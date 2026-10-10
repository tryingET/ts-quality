"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TEST_PATTERNS = exports.DEFAULT_SOURCE_PATTERNS = void 0;
exports.listFiles = listFiles;
exports.matchesDiscoveryPattern = matchesDiscoveryPattern;
exports.collectSourceFiles = collectSourceFiles;
exports.globToRegExp = globToRegExp;
exports.matchPattern = matchPattern;
exports.matchesAny = matchesAny;
exports.resolveCoverageEvidence = resolveCoverageEvidence;
exports.findCoverageEvidence = findCoverageEvidence;
exports.repoDigest = repoDigest;
exports.inferPackages = inferPackages;
exports.resolvePackageName = resolvePackageName;
exports.buildRepositoryEntity = buildRepositoryEntity;
exports.loadOptionalJsonArray = loadOptionalJsonArray;
exports.isWaiverActive = isWaiverActive;
exports.isFindingWaived = isFindingWaived;
exports.parseUnifiedDiff = parseUnifiedDiff;
exports.summarizeMutationScore = summarizeMutationScore;
exports.changedFileSet = changedFileSet;
exports.spanOverlaps = spanOverlaps;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const paths_1 = require("./paths");
const text_io_1 = require("./text-io");
/** Source and test discovery, glob matching, coverage lookup, package inference, waivers and unified diffs. */
exports.DEFAULT_SOURCE_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'];
exports.DEFAULT_TEST_PATTERNS = [
    'test/**/*.js',
    'test/**/*.mjs',
    'test/**/*.cjs',
    'test/**/*.ts',
    'test/**/*.tsx',
    'tests/**/*.js',
    'tests/**/*.mjs',
    'tests/**/*.cjs',
    'tests/**/*.ts',
    'tests/**/*.tsx',
    '**/*.test.js',
    '**/*.test.mjs',
    '**/*.test.cjs',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.js',
    '**/*.spec.mjs',
    '**/*.spec.cjs',
    '**/*.spec.ts',
    '**/*.spec.tsx'
];
function listFiles(rootDir, options) {
    const include = options?.include ?? /./;
    const excludeDirs = new Set((options?.excludeDirs ?? ['node_modules', 'dist', '.git', '.ts-quality']).map((item) => (0, paths_1.normalizePath)(item)));
    const output = [];
    function visit(currentDir) {
        const entries = fs_1.default.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const absolute = path_1.default.join(currentDir, entry.name);
            const relative = (0, paths_1.normalizePath)(path_1.default.relative(rootDir, absolute));
            if (entry.isDirectory()) {
                if (excludeDirs.has(entry.name) || excludeDirs.has(relative)) {
                    continue;
                }
                visit(absolute);
                continue;
            }
            if (include.test(relative)) {
                output.push(relative);
            }
        }
    }
    if (fs_1.default.existsSync(rootDir)) {
        visit(rootDir);
    }
    return output.sort();
}
function hasHiddenDirectory(filePath) {
    return (0, paths_1.normalizePath)(filePath).split('/').slice(0, -1).some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..');
}
function patternTargetsHiddenDirectory(pattern) {
    return (0, paths_1.normalizePath)(pattern).split('/').some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..');
}
/**
 * Pattern match for source/test discovery. Hidden directories (.next, .turbo, .cache, generated snapshots such as
 * .ontology/snapshots) hold tool state rather than repository code, so a broad pattern like `**\/*.test.ts` must not
 * reach into them; a pattern that names a hidden directory explicitly (for example `.storybook/**`) still does.
 */
function matchesDiscoveryPattern(pattern, filePath) {
    return matchPattern(pattern, filePath) && (!hasHiddenDirectory(filePath) || patternTargetsHiddenDirectory(pattern));
}
function collectSourceFiles(rootDir, patterns = [...exports.DEFAULT_SOURCE_PATTERNS]) {
    const files = listFiles(rootDir, { include: /\.(ts|tsx|js|jsx|mjs|cjs)$/ });
    return files.filter((filePath) => patterns.some((pattern) => matchesDiscoveryPattern(pattern, filePath)));
}
function globToRegExp(pattern) {
    const normalized = (0, paths_1.normalizePath)(pattern);
    let output = '^';
    for (let index = 0; index < normalized.length;) {
        if (normalized.slice(index, index + 3) === '**/') {
            output += '(?:.*/)?';
            index += 3;
            continue;
        }
        if (normalized.slice(index, index + 2) === '**') {
            output += '.*';
            index += 2;
            continue;
        }
        const current = normalized[index] ?? '';
        if (current === '*') {
            output += '[^/]*';
            index += 1;
            continue;
        }
        output += current.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        index += 1;
    }
    output += '$';
    return new RegExp(output);
}
function matchPattern(pattern, value) {
    const normalizedPattern = (0, paths_1.normalizePath)(pattern);
    const normalizedValue = (0, paths_1.normalizePath)(value);
    if (normalizedPattern.startsWith('path:')) {
        return matchPattern(normalizedPattern.slice(5), normalizedValue);
    }
    if (!normalizedPattern.includes('*')) {
        return normalizedPattern === normalizedValue;
    }
    return globToRegExp(normalizedPattern).test(normalizedValue);
}
function matchesAny(patterns, value) {
    return patterns.some((pattern) => matchPattern(pattern, value));
}
function resolveCoverageEvidence(filePath, coverage) {
    const normalized = (0, paths_1.normalizePath)(filePath);
    const exact = coverage.find((item) => (0, paths_1.normalizePath)(item.filePath) === normalized);
    if (exact) {
        return { match: 'exact', evidence: exact };
    }
    const suffixMatches = coverage.filter((item) => (0, paths_1.normalizePath)(item.filePath).endsWith(`/${normalized}`));
    if (suffixMatches.length === 1) {
        return { match: 'suffix', evidence: suffixMatches[0] };
    }
    if (suffixMatches.length > 1) {
        return { match: 'ambiguous', candidates: suffixMatches.map((item) => (0, paths_1.normalizePath)(item.filePath)).sort((left, right) => left.localeCompare(right)) };
    }
    return { match: 'missing' };
}
function findCoverageEvidence(filePath, coverage) {
    return resolveCoverageEvidence(filePath, coverage).evidence;
}
function repoDigest(rootDir, filePaths) {
    const entries = filePaths.map((filePath) => ({ filePath, digest: (0, text_io_1.fileDigest)(path_1.default.join(rootDir, filePath)) }));
    return (0, text_io_1.digestObject)(entries);
}
function inferPackages(rootDir) {
    const packageJsonFiles = listFiles(rootDir, { include: /package\.json$/ });
    return packageJsonFiles.map((filePath) => {
        const packageDir = (0, paths_1.normalizePath)(path_1.default.dirname(filePath));
        const packageJson = (0, text_io_1.readJson)(path_1.default.join(rootDir, filePath));
        return {
            name: packageJson.name ?? packageDir,
            dir: packageDir === '.' ? '' : packageDir
        };
    });
}
function resolvePackageName(filePath, packages) {
    const normalized = (0, paths_1.normalizePath)(filePath);
    const match = packages
        .filter((entry) => normalized === entry.dir || normalized.startsWith(`${entry.dir}/`) || entry.dir === '')
        .sort((left, right) => right.dir.length - left.dir.length)[0];
    return match?.name;
}
function buildRepositoryEntity(rootDir, filePaths) {
    const packages = inferPackages(rootDir);
    return {
        rootDir: (0, paths_1.normalizePath)(rootDir),
        name: path_1.default.basename(rootDir),
        packages,
        digest: repoDigest(rootDir, filePaths)
    };
}
function loadOptionalJsonArray(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        return [];
    }
    return (0, text_io_1.readJson)(filePath);
}
function isWaiverActive(waiver, nowIso) {
    if (!waiver.expiresAt) {
        return true;
    }
    return new Date(nowIso).getTime() <= new Date(waiver.expiresAt).getTime();
}
function isFindingWaived(finding, waivers, nowIso) {
    return waivers.find((waiver) => waiver.ruleId === (finding.ruleId ?? finding.code) && isWaiverActive(waiver, nowIso) && finding.scope.every((scope) => waiver.scope.some((item) => matchPattern(item, scope) || item === scope)));
}
function parseUnifiedDiff(diffText) {
    const regions = [];
    let currentFile;
    let counter = 0;
    for (const line of diffText.split(/\r?\n/)) {
        if (line.startsWith('+++ b/')) {
            currentFile = (0, paths_1.normalizePath)(line.slice(6));
            continue;
        }
        const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
        if (match && currentFile) {
            const startLine = Number(match[1]);
            const lineCount = Number(match[2] ?? '1');
            regions.push({
                filePath: currentFile,
                hunkId: `hunk-${counter++}`,
                span: {
                    startLine,
                    endLine: startLine + Math.max(lineCount - 1, 0)
                }
            });
        }
    }
    return regions;
}
function summarizeMutationScore(results) {
    const killed = results.filter((result) => result.status === 'killed').length;
    const survived = results.filter((result) => result.status === 'survived').length;
    const total = killed + survived;
    return {
        killed,
        survived,
        total,
        measured: total > 0,
        score: total === 0 ? 0 : killed / total
    };
}
function changedFileSet(changedFiles, changedRegions) {
    return new Set([...changedFiles.map((item) => (0, paths_1.normalizePath)(item)), ...changedRegions.map((item) => (0, paths_1.normalizePath)(item.filePath))]);
}
function spanOverlaps(line, span) {
    return line >= span.startLine && line <= span.endLine;
}
//# sourceMappingURL=discovery.js.map