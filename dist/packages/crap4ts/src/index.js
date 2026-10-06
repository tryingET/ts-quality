"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLcov = parseLcov;
exports.lineCoverage = lineCoverage;
exports.functionCoverage = functionCoverage;
exports.crapScore = crapScore;
exports.analyzeSource = analyzeSource;
exports.analyzeCrap = analyzeCrap;
exports.formatCrapText = formatCrapText;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
const LCOV_DA_PATTERN = /^([1-9]\d*),(\d+)(?:,.*)?$/;
// FN:<start line>,[<end line>,]<name> and FNDA:<hits>,<name>
const LCOV_FN_PATTERN = /^([1-9]\d*),(?:\d+,)?(.+)$/;
const LCOV_FNDA_PATTERN = /^(\d+),(.+)$/;
/** Parses LCOV DA records. Repeated records for one file merge (hits add up); unreadable DA records are counted, not guessed. */
function parseLcov(lcovText) {
    const records = new Map();
    let current;
    let source;
    for (const rawLine of lcovText.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line.startsWith('TN:')) {
            source = line.slice(3);
            continue;
        }
        if (line.startsWith('SF:')) {
            const filePath = (0, index_1.normalizePath)(line.slice(3));
            current = records.get(filePath) ?? { lines: {}, source, malformedLines: 0, functionLines: new Map(), functionHits: {} };
            current.functionLines = new Map();
            records.set(filePath, current);
            continue;
        }
        if (line.startsWith('FN:') && current) {
            const match = LCOV_FN_PATTERN.exec(line.slice(3));
            if (match) {
                current.functionLines.set(match[2], match[1]);
            }
            continue;
        }
        if (line.startsWith('FNDA:') && current) {
            const match = LCOV_FNDA_PATTERN.exec(line.slice(5));
            const startLine = match ? current.functionLines.get(match[2]) : undefined;
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
            const lineNumber = match[1];
            current.lines[lineNumber] = (current.lines[lineNumber] ?? 0) + Number(match[2]);
            continue;
        }
        if (line === 'end_of_record') {
            current = undefined;
            source = undefined;
        }
    }
    return [...records.entries()]
        .map(([filePath, record]) => {
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
function lineCoverage(lineMap, span) {
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
function unknownCoverage(status) {
    return { status, pct: 0, instrumentedLines: 0, coveredLines: 0 };
}
/** Number of source lines as TypeScript counts them; a final line break does not start another line. */
function sourceLineCountOf(sourceFile) {
    const lineStarts = sourceFile.getLineStarts();
    const last = lineStarts[lineStarts.length - 1] ?? 0;
    return sourceFile.text.length > 0 && last === sourceFile.text.length ? lineStarts.length - 1 : lineStarts.length;
}
function indexFileCoverage(filePath, coverage, sourceLineCount) {
    const empty = { hitsByLine: new Map(), functionHits: [] };
    const resolved = (0, index_1.resolveCoverageEvidence)(filePath, coverage);
    const evidence = resolved.evidence;
    if (!evidence) {
        return { ...empty, unknown: resolved.match === 'ambiguous' ? 'ambiguous' : 'missing' };
    }
    if ((evidence.malformedLines ?? 0) > 0) {
        return { ...empty, unknown: 'malformed' };
    }
    const hitsByLine = new Map(Object.entries(evidence.lines).map(([line, hits]) => [Number(line), hits]));
    const functionHits = Object.entries(evidence.functionHits ?? {}).map(([line, hits]) => [Number(line), hits]);
    if ([...hitsByLine.keys(), ...functionHits.map(([line]) => line)].some((line) => line > sourceLineCount)) {
        return { ...empty, unknown: 'mismatched' };
    }
    return { hitsByLine, functionHits };
}
function coverageInSpan(index, span) {
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
function functionCoverage(filePath, span, coverage, sourceLineCount) {
    return coverageInSpan(indexFileCoverage(filePath, coverage, sourceLineCount), span);
}
/** CRAP = complexity^2 * (1 - coverage)^3 + complexity, with coverage in percent (clamped to 0-100), rounded to two decimals. */
function crapScore(complexity, coveragePct) {
    const uncovered = 1 - Math.max(0, Math.min(1, coveragePct / 100));
    return Number((complexity * complexity * Math.pow(uncovered, 3) + complexity).toFixed(2));
}
/** Decision points in the function's own body; nested functions are separate subjects and are not counted here. */
function computeComplexity(node) {
    let complexity = 1;
    function visit(inner) {
        if (typescript_1.default.isFunctionLike(inner)) {
            return;
        }
        if (typescript_1.default.isIfStatement(inner) ||
            typescript_1.default.isForStatement(inner) ||
            typescript_1.default.isForInStatement(inner) ||
            typescript_1.default.isForOfStatement(inner) ||
            typescript_1.default.isWhileStatement(inner) ||
            typescript_1.default.isDoStatement(inner) ||
            typescript_1.default.isCaseClause(inner) ||
            typescript_1.default.isCatchClause(inner) ||
            typescript_1.default.isConditionalExpression(inner)) {
            complexity += 1;
        }
        if (typescript_1.default.isBinaryExpression(inner)) {
            const operator = inner.operatorToken.kind;
            if (operator === typescript_1.default.SyntaxKind.AmpersandAmpersandToken ||
                operator === typescript_1.default.SyntaxKind.BarBarToken ||
                operator === typescript_1.default.SyntaxKind.QuestionQuestionToken) {
                complexity += 1;
            }
        }
        typescript_1.default.forEachChild(inner, visit);
    }
    if (node.body) {
        visit(node.body);
    }
    return complexity;
}
function nodeLineSpan(node, sourceFile) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
    return { startLine: start, endLine: end };
}
function anonymousName(node, sourceFile) {
    return `<anonymous@${nodeLineSpan(node, sourceFile).startLine}>`;
}
const BINDING_ASSIGNMENTS = new Set([
    typescript_1.default.SyntaxKind.EqualsToken,
    typescript_1.default.SyntaxKind.BarBarEqualsToken,
    typescript_1.default.SyntaxKind.AmpersandAmpersandEqualsToken,
    typescript_1.default.SyntaxKind.QuestionQuestionEqualsToken
]);
function hasModifier(node, kind) {
    return typescript_1.default.canHaveModifiers(node) && (typescript_1.default.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);
}
/** The name an expression is bound to: variable, property, class field, assignment target or default export. */
function assignedName(node, sourceFile) {
    let current = node;
    let parent = node.parent;
    while (parent && (typescript_1.default.isParenthesizedExpression(parent) || typescript_1.default.isAsExpression(parent) || typescript_1.default.isSatisfiesExpression(parent) || typescript_1.default.isNonNullExpression(parent) || typescript_1.default.isTypeAssertionExpression(parent))) {
        current = parent;
        parent = parent.parent;
    }
    if (!parent) {
        return undefined;
    }
    if ((typescript_1.default.isVariableDeclaration(parent) || typescript_1.default.isPropertyAssignment(parent) || typescript_1.default.isPropertyDeclaration(parent) || typescript_1.default.isParameter(parent) || typescript_1.default.isBindingElement(parent)) && parent.initializer === current) {
        return parent.name.getText(sourceFile);
    }
    if (typescript_1.default.isBinaryExpression(parent) && BINDING_ASSIGNMENTS.has(parent.operatorToken.kind) && parent.right === current) {
        return parent.left.getText(sourceFile);
    }
    if (typescript_1.default.isExportAssignment(parent) && parent.expression === current) {
        return 'default';
    }
    return undefined;
}
function functionIdentity(node, sourceFile) {
    if (typescript_1.default.isConstructorDeclaration(node)) {
        const owner = node.parent;
        const className = owner.name?.text ?? (typescript_1.default.isClassExpression(owner) ? assignedName(owner, sourceFile) : undefined);
        return `constructor:${className ? className.replace(/\s+/g, ' ') : anonymousName(owner, sourceFile)}`;
    }
    const kind = typescript_1.default.isFunctionDeclaration(node)
        ? 'function'
        : typescript_1.default.isMethodDeclaration(node)
            ? 'method'
            : typescript_1.default.isGetAccessorDeclaration(node)
                ? 'get'
                : typescript_1.default.isSetAccessorDeclaration(node)
                    ? 'set'
                    : typescript_1.default.isArrowFunction(node)
                        ? 'arrow'
                        : 'function-expression';
    const ownName = node.name?.getText(sourceFile) ?? (typescript_1.default.isFunctionDeclaration(node) && hasModifier(node, typescript_1.default.SyntaxKind.DefaultKeyword) ? 'default' : undefined);
    const boundName = typescript_1.default.isArrowFunction(node) || typescript_1.default.isFunctionExpression(node) ? assignedName(node, sourceFile) : undefined;
    const name = ownName ?? boundName;
    // Names come from source text; collapse line breaks so one symbol stays on one report line.
    return `${kind}:${name ? name.replace(/\s+/g, ' ') : anonymousName(node, sourceFile)}`;
}
/** Function-like declarations with an executable body; signatures, overloads, abstract and ambient declarations have none. */
function isExecutableFunction(node) {
    return (typescript_1.default.isFunctionDeclaration(node) ||
        typescript_1.default.isMethodDeclaration(node) ||
        typescript_1.default.isConstructorDeclaration(node) ||
        typescript_1.default.isGetAccessorDeclaration(node) ||
        typescript_1.default.isSetAccessorDeclaration(node) ||
        typescript_1.default.isArrowFunction(node) ||
        typescript_1.default.isFunctionExpression(node)) && node.body !== undefined;
}
function compareHotspots(left, right) {
    return right.crap - left.crap
        || left.filePath.localeCompare(right.filePath)
        || left.span.startLine - right.span.startLine
        || left.span.endLine - right.span.endLine
        || left.symbol.localeCompare(right.symbol);
}
function analyzeSource(filePath, sourceText, coverage, changed, changedRegions) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const fileCoverage = indexFileCoverage(filePath, coverage, sourceLineCountOf(sourceFile));
    const results = [];
    const fileRegions = changedRegions.filter((region) => (0, index_1.normalizePath)(region.filePath) === (0, index_1.normalizePath)(filePath));
    function pushFunction(node) {
        const span = nodeLineSpan(node, sourceFile);
        const coverageForFunction = coverageInSpan(fileCoverage, span);
        const complexity = computeComplexity(node);
        const changedBySpan = fileRegions.some((region) => {
            for (let line = region.span.startLine; line <= region.span.endLine; line += 1) {
                if ((0, index_1.spanOverlaps)(line, span)) {
                    return true;
                }
            }
            return false;
        });
        const changedInScope = changed.size === 0
            ? true
            : fileRegions.length > 0
                ? changedBySpan
                : changed.has((0, index_1.normalizePath)(filePath));
        results.push({
            kind: 'complexity',
            filePath: (0, index_1.normalizePath)(filePath),
            symbol: functionIdentity(node, sourceFile),
            span,
            complexity,
            coveragePct: coverageForFunction.pct,
            crap: crapScore(complexity, coverageForFunction.pct),
            changed: changedInScope,
            coverageStatus: coverageForFunction.status
        });
    }
    function visit(node) {
        if (hasModifier(node, typescript_1.default.SyntaxKind.DeclareKeyword)) {
            return;
        }
        if (isExecutableFunction(node)) {
            pushFunction(node);
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return results;
}
function analyzeCrap(options) {
    const sourceFiles = options.sourceFiles ?? (0, index_1.collectSourceFiles)(options.rootDir);
    const coverage = options.coverage ?? [];
    const changed = (0, index_1.changedFileSet)(options.changedFiles ?? [], options.changedRegions ?? []);
    const changedRegions = options.changedRegions ?? [];
    const files = sourceFiles.map((relativePath) => {
        const absolute = path_1.default.join(options.rootDir, relativePath);
        const sourceText = fs_1.default.readFileSync(absolute, 'utf8');
        const functions = analyzeSource(relativePath, sourceText, coverage, changed, changedRegions);
        const averageCrap = functions.length === 0 ? 0 : Number((functions.reduce((sum, item) => sum + item.crap, 0) / functions.length).toFixed(2));
        const maxCrap = functions.reduce((max, item) => Math.max(max, item.crap), 0);
        return {
            filePath: (0, index_1.normalizePath)(relativePath),
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
function formatCrapText(report) {
    const lines = [];
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
//# sourceMappingURL=index.js.map