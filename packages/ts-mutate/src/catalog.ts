import ts from 'typescript';
import {
  changedFileSet,
  type ChangedRegion,
  type CoverageEvidence,
  digestObject,
  findCoverageEvidence,
  type MutationSite,
  normalizePath
} from '../../evidence-model/src/index';

/** The mutation catalog: AST site discovery with runtime-valid operators only, never type-only syntax. */

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
export function isAmbientDeclaration(node: ts.Node): boolean {
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
export function candidateMutationSites(sourceText: string, filePath: string): MutationSite[] {
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
export interface ScopeContext {
  changed: Set<string>;
  changedRegions: ChangedRegion[];
  coverage: CoverageEvidence[];
  coveredOnly: boolean;
}
/** Why an in-scope file's site is not eligible: outside the changed hunks or, with coveredOnly, without covered LCOV evidence. */
export function eligibilityExclusion(site: MutationSite, context: ScopeContext): 'outside-changed-hunks' | 'uncovered' | undefined {
  const fileRegions = context.changedRegions.filter((item) => normalizePath(item.filePath) === site.filePath);
  if (fileRegions.length > 0 && !fileRegions.some((region) => region.span.startLine <= site.span.endLine && region.span.endLine >= site.span.startLine)) {
    return 'outside-changed-hunks';
  }
  if (context.coveredOnly && !coverageForLine(site.filePath, site.span.startLine, context.coverage)) {
    return 'uncovered';
  }
  return undefined;
}
export function inChangedScope(filePath: string, changed: Set<string>): boolean {
  return changed.size === 0 || changed.has(normalizePath(filePath));
}
export function discoverMutationSites(sourceText: string, filePath: string, coverage: CoverageEvidence[] = [], changedFiles: string[] = [], changedRegions: ChangedRegion[] = [], coveredOnly = false): MutationSite[] {
  const context: ScopeContext = { changed: changedFileSet(changedFiles, changedRegions), changedRegions, coverage, coveredOnly };
  if (!inChangedScope(filePath, context.changed)) {
    return [];
  }
  return candidateMutationSites(sourceText, filePath).filter((site) => eligibilityExclusion(site, context) === undefined);
}
