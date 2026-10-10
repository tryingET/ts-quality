"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileEntities = fileEntities;
exports.symbolEntities = symbolEntities;
exports.uniquePaths = uniquePaths;
exports.buildAnalysisManifest = buildAnalysisManifest;
exports.refreshExecutionWitnessPlans = refreshExecutionWitnessPlans;
exports.buildAnalysisContext = buildAnalysisContext;
exports.isSourceTsFile = isSourceTsFile;
exports.builtOutputRoots = builtOutputRoots;
exports.detectBuiltOutputCoverageWarnings = detectBuiltOutputCoverageWarnings;
exports.refreshExecutionWitnesses = refreshExecutionWitnesses;
exports.sourceFilesExcludingTests = sourceFilesExcludingTests;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../crap4ts/src/index");
const index_3 = require("../../invariants/src/index");
const config_1 = require("./config");
const witness_commands_1 = require("./witness-commands");
/** Check-time analysis: changed scope, coverage generation and reading, witness plans and the analysis context. */
function fileEntities(rootDir, filePaths) {
    const repo = (0, index_1.buildRepositoryEntity)(rootDir, filePaths);
    return filePaths.map((filePath) => {
        const normalizedFilePath = (0, index_1.normalizePath)(filePath);
        const result = {
            filePath: normalizedFilePath,
            digest: (0, index_1.fileDigest)(path_1.default.join(rootDir, filePath))
        };
        const packageName = (0, index_1.resolvePackageName)(normalizedFilePath, repo.packages);
        if (packageName) {
            result.packageName = packageName;
        }
        return result;
    });
}
function symbolEntities(complexity) {
    return complexity.map((item) => ({
        filePath: item.filePath,
        symbol: item.symbol,
        kind: item.symbol.split(':')[0] ?? 'function',
        span: item.span
    }));
}
function resolveChangedFileOverride(rootDir, filePath) {
    return (0, index_1.resolveRepoLocalPath)(rootDir, filePath, { allowMissing: true, kind: 'changed file override' }).relativePath;
}
function uniquePaths(values) {
    const seen = new Set();
    const result = [];
    for (const value of values.map((item) => (0, index_1.normalizePath)(item)).filter(Boolean)) {
        if (seen.has(value)) {
            continue;
        }
        seen.add(value);
        result.push(value);
    }
    return result;
}
function missingChangeScopeError(diffFile) {
    const detail = diffFile
        ? ` Configured diff file ${diffFile} did not contribute any changed hunks.`
        : '';
    return new Error(`Changed scope is required.${detail} Provide --changed <a,b,c> or configure changeSet.files / changeSet.diffFile with at least one changed file or hunk before running ts-quality check.`);
}
function runCoverageGenerationCommand(rootDir, input) {
    const command = input.command.filter((item) => item.length > 0);
    if (command.length === 0) {
        throw new Error('coverage.generateCommand must contain at least one executable argument');
    }
    const executable = command[0];
    if (!executable) {
        throw new Error('coverage.generateCommand must contain an executable argument');
    }
    const started = Date.now();
    const result = (0, child_process_1.spawnSync)(executable, command.slice(1), {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: input.timeoutMs,
        shell: process.platform === 'win32',
        env: (0, witness_commands_1.executionWitnessCommandEnv)()
    });
    const durationMs = Date.now() - started;
    const receipt = result.error
        ? {
            status: result.error.code === 'ETIMEDOUT' ? 'timeout' : 'error',
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: result.error.message ?? 'unknown coverage generation command error'
        }
        : {
            status: result.status === 0 ? 'pass' : 'fail',
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: (0, witness_commands_1.executionWitnessCommandDetails)(result)
        };
    return {
        lcovPath: input.lcovPath,
        command,
        attemptedAt: input.attemptedAt,
        receipt
    };
}
function readCoverageWithOptionalGeneration(rootDir, input) {
    const coverageAbsolutePath = path_1.default.join(rootDir, input.coveragePath);
    if (fs_1.default.existsSync(coverageAbsolutePath)) {
        return { coverage: (0, index_2.parseLcov)(fs_1.default.readFileSync(coverageAbsolutePath, 'utf8')) };
    }
    if (!input.generateCoverage || !input.generateWhenMissing || input.generateCommand.length === 0) {
        return { coverage: [] };
    }
    (0, index_1.ensureDir)(path_1.default.dirname(coverageAbsolutePath));
    const coverageGeneration = runCoverageGenerationCommand(rootDir, {
        lcovPath: input.coveragePath,
        command: input.generateCommand,
        timeoutMs: input.generateTimeoutMs,
        attemptedAt: input.attemptedAt
    });
    if (coverageGeneration.receipt.status !== 'pass') {
        // Raw text: the CLI error boundary escapes control characters once; pre-escaping here double-escaped them.
        throw new Error(`coverage generation command ${coverageGeneration.receipt.status}; expected LCOV at ${input.coveragePath}${coverageGeneration.receipt.details ? `\n${coverageGeneration.receipt.details}` : ''}`);
    }
    if (!fs_1.default.existsSync(coverageAbsolutePath)) {
        throw new Error(`coverage generation command passed but did not create expected LCOV at ${input.coveragePath}`);
    }
    return {
        coverage: (0, index_2.parseLcov)(fs_1.default.readFileSync(coverageAbsolutePath, 'utf8')),
        coverageGeneration
    };
}
function buildAnalysisManifest(rootDir, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const sourceFiles = sourceFilesExcludingTests(rootDir, loaded.config.sourcePatterns, loaded.config.testPatterns ?? [...index_1.DEFAULT_TEST_PATTERNS]);
    const changedRegions = loaded.config.changeSet.diffFile ? (0, config_1.loadChangedRegions)(rootDir, loaded.config.changeSet.diffFile) : [];
    const configuredChangedFiles = loaded.config.changeSet.files ?? [];
    const baseChangedFiles = options?.changedFiles
        ? options.changedFiles.map((item) => resolveChangedFileOverride(rootDir, item))
        : [...configuredChangedFiles];
    const changedFiles = uniquePaths([...baseChangedFiles, ...changedRegions.map((item) => item.filePath)]);
    if (changedFiles.length === 0) {
        throw missingChangeScopeError(loaded.config.changeSet.diffFile || undefined);
    }
    const coveragePath = loaded.config.coverage.lcovPath ?? 'coverage/lcov.info';
    const coverageResult = readCoverageWithOptionalGeneration(rootDir, {
        coveragePath,
        generateCommand: loaded.config.coverage.generateCommand ?? [],
        generateWhenMissing: loaded.config.coverage.generateWhenMissing ?? true,
        generateTimeoutMs: loaded.config.coverage.generateTimeoutMs ?? 60_000,
        generateCoverage: options?.generateCoverage ?? false,
        attemptedAt: options?.observedAt ?? (0, index_1.nowIso)()
    });
    return {
        loaded,
        sourceFiles,
        changedFiles,
        changedRegions,
        coveragePath,
        coverage: coverageResult.coverage,
        ...(coverageResult.coverageGeneration ? { coverageGeneration: coverageResult.coverageGeneration } : {}),
        runtimeMirrorRoots: [...(loaded.config.mutations.runtimeMirrorRoots ?? ['dist'])]
    };
}
function refreshExecutionWitnessPlans(rootDir, input) {
    const crapReport = (0, index_2.analyzeCrap)({
        rootDir,
        sourceFiles: input.sourceFiles,
        coverage: input.coverage,
        changedFiles: input.changedFiles,
        changedRegions: input.changedRegions
    });
    const planSummary = (0, index_3.collectExecutionWitnessPlanSummary)({
        invariants: input.invariants,
        changedFiles: input.changedFiles,
        changedRegions: input.changedRegions,
        complexity: crapReport.hotspots
    });
    const autoRan = [];
    for (const witnessPlan of planSummary.autoRun) {
        const witnessResult = (0, witness_commands_1.runExecutionWitnessCommand)(rootDir, {
            invariantId: witnessPlan.invariantId,
            scenarioId: witnessPlan.scenarioId,
            sourceFiles: witnessPlan.sourceFiles,
            ...(witnessPlan.testFiles.length > 0 ? { testFiles: witnessPlan.testFiles } : {}),
            outputPath: witnessPlan.outputPath,
            command: witnessPlan.command,
            ...(witnessPlan.timeoutMs !== undefined ? { timeoutMs: witnessPlan.timeoutMs } : {}),
            observedAt: input.observedAt
        });
        autoRan.push({
            invariantId: witnessPlan.invariantId,
            scenarioId: witnessPlan.scenarioId,
            outputPath: witnessResult.recordedOutputPath,
            receiptPath: witnessResult.recordedReceiptPath,
            command: [...witnessPlan.command],
            sourceFiles: [...witnessPlan.sourceFiles],
            ...(witnessPlan.testFiles.length > 0 ? { testFiles: [...witnessPlan.testFiles] } : {}),
            observedAt: input.observedAt,
            receipt: witnessResult.receipt
        });
    }
    const skipped = planSummary.skipped.map((item) => ({
        invariantId: item.invariantId,
        scenarioId: item.scenarioId,
        outputPath: item.outputPath,
        command: [...item.command],
        ...(item.testFiles.length > 0 ? { testFiles: [...item.testFiles] } : {}),
        reason: item.reason
    }));
    return { autoRan, skipped };
}
function buildAnalysisContext(input) {
    return {
        runId: input.runId,
        createdAt: input.createdAt,
        configPath: input.configPath,
        coverageLcovPath: input.coverageLcovPath,
        runtimeMirrorRoots: [...input.runtimeMirrorRoots],
        sourceFiles: [...input.sourceFiles],
        changedFiles: [...input.changedFiles],
        changedRegions: [...input.changedRegions],
        executionFingerprint: input.executionFingerprint
    };
}
function isSourceTsFile(filePath) {
    return /(?:^|\/)src\/.*\.tsx?$/.test((0, index_1.normalizePath)(filePath));
}
function builtOutputRoots(runtimeMirrorRoots) {
    return uniquePaths(['dist', 'lib', 'build', ...runtimeMirrorRoots]);
}
function coverageHasFile(coverage, filePath) {
    const normalized = (0, index_1.normalizePath)(filePath);
    return coverage.some((item) => (0, index_1.normalizePath)(item.filePath) === normalized);
}
function detectBuiltOutputCoverageWarnings(input) {
    const roots = builtOutputRoots(input.runtimeMirrorRoots);
    const warnings = [];
    const coveredFiles = input.coverage.map((item) => (0, index_1.normalizePath)(item.filePath));
    for (const changedFile of input.changedFiles.map((item) => (0, index_1.normalizePath)(item)).filter(isSourceTsFile)) {
        if (coverageHasFile(input.coverage, changedFile)) {
            continue;
        }
        const mirrorCandidates = (0, index_1.runtimeMirrorCandidates)(changedFile, roots);
        const matchingBuilt = coveredFiles.filter((filePath) => mirrorCandidates.includes(filePath));
        if (matchingBuilt.length === 0) {
            continue;
        }
        warnings.push({
            code: 'coverage-built-output-without-source-map',
            message: 'Coverage exists for built output but not changed source.',
            changedFile,
            evidence: [`changed source ${changedFile} has no LCOV entry`, `built LCOV entries: ${matchingBuilt.slice(0, 5).join(', ')}`],
            hint: 'Coverage exists for built output but not changed source. Enable source-map coverage mapping, for example NODE_OPTIONS=--enable-source-maps, or configure coverage to map back to src/**.'
        });
    }
    return warnings;
}
function refreshExecutionWitnesses(rootDir, options) {
    const manifest = buildAnalysisManifest(rootDir, options);
    const invariants = (0, config_1.loadInvariants)(rootDir, manifest.loaded.config.invariantsPath);
    return refreshExecutionWitnessPlans(rootDir, {
        sourceFiles: manifest.sourceFiles,
        changedFiles: manifest.changedFiles.map((item) => (0, index_1.normalizePath)(item)),
        changedRegions: manifest.changedRegions,
        coverage: manifest.coverage,
        invariants,
        observedAt: options?.observedAt ?? (0, index_1.nowIso)()
    });
}
/** Source files are never test files, even when tests are colocated under a source root such as src/__tests__. */
function sourceFilesExcludingTests(rootDir, sourcePatterns, testPatterns) {
    return (0, index_1.collectSourceFiles)(rootDir, sourcePatterns).filter((filePath) => !testPatterns.some((pattern) => (0, index_1.matchPattern)(pattern, filePath)));
}
//# sourceMappingURL=analysis.js.map