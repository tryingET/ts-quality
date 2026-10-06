import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  type ChangedRegion,
  type ComplexityEvidence,
  type CoverageEvidence,
  type FunctionCoverageStatus,
  type LineSpan,
  changedFileSet,
  collectSourceFiles,
  normalizePath,
  resolveCoverageEvidence,
  spanOverlaps
} from '../../evidence-model/src/index';

export interface CrapOptions {
  rootDir: string;
  sourceFiles?: string[];
  coverage?: CoverageEvidence[];
  changedFiles?: string[];
  changedRegions?: ChangedRegion[];
}

export interface CrapAnalysis {
  files: Array<{
    filePath: string;
    functions: ComplexityEvidence[];
    averageCrap: number;
    maxCrap: number;
  }>;
  hotspots: ComplexityEvidence[];
  summary: {
    fileCount: number;
    functionCount: number;
    averageCrap: number;
    maxCrap: number;
  };
}

export interface FunctionCoverage {
  status: FunctionCoverageStatus;
  /** Percent (0-100) of instrumented lines that executed; 0 whenever status is not `measured`. */
  pct: number;
  instrumentedLines: number;
  coveredLines: number;
}

interface LcovRecord {
  lines: Record<string, number>;
  source: string | undefined;
  malformedLines: number;
  functionLines: Map<string, string>;
  functionHits: Record<string, number>;
}

const LCOV_DA_PATTERN = /^([1-9]\d*),(\d+)(?:,.*)?$/;
// FN:<start line>,[<end line>,]<name> and FNDA:<hits>,<name>
const LCOV_FN_PATTERN = /^([1-9]\d*),(?:\d+,)?(.+)$/;
const LCOV_FNDA_PATTERN = /^(\d+),(.+)$/;

/** Parses LCOV DA records. Repeated records for one file merge (hits add up); unreadable DA records are counted, not guessed. */
export function parseLcov(lcovText: string): CoverageEvidence[] {
  const records = new Map<string, LcovRecord>();
  let current: LcovRecord | undefined;
  let source: string | undefined;

  for (const rawLine of lcovText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('TN:')) {
      source = line.slice(3);
      continue;
    }
    if (line.startsWith('SF:')) {
      const filePath = normalizePath(line.slice(3));
      current = records.get(filePath) ?? { lines: {}, source, malformedLines: 0, functionLines: new Map(), functionHits: {} };
      current.functionLines = new Map();
      records.set(filePath, current);
      continue;
    }
    if (line.startsWith('FN:') && current) {
      const match = LCOV_FN_PATTERN.exec(line.slice(3));
      if (match) {
        current.functionLines.set(match[2] as string, match[1] as string);
      }
      continue;
    }
    if (line.startsWith('FNDA:') && current) {
      const match = LCOV_FNDA_PATTERN.exec(line.slice(5));
      const startLine = match ? current.functionLines.get(match[2] as string) : undefined;
      if (match && startLine) {
        current.functionHits[startLine] = (current.functionHits[startLine] ?? 0) + Number(match[1]);
      }
      continue;
    }
    if (line.startsWith('DA:')) {
      if (!current) {
        continue;
      }
      const match = LCOV_DA_PATTERN.exec(line.slice(3));
      if (!match) {
        current.malformedLines += 1;
        continue;
      }
      const lineNumber = match[1] as string;
      current.lines[lineNumber] = (current.lines[lineNumber] ?? 0) + Number(match[2]);
      continue;
    }
    if (line === 'end_of_record') {
      current = undefined;
      source = undefined;
    }
  }

  return [...records.entries()]
    .map(([filePath, record]): CoverageEvidence => {
      const values = Object.values(record.lines);
      const coveredLines = values.filter((value) => value > 0).length;
      const totalLines = values.length;
      return {
        kind: 'coverage',
        filePath,
        lines: record.lines,
        coveredLines,
        totalLines,
        pct: totalLines === 0 || record.malformedLines > 0 ? 0 : Number(((coveredLines / totalLines) * 100).toFixed(2)),
        source: record.source,
        ...(record.malformedLines > 0 ? { malformedLines: record.malformedLines } : {}),
        ...(Object.keys(record.functionHits).length > 0 ? { functionHits: record.functionHits } : {})
      };
    })
    .sort((left, right) => left.filePath.localeCompare(right.filePath));
}

/** Percent of the span's LCOV-instrumented lines that executed; 0 when the span has no instrumented line. */
export function lineCoverage(lineMap: Record<string, number>, span: LineSpan): number {
  let instrumented = 0;
  let covered = 0;
  for (const [line, hits] of Object.entries(lineMap)) {
    const lineNumber = Number(line);
    if (lineNumber < span.startLine || lineNumber > span.endLine) {
      continue;
    }
    instrumented += 1;
    if (hits > 0) {
      covered += 1;
    }
  }
  return instrumented === 0 ? 0 : Number(((covered / instrumented) * 100).toFixed(2));
}

function unknownCoverage(status: FunctionCoverageStatus): FunctionCoverage {
  return { status, pct: 0, instrumentedLines: 0, coveredLines: 0 };
}

interface FileCoverageIndex {
  unknown?: FunctionCoverageStatus | undefined;
  hitsByLine: Map<number, number>;
  functionHits: Array<[number, number]>;
}

/** Number of source lines as TypeScript counts them; a final line break does not start another line. */
function sourceLineCountOf(sourceFile: ts.SourceFile): number {
  const lineStarts = sourceFile.getLineStarts();
  const last = lineStarts[lineStarts.length - 1] ?? 0;
  return sourceFile.text.length > 0 && last === sourceFile.text.length ? lineStarts.length - 1 : lineStarts.length;
}

function indexFileCoverage(filePath: string, coverage: CoverageEvidence[], sourceLineCount: number): FileCoverageIndex {
  const empty = { hitsByLine: new Map<number, number>(), functionHits: [] };
  const resolved = resolveCoverageEvidence(filePath, coverage);
  const evidence = resolved.evidence;
  if (!evidence) {
    return { ...empty, unknown: resolved.match === 'ambiguous' ? 'ambiguous' : 'missing' };
  }
  if ((evidence.malformedLines ?? 0) > 0) {
    return { ...empty, unknown: 'malformed' };
  }
  const hitsByLine = new Map(Object.entries(evidence.lines).map(([line, hits]) => [Number(line), hits] as [number, number]));
  const functionHits = Object.entries(evidence.functionHits ?? {}).map(([line, hits]) => [Number(line), hits] as [number, number]);
  if ([...hitsByLine.keys(), ...functionHits.map(([line]) => line)].some((line) => line > sourceLineCount)) {
    return { ...empty, unknown: 'mismatched' };
  }
  return { hitsByLine, functionHits };
}

function coverageInSpan(index: FileCoverageIndex, span: LineSpan): FunctionCoverage {
  if (index.unknown) {
    return unknownCoverage(index.unknown);
  }
  let instrumentedLines = 0;
  let coveredLines = 0;
  for (let line = span.startLine; line <= span.endLine; line += 1) {
    const hits = index.hitsByLine.get(line);
    if (hits !== undefined) {
      instrumentedLines += 1;
      coveredLines += hits > 0 ? 1 : 0;
    }
  }
  if (instrumentedLines > 0) {
    return { status: 'measured', pct: Number(((coveredLines / instrumentedLines) * 100).toFixed(2)), instrumentedLines, coveredLines };
  }
  // Statement-level LCOV (istanbul) has no DA line for an empty body; its function-entry record still measures it.
  const entry = index.functionHits.filter(([line]) => line >= span.startLine && line <= span.endLine).sort((left, right) => left[0] - right[0])[0];
  if (entry) {
    return { status: 'measured', pct: entry[1] > 0 ? 100 : 0, instrumentedLines: 1, coveredLines: entry[1] > 0 ? 1 : 0 };
  }
  return unknownCoverage('not-instrumented');
}

/**
 * Coverage of one function from LCOV evidence. Missing, ambiguous, malformed, mismatched (lines past the end of
 * the source, as from compiled or stale output) and uninstrumented evidence is reported as unknown, never as covered.
 */
export function functionCoverage(filePath: string, span: LineSpan, coverage: CoverageEvidence[], sourceLineCount: number): FunctionCoverage {
  return coverageInSpan(indexFileCoverage(filePath, coverage, sourceLineCount), span);
}

/** CRAP = complexity^2 * (1 - coverage)^3 + complexity, with coverage in percent (clamped to 0-100), rounded to two decimals. */
export function crapScore(complexity: number, coveragePct: number): number {
  const uncovered = 1 - Math.max(0, Math.min(1, coveragePct / 100));
  return Number((complexity * complexity * Math.pow(uncovered, 3) + complexity).toFixed(2));
}

/** Decision points in the function's own body; nested functions are separate subjects and are not counted here. */
function computeComplexity(node: ts.FunctionLikeDeclaration): number {
  let complexity = 1;
  function visit(inner: ts.Node): void {
    if (ts.isFunctionLike(inner)) {
      return;
    }
    if (
      ts.isIfStatement(inner) ||
      ts.isForStatement(inner) ||
      ts.isForInStatement(inner) ||
      ts.isForOfStatement(inner) ||
      ts.isWhileStatement(inner) ||
      ts.isDoStatement(inner) ||
      ts.isCaseClause(inner) ||
      ts.isCatchClause(inner) ||
      ts.isConditionalExpression(inner)
    ) {
      complexity += 1;
    }
    if (ts.isBinaryExpression(inner)) {
      const operator = inner.operatorToken.kind;
      if (
        operator === ts.SyntaxKind.AmpersandAmpersandToken ||
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        complexity += 1;
      }
    }
    ts.forEachChild(inner, visit);
  }
  if (node.body) {
    visit(node.body);
  }
  return complexity;
}

function nodeLineSpan(node: ts.Node, sourceFile: ts.SourceFile): LineSpan {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
  return { startLine: start, endLine: end };
}

function anonymousName(node: ts.Node, sourceFile: ts.SourceFile): string {
  return `<anonymous@${nodeLineSpan(node, sourceFile).startLine}>`;
}

const BINDING_ASSIGNMENTS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken
]);

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}

/** The name an expression is bound to: variable, property, class field, assignment target or default export. */
function assignedName(node: ts.Expression, sourceFile: ts.SourceFile): string | undefined {
  let current: ts.Node = node;
  let parent = node.parent;
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isSatisfiesExpression(parent) || ts.isNonNullExpression(parent) || ts.isTypeAssertionExpression(parent))) {
    current = parent;
    parent = parent.parent;
  }
  if (!parent) {
    return undefined;
  }
  if ((ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.initializer === current) {
    return parent.name.getText(sourceFile);
  }
  if (ts.isBinaryExpression(parent) && BINDING_ASSIGNMENTS.has(parent.operatorToken.kind) && parent.right === current) {
    return parent.left.getText(sourceFile);
  }
  if (ts.isExportAssignment(parent) && parent.expression === current) {
    return 'default';
  }
  return undefined;
}

function functionIdentity(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
  if (ts.isConstructorDeclaration(node)) {
    const owner = node.parent;
    const className = owner.name?.text ?? (ts.isClassExpression(owner) ? assignedName(owner, sourceFile) : undefined);
    return `constructor:${className ? className.replace(/\s+/g, ' ') : anonymousName(owner, sourceFile)}`;
  }
  const kind = ts.isFunctionDeclaration(node)
    ? 'function'
    : ts.isMethodDeclaration(node)
      ? 'method'
      : ts.isGetAccessorDeclaration(node)
        ? 'get'
        : ts.isSetAccessorDeclaration(node)
          ? 'set'
          : ts.isArrowFunction(node)
            ? 'arrow'
            : 'function-expression';
  const ownName = node.name?.getText(sourceFile) ?? (ts.isFunctionDeclaration(node) && hasModifier(node, ts.SyntaxKind.DefaultKeyword) ? 'default' : undefined);
  const boundName = ts.isArrowFunction(node) || ts.isFunctionExpression(node) ? assignedName(node, sourceFile) : undefined;
  const name = ownName ?? boundName;
  // Names come from source text; collapse line breaks so one symbol stays on one report line.
  return `${kind}:${name ? name.replace(/\s+/g, ' ') : anonymousName(node, sourceFile)}`;
}

/** Function-like declarations with an executable body; signatures, overloads, abstract and ambient declarations have none. */
function isExecutableFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  ) && node.body !== undefined;
}

function compareHotspots(left: ComplexityEvidence, right: ComplexityEvidence): number {
  return right.crap - left.crap
    || left.filePath.localeCompare(right.filePath)
    || left.span.startLine - right.span.startLine
    || left.span.endLine - right.span.endLine
    || left.symbol.localeCompare(right.symbol);
}

export function analyzeSource(filePath: string, sourceText: string, coverage: CoverageEvidence[], changed: Set<string>, changedRegions: ChangedRegion[]): ComplexityEvidence[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const fileCoverage = indexFileCoverage(filePath, coverage, sourceLineCountOf(sourceFile));
  const results: ComplexityEvidence[] = [];
  const fileRegions = changedRegions.filter((region) => normalizePath(region.filePath) === normalizePath(filePath));

  function pushFunction(node: ts.FunctionLikeDeclaration): void {
    const span = nodeLineSpan(node, sourceFile);
    const coverageForFunction = coverageInSpan(fileCoverage, span);
    const complexity = computeComplexity(node);
    const changedBySpan = fileRegions.some((region) => {
      for (let line = region.span.startLine; line <= region.span.endLine; line += 1) {
        if (spanOverlaps(line, span)) {
          return true;
        }
      }
      return false;
    });
    const changedInScope = changed.size === 0
      ? true
      : fileRegions.length > 0
        ? changedBySpan
        : changed.has(normalizePath(filePath));
    results.push({
      kind: 'complexity',
      filePath: normalizePath(filePath),
      symbol: functionIdentity(node, sourceFile),
      span,
      complexity,
      coveragePct: coverageForFunction.pct,
      crap: crapScore(complexity, coverageForFunction.pct),
      changed: changedInScope,
      coverageStatus: coverageForFunction.status
    });
  }

  function visit(node: ts.Node): void {
    if (hasModifier(node, ts.SyntaxKind.DeclareKeyword)) {
      return;
    }
    if (isExecutableFunction(node)) {
      pushFunction(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

export function analyzeCrap(options: CrapOptions): CrapAnalysis {
  const sourceFiles = options.sourceFiles ?? collectSourceFiles(options.rootDir);
  const coverage = options.coverage ?? [];
  const changed = changedFileSet(options.changedFiles ?? [], options.changedRegions ?? []);
  const changedRegions = options.changedRegions ?? [];
  const files = sourceFiles.map((relativePath) => {
    const absolute = path.join(options.rootDir, relativePath);
    const sourceText = fs.readFileSync(absolute, 'utf8');
    const functions = analyzeSource(relativePath, sourceText, coverage, changed, changedRegions);
    const averageCrap = functions.length === 0 ? 0 : Number((functions.reduce((sum, item) => sum + item.crap, 0) / functions.length).toFixed(2));
    const maxCrap = functions.reduce((max, item) => Math.max(max, item.crap), 0);
    return {
      filePath: normalizePath(relativePath),
      functions,
      averageCrap,
      maxCrap
    };
  });

  const hotspots = files.flatMap((file) => file.functions).sort(compareHotspots);
  const functionCount = hotspots.length;
  const averageCrap = functionCount === 0 ? 0 : Number((hotspots.reduce((sum, item) => sum + item.crap, 0) / functionCount).toFixed(2));
  return {
    files,
    hotspots,
    summary: {
      fileCount: files.length,
      functionCount,
      averageCrap,
      maxCrap: hotspots[0]?.crap ?? 0
    }
  };
}

export function formatCrapText(report: CrapAnalysis): string {
  const lines: string[] = [];
  lines.push(`CRAP summary: ${report.summary.functionCount} functions across ${report.summary.fileCount} files`);
  lines.push(`Average CRAP: ${report.summary.averageCrap}`);
  lines.push(`Max CRAP: ${report.summary.maxCrap}`);
  lines.push('Hotspots:');
  for (const hotspot of report.hotspots.slice(0, 10)) {
    const coverageText = hotspot.coverageStatus && hotspot.coverageStatus !== 'measured' ? `unknown (${hotspot.coverageStatus})` : `${hotspot.coveragePct}%`;
    lines.push(`- ${hotspot.filePath}:${hotspot.span.startLine}-${hotspot.span.endLine} ${hotspot.symbol} complexity=${hotspot.complexity} coverage=${coverageText} crap=${hotspot.crap}`);
  }
  return lines.join('\n');
}
