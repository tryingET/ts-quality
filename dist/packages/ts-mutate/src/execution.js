"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUTATION_WORKSPACE_EXCLUDE_SET = void 0;
exports.hasSyntaxErrors = hasSyntaxErrors;
exports.boundedDetails = boundedDetails;
exports.runCommand = runCommand;
exports.runCommandReceipt = runCommandReceipt;
exports.canonicalRuntimeMirrorRoots = canonicalRuntimeMirrorRoots;
exports.repoFileDigests = repoFileDigests;
exports.buildExecutionFingerprint = buildExecutionFingerprint;
exports.manifestKey = manifestKey;
exports.loadManifest = loadManifest;
exports.saveManifest = saveManifest;
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
exports.MUTATION_WORKSPACE_EXCLUDE_SET = new Set(MUTATION_WORKSPACE_EXCLUDES);
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
const DETAILS_HEAD = 200;
const DETAILS_TAIL = 600;
/**
 * Bounds recorded command output but keeps both ends: the start says what failed, and test runners name the failing
 * tests at the end. The omitted middle is marked.
 */
function boundedDetails(text) {
    const trimmed = text.trim();
    if (trimmed.length <= DETAILS_HEAD + DETAILS_TAIL + 3) {
        return trimmed;
    }
    return `${trimmed.slice(0, DETAILS_HEAD).trimEnd()} … ${trimmed.slice(-DETAILS_TAIL).trimStart()}`;
}
function commandDetails(result) {
    return boundedDetails(`${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`);
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
            receipt: { status: 'error', durationMs, details: boundedDetails(`test command terminated by signal ${result.signal}. ${commandDetails(result)}`) },
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
        if (filePath.split('/').some((segment) => exports.MUTATION_WORKSPACE_EXCLUDE_SET.has(segment))) {
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
//# sourceMappingURL=execution.js.map