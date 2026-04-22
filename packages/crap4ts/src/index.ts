import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  type ChangedRegion,
  type ComplexityEvidence,
  type CoverageEvidence,
  type LineSpan,
  changedFileSet,
  collectSourceFiles,
  findCoverageEvidence,
  normalizePath,
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

type ComplexitySubjectNode = ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression;
type MaybeNamedNode = ts.Node & { name?: ts.Node };

export function parseLcov(lcovText: string): CoverageEvidence[] {
  const output: CoverageEvidence[] = [];
  let currentFile: string | undefined;
  let lines: Record<string, number> = {};
  let source: string | undefined;

  function flush(): void {
    if (!currentFile) {
      return;
    }
    const values = Object.values(lines);
    const coveredLines = values.filter((value) => value > 0).length;
    const totalLines = values.length;
    output.push({
      kind: 'coverage',
      filePath: currentFile,
      lines,
      coveredLines,
      totalLines,
      pct: totalLines === 0 ? 0 : Number(((coveredLines / totalLines) * 100).toFixed(2)),
      source
    });
    currentFile = undefined;
    lines = {};
    source = undefined;
  }

  for (const rawLine of lcovText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('TN:')) {
      source = line.slice(3);
      continue;
    }
    if (line.startsWith('SF:')) {
      flush();
      currentFile = normalizePath(line.slice(3));
      continue;
    }
    if (line.startsWith('DA:')) {
      const [lineNumber, hits] = line.slice(3).split(',');
      if (!lineNumber) {
        continue;
      }
      lines[lineNumber] = Number(hits ?? '0');
      continue;
    }
    if (line === 'end_of_record') {
      flush();
    }
  }
  flush();
  return output.sort((left, right) => left.filePath.localeCompare(right.filePath));
}

export function lineCoverage(lineMap: Record<string, number>, span: LineSpan, sourceText: string): number {
  const sourceLines = sourceText.split(/\r?\n/);
  const executableLines = new Set<number>();
  for (let index = span.startLine; index <= span.endLine; index += 1) {
    const sourceLine = sourceLines[index - 1] ?? '';
    if (sourceLine.trim() === '' || /^[{}\])]+;?$/.test(sourceLine.trim())) {
      continue;
    }
    executableLines.add(index);
  }
  if (executableLines.size === 0) {
    return 100;
  }
  let covered = 0;
  for (const line of executableLines) {
    if ((lineMap[String(line)] ?? 0) > 0) {
      covered += 1;
    }
  }
  return Number(((covered / executableLines.size) * 100).toFixed(2));
}

export function crapScore(complexity: number, coveragePct: number): number {
  const uncovered = 1 - Math.max(0, Math.min(1, coveragePct / 100));
  return Number((complexity * complexity * Math.pow(uncovered, 3) + complexity).toFixed(2));
}

function computeComplexity(node: ComplexitySubjectNode): number {
  let complexity = 1;
  function visit(inner: ts.Node): void {
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

function findCoverage(filePath: string, coverage: CoverageEvidence[]): CoverageEvidence | undefined {
  return findCoverageEvidence(filePath, coverage);
}

function nodeLineSpan(node: ts.Node, sourceFile: ts.SourceFile): LineSpan {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
  return { startLine: start, endLine: end };
}

function symbolName(node: MaybeNamedNode, sourceFile: ts.SourceFile): string {
  if (node.name) {
    return node.name.getText(sourceFile);
  }
  const span = nodeLineSpan(node, sourceFile);
  return `<anonymous@${span.startLine}>`;
}

export function analyzeSource(filePath: string, sourceText: string, coverage: CoverageEvidence[], changed: Set<string>, changedRegions: ChangedRegion[]): ComplexityEvidence[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const coverageForFile = findCoverage(filePath, coverage);
  const results: ComplexityEvidence[] = [];
  const fileRegions = changedRegions.filter((region) => normalizePath(region.filePath) === normalizePath(filePath));

  function pushFunction(node: ComplexitySubjectNode, kind: string): void {
    const span = nodeLineSpan(node, sourceFile);
    const coveragePct = coverageForFile ? lineCoverage(coverageForFile.lines, span, sourceText) : 0;
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
      symbol: `${kind}:${symbolName(node, sourceFile)}`,
      span,
      complexity,
      coveragePct,
      crap: crapScore(complexity, coveragePct),
      changed: changedInScope
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node)) {
      pushFunction(node, 'function');
    } else if (ts.isMethodDeclaration(node)) {
      pushFunction(node, 'method');
    } else if (ts.isArrowFunction(node)) {
      pushFunction(node, 'arrow');
    } else if (ts.isFunctionExpression(node)) {
      pushFunction(node, 'function-expression');
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

  const hotspots = files.flatMap((file) => file.functions).sort((left, right) => right.crap - left.crap);
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
    lines.push(`- ${hotspot.filePath}:${hotspot.span.startLine}-${hotspot.span.endLine} ${hotspot.symbol} complexity=${hotspot.complexity} coverage=${hotspot.coveragePct}% crap=${hotspot.crap}`);
  }
  return lines.join('\n');
}
