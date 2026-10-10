import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  changedFileSet,
  type ChangedRegion,
  collectSourceFiles,
  type CoverageEvidence,
  type FunctionSpan,
  type LineSpan,
  matchPattern,
  type MutationExclusionReason,
  type MutationSelectionLedger,
  type MutationSite,
  type MutationTarget,
  type MutationTargetResolution,
  normalizePath
} from '../../evidence-model/src/index';
import {
  ScopeContext,
  candidateMutationSites,
  eligibilityExclusion,
  inChangedScope,
  isAmbientDeclaration
} from './catalog';

/** Explicit mutation targets and the inert selection ledger: discovered, eligible, selected and excluded sites. */

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
