"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLcov = parseLcov;
exports.lineCoverage = lineCoverage;
exports.crapScore = crapScore;
exports.analyzeSource = analyzeSource;
exports.analyzeCrap = analyzeCrap;
exports.formatCrapText = formatCrapText;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
function parseLcov(lcovText) {
    const output = [];
    let currentFile;
    let lines = {};
    let source;
    function flush() {
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
            currentFile = (0, index_1.normalizePath)(line.slice(3));
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
function lineCoverage(lineMap, span, sourceText) {
    const sourceLines = sourceText.split(/\r?\n/);
    const executableLines = new Set();
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
function crapScore(complexity, coveragePct) {
    const uncovered = 1 - Math.max(0, Math.min(1, coveragePct / 100));
    return Number((complexity * complexity * Math.pow(uncovered, 3) + complexity).toFixed(2));
}
function computeComplexity(node) {
    let complexity = 1;
    function visit(inner) {
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
function findCoverage(filePath, coverage) {
    return (0, index_1.findCoverageEvidence)(filePath, coverage);
}
function nodeLineSpan(node, sourceFile) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
    return { startLine: start, endLine: end };
}
function symbolName(node, sourceFile) {
    if (node.name) {
        return node.name.getText(sourceFile);
    }
    const span = nodeLineSpan(node, sourceFile);
    return `<anonymous@${span.startLine}>`;
}
function analyzeSource(filePath, sourceText, coverage, changed, changedRegions) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const coverageForFile = findCoverage(filePath, coverage);
    const results = [];
    const fileRegions = changedRegions.filter((region) => (0, index_1.normalizePath)(region.filePath) === (0, index_1.normalizePath)(filePath));
    function pushFunction(node, kind) {
        const span = nodeLineSpan(node, sourceFile);
        const coveragePct = coverageForFile ? lineCoverage(coverageForFile.lines, span, sourceText) : 0;
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
            symbol: `${kind}:${symbolName(node, sourceFile)}`,
            span,
            complexity,
            coveragePct,
            crap: crapScore(complexity, coveragePct),
            changed: changedInScope
        });
    }
    function visit(node) {
        if (typescript_1.default.isFunctionDeclaration(node)) {
            pushFunction(node, 'function');
        }
        else if (typescript_1.default.isMethodDeclaration(node)) {
            pushFunction(node, 'method');
        }
        else if (typescript_1.default.isArrowFunction(node)) {
            pushFunction(node, 'arrow');
        }
        else if (typescript_1.default.isFunctionExpression(node)) {
            pushFunction(node, 'function-expression');
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
function formatCrapText(report) {
    const lines = [];
    lines.push(`CRAP summary: ${report.summary.functionCount} functions across ${report.summary.fileCount} files`);
    lines.push(`Average CRAP: ${report.summary.averageCrap}`);
    lines.push(`Max CRAP: ${report.summary.maxCrap}`);
    lines.push('Hotspots:');
    for (const hotspot of report.hotspots.slice(0, 10)) {
        lines.push(`- ${hotspot.filePath}:${hotspot.span.startLine}-${hotspot.span.endLine} ${hotspot.symbol} complexity=${hotspot.complexity} coverage=${hotspot.coveragePct}% crap=${hotspot.crap}`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=index.js.map