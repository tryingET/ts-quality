"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAmbientDeclaration = isAmbientDeclaration;
exports.candidateMutationSites = candidateMutationSites;
exports.eligibilityExclusion = eligibilityExclusion;
exports.inChangedScope = inChangedScope;
exports.discoverMutationSites = discoverMutationSites;
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
/** The mutation catalog: AST site discovery with runtime-valid operators only, never type-only syntax. */
function coverageForLine(filePath, line, coverage) {
    const entry = (0, index_1.findCoverageEvidence)(filePath, coverage);
    if (!entry) {
        return false;
    }
    return (entry.lines[String(line)] ?? 0) > 0;
}
function mutationId(filePath, span, original, replacement) {
    return (0, index_1.digestObject)({ filePath: (0, index_1.normalizePath)(filePath), span, original, replacement });
}
const BINARY_OPERATOR_MUTATIONS = new Map([
    [typescript_1.default.SyntaxKind.EqualsEqualsEqualsToken, { replacement: '!==', description: 'strict equality inversion' }],
    [typescript_1.default.SyntaxKind.ExclamationEqualsEqualsToken, { replacement: '===', description: 'strict inequality inversion' }],
    [typescript_1.default.SyntaxKind.EqualsEqualsToken, { replacement: '!=', description: 'loose equality inversion' }],
    [typescript_1.default.SyntaxKind.ExclamationEqualsToken, { replacement: '==', description: 'loose inequality inversion' }],
    [typescript_1.default.SyntaxKind.GreaterThanToken, { replacement: '>=', description: 'greater-than relaxation' }],
    [typescript_1.default.SyntaxKind.GreaterThanEqualsToken, { replacement: '>', description: 'greater-than tightening' }],
    [typescript_1.default.SyntaxKind.LessThanToken, { replacement: '<=', description: 'less-than relaxation' }],
    [typescript_1.default.SyntaxKind.LessThanEqualsToken, { replacement: '<', description: 'less-than tightening' }],
    [typescript_1.default.SyntaxKind.PlusToken, { replacement: '-', description: 'addition to subtraction' }],
    [typescript_1.default.SyntaxKind.MinusToken, { replacement: '+', description: 'subtraction to addition' }],
    [typescript_1.default.SyntaxKind.AsteriskToken, { replacement: '/', description: 'multiplication to division' }],
    [typescript_1.default.SyntaxKind.AmpersandAmpersandToken, { replacement: '||', description: 'and to or' }],
    [typescript_1.default.SyntaxKind.BarBarToken, { replacement: '&&', description: 'or to and' }]
]);
function isAmbientDeclaration(node) {
    return typescript_1.default.canHaveModifiers(node) && (typescript_1.default.getModifiers(node) ?? []).some((modifier) => modifier.kind === typescript_1.default.SyntaxKind.DeclareKeyword);
}
function isClassExtendsExpression(node) {
    return typescript_1.default.isExpressionWithTypeArguments(node)
        && typescript_1.default.isHeritageClause(node.parent)
        && node.parent.token === typescript_1.default.SyntaxKind.ExtendsKeyword
        && typescript_1.default.isClassLike(node.parent.parent);
}
/** Syntax erased at compile time; mutating it cannot change runtime behavior. A class `extends` expression runs. */
function isTypeOnlySyntax(node) {
    return (typescript_1.default.isTypeNode(node) && !isClassExtendsExpression(node))
        || typescript_1.default.isInterfaceDeclaration(node)
        || typescript_1.default.isTypeAliasDeclaration(node)
        || typescript_1.default.isTypeParameterDeclaration(node)
        || isAmbientDeclaration(node);
}
function isPropertyName(node) {
    const parent = node.parent;
    return parent?.name === node || parent?.propertyName === node;
}
// Pairs that would lex as a different token (a comment, `++`, `--`) if a replacement touched its neighbor.
const MERGING_TOKEN_PAIRS = new Set(['//', '/*', '*/', '++', '--']);
function mergesWithNeighbors(sourceText, startOffset, endOffset, replacement) {
    const before = sourceText[startOffset - 1] ?? '';
    const after = sourceText[endOffset] ?? '';
    return MERGING_TOKEN_PAIRS.has(`${before}${replacement.slice(0, 1)}`) || MERGING_TOKEN_PAIRS.has(`${replacement.slice(-1)}${after}`);
}
function conditionOf(node) {
    if (typescript_1.default.isIfStatement(node)) {
        return { expression: node.expression, description: 'if condition inversion' };
    }
    if (typescript_1.default.isConditionalExpression(node)) {
        return { expression: node.condition, description: 'conditional expression inversion' };
    }
    if (typescript_1.default.isWhileStatement(node)) {
        return { expression: node.expression, description: 'while condition inversion' };
    }
    if (typescript_1.default.isDoStatement(node)) {
        return { expression: node.expression, description: 'do-while condition inversion' };
    }
    if (typescript_1.default.isForStatement(node) && node.condition) {
        return { expression: node.condition, description: 'for condition inversion' };
    }
    return undefined;
}
/** Every valid mutation site in the file, before change-scope, coverage, target or budget selection. */
function candidateMutationSites(sourceText, filePath) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const sites = [];
    if (sourceFile.isDeclarationFile) {
        return sites;
    }
    function considerRange(startOffset, endOffset, replacement, operator, description) {
        if (mergesWithNeighbors(sourceText, startOffset, endOffset, replacement)) {
            return;
        }
        const startLine = sourceFile.getLineAndCharacterOfPosition(startOffset).line + 1;
        const endLine = sourceFile.getLineAndCharacterOfPosition(endOffset).line + 1;
        const span = { startLine, endLine, startOffset, endOffset };
        const original = sourceText.slice(startOffset, endOffset);
        sites.push({
            id: mutationId(filePath, span, original, replacement),
            filePath: (0, index_1.normalizePath)(filePath),
            span: { startLine: span.startLine, endLine: span.endLine },
            startOffset,
            endOffset,
            operator,
            original,
            replacement,
            description
        });
    }
    function consider(node, replacement, operator, description) {
        considerRange(node.getStart(sourceFile), node.end, replacement, operator, description);
    }
    function visit(node) {
        if (isTypeOnlySyntax(node)) {
            return;
        }
        if (typescript_1.default.isBinaryExpression(node)) {
            const mutation = BINARY_OPERATOR_MUTATIONS.get(node.operatorToken.kind);
            if (mutation) {
                consider(node.operatorToken, mutation.replacement, node.operatorToken.getText(sourceFile), mutation.description);
            }
        }
        else if ((typescript_1.default.isPrefixUnaryExpression(node) || typescript_1.default.isPostfixUnaryExpression(node)) && (node.operator === typescript_1.default.SyntaxKind.PlusPlusToken || node.operator === typescript_1.default.SyntaxKind.MinusMinusToken)) {
            const operator = node.operator === typescript_1.default.SyntaxKind.PlusPlusToken ? '++' : '--';
            const replacement = operator === '++' ? '--' : '++';
            const startOffset = typescript_1.default.isPrefixUnaryExpression(node) ? node.getStart(sourceFile) : node.end - 2;
            considerRange(startOffset, startOffset + 2, replacement, operator, operator === '++' ? 'increment to decrement' : 'decrement to increment');
        }
        else if (node.kind === typescript_1.default.SyntaxKind.TrueKeyword) {
            consider(node, 'false', 'true', 'boolean flip true->false');
        }
        else if (node.kind === typescript_1.default.SyntaxKind.FalseKeyword) {
            consider(node, 'true', 'false', 'boolean flip false->true');
        }
        else if (typescript_1.default.isNumericLiteral(node) && (node.text === '0' || node.text === '1') && /^[01]$/.test(node.getText(sourceFile)) && !isPropertyName(node)) {
            const original = node.getText(sourceFile);
            consider(node, original === '0' ? '1' : '0', original, original === '0' ? 'numeric constant 0->1' : 'numeric constant 1->0');
        }
        const condition = conditionOf(node);
        if (condition) {
            const expression = condition.expression;
            const replacement = typescript_1.default.isPrefixUnaryExpression(expression) && expression.operator === typescript_1.default.SyntaxKind.ExclamationToken
                ? expression.operand.getText(sourceFile)
                : `!(${expression.getText(sourceFile)})`;
            consider(expression, replacement, 'condition', condition.description);
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return sites;
}
/** Why an in-scope file's site is not eligible: outside the changed hunks or, with coveredOnly, without covered LCOV evidence. */
function eligibilityExclusion(site, context) {
    const fileRegions = context.changedRegions.filter((item) => (0, index_1.normalizePath)(item.filePath) === site.filePath);
    if (fileRegions.length > 0 && !fileRegions.some((region) => region.span.startLine <= site.span.endLine && region.span.endLine >= site.span.startLine)) {
        return 'outside-changed-hunks';
    }
    if (context.coveredOnly && !coverageForLine(site.filePath, site.span.startLine, context.coverage)) {
        return 'uncovered';
    }
    return undefined;
}
function inChangedScope(filePath, changed) {
    return changed.size === 0 || changed.has((0, index_1.normalizePath)(filePath));
}
function discoverMutationSites(sourceText, filePath, coverage = [], changedFiles = [], changedRegions = [], coveredOnly = false) {
    const context = { changed: (0, index_1.changedFileSet)(changedFiles, changedRegions), changedRegions, coverage, coveredOnly };
    if (!inChangedScope(filePath, context.changed)) {
        return [];
    }
    return candidateMutationSites(sourceText, filePath).filter((site) => eligibilityExclusion(site, context) === undefined);
}
//# sourceMappingURL=catalog.js.map