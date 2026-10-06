"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverMutationSites = discoverMutationSites;
exports.parseMutationTarget = parseMutationTarget;
exports.selectMutationSites = selectMutationSites;
exports.applyMutation = applyMutation;
exports.runMutations = runMutations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
// Bumped when mutant-workspace or outcome semantics change so cached results from older versions are not reused
// (9: a signal-killed test process is an error, not a kill).
const MUTATION_RUNTIME_VERSION = '9';
const SANITIZED_MUTATION_ENV_KEYS = ['NODE_TEST_CONTEXT'];
const MUTATION_WORKSPACE_EXCLUDES = ['.git', 'node_modules', '.ts-quality'];
const MUTATION_WORKSPACE_EXCLUDE_SET = new Set(MUTATION_WORKSPACE_EXCLUDES);
function mutationCommandEnv(baseEnv = process.env) {
    const env = { ...baseEnv };
    for (const key of SANITIZED_MUTATION_ENV_KEYS) {
        delete env[key];
    }
    return env;
}
function mutationEnvFingerprint(env) {
    return Object.fromEntries(Object.entries(env)
        .filter(([, value]) => typeof value === 'string' && value.length > 0)
        .sort(([left], [right]) => left.localeCompare(right)));
}
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
const DEFAULT_MUTATION_SOURCE_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'];
function targetError(spec, why) {
    return new Error(`Invalid mutation target "${spec}": ${why}. Use file:<path>, span:<path>:<start>-<end>, symbol:<path>#<kind:name>[@<start>-<end>] or site:<id>.`);
}
function lineRange(spec, text) {
    const match = /^([1-9]\d*)-([1-9]\d*)$/.exec(text);
    if (!match || Number(match[1]) > Number(match[2])) {
        throw targetError(spec, 'expected a line range <start>-<end> with start <= end');
    }
    return { startLine: Number(match[1]), endLine: Number(match[2]) };
}
function parseMutationTarget(spec) {
    const colon = spec.indexOf(':');
    const kind = colon > 0 ? spec.slice(0, colon) : '';
    const rest = colon > 0 ? spec.slice(colon + 1) : '';
    if (!rest) {
        throw targetError(spec, 'missing kind or value');
    }
    if (kind === 'file') {
        return { kind, filePath: (0, index_1.normalizePath)(rest) };
    }
    if (kind === 'site') {
        return { kind, siteId: rest };
    }
    if (kind === 'span') {
        const separator = rest.lastIndexOf(':');
        if (separator <= 0) {
            throw targetError(spec, 'expected span:<path>:<start>-<end>');
        }
        return { kind, filePath: (0, index_1.normalizePath)(rest.slice(0, separator)), ...lineRange(spec, rest.slice(separator + 1)) };
    }
    if (kind === 'symbol') {
        const hash = rest.indexOf('#');
        if (hash <= 0 || hash === rest.length - 1) {
            throw targetError(spec, 'expected symbol:<path>#<kind:name>');
        }
        const filePath = (0, index_1.normalizePath)(rest.slice(0, hash));
        const symbolText = rest.slice(hash + 1);
        // Only a trailing @<start>-<end> is a span; names such as arrow:<anonymous@6> keep their @.
        const at = /@(\d+-\d+)$/.exec(symbolText);
        return at && at.index > 0
            ? { kind, filePath, symbol: symbolText.slice(0, at.index), ...lineRange(spec, at[1]) }
            : { kind, filePath, symbol: symbolText };
    }
    throw targetError(spec, `unknown kind "${kind}"`);
}
function spanContains(outer, inner) {
    return outer.startLine <= inner.startLine && inner.endLine <= outer.endLine;
}
function functionKind(node) {
    if (typescript_1.default.isFunctionDeclaration(node))
        return 'function';
    if (typescript_1.default.isMethodDeclaration(node))
        return 'method';
    if (typescript_1.default.isConstructorDeclaration(node))
        return 'constructor';
    if (typescript_1.default.isGetAccessorDeclaration(node))
        return 'get';
    if (typescript_1.default.isSetAccessorDeclaration(node))
        return 'set';
    if (typescript_1.default.isArrowFunction(node))
        return 'arrow';
    if (typescript_1.default.isFunctionExpression(node))
        return 'function-expression';
    return undefined;
}
/** Executable function bodies with their character ranges, so ownership is decided by offsets, not shared lines. */
function functionNodeRanges(sourceText, filePath) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const ranges = [];
    const visit = (node) => {
        if (isAmbientDeclaration(node)) {
            return;
        }
        const kind = functionKind(node);
        if (kind && node.body) {
            const start = node.getStart(sourceFile);
            ranges.push({
                kind,
                start,
                end: node.end,
                span: { startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1, endLine: sourceFile.getLineAndCharacterOfPosition(node.end).line + 1 }
            });
        }
        typescript_1.default.forEachChild(node, visit);
    };
    visit(sourceFile);
    return ranges;
}
function innermostFunction(ranges, offset) {
    return ranges
        .filter((range) => range.start <= offset && offset < range.end)
        .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
}
function siteExistsOutsideScope(target, context) {
    for (const filePath of context.sourceFiles) {
        if (inChangedScope(filePath, context.changed)) {
            continue;
        }
        const text = fs_1.default.readFileSync(path_1.default.join(context.repoRoot, filePath), 'utf8');
        if (candidateMutationSites(text, filePath).some((site) => site.id === target.siteId)) {
            return true;
        }
    }
    return false;
}
function resolveTarget(target, context) {
    const none = { matches: () => false, nested: () => false };
    const unresolved = (reason) => ({ resolution: { target, status: 'unresolved', reason, matchedSites: 0, selectedSites: 0 }, ...none });
    const resolved = (matches, nested = () => false) => ({ resolution: { target, status: 'resolved', matchedSites: 0, selectedSites: 0 }, matches, nested });
    if (target.kind === 'site') {
        if (context.discovered.some((site) => site.id === target.siteId)) {
            return resolved((site) => site.id === target.siteId);
        }
        return unresolved(siteExistsOutsideScope(target, context) ? 'outside-changed-scope' : 'stale-site');
    }
    const filePath = (0, index_1.normalizePath)(target.filePath);
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
    const candidates = context.functions.filter((item) => (0, index_1.normalizePath)(item.filePath) === filePath && item.symbol === target.symbol);
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
    const owner = exact[0];
    const kind = target.symbol.slice(0, target.symbol.indexOf(':'));
    const ranges = functionNodeRanges(context.sourceTexts.get(filePath) ?? '', filePath);
    const ownerRanges = ranges.filter((range) => range.kind === kind && range.span.startLine === owner.span.startLine && range.span.endLine === owner.span.endLine);
    if (ownerRanges.length !== 1) {
        // Two functions of the same kind on identical lines cannot be told apart by the inventory.
        return unresolved(ownerRanges.length === 0 ? 'not-found' : 'ambiguous');
    }
    const ownerRange = ownerRanges[0];
    // A site belongs to the function whose body most tightly encloses it; nested and sibling functions own their own sites.
    const ownedBy = (site) => (site.filePath === filePath ? innermostFunction(ranges, site.startOffset) : undefined);
    return resolved((site) => ownedBy(site) === ownerRange, (site) => site.filePath === filePath && ownerRange.start <= site.startOffset && site.startOffset < ownerRange.end && ownedBy(site) !== ownerRange);
}
/**
 * Inert mutation selection: discovers, filters and budgets sites and records why each was or was not selected.
 * Runs no command and writes nothing.
 */
function selectMutationSites(options) {
    const sourceFiles = (options.sourceFiles ?? (0, index_1.collectSourceFiles)(options.repoRoot, DEFAULT_MUTATION_SOURCE_PATTERNS))
        .filter((filePath) => !(0, index_1.matchPattern)('**/*.d.ts', filePath))
        .map((filePath) => (0, index_1.normalizePath)(filePath));
    const changedRegions = options.changedRegions ?? [];
    const context = {
        changed: (0, index_1.changedFileSet)(options.changedFiles ?? [], changedRegions),
        changedRegions,
        coverage: options.coverage ?? [],
        coveredOnly: options.coveredOnly ?? false
    };
    const sourceTexts = new Map();
    const discovered = sourceFiles
        .filter((filePath) => inChangedScope(filePath, context.changed))
        .flatMap((filePath) => {
        const text = fs_1.default.readFileSync(path_1.default.join(options.repoRoot, filePath), 'utf8');
        sourceTexts.set(filePath, text);
        return candidateMutationSites(text, filePath);
    });
    const excluded = [];
    const exclude = (site, reason) => {
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
function applyMutation(sourceText, site) {
    return `${sourceText.slice(0, site.startOffset)}${site.replacement}${sourceText.slice(site.endOffset)}`;
}
function copyRecursive(sourceDir, destinationDir, exclude) {
    (0, index_1.ensureDir)(destinationDir);
    for (const entry of fs_1.default.readdirSync(sourceDir, { withFileTypes: true })) {
        if (exclude.has(entry.name)) {
            continue;
        }
        const sourcePath = path_1.default.join(sourceDir, entry.name);
        const destinationPath = path_1.default.join(destinationDir, entry.name);
        if (entry.isDirectory()) {
            copyRecursive(sourcePath, destinationPath, exclude);
        }
        else {
            (0, index_1.ensureDir)(path_1.default.dirname(destinationPath));
            fs_1.default.copyFileSync(sourcePath, destinationPath);
        }
    }
}
function hasSyntaxErrors(filePath, sourceText) {
    const transpileResult = typescript_1.default.transpileModule(sourceText, {
        fileName: filePath,
        compilerOptions: {
            allowJs: true,
            target: typescript_1.default.ScriptTarget.ES2020,
            module: typescript_1.default.ModuleKind.CommonJS
        },
        reportDiagnostics: true
    });
    return (transpileResult.diagnostics ?? []).some((diagnostic) => diagnostic.category === typescript_1.default.DiagnosticCategory.Error);
}
function stdioText(value) {
    return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}
function commandDetails(result) {
    return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}
function requiredExecutable(command) {
    const executable = command[0];
    if (!executable) {
        throw new Error('Mutation test command must contain an executable argument.');
    }
    return executable;
}
function runCommand(cwd, testCommand, timeoutMs) {
    const started = Date.now();
    const result = (0, child_process_1.spawnSync)(requiredExecutable(testCommand), testCommand.slice(1), {
        cwd,
        encoding: 'utf8',
        timeout: timeoutMs,
        shell: process.platform === 'win32',
        env: mutationCommandEnv()
    });
    const durationMs = Date.now() - started;
    const exitCode = typeof result.status === 'number' ? result.status : undefined;
    if (result.error) {
        const error = result.error;
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
function runCommandReceipt(cwd, testCommand, timeoutMs) {
    return runCommand(cwd, testCommand, timeoutMs).receipt;
}
function canonicalRuntimeMirrorRoots(runtimeMirrorRoots) {
    const seen = new Set();
    const roots = [];
    for (const candidate of runtimeMirrorRoots ?? ['dist']) {
        const normalized = (0, index_1.normalizePath)(candidate);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        roots.push(normalized);
    }
    return roots.length > 0 ? roots : ['dist'];
}
function mutationFingerprintFilePaths(repoRoot) {
    return (0, index_1.listFiles)(repoRoot, { excludeDirs: MUTATION_WORKSPACE_EXCLUDES })
        .filter((filePath) => {
        if (filePath.split('/').some((segment) => MUTATION_WORKSPACE_EXCLUDE_SET.has(segment))) {
            return false;
        }
        const absolutePath = path_1.default.join(repoRoot, filePath);
        try {
            return fs_1.default.lstatSync(absolutePath).isFile();
        }
        catch {
            return false;
        }
    });
}
function repoFileDigests(repoRoot) {
    return mutationFingerprintFilePaths(repoRoot)
        .map((filePath) => ({ filePath, digest: (0, index_1.fileDigest)(path_1.default.join(repoRoot, filePath)) }));
}
function buildExecutionFingerprint(testCommand, runtimeMirrorRoots, repoFiles) {
    const effectiveEnv = mutationCommandEnv();
    return (0, index_1.digestObject)({
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
function manifestKey(repoRoot, site, executionFingerprint) {
    const absolutePath = path_1.default.join(repoRoot, site.filePath);
    const fileText = fs_1.default.readFileSync(absolutePath, 'utf8');
    return (0, index_1.digestObject)({ site, sourceDigest: (0, index_1.digestObject)(fileText), executionFingerprint });
}
function loadManifest(filePath) {
    if (!filePath || !fs_1.default.existsSync(filePath)) {
        return { version: '2', entries: {} };
    }
    const manifest = (0, index_1.readJson)(filePath);
    return manifest.version === '2' ? manifest : { version: '2', entries: {} };
}
function saveManifest(filePath, manifest) {
    if (!filePath) {
        return;
    }
    (0, index_1.writeJson)(filePath, manifest);
}
function linkSharedPath(sourcePath, destinationPath) {
    if (!fs_1.default.existsSync(sourcePath) || fs_1.default.existsSync(destinationPath)) {
        return;
    }
    const type = fs_1.default.statSync(sourcePath).isDirectory() ? 'junction' : 'file';
    fs_1.default.symlinkSync(sourcePath, destinationPath, type);
}
/** Repo-relative node_modules directories, including nested workspace-package ones, without descending into any node_modules. */
function nodeModulesRoots(repoRoot, currentDir = repoRoot) {
    const roots = [];
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        // A node_modules that is itself a symlink (shared install dirs, container volumes) is still the install root.
        const symlinkedNodeModules = entry.name === 'node_modules' && entry.isSymbolicLink() && fs_1.default.existsSync(absolutePath) && fs_1.default.statSync(absolutePath).isDirectory();
        if (!entry.isDirectory() && !symlinkedNodeModules) {
            continue;
        }
        if (entry.name === 'node_modules') {
            roots.push((0, index_1.normalizePath)(path_1.default.relative(repoRoot, absolutePath)));
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
function workspaceLinkTarget(realRepoRoot, linkPath) {
    let realTarget;
    try {
        realTarget = fs_1.default.realpathSync(linkPath);
    }
    catch {
        return undefined;
    }
    const relativeTarget = path_1.default.relative(realRepoRoot, realTarget);
    if (relativeTarget === '' || relativeTarget.startsWith('..') || path_1.default.isAbsolute(relativeTarget)) {
        return undefined;
    }
    return relativeTarget.split(path_1.default.sep).includes('node_modules') ? undefined : relativeTarget;
}
/**
 * Mirrors one node_modules directory entry by entry. Third-party entries link to the real repo, but workspace-package
 * links (pnpm `packages/b/node_modules/@scope/a -> ../../../a`, npm `node_modules/@scope/a -> ../packages/a`) are
 * re-pointed at the mutant workspace so tests that import a sibling package by name exercise the mutated copy.
 */
function mirrorNodeModules(repoRoot, realRepoRoot, tempDir, relativeDir) {
    const sourceDir = path_1.default.join(repoRoot, relativeDir);
    const destinationDir = path_1.default.join(tempDir, relativeDir);
    fs_1.default.mkdirSync(destinationDir, { recursive: true });
    for (const entry of fs_1.default.readdirSync(sourceDir, { withFileTypes: true })) {
        const entryRelative = path_1.default.join(relativeDir, entry.name);
        if (entry.name.startsWith('@') && entry.isDirectory()) {
            mirrorNodeModules(repoRoot, realRepoRoot, tempDir, entryRelative);
            continue;
        }
        const workspaceTarget = entry.isSymbolicLink() ? workspaceLinkTarget(realRepoRoot, path_1.default.join(repoRoot, entryRelative)) : undefined;
        if (workspaceTarget !== undefined) {
            fs_1.default.symlinkSync(path_1.default.join(tempDir, workspaceTarget), path_1.default.join(tempDir, entryRelative), 'junction');
            continue;
        }
        linkSharedPath(path_1.default.join(repoRoot, entryRelative), path_1.default.join(tempDir, entryRelative));
    }
}
// Workspace managers such as pnpm keep package-only dependencies in each package's own node_modules,
// so linking only the root one would make mutants fail on module resolution and count as killed.
function hydrateTempRuntime(repoRoot, tempDir) {
    const realRepoRoot = fs_1.default.realpathSync(repoRoot);
    for (const relativePath of nodeModulesRoots(repoRoot)) {
        if (fs_1.default.existsSync(path_1.default.dirname(path_1.default.join(tempDir, relativePath)))) {
            mirrorNodeModules(repoRoot, realRepoRoot, tempDir, relativePath);
        }
    }
}
function clearExcludedWorkspaceEntries(rootDir, currentDir) {
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
        const excluded = MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath);
        if (excluded) {
            if (entry.name === 'node_modules' || relativePath === 'node_modules') {
                continue;
            }
            fs_1.default.rmSync(absolutePath, { recursive: true, force: true });
            continue;
        }
        if (entry.isDirectory()) {
            clearExcludedWorkspaceEntries(rootDir, absolutePath);
        }
    }
}
function walkMutationWorkspace(rootDir, currentDir, visit) {
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
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
function restoreWorkspaceFile(repoRoot, tempDir, relativePath) {
    const sourcePath = path_1.default.join(repoRoot, relativePath);
    const destinationPath = path_1.default.join(tempDir, relativePath);
    (0, index_1.ensureDir)(path_1.default.dirname(destinationPath));
    fs_1.default.rmSync(destinationPath, { recursive: true, force: true });
    fs_1.default.copyFileSync(sourcePath, destinationPath);
}
function pruneEmptyDirectories(rootDir, currentDir) {
    let empty = true;
    for (const entry of fs_1.default.readdirSync(currentDir, { withFileTypes: true })) {
        const absolutePath = path_1.default.join(currentDir, entry.name);
        const relativePath = (0, index_1.normalizePath)(path_1.default.relative(rootDir, absolutePath));
        if (entry.isDirectory()) {
            if (MUTATION_WORKSPACE_EXCLUDE_SET.has(entry.name) || MUTATION_WORKSPACE_EXCLUDE_SET.has(relativePath)) {
                empty = false;
                continue;
            }
            if (pruneEmptyDirectories(rootDir, absolutePath)) {
                fs_1.default.rmdirSync(absolutePath);
                continue;
            }
            empty = false;
            continue;
        }
        empty = false;
    }
    return currentDir !== rootDir && empty;
}
function prepareMutationWorkspace(repoRoot, repoFiles) {
    const tempRoot = path_1.default.join(repoRoot, '.ts-quality', 'tmp-mutants');
    (0, index_1.ensureDir)(tempRoot);
    const tempDir = fs_1.default.mkdtempSync(path_1.default.join(tempRoot, 'mutant-'));
    copyRecursive(repoRoot, tempDir, MUTATION_WORKSPACE_EXCLUDE_SET);
    hydrateTempRuntime(repoRoot, tempDir);
    return {
        tempDir,
        snapshot: new Map(repoFiles.map(({ filePath, digest }) => [(0, index_1.normalizePath)(filePath), digest]))
    };
}
function resetMutationWorkspace(repoRoot, workspace) {
    clearExcludedWorkspaceEntries(workspace.tempDir, workspace.tempDir);
    const seen = new Set();
    walkMutationWorkspace(workspace.tempDir, workspace.tempDir, (absolutePath, relativePath, kind) => {
        const normalizedPath = (0, index_1.normalizePath)(relativePath);
        seen.add(normalizedPath);
        const expectedDigest = workspace.snapshot.get(normalizedPath);
        if (!expectedDigest) {
            fs_1.default.rmSync(absolutePath, { recursive: true, force: true });
            return;
        }
        if (kind === 'symlink' || (0, index_1.fileDigest)(absolutePath) !== expectedDigest) {
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
function disposeMutationWorkspace(workspace) {
    if (!workspace) {
        return;
    }
    fs_1.default.rmSync(workspace.tempDir, { recursive: true, force: true });
}
function transpileRuntimeMirrorSource(repoRoot, site, mutatedSource) {
    const compilerOptions = (0, index_1.compilerOptionsForRepoFile)(repoRoot, site.filePath) ?? {};
    const transpiled = typescript_1.default.transpileModule(mutatedSource, {
        fileName: site.filePath,
        compilerOptions: {
            ...compilerOptions,
            target: compilerOptions.target ?? typescript_1.default.ScriptTarget.ES2020,
            module: compilerOptions.module ?? typescript_1.default.ModuleKind.CommonJS,
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
function writeRuntimeMirrors(repoRoot, tempDir, site, mutatedSource, runtimeMirrorRoots) {
    const extension = path_1.default.extname(site.filePath);
    const runtimeSource = extension === '.ts' || extension === '.tsx'
        ? transpileRuntimeMirrorSource(repoRoot, site, mutatedSource)
        : mutatedSource;
    for (const candidate of (0, index_1.runtimeMirrorCandidates)(site.filePath, runtimeMirrorRoots)) {
        const mirrorPath = path_1.default.join(tempDir, candidate);
        if (!fs_1.default.existsSync(mirrorPath) || !fs_1.default.statSync(mirrorPath).isFile()) {
            continue;
        }
        fs_1.default.writeFileSync(mirrorPath, runtimeSource, 'utf8');
    }
}
function assertionHintForMutation(site) {
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
function mutationResultForSite(site, input) {
    const result = {
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
function runSingleMutation(repoRoot, workspace, site, mutatedSource, testCommand, timeoutMs, runtimeMirrorRoots) {
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
        const targetPath = path_1.default.join(workspace.tempDir, site.filePath);
        (0, index_1.ensureDir)(path_1.default.dirname(targetPath));
        fs_1.default.writeFileSync(targetPath, mutatedSource, 'utf8');
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
    }
    finally {
        resetMutationWorkspace(repoRoot, workspace);
    }
}
/** Killed, survived and invalid outcomes are reusable for the same fingerprint; infrastructure errors are retried, never cached. */
function cacheableResult(result) {
    return result.status === 'killed' || result.status === 'survived' || result.status === 'invalid';
}
function runMutations(options) {
    const coverage = options.coverage ?? [];
    const selectionOptions = {
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
    const finish = (results, runBaseline) => {
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
    const untrustedRun = (failedBaseline) => finish(limitedSites.map((site) => mutationResultForSite(site, {
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
    const results = [];
    let workspace;
    let phaseStartedAt;
    let executedCount = 0;
    try {
        for (const site of limitedSites) {
            const key = manifestKey(options.repoRoot, site, executionFingerprint);
            const cached = manifest.entries[key];
            if (cached && cacheableResult(cached)) {
                const cachedInput = {
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
            const sourceText = fs_1.default.readFileSync(path_1.default.join(options.repoRoot, site.filePath), 'utf8');
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
    }
    finally {
        disposeMutationWorkspace(workspace);
    }
    saveManifest(options.manifestPath, manifest);
    return finish(results, baseline);
}
//# sourceMappingURL=index.js.map