import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import ts from 'typescript';
import {
  type ChangedRegion,
  type CoverageEvidence,
  type FunctionSpan,
  type LineSpan,
  type MutationExclusionReason,
  type MutationSelectionLedger,
  type MutationTarget,
  type MutationTargetResolution,
  type ExecutionReceipt,
  type MutationResult,
  type MutationSite,
  changedFileSet,
  collectSourceFiles,
  compilerOptionsForRepoFile,
  digestObject,
  ensureDir,
  fileDigest,
  findCoverageEvidence,
  listFiles,
  matchPattern,
  normalizePath,
  readJson,
  runtimeMirrorCandidates,
  writeJson
} from '../../evidence-model/src/index';

export interface MutationManifest {
  version: '2';
  entries: Record<string, MutationResult>;
}

export interface MutationOptions {
  repoRoot: string;
  testCommand: string[];
  sourceFiles?: string[];
  changedFiles?: string[];
  changedRegions?: ChangedRegion[];
  coverage?: CoverageEvidence[];
  coveredOnly?: boolean;
  runtimeMirrorRoots?: string[];
  manifestPath?: string;
  timeoutMs?: number;
  maxSites?: number;
  /** Stop launching new mutants once the mutant phase has run this long; the first mutant always runs. */
  maxDurationMs?: number;
  targets?: MutationTarget[];
  functions?: FunctionSpan[];
}

export interface MutationRun {
  sites: MutationSite[];
  results: MutationResult[];
  score: number;
  killed: number;
  survived: number;
  baseline: ExecutionReceipt;
  executionFingerprint: string;
  selection: MutationSelectionLedger;
}

type MutationErrorKind = NonNullable<MutationResult['errorKind']>;

interface CommandOutcome {
  receipt: ExecutionReceipt;
  errorKind?: MutationErrorKind | undefined;
}

interface RepoFileDigest {
  filePath: string;
  digest: string;
}

interface MutationWorkspace {
  tempDir: string;
  snapshot: Map<string, string>;
}

// Bumped when mutant-workspace or outcome semantics change so cached results from older versions are not reused
// (9: a signal-killed test process is an error, not a kill).
const MUTATION_RUNTIME_VERSION = '9';
const SANITIZED_MUTATION_ENV_KEYS = ['NODE_TEST_CONTEXT'];
const MUTATION_WORKSPACE_EXCLUDES = ['.git', 'node_modules', '.ts-quality'];
const MUTATION_WORKSPACE_EXCLUDE_SET = new Set(MUTATION_WORKSPACE_EXCLUDES);

function mutationCommandEnv(baseEnv: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = { ...baseEnv };
  for (const key of SANITIZED_MUTATION_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function mutationEnvFingerprint(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([, value]) => typeof value === 'string' && value.length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  ) as Record<string, string>;
}

function coverageForLine(filePath: string, line: number, coverage: CoverageEvidence[]): boolean {
  const entry = findCoverageEvidence(filePath, coverage);
  if (!entry) {
    return false;
  }
  return (entry.lines[String(line)] ?? 0) > 0;
}

function mutationId(filePath: string, span: { startLine: number; endLine: number; startOffset: number; endOffset: number }, original: string, replacement: string): string {
  return digestObject({ filePath: normalizePath(filePath), span, original, replacement });
}

const BINARY_OPERATOR_MUTATIONS = new Map<ts.SyntaxKind, { replacement: string; description: string }>([
  [ts.SyntaxKind.EqualsEqualsEqualsToken, { replacement: '!==', description: 'strict equality inversion' }],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, { replacement: '===', description: 'strict inequality inversion' }],
  [ts.SyntaxKind.EqualsEqualsToken, { replacement: '!=', description: 'loose equality inversion' }],
  [ts.SyntaxKind.ExclamationEqualsToken, { replacement: '==', description: 'loose inequality inversion' }],
  [ts.SyntaxKind.GreaterThanToken, { replacement: '>=', description: 'greater-than relaxation' }],
  [ts.SyntaxKind.GreaterThanEqualsToken, { replacement: '>', description: 'greater-than tightening' }],
  [ts.SyntaxKind.LessThanToken, { replacement: '<=', description: 'less-than relaxation' }],
  [ts.SyntaxKind.LessThanEqualsToken, { replacement: '<', description: 'less-than tightening' }],
  [ts.SyntaxKind.PlusToken, { replacement: '-', description: 'addition to subtraction' }],
  [ts.SyntaxKind.MinusToken, { replacement: '+', description: 'subtraction to addition' }],
  [ts.SyntaxKind.AsteriskToken, { replacement: '/', description: 'multiplication to division' }],
  [ts.SyntaxKind.AmpersandAmpersandToken, { replacement: '||', description: 'and to or' }],
  [ts.SyntaxKind.BarBarToken, { replacement: '&&', description: 'or to and' }]
]);

function isAmbientDeclaration(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword);
}

function isClassExtendsExpression(node: ts.Node): boolean {
  return ts.isExpressionWithTypeArguments(node)
    && ts.isHeritageClause(node.parent)
    && node.parent.token === ts.SyntaxKind.ExtendsKeyword
    && ts.isClassLike(node.parent.parent);
}

/** Syntax erased at compile time; mutating it cannot change runtime behavior. A class `extends` expression runs. */
function isTypeOnlySyntax(node: ts.Node): boolean {
  return (ts.isTypeNode(node) && !isClassExtendsExpression(node))
    || ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)
    || ts.isTypeParameterDeclaration(node)
    || isAmbientDeclaration(node);
}

function isPropertyName(node: ts.Node): boolean {
  const parent = node.parent as (ts.Node & { name?: ts.Node; propertyName?: ts.Node }) | undefined;
  return parent?.name === node || parent?.propertyName === node;
}

// Pairs that would lex as a different token (a comment, `++`, `--`) if a replacement touched its neighbor.
const MERGING_TOKEN_PAIRS = new Set(['//', '/*', '*/', '++', '--']);

function mergesWithNeighbors(sourceText: string, startOffset: number, endOffset: number, replacement: string): boolean {
  const before = sourceText[startOffset - 1] ?? '';
  const after = sourceText[endOffset] ?? '';
  return MERGING_TOKEN_PAIRS.has(`${before}${replacement.slice(0, 1)}`) || MERGING_TOKEN_PAIRS.has(`${replacement.slice(-1)}${after}`);
}

function conditionOf(node: ts.Node): { expression: ts.Expression; description: string } | undefined {
  if (ts.isIfStatement(node)) {
    return { expression: node.expression, description: 'if condition inversion' };
  }
  if (ts.isConditionalExpression(node)) {
    return { expression: node.condition, description: 'conditional expression inversion' };
  }
  if (ts.isWhileStatement(node)) {
    return { expression: node.expression, description: 'while condition inversion' };
  }
  if (ts.isDoStatement(node)) {
    return { expression: node.expression, description: 'do-while condition inversion' };
  }
  if (ts.isForStatement(node) && node.condition) {
    return { expression: node.condition, description: 'for condition inversion' };
  }
  return undefined;
}

/** Every valid mutation site in the file, before change-scope, coverage, target or budget selection. */
function candidateMutationSites(sourceText: string, filePath: string): MutationSite[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const sites: MutationSite[] = [];
  if (sourceFile.isDeclarationFile) {
    return sites;
  }

  function considerRange(startOffset: number, endOffset: number, replacement: string, operator: string, description: string): void {
    if (mergesWithNeighbors(sourceText, startOffset, endOffset, replacement)) {
      return;
    }
    const startLine = sourceFile.getLineAndCharacterOfPosition(startOffset).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(endOffset).line + 1;
    const span = { startLine, endLine, startOffset, endOffset };
    const original = sourceText.slice(startOffset, endOffset);
    sites.push({
      id: mutationId(filePath, span, original, replacement),
      filePath: normalizePath(filePath),
      span: { startLine: span.startLine, endLine: span.endLine },
      startOffset,
      endOffset,
      operator,
      original,
      replacement,
      description
    });
  }

  function consider(node: ts.Node, replacement: string, operator: string, description: string): void {
    considerRange(node.getStart(sourceFile), node.end, replacement, operator, description);
  }

  function visit(node: ts.Node): void {
    if (isTypeOnlySyntax(node)) {
      return;
    }
    if (ts.isBinaryExpression(node)) {
      const mutation = BINARY_OPERATOR_MUTATIONS.get(node.operatorToken.kind);
      if (mutation) {
        consider(node.operatorToken, mutation.replacement, node.operatorToken.getText(sourceFile), mutation.description);
      }
    } else if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)) {
      const operator = node.operator === ts.SyntaxKind.PlusPlusToken ? '++' : '--';
      const replacement = operator === '++' ? '--' : '++';
      const startOffset = ts.isPrefixUnaryExpression(node) ? node.getStart(sourceFile) : node.end - 2;
      considerRange(startOffset, startOffset + 2, replacement, operator, operator === '++' ? 'increment to decrement' : 'decrement to increment');
    } else if (node.kind === ts.SyntaxKind.TrueKeyword) {
      consider(node, 'false', 'true', 'boolean flip true->false');
    } else if (node.kind === ts.SyntaxKind.FalseKeyword) {
      consider(node, 'true', 'false', 'boolean flip false->true');
    } else if (ts.isNumericLiteral(node) && (node.text === '0' || node.text === '1') && /^[01]$/.test(node.getText(sourceFile)) && !isPropertyName(node)) {
      const original = node.getText(sourceFile);
      consider(node, original === '0' ? '1' : '0', original, original === '0' ? 'numeric constant 0->1' : 'numeric constant 1->0');
    }
    const condition = conditionOf(node);
    if (condition) {
      const expression = condition.expression;
      const replacement = ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.ExclamationToken
        ? expression.operand.getText(sourceFile)
        : `!(${expression.getText(sourceFile)})`;
      consider(expression, replacement, 'condition', condition.description);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return sites;
}

interface ScopeContext {
  changed: Set<string>;
  changedRegions: ChangedRegion[];
  coverage: CoverageEvidence[];
  coveredOnly: boolean;
}

/** Why an in-scope file's site is not eligible: outside the changed hunks or, with coveredOnly, without covered LCOV evidence. */
function eligibilityExclusion(site: MutationSite, context: ScopeContext): 'outside-changed-hunks' | 'uncovered' | undefined {
  const fileRegions = context.changedRegions.filter((item) => normalizePath(item.filePath) === site.filePath);
  if (fileRegions.length > 0 && !fileRegions.some((region) => region.span.startLine <= site.span.endLine && region.span.endLine >= site.span.startLine)) {
    return 'outside-changed-hunks';
  }
  if (context.coveredOnly && !coverageForLine(site.filePath, site.span.startLine, context.coverage)) {
    return 'uncovered';
  }
  return undefined;
}

function inChangedScope(filePath: string, changed: Set<string>): boolean {
  return changed.size === 0 || changed.has(normalizePath(filePath));
}

export function discoverMutationSites(sourceText: string, filePath: string, coverage: CoverageEvidence[] = [], changedFiles: string[] = [], changedRegions: ChangedRegion[] = [], coveredOnly = false): MutationSite[] {
  const context: ScopeContext = { changed: changedFileSet(changedFiles, changedRegions), changedRegions, coverage, coveredOnly };
  if (!inChangedScope(filePath, context.changed)) {
    return [];
  }
  return candidateMutationSites(sourceText, filePath).filter((site) => eligibilityExclusion(site, context) === undefined);
}

export type { FunctionSpan, MutationExclusionReason, MutationSelectionLedger, MutationTarget, MutationTargetResolution };

export interface MutationSelection {
  sites: MutationSite[];
  ledger: MutationSelectionLedger;
}

export interface MutationSelectionOptions {
  repoRoot: string;
  sourceFiles?: string[];
  changedFiles?: string[];
  changedRegions?: ChangedRegion[];
  coverage?: CoverageEvidence[];
  coveredOnly?: boolean;
  targets?: MutationTarget[];
  functions?: FunctionSpan[];
  maxSites?: number;
  maxDurationMs?: number;
}

const DEFAULT_MUTATION_SOURCE_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'];

function targetError(spec: string, why: string): Error {
  return new Error(`Invalid mutation target "${spec}": ${why}. Use file:<path>, span:<path>:<start>-<end>, symbol:<path>#<kind:name>[@<start>-<end>] or site:<id>.`);
}

function lineRange(spec: string, text: string): { startLine: number; endLine: number } {
  const match = /^([1-9]\d*)-([1-9]\d*)$/.exec(text);
  if (!match || Number(match[1]) > Number(match[2])) {
    throw targetError(spec, 'expected a line range <start>-<end> with start <= end');
  }
  return { startLine: Number(match[1]), endLine: Number(match[2]) };
}

export function parseMutationTarget(spec: string): MutationTarget {
  const colon = spec.indexOf(':');
  const kind = colon > 0 ? spec.slice(0, colon) : '';
  const rest = colon > 0 ? spec.slice(colon + 1) : '';
  if (!rest) {
    throw targetError(spec, 'missing kind or value');
  }
  if (kind === 'file') {
    return { kind, filePath: normalizePath(rest) };
  }
  if (kind === 'site') {
    return { kind, siteId: rest };
  }
  if (kind === 'span') {
    const separator = rest.lastIndexOf(':');
    if (separator <= 0) {
      throw targetError(spec, 'expected span:<path>:<start>-<end>');
    }
    return { kind, filePath: normalizePath(rest.slice(0, separator)), ...lineRange(spec, rest.slice(separator + 1)) };
  }
  if (kind === 'symbol') {
    const hash = rest.indexOf('#');
    if (hash <= 0 || hash === rest.length - 1) {
      throw targetError(spec, 'expected symbol:<path>#<kind:name>');
    }
    const filePath = normalizePath(rest.slice(0, hash));
    const symbolText = rest.slice(hash + 1);
    // Only a trailing @<start>-<end> is a span; names such as arrow:<anonymous@6> keep their @.
    const at = /@(\d+-\d+)$/.exec(symbolText);
    return at && at.index > 0
      ? { kind, filePath, symbol: symbolText.slice(0, at.index), ...lineRange(spec, at[1] as string) }
      : { kind, filePath, symbol: symbolText };
  }
  throw targetError(spec, `unknown kind "${kind}"`);
}

function spanContains(outer: LineSpan, inner: LineSpan): boolean {
  return outer.startLine <= inner.startLine && inner.endLine <= outer.endLine;
}

interface FunctionNodeRange {
  kind: string;
  span: LineSpan;
  start: number;
  end: number;
}

function functionKind(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isMethodDeclaration(node)) return 'method';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isGetAccessorDeclaration(node)) return 'get';
  if (ts.isSetAccessorDeclaration(node)) return 'set';
  if (ts.isArrowFunction(node)) return 'arrow';
  if (ts.isFunctionExpression(node)) return 'function-expression';
  return undefined;
}

/** Executable function bodies with their character ranges, so ownership is decided by offsets, not shared lines. */
function functionNodeRanges(sourceText: string, filePath: string): FunctionNodeRange[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const ranges: FunctionNodeRange[] = [];
  const visit = (node: ts.Node): void => {
    if (isAmbientDeclaration(node)) {
      return;
    }
    const kind = functionKind(node);
    if (kind && (node as ts.FunctionLikeDeclaration).body) {
      const start = node.getStart(sourceFile);
      ranges.push({
        kind,
        start,
        end: node.end,
        span: { startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1, endLine: sourceFile.getLineAndCharacterOfPosition(node.end).line + 1 }
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return ranges;
}

function innermostFunction(ranges: FunctionNodeRange[], offset: number): FunctionNodeRange | undefined {
  return ranges
    .filter((range) => range.start <= offset && offset < range.end)
    .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
}

interface ResolvedTarget {
  resolution: MutationTargetResolution;
  matches: (site: MutationSite) => boolean;
  nested: (site: MutationSite) => boolean;
}

interface TargetContext {
  repoRoot: string;
  sourceFiles: Set<string>;
  changed: Set<string>;
  functions: FunctionSpan[];
  discovered: MutationSite[];
  sourceTexts: Map<string, string>;
}

function siteExistsOutsideScope(target: { siteId: string }, context: TargetContext): boolean {
  for (const filePath of context.sourceFiles) {
    if (inChangedScope(filePath, context.changed)) {
      continue;
    }
    const text = fs.readFileSync(path.join(context.repoRoot, filePath), 'utf8');
    if (candidateMutationSites(text, filePath).some((site) => site.id === target.siteId)) {
      return true;
    }
  }
  return false;
}

function resolveTarget(target: MutationTarget, context: TargetContext): ResolvedTarget {
  const none = { matches: () => false, nested: () => false };
  const unresolved = (reason: NonNullable<MutationTargetResolution['reason']>): ResolvedTarget => ({ resolution: { target, status: 'unresolved', reason, matchedSites: 0, selectedSites: 0 }, ...none });
  const resolved = (matches: ResolvedTarget['matches'], nested: ResolvedTarget['nested'] = () => false): ResolvedTarget => ({ resolution: { target, status: 'resolved', matchedSites: 0, selectedSites: 0 }, matches, nested });
  if (target.kind === 'site') {
    if (context.discovered.some((site) => site.id === target.siteId)) {
      return resolved((site) => site.id === target.siteId);
    }
    return unresolved(siteExistsOutsideScope(target, context) ? 'outside-changed-scope' : 'stale-site');
  }
  const filePath = normalizePath(target.filePath);
  if (!context.sourceFiles.has(filePath)) {
    return unresolved('not-a-source-file');
  }
  if (!inChangedScope(filePath, context.changed)) {
    return unresolved('outside-changed-scope');
  }
  if (target.kind === 'file') {
    return resolved((site) => site.filePath === filePath);
  }
  if (target.kind === 'span') {
    return resolved((site) => site.filePath === filePath && spanContains(target, site.span));
  }
  const candidates = context.functions.filter((item) => normalizePath(item.filePath) === filePath && item.symbol === target.symbol);
  if (candidates.length === 0) {
    return unresolved('not-found');
  }
  const startLine = target.startLine;
  const endLine = target.endLine;
  const exact = startLine !== undefined && endLine !== undefined
    ? candidates.filter((item) => item.span.startLine === startLine && item.span.endLine === endLine)
    : candidates;
  if (exact.length === 0) {
    return unresolved('stale-span');
  }
  if (exact.length > 1) {
    return unresolved('ambiguous');
  }
  const owner = exact[0] as FunctionSpan;
  const kind = target.symbol.slice(0, target.symbol.indexOf(':'));
  const ranges = functionNodeRanges(context.sourceTexts.get(filePath) ?? '', filePath);
  const ownerRanges = ranges.filter((range) => range.kind === kind && range.span.startLine === owner.span.startLine && range.span.endLine === owner.span.endLine);
  if (ownerRanges.length !== 1) {
    // Two functions of the same kind on identical lines cannot be told apart by the inventory.
    return unresolved(ownerRanges.length === 0 ? 'not-found' : 'ambiguous');
  }
  const ownerRange = ownerRanges[0] as FunctionNodeRange;
  // A site belongs to the function whose body most tightly encloses it; nested and sibling functions own their own sites.
  const ownedBy = (site: MutationSite): FunctionNodeRange | undefined => (site.filePath === filePath ? innermostFunction(ranges, site.startOffset) : undefined);
  return resolved(
    (site) => ownedBy(site) === ownerRange,
    (site) => site.filePath === filePath && ownerRange.start <= site.startOffset && site.startOffset < ownerRange.end && ownedBy(site) !== ownerRange
  );
}

/**
 * Inert mutation selection: discovers, filters and budgets sites and records why each was or was not selected.
 * Runs no command and writes nothing.
 */
export function selectMutationSites(options: MutationSelectionOptions): MutationSelection {
  const sourceFiles = (options.sourceFiles ?? collectSourceFiles(options.repoRoot, DEFAULT_MUTATION_SOURCE_PATTERNS))
    .filter((filePath) => !matchPattern('**/*.d.ts', filePath))
    .map((filePath) => normalizePath(filePath));
  const changedRegions = options.changedRegions ?? [];
  const context: ScopeContext = {
    changed: changedFileSet(options.changedFiles ?? [], changedRegions),
    changedRegions,
    coverage: options.coverage ?? [],
    coveredOnly: options.coveredOnly ?? false
  };
  const sourceTexts = new Map<string, string>();
  const discovered = sourceFiles
    .filter((filePath) => inChangedScope(filePath, context.changed))
    .flatMap((filePath) => {
      const text = fs.readFileSync(path.join(options.repoRoot, filePath), 'utf8');
      sourceTexts.set(filePath, text);
      return candidateMutationSites(text, filePath);
    });
  const excluded: MutationSelectionLedger['excluded'] = [];
  const exclude = (site: MutationSite, reason: MutationExclusionReason): void => {
    excluded.push({ siteId: site.id, filePath: site.filePath, line: site.span.startLine, reason });
  };
  const eligible = discovered.filter((site) => {
    const reason = eligibilityExclusion(site, context);
    if (reason) {
      exclude(site, reason);
    }
    return reason === undefined;
  });

  const targets = options.targets ?? [];
  const resolvedTargets = targets.map((target) => resolveTarget(target, { repoRoot: options.repoRoot, sourceFiles: new Set(sourceFiles), changed: context.changed, functions: options.functions ?? [], discovered, sourceTexts }));
  let matched = eligible;
  if (targets.length > 0) {
    matched = eligible.filter((site) => {
      if (resolvedTargets.some((item) => item.matches(site))) {
        return true;
      }
      exclude(site, resolvedTargets.some((item) => item.nested(site)) ? 'nested-function' : 'not-targeted');
      return false;
    });
  }
  const maxSites = typeof options.maxSites === 'number' ? options.maxSites : undefined;
  const sites = maxSites === undefined ? matched : matched.slice(0, maxSites);
  for (const site of matched.slice(sites.length)) {
    exclude(site, 'budget-sites');
  }
  for (const item of resolvedTargets) {
    if (item.resolution.status !== 'resolved') {
      continue;
    }
    item.resolution.matchedSites = matched.filter((site) => item.matches(site)).length;
    item.resolution.selectedSites = sites.filter((site) => item.matches(site)).length;
    if (item.resolution.matchedSites === 0) {
      // The identity exists, but nothing in it is eligible (outside the changed hunks, uncovered or nested only).
      item.resolution.status = 'unresolved';
      item.resolution.reason = 'no-eligible-sites';
    }
  }
  const order = new Map(discovered.map((site, index) => [site.id, index]));
  excluded.sort((left, right) => (order.get(left.siteId) ?? 0) - (order.get(right.siteId) ?? 0));
  return {
    sites,
    ledger: {
      version: '1',
      policy: { coveredOnly: context.coveredOnly, maxSites: maxSites ?? null, maxDurationMs: options.maxDurationMs ?? null, targets },
      counts: { discovered: discovered.length, eligible: eligible.length, selected: sites.length, excluded: excluded.length, executed: 0, cached: 0, unobserved: 0 },
      targets: resolvedTargets.map((item) => item.resolution),
      excluded,
      complete: false
    }
  };
}

export function applyMutation(sourceText: string, site: MutationSite): string {
  return `${sourceText.slice(0, site.startOffset)}${site.replacement}${sourceText.slice(site.endOffset)}`;
}

function copyRecursive(sourceDir: string, destinationDir: string, exclude: Set<string>): void {
  ensureDir(destinationDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (exclude.has(entry.name)) {
      continue;
    }
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(sourcePath, destinationPath, exclude);
    } else {
      ensureDir(path.dirname(destinationPath));
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function hasSyntaxErrors(filePath: string, sourceText: string): boolean {
  const transpileResult = ts.transpileModule(sourceText, {
    fileName: filePath,
    compilerOptions: {
      allowJs: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS
    },
    reportDiagnostics: true
  });
  return (transpileResult.diagnostics ?? []).some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
}

function stdioText(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}

function commandDetails(result: ReturnType<typeof spawnSync>): string {
  return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}

function requiredExecutable(command: string[]): string {
  const executable = command[0];
  if (!executable) {
    throw new Error('Mutation test command must contain an executable argument.');
  }
  return executable;
}

function runCommand(cwd: string, testCommand: string[], timeoutMs: number): CommandOutcome {
  const started = Date.now();
  const result = spawnSync(requiredExecutable(testCommand), testCommand.slice(1), {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: process.platform === 'win32',
    env: mutationCommandEnv()
  });
  const durationMs = Date.now() - started;
  const exitCode = typeof result.status === 'number' ? result.status : undefined;
  if (result.error) {
    const error = result.error as { code?: string; message?: string };
    const timedOut = error.code === 'ETIMEDOUT';
    return {
      receipt: { status: timedOut ? 'timeout' : 'error', exitCode, durationMs, details: error.message ?? 'unknown test command error' },
      errorKind: timedOut ? 'timeout' : error.code === 'ENOENT' ? 'command-missing' : 'spawn'
    };
  }
  if (result.status === null && result.signal) {
    // A process killed by a signal (OOM killer, external kill) never reached an assertion verdict.
    return {
      receipt: { status: 'error', durationMs, details: `test command terminated by signal ${result.signal}. ${commandDetails(result)}`.trim().slice(0, 280) },
      errorKind: 'signal'
    };
  }
  return { receipt: { status: result.status === 0 ? 'pass' : 'fail', exitCode, durationMs, details: commandDetails(result) } };
}

function runCommandReceipt(cwd: string, testCommand: string[], timeoutMs: number): ExecutionReceipt {
  return runCommand(cwd, testCommand, timeoutMs).receipt;
}

function canonicalRuntimeMirrorRoots(runtimeMirrorRoots: string[] | undefined): string[] {
  const seen = new Set<string>();
  const roots: string[] = [];
  for (const candidate of runtimeMirrorRoots ?? ['dist']) {
    const normalized = normalizePath(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    roots.push(normalized);
  }
  return roots.length > 0 ? roots : ['dist'];
}

function mutationFingerprintFilePaths(repoRoot: string): string[] {
  return listFiles(repoRoot, { excludeDirs: MUTATION_WORKSPACE_EXCLUDES })
    .filter((filePath) => {
      if (filePath.split('/').some((segment) => MUTATION_WORKSPACE_EXCLUDE_SET.has(segment))) {
        return false;
      }
      const absolutePath = path.join(repoRoot, filePath);
      try {
        return fs.lstatSync(absolutePath).isFile();
      } catch {
        return false;
      }
    });
}

function repoFileDigests(repoRoot: string): RepoFileDigest[] {
  return mutationFingerprintFilePaths(repoRoot)
    .map((filePath) => ({ filePath, digest: fileDigest(path.join(repoRoot, filePath)) }));
}

function buildExecutionFingerprint(testCommand: string[], runtimeMirrorRoots: string[], repoFiles: RepoFileDigest[]): string {
  const effectiveEnv = mutationCommandEnv();
  return digestObject({
    mutationRuntimeVersion: MUTATION_RUNTIME_VERSION,
    testCommand,
    runtimeMirrorRoots,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    env: mutationEnvFingerprint(effectiveEnv),
    repoFiles
  });
}

function manifestKey(repoRoot: string, site: MutationSite, executionFingerprint: string): string {
  const absolutePath = path.join(repoRoot, site.filePath);
  const fileText = fs.readFileSync(absolutePath, 'utf8');
  return digestObject({ site, sourceDigest: digestObject(fileText), executionFingerprint });
}

function loadManifest(filePath: string | undefined): MutationManifest {
  if (!filePath || !fs.existsSync(filePath)) {
    return { version: '2', entries: {} };
  }
  const manifest = readJson<MutationManifest>(filePath);
  return manifest.version === '2' ? manifest : { version: '2', entries: {} };
}

function saveManifest(filePath: string | undefined, manifest: MutationManifest): void {
  if (!filePath) {
    return;
  }
  writeJson(filePath, manifest);
}

function linkSharedPath(sourcePath: string, destinationPath: string): void {
  if (!fs.existsSync(sourcePath) || fs.existsSync(destinationPath)) {
    return;
  }
  const type = fs.statSync(sourcePath).isDirectory() ? 'junction' : 'file';
  fs.symlinkSync(sourcePath, destinationPath, type);
}

/** Repo-relative node_modules directories, including nested workspace-package ones, without descending into any node_modules. */
function nodeModulesRoots(repoRoot: string, currentDir = repoRoot): string[] {
  const roots: string[] = [];
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    // A node_modules that is itself a symlink (shared install dirs, container volumes) is still the install root.
    const symlinkedNodeModules = entry.name === 'node_modules' && entry.isSymbolicLink() && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
    if (!entry.isDirectory() && !symlinkedNodeModules) {
      continue;
    }
    if (entry.name === 'node_modules') {
      roots.push(normalizePath(path.relative(repoRoot, absolutePath)));
      continue;
    }
    if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name)) {
      continue;
    }
    roots.push(...nodeModulesRoots(repoRoot, absolutePath));
  }
  return roots;
}

/** Repo-relative path of a workspace package a node_modules link resolves to, or undefined for third-party targets. */
function workspaceLinkTarget(realRepoRoot: string, linkPath: string): string | undefined {
  let realTarget: string;
  try {
    realTarget = fs.realpathSync(linkPath);
  } catch {
    return undefined;
  }
  const relativeTarget = path.relative(realRepoRoot, realTarget);
  if (relativeTarget === '' || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    return undefined;
  }
  return relativeTarget.split(path.sep).includes('node_modules') ? undefined : relativeTarget;
}

/**
 * Mirrors one node_modules directory entry by entry. Third-party entries link to the real repo, but workspace-package
 * links (pnpm `packages/b/node_modules/@scope/a -> ../../../a`, npm `node_modules/@scope/a -> ../packages/a`) are
 * re-pointed at the mutant workspace so tests that import a sibling package by name exercise the mutated copy.
 */
function mirrorNodeModules(repoRoot: string, realRepoRoot: string, tempDir: string, relativeDir: string): void {
  const sourceDir = path.join(repoRoot, relativeDir);
  const destinationDir = path.join(tempDir, relativeDir);
  fs.mkdirSync(destinationDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const entryRelative = path.join(relativeDir, entry.name);
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      mirrorNodeModules(repoRoot, realRepoRoot, tempDir, entryRelative);
      continue;
    }
    const workspaceTarget = entry.isSymbolicLink() ? workspaceLinkTarget(realRepoRoot, path.join(repoRoot, entryRelative)) : undefined;
    if (workspaceTarget !== undefined) {
      fs.symlinkSync(path.join(tempDir, workspaceTarget), path.join(tempDir, entryRelative), 'junction');
      continue;
    }
    linkSharedPath(path.join(repoRoot, entryRelative), path.join(tempDir, entryRelative));
  }
}

// Workspace managers such as pnpm keep package-only dependencies in each package's own node_modules,
// so linking only the root one would make mutants fail on module resolution and count as killed.
function hydrateTempRuntime(repoRoot: string, tempDir: string): void {
  const realRepoRoot = fs.realpathSync(repoRoot);
  for (const relativePath of nodeModulesRoots(repoRoot)) {
    if (fs.existsSync(path.dirname(path.join(tempDir, relativePath)))) {
      mirrorNodeModules(repoRoot, realRepoRoot, tempDir, relativePath);
    }
  }
}

function clearExcludedWorkspaceEntries(rootDir: string, currentDir: string): void {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    const excluded = MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath);
    if (excluded) {
      if (entry.name === 'node_modules' || relativePath === 'node_modules') {
        continue;
      }
      fs.rmSync(absolutePath, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) {
      clearExcludedWorkspaceEntries(rootDir, absolutePath);
    }
  }
}

function walkMutationWorkspace(rootDir: string, currentDir: string, visit: (absolutePath: string, relativePath: string, kind: 'file' | 'symlink') => void): void {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    if (entry.isDirectory()) {
      if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
        continue;
      }
      walkMutationWorkspace(rootDir, absolutePath, visit);
      continue;
    }
    if (entry.isSymbolicLink() && (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath))) {
      continue;
    }
    visit(absolutePath, relativePath, entry.isSymbolicLink() ? 'symlink' : 'file');
  }
}

function restoreWorkspaceFile(repoRoot: string, tempDir: string, relativePath: string): void {
  const sourcePath = path.join(repoRoot, relativePath);
  const destinationPath = path.join(tempDir, relativePath);
  ensureDir(path.dirname(destinationPath));
  fs.rmSync(destinationPath, { recursive: true, force: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

function pruneEmptyDirectories(rootDir: string, currentDir: string): boolean {
  let empty = true;
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, absolutePath));
    if (entry.isDirectory()) {
      if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
        empty = false;
        continue;
      }
      if (pruneEmptyDirectories(rootDir, absolutePath)) {
        fs.rmdirSync(absolutePath);
        continue;
      }
      empty = false;
      continue;
    }
    empty = false;
  }
  return currentDir !== rootDir && empty;
}

function prepareMutationWorkspace(repoRoot: string, repoFiles: RepoFileDigest[]): MutationWorkspace {
  const tempRoot = path.join(repoRoot, '.ts-quality', 'tmp-mutants');
  ensureDir(tempRoot);
  const tempDir = fs.mkdtempSync(path.join(tempRoot, 'mutant-'));
  copyRecursive(repoRoot, tempDir, MUTATION_WORKSPACE_EXCLUDE_SET);
  hydrateTempRuntime(repoRoot, tempDir);
  return {
    tempDir,
    snapshot: new Map(repoFiles.map(({ filePath, digest }) => [normalizePath(filePath), digest]))
  };
}

function resetMutationWorkspace(repoRoot: string, workspace: MutationWorkspace): void {
  clearExcludedWorkspaceEntries(workspace.tempDir, workspace.tempDir);
  const seen = new Set<string>();
  walkMutationWorkspace(workspace.tempDir, workspace.tempDir, (absolutePath, relativePath, kind) => {
    const normalizedPath = normalizePath(relativePath);
    seen.add(normalizedPath);
    const expectedDigest = workspace.snapshot.get(normalizedPath);
    if (!expectedDigest) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
      return;
    }
    if (kind === 'symlink' || fileDigest(absolutePath) !== expectedDigest) {
      restoreWorkspaceFile(repoRoot, workspace.tempDir, normalizedPath);
    }
  });
  for (const relativePath of workspace.snapshot.keys()) {
    if (!seen.has(relativePath)) {
      restoreWorkspaceFile(repoRoot, workspace.tempDir, relativePath);
    }
  }
  pruneEmptyDirectories(workspace.tempDir, workspace.tempDir);
}

function disposeMutationWorkspace(workspace: MutationWorkspace | undefined): void {
  if (!workspace) {
    return;
  }
  fs.rmSync(workspace.tempDir, { recursive: true, force: true });
}

function transpileRuntimeMirrorSource(repoRoot: string, site: MutationSite, mutatedSource: string): string {
  const compilerOptions = compilerOptionsForRepoFile(repoRoot, site.filePath) ?? {};
  const transpiled = ts.transpileModule(mutatedSource, {
    fileName: site.filePath,
    compilerOptions: {
      ...compilerOptions,
      target: compilerOptions.target ?? ts.ScriptTarget.ES2020,
      module: compilerOptions.module ?? ts.ModuleKind.CommonJS,
      sourceMap: false,
      inlineSourceMap: false,
      inlineSources: false,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false
    },
    reportDiagnostics: false
  });
  return transpiled.outputText;
}

function writeRuntimeMirrors(repoRoot: string, tempDir: string, site: MutationSite, mutatedSource: string, runtimeMirrorRoots: string[]): void {
  const extension = path.extname(site.filePath);
  const runtimeSource = extension === '.ts' || extension === '.tsx'
    ? transpileRuntimeMirrorSource(repoRoot, site, mutatedSource)
    : mutatedSource;
  for (const candidate of runtimeMirrorCandidates(site.filePath, runtimeMirrorRoots)) {
    const mirrorPath = path.join(tempDir, candidate);
    if (!fs.existsSync(mirrorPath) || !fs.statSync(mirrorPath).isFile()) {
      continue;
    }
    fs.writeFileSync(mirrorPath, runtimeSource, 'utf8');
  }
}

function assertionHintForMutation(site: MutationSite): string {
  const location = `${site.filePath}:${site.span.startLine}`;
  if (site.operator.includes('equality') || ['===', '!=='].includes(site.original)) {
    return `Assert both equality and inequality behavior around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
  }
  if (site.operator.includes('greater-than') || site.operator.includes('less-than') || ['>', '>=', '<', '<='].includes(site.original)) {
    return `Add a boundary assertion around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
  }
  if (site.operator.includes('boolean') || site.original === 'true' || site.original === 'false') {
    return `Assert the opposite boolean branch around ${location}; this mutant flipped ${site.original} to ${site.replacement}.`;
  }
  if (site.operator.includes('and to or') || site.operator.includes('or to and') || ['&&', '||'].includes(site.original)) {
    return `Assert the combined-condition case around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
  }
  return `Add or tighten a focused assertion around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
}

function mutationResultForSite(site: MutationSite, input: { status: MutationResult['status']; durationMs: number; details?: string; mutatedSource?: string; testCommand: string[]; origin?: MutationResult['origin']; errorKind?: MutationErrorKind | undefined }): MutationResult {
  const result: MutationResult = {
    kind: 'mutation-result',
    siteId: site.id,
    filePath: site.filePath,
    status: input.status,
    durationMs: input.durationMs,
    span: site.span,
    startOffset: site.startOffset,
    endOffset: site.endOffset,
    operator: site.operator,
    original: site.original,
    replacement: site.replacement,
    testCommand: [...input.testCommand],
    assertionHint: assertionHintForMutation(site)
  };
  if (input.details) {
    result.details = input.details;
  }
  if (input.mutatedSource) {
    result.mutated = input.mutatedSource.slice(site.startOffset, site.startOffset + site.replacement.length);
  }
  if (input.origin) {
    result.origin = input.origin;
  }
  if (input.errorKind) {
    result.errorKind = input.errorKind;
  }
  return result;
}

function runSingleMutation(repoRoot: string, workspace: MutationWorkspace, site: MutationSite, mutatedSource: string, testCommand: string[], timeoutMs: number, runtimeMirrorRoots: string[]): MutationResult {
  if (hasSyntaxErrors(site.filePath, mutatedSource)) {
    return mutationResultForSite(site, {
      status: 'invalid',
      durationMs: 0,
      details: 'Mutation produced syntax errors',
      mutatedSource,
      testCommand,
      origin: 'executed'
    });
  }

  try {
    const targetPath = path.join(workspace.tempDir, site.filePath);
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, mutatedSource, 'utf8');
    writeRuntimeMirrors(repoRoot, workspace.tempDir, site, mutatedSource, runtimeMirrorRoots);
    const { receipt, errorKind } = runCommand(workspace.tempDir, testCommand, timeoutMs);
    return mutationResultForSite(site, {
      status: receipt.status === 'pass' ? 'survived' : receipt.status === 'fail' ? 'killed' : 'error',
      durationMs: receipt.durationMs,
      details: receipt.status === 'timeout' ? `test command timed out: ${receipt.details}` : receipt.details,
      mutatedSource,
      testCommand,
      origin: 'executed',
      errorKind
    });
  } finally {
    resetMutationWorkspace(repoRoot, workspace);
  }
}

/** Killed, survived and invalid outcomes are reusable for the same fingerprint; infrastructure errors are retried, never cached. */
function cacheableResult(result: MutationResult): boolean {
  return result.status === 'killed' || result.status === 'survived' || result.status === 'invalid';
}

export function runMutations(options: MutationOptions): MutationRun {
  const coverage = options.coverage ?? [];
  const selectionOptions: MutationSelectionOptions = {
    repoRoot: options.repoRoot,
    changedFiles: options.changedFiles ?? [],
    changedRegions: options.changedRegions ?? [],
    coverage,
    coveredOnly: options.coveredOnly ?? false
  };
  if (options.sourceFiles) {
    selectionOptions.sourceFiles = options.sourceFiles;
  }
  if (options.targets) {
    selectionOptions.targets = options.targets;
  }
  if (options.functions) {
    selectionOptions.functions = options.functions;
  }
  if (typeof options.maxSites === 'number') {
    selectionOptions.maxSites = options.maxSites;
  }
  if (typeof options.maxDurationMs === 'number') {
    selectionOptions.maxDurationMs = options.maxDurationMs;
  }
  const { sites: limitedSites, ledger } = selectMutationSites(selectionOptions);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const runtimeMirrorRoots = canonicalRuntimeMirrorRoots(options.runtimeMirrorRoots);
  const baseline = runCommandReceipt(options.repoRoot, options.testCommand, timeoutMs);
  const repoFiles = repoFileDigests(options.repoRoot);
  const executionFingerprint = buildExecutionFingerprint(options.testCommand, runtimeMirrorRoots, repoFiles);
  const finish = (results: MutationResult[], runBaseline: ExecutionReceipt): MutationRun => {
    const killed = results.filter((result) => result.status === 'killed').length;
    const survived = results.filter((result) => result.status === 'survived').length;
    const total = killed + survived;
    const counts = {
      ...ledger.counts,
      executed: results.filter((result) => result.origin === 'executed').length,
      cached: results.filter((result) => result.origin === 'cached').length,
      unobserved: results.filter((result) => result.origin === 'not-executed').length
    };
    return {
      sites: limitedSites,
      results,
      // An untrusted baseline scores 0, never a vacuous 1.
      score: runBaseline.status !== 'pass' ? 0 : total === 0 ? 1 : killed / total,
      killed,
      survived,
      baseline: runBaseline,
      executionFingerprint,
      // Complete only when every selected site has an assertion verdict (killed, survived) or is invalid code.
      selection: { ...ledger, counts, complete: runBaseline.status === 'pass' && results.length === limitedSites.length && results.every((result) => cacheableResult(result)) }
    };
  };
  const untrustedRun = (failedBaseline: ExecutionReceipt): MutationRun => finish(limitedSites.map((site) => mutationResultForSite(site, {
    status: 'error',
    durationMs: failedBaseline.durationMs,
    details: `Baseline test command must pass before mutation scoring is trusted. ${failedBaseline.details ?? ''}`.trim().slice(0, 280),
    testCommand: options.testCommand,
    origin: 'not-executed',
    errorKind: 'baseline'
  })), failedBaseline);
  if (baseline.status !== 'pass') {
    return untrustedRun(baseline);
  }

  const manifest = loadManifest(options.manifestPath);
  const results: MutationResult[] = [];
  let workspace: MutationWorkspace | undefined;
  let phaseStartedAt: number | undefined;
  let executedCount = 0;

  try {
    for (const site of limitedSites) {
      const key = manifestKey(options.repoRoot, site, executionFingerprint);
      const cached = manifest.entries[key];
      if (cached && cacheableResult(cached)) {
        const cachedInput: { status: MutationResult['status']; durationMs: number; details?: string; testCommand: string[] } = {
          status: cached.status,
          durationMs: cached.durationMs,
          testCommand: options.testCommand
        };
        if (cached.details) {
          cachedInput.details = cached.details;
        }
        results.push({
          ...mutationResultForSite(site, cachedInput),
          ...cached,
          origin: 'cached'
        });
        continue;
      }
      if (typeof options.maxDurationMs === 'number' && executedCount > 0 && phaseStartedAt !== undefined && Date.now() - phaseStartedAt >= options.maxDurationMs) {
        // Budget exhaustion is incomplete evidence: the site has no outcome and is never cached as clean.
        results.push(mutationResultForSite(site, {
          status: 'error',
          durationMs: 0,
          details: `not executed: mutation time budget maxDurationMs=${options.maxDurationMs} exhausted; this site has no observed outcome`,
          testCommand: options.testCommand,
          origin: 'not-executed',
          errorKind: 'budget'
        }));
        continue;
      }
      if (!workspace) {
        workspace = prepareMutationWorkspace(options.repoRoot, repoFiles);
        // A kill is evidence only if the unmutated code passes in this same workspace; otherwise any environment
        // difference (missing install state, excluded files, absolute paths) would count as killing every mutant.
        const workspaceBaseline = runCommandReceipt(workspace.tempDir, options.testCommand, timeoutMs);
        // The baseline run may leave side effects; every mutant must start from the same pristine workspace.
        resetMutationWorkspace(options.repoRoot, workspace);
        if (workspaceBaseline.status !== 'pass') {
          return untrustedRun({
            ...workspaceBaseline,
            details: `mutation workspace baseline: the unmutated test command fails inside the mutation workspace, so kills there would not be evidence. ${workspaceBaseline.details ?? ''}`.trim().slice(0, 280)
          });
        }
      }
      const sourceText = fs.readFileSync(path.join(options.repoRoot, site.filePath), 'utf8');
      const mutatedSource = applyMutation(sourceText, site);
      if (!hasSyntaxErrors(site.filePath, mutatedSource)) {
        // The budget clock starts with the first mutant that actually runs the test command.
        phaseStartedAt ??= Date.now();
      }
      const result = runSingleMutation(options.repoRoot, workspace, site, mutatedSource, options.testCommand, timeoutMs, runtimeMirrorRoots);
      if (result.status !== 'invalid') {
        executedCount += 1;
      }
      results.push(result);
      if (cacheableResult(result)) {
        manifest.entries[key] = result;
      }
    }
  } finally {
    disposeMutationWorkspace(workspace);
  }

  saveManifest(options.manifestPath, manifest);
  return finish(results, baseline);
}
