"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverMutationSites = discoverMutationSites;
exports.applyMutation = applyMutation;
exports.runMutations = runMutations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
const MUTATION_RUNTIME_VERSION = '3';
const SANITIZED_MUTATION_ENV_KEYS = ['NODE_TEST_CONTEXT'];
const FINGERPRINT_ENV_KEYS = ['CI', 'NODE_ENV', 'NODE_OPTIONS', 'NODE_PATH', 'TS_NODE_PROJECT', 'TS_NODE_TRANSPILE_ONLY', 'TSX_TSCONFIG_PATH', 'TZ'];
function mutationCommandEnv(baseEnv = process.env) {
    const env = { ...baseEnv };
    for (const key of SANITIZED_MUTATION_ENV_KEYS) {
        delete env[key];
    }
    return env;
}
function mutationEnvFingerprint(env) {
    return FINGERPRINT_ENV_KEYS.reduce((result, key) => {
        const value = env[key];
        if (typeof value === 'string' && value.length > 0) {
            result[key] = value;
        }
        return result;
    }, {});
}
function lineOf(node, sourceFile) {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}
function spanFor(node, sourceFile) {
    const startLine = lineOf(node, sourceFile);
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
    return { startLine, endLine, startOffset: node.getStart(sourceFile), endOffset: node.end };
}
function coverageForLine(filePath, line, coverage) {
    const entry = (0, index_1.findCoverageEvidence)(filePath, coverage);
    if (!entry) {
        return true;
    }
    return (entry.lines[String(line)] ?? 0) > 0;
}
function mutationId(filePath, span, original, replacement) {
    return (0, index_1.digestObject)({ filePath: (0, index_1.normalizePath)(filePath), span, original, replacement });
}
function discoverMutationSites(sourceText, filePath, coverage = [], changedFiles = [], changedRegions = [], coveredOnly = false) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const sites = [];
    const changed = (0, index_1.changedFileSet)(changedFiles, changedRegions);
    const fileRegions = changedRegions.filter((item) => (0, index_1.normalizePath)(item.filePath) === (0, index_1.normalizePath)(filePath));
    function consider(node, replacement, operator, description) {
        const span = spanFor(node, sourceFile);
        const line = span.startLine;
        const inChangedRegion = fileRegions.some((region) => (0, index_1.spanOverlaps)(line, region.span));
        if (changed.size > 0) {
            const inChangeScope = fileRegions.length > 0 ? inChangedRegion : changed.has((0, index_1.normalizePath)(filePath));
            if (!inChangeScope) {
                return;
            }
        }
        if (coveredOnly && !coverageForLine(filePath, line, coverage)) {
            return;
        }
        const original = node.getText(sourceFile);
        sites.push({
            id: mutationId(filePath, span, original, replacement),
            filePath: (0, index_1.normalizePath)(filePath),
            span: { startLine: span.startLine, endLine: span.endLine },
            startOffset: span.startOffset,
            endOffset: span.endOffset,
            operator,
            original,
            replacement,
            description
        });
    }
    function visit(node) {
        if (typescript_1.default.isBinaryExpression(node)) {
            const token = node.operatorToken.kind;
            const text = node.operatorToken.getText(sourceFile);
            if (token === typescript_1.default.SyntaxKind.EqualsEqualsEqualsToken) {
                consider(node.operatorToken, '!==', text, 'strict equality inversion');
            }
            else if (token === typescript_1.default.SyntaxKind.ExclamationEqualsEqualsToken) {
                consider(node.operatorToken, '===', text, 'strict inequality inversion');
            }
            else if (token === typescript_1.default.SyntaxKind.GreaterThanToken) {
                consider(node.operatorToken, '>=', text, 'greater-than relaxation');
            }
            else if (token === typescript_1.default.SyntaxKind.GreaterThanEqualsToken) {
                consider(node.operatorToken, '>', text, 'greater-than tightening');
            }
            else if (token === typescript_1.default.SyntaxKind.LessThanToken) {
                consider(node.operatorToken, '<=', text, 'less-than relaxation');
            }
            else if (token === typescript_1.default.SyntaxKind.LessThanEqualsToken) {
                consider(node.operatorToken, '<', text, 'less-than tightening');
            }
            else if (token === typescript_1.default.SyntaxKind.PlusToken) {
                consider(node.operatorToken, '-', text, 'addition to subtraction');
            }
            else if (token === typescript_1.default.SyntaxKind.MinusToken) {
                consider(node.operatorToken, '+', text, 'subtraction to addition');
            }
            else if (token === typescript_1.default.SyntaxKind.AmpersandAmpersandToken) {
                consider(node.operatorToken, '||', text, 'and to or');
            }
            else if (token === typescript_1.default.SyntaxKind.BarBarToken) {
                consider(node.operatorToken, '&&', text, 'or to and');
            }
        }
        if (node.kind === typescript_1.default.SyntaxKind.TrueKeyword) {
            consider(node, 'false', 'true', 'boolean flip true->false');
        }
        if (node.kind === typescript_1.default.SyntaxKind.FalseKeyword) {
            consider(node, 'true', 'false', 'boolean flip false->true');
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return sites;
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
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    return sourceFile.parseDiagnostics.length > 0;
}
function commandDetails(result) {
    return `${(result.stdout ?? '').trim()}\n${(result.stderr ?? '').trim()}`.trim().slice(0, 280);
}
function runCommandReceipt(cwd, testCommand, timeoutMs) {
    const started = Date.now();
    const result = (0, child_process_1.spawnSync)(testCommand[0], testCommand.slice(1), {
        cwd,
        encoding: 'utf8',
        timeout: timeoutMs,
        shell: process.platform === 'win32',
        env: mutationCommandEnv()
    });
    const durationMs = Date.now() - started;
    if (result.error) {
        const error = result.error;
        const status = error.code === 'ETIMEDOUT' ? 'timeout' : 'error';
        return {
            status,
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: error.message ?? 'unknown test command error'
        };
    }
    return {
        status: result.status === 0 ? 'pass' : 'fail',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: commandDetails(result)
    };
}
function buildExecutionFingerprint(repoRoot, testCommand, runtimeMirrorRoots) {
    const repoFiles = (0, index_1.listFiles)(repoRoot, { excludeDirs: ['.git', 'node_modules', '.ts-quality'] })
        .map((filePath) => ({ filePath, digest: (0, index_1.fileDigest)(path_1.default.join(repoRoot, filePath)) }));
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
function hydrateTempRuntime(repoRoot, tempDir) {
    linkSharedPath(path_1.default.join(repoRoot, 'node_modules'), path_1.default.join(tempDir, 'node_modules'));
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
function runSingleMutation(repoRoot, site, mutatedSource, testCommand, timeoutMs, runtimeMirrorRoots) {
    if (hasSyntaxErrors(site.filePath, mutatedSource)) {
        return {
            kind: 'mutation-result',
            siteId: site.id,
            filePath: site.filePath,
            status: 'invalid',
            durationMs: 0,
            details: 'Mutation produced syntax errors'
        };
    }
    const tempRoot = path_1.default.join(repoRoot, '.ts-quality', 'tmp-mutants');
    (0, index_1.ensureDir)(tempRoot);
    const tempDir = fs_1.default.mkdtempSync(path_1.default.join(tempRoot, 'mutant-'));
    try {
        copyRecursive(repoRoot, tempDir, new Set(['.git', 'node_modules', '.ts-quality']));
        hydrateTempRuntime(repoRoot, tempDir);
        const targetPath = path_1.default.join(tempDir, site.filePath);
        (0, index_1.ensureDir)(path_1.default.dirname(targetPath));
        fs_1.default.writeFileSync(targetPath, mutatedSource, 'utf8');
        writeRuntimeMirrors(repoRoot, tempDir, site, mutatedSource, runtimeMirrorRoots);
        const receipt = runCommandReceipt(tempDir, testCommand, timeoutMs);
        return {
            kind: 'mutation-result',
            siteId: site.id,
            filePath: site.filePath,
            status: receipt.status === 'pass' ? 'survived' : receipt.status === 'fail' ? 'killed' : 'error',
            durationMs: receipt.durationMs,
            details: receipt.status === 'timeout' ? `test command timed out: ${receipt.details}` : receipt.details
        };
    }
    finally {
        fs_1.default.rmSync(tempDir, { recursive: true, force: true });
    }
}
function runMutations(options) {
    const sourceFiles = (options.sourceFiles ?? (0, index_1.collectSourceFiles)(options.repoRoot, ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs']))
        .filter((filePath) => !(0, index_1.matchPattern)('**/*.d.ts', filePath));
    const coverage = options.coverage ?? [];
    const changedFiles = options.changedFiles ?? [];
    const changedRegions = options.changedRegions ?? [];
    const sites = sourceFiles.flatMap((relativePath) => {
        const sourceText = fs_1.default.readFileSync(path_1.default.join(options.repoRoot, relativePath), 'utf8');
        return discoverMutationSites(sourceText, relativePath, coverage, changedFiles, changedRegions, options.coveredOnly ?? false);
    });
    const limitedSites = typeof options.maxSites === 'number' ? sites.slice(0, options.maxSites) : sites;
    const timeoutMs = options.timeoutMs ?? 15_000;
    const runtimeMirrorRoots = options.runtimeMirrorRoots ?? ['dist'];
    const executionFingerprint = buildExecutionFingerprint(options.repoRoot, options.testCommand, runtimeMirrorRoots);
    const baseline = runCommandReceipt(options.repoRoot, options.testCommand, timeoutMs);
    if (baseline.status !== 'pass') {
        const results = limitedSites.map((site) => ({
            kind: 'mutation-result',
            siteId: site.id,
            filePath: site.filePath,
            status: 'error',
            durationMs: baseline.durationMs,
            details: `Baseline test command must pass before mutation scoring is trusted. ${baseline.details}`.trim().slice(0, 280)
        }));
        return {
            sites: limitedSites,
            results,
            score: 0,
            killed: 0,
            survived: 0,
            baseline,
            executionFingerprint
        };
    }
    const manifest = loadManifest(options.manifestPath);
    const results = [];
    for (const site of limitedSites) {
        const key = manifestKey(options.repoRoot, site, executionFingerprint);
        const cached = manifest.entries[key];
        if (cached) {
            results.push(cached);
            continue;
        }
        const sourceText = fs_1.default.readFileSync(path_1.default.join(options.repoRoot, site.filePath), 'utf8');
        const mutatedSource = applyMutation(sourceText, site);
        const result = runSingleMutation(options.repoRoot, site, mutatedSource, options.testCommand, timeoutMs, runtimeMirrorRoots);
        results.push(result);
        manifest.entries[key] = result;
    }
    saveManifest(options.manifestPath, manifest);
    const killed = results.filter((result) => result.status === 'killed').length;
    const survived = results.filter((result) => result.status === 'survived').length;
    const total = killed + survived;
    return {
        sites: limitedSites,
        results,
        score: total === 0 ? 1 : killed / total,
        killed,
        survived,
        baseline,
        executionFingerprint
    };
}
//# sourceMappingURL=index.js.map