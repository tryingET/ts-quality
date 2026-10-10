"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeModuleExport = writeModuleExport;
exports.relativeToRoot = relativeToRoot;
exports.materializeProject = materializeProject;
exports.adoptFromRun = adoptFromRun;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const config_1 = require("./config");
const mutation_remediation_1 = require("./mutation-remediation");
function writeModuleExport(filePath, value) {
    if (filePath.endsWith('.json')) {
        (0, index_1.writeJson)(filePath, value);
        return;
    }
    (0, index_1.ensureDir)(path_1.default.dirname(filePath));
    const existingText = fs_1.default.existsSync(filePath) ? fs_1.default.readFileSync(filePath, 'utf8') : '';
    const useCommonJs = filePath.endsWith('.cjs') || /\bmodule\.exports\b|\bexports\.default\b/.test(existingText);
    const moduleText = useCommonJs
        ? `module.exports = ${(0, index_1.stableStringify)(value)};\n`
        : `export default ${(0, index_1.stableStringify)(value)};\n`;
    fs_1.default.writeFileSync(filePath, moduleText, 'utf8');
}
function relativeToRoot(rootDir, targetPath) {
    return (0, index_1.normalizePath)(path_1.default.relative(rootDir, targetPath));
}
function materializedOutputDir(rootDir, outDir) {
    const target = outDir ?? '.ts-quality/materialized';
    return (0, index_1.resolveRepoLocalPath)(rootDir, target, { allowMissing: true, kind: 'materialized output dir' }).absolutePath;
}
function materializedFilePath(outDir, fileName) {
    return path_1.default.join(outDir, fileName);
}
function materializedInputRelativePath(sourceRelativePath) {
    return path_1.default.posix.join('inputs', (0, index_1.normalizePath)(sourceRelativePath));
}
function materializeProject(rootDir, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const outputDir = materializedOutputDir(rootDir, options?.outDir);
    (0, index_1.ensureDir)(outputDir);
    const invariants = (0, config_1.loadInvariants)(rootDir, loaded.config.invariantsPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const approvals = (0, config_1.loadApprovals)(rootDir, loaded.config.approvalsPath);
    const waivers = (0, config_1.loadWaivers)(rootDir, loaded.config.waiversPath);
    const overrides = (0, config_1.loadOverrides)(rootDir, loaded.config.overridesPath);
    const files = [];
    const writeMaterializedJson = (fileName, value) => {
        const absolutePath = materializedFilePath(outputDir, fileName);
        (0, index_1.writeJson)(absolutePath, value);
        const relativePath = relativeToRoot(rootDir, absolutePath);
        files.push(relativePath);
        return relativePath;
    };
    const materializedConfig = {
        ...loaded.config,
        invariantsPath: writeMaterializedJson('invariants.json', invariants),
        constitutionPath: writeMaterializedJson('constitution.json', constitution),
        agentsPath: writeMaterializedJson('agents.json', agents),
        approvalsPath: writeMaterializedJson('approvals.json', approvals),
        waiversPath: writeMaterializedJson('waivers.json', waivers),
        overridesPath: writeMaterializedJson('overrides.json', overrides)
    };
    if (loaded.config.changeSet.diffFile) {
        const diffSourceResolution = (0, index_1.resolveRepoLocalPath)(rootDir, loaded.config.changeSet.diffFile, { allowMissing: true, kind: 'diff file' });
        if (fs_1.default.existsSync(diffSourceResolution.absolutePath)) {
            const diffTarget = materializedFilePath(outputDir, materializedInputRelativePath(diffSourceResolution.relativePath));
            (0, index_1.ensureDir)(path_1.default.dirname(diffTarget));
            fs_1.default.copyFileSync(diffSourceResolution.absolutePath, diffTarget);
            materializedConfig.changeSet = {
                ...materializedConfig.changeSet,
                diffFile: relativeToRoot(rootDir, diffTarget)
            };
            files.push(relativeToRoot(rootDir, diffTarget));
        }
    }
    const configTarget = materializedFilePath(outputDir, 'ts-quality.config.json');
    (0, index_1.writeJson)(configTarget, materializedConfig);
    const configPath = relativeToRoot(rootDir, configTarget);
    files.push(configPath);
    return {
        configPath,
        outDir: relativeToRoot(rootDir, outputDir),
        files
    };
}
function sourceRunPath(inputPath) {
    const absoluteInput = path_1.default.resolve(inputPath);
    if (fs_1.default.existsSync(absoluteInput) && fs_1.default.statSync(absoluteInput).isFile()) {
        if (path_1.default.basename(absoluteInput) !== 'run.json') {
            throw new Error(`adoption source must be a run.json file or run directory: ${inputPath}`);
        }
        return absoluteInput;
    }
    const candidate = path_1.default.join(absoluteInput, 'run.json');
    if (!fs_1.default.existsSync(candidate)) {
        throw new Error(`adoption source run.json not found: ${inputPath}`);
    }
    return candidate;
}
function sourceRootForRunPath(runJsonPath) {
    const runDir = path_1.default.dirname(runJsonPath);
    const runsDir = path_1.default.dirname(runDir);
    const tsQualityDir = path_1.default.dirname(runsDir);
    if (path_1.default.basename(runsDir) !== 'runs' || path_1.default.basename(tsQualityDir) !== '.ts-quality') {
        throw new Error(`adoption source must be under .ts-quality/runs/<run-id>/run.json: ${runJsonPath}`);
    }
    return path_1.default.dirname(tsQualityDir);
}
function sourceFileExistsInside(sourceRoot, relativePath) {
    if (relativePath.endsWith('.receipt.json')) {
        return false;
    }
    try {
        const source = (0, index_1.resolveRepoLocalPath)(sourceRoot, relativePath, { kind: 'adoption source' });
        return fs_1.default.existsSync(source.absolutePath) && fs_1.default.statSync(source.absolutePath).isFile();
    }
    catch {
        return false;
    }
}
function sourceConfigAdoptionPaths(sourceRoot, run) {
    const explicitConfigPath = run.controlPlane?.configPath ?? run.analysis?.configPath;
    try {
        const loaded = (0, config_1.loadContext)(sourceRoot, explicitConfigPath);
        return [
            relativeToRoot(sourceRoot, loaded.configPath),
            loaded.config.invariantsPath,
            loaded.config.constitutionPath,
            loaded.config.agentsPath,
            loaded.config.approvalsPath,
            loaded.config.waiversPath,
            loaded.config.overridesPath,
            ...trustedPublicKeyFiles(sourceRoot, loaded.config.trustedKeysDir)
        ];
    }
    catch {
        return [
            run.controlPlane?.configPath,
            run.analysis?.configPath,
            '.ts-quality/invariants.ts',
            '.ts-quality/invariants.js',
            '.ts-quality/invariants.json',
            run.controlPlane?.constitutionPath,
            run.controlPlane?.agentsPath,
            run.controlPlane?.approvalsPath,
            run.controlPlane?.waiversPath,
            run.controlPlane?.overridesPath
        ].filter((item) => typeof item === 'string' && item.length > 0);
    }
}
function trustedPublicKeyFiles(sourceRoot, trustedKeysDir) {
    try {
        const directory = (0, index_1.resolveRepoLocalPath)(sourceRoot, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' });
        if (!fs_1.default.existsSync(directory.absolutePath) || !fs_1.default.statSync(directory.absolutePath).isDirectory()) {
            return [];
        }
        return fs_1.default.readdirSync(directory.absolutePath, { withFileTypes: true })
            .filter((entry) => entry.isFile() && entry.name.endsWith('.pub.pem'))
            .map((entry) => (0, index_1.normalizePath)(path_1.default.join(directory.relativePath, entry.name)))
            .filter((relativePath) => sourceFileExistsInside(sourceRoot, relativePath));
    }
    catch {
        return [];
    }
}
function existingAdoptionSourceFiles(sourceRoot, run) {
    const candidates = (0, mutation_remediation_1.uniqueStrings)([
        ...sourceConfigAdoptionPaths(sourceRoot, run),
        ...run.behaviorClaims.flatMap((claim) => claim.evidenceSummary?.executionWitnessFiles ?? [])
    ].filter((item) => typeof item === 'string' && item.length > 0));
    return candidates.filter((relativePath) => sourceFileExistsInside(sourceRoot, relativePath));
}
function copyAdoptionFile(sourceRoot, targetRoot, relativePath, result) {
    const source = (0, index_1.resolveRepoLocalPath)(sourceRoot, relativePath, { kind: 'adoption source' });
    const target = (0, index_1.resolveRepoLocalPath)(targetRoot, relativePath, { allowMissing: true, kind: 'adoption target' });
    if (fs_1.default.existsSync(target.absolutePath)) {
        if (!fs_1.default.statSync(target.absolutePath).isFile()) {
            result.skipped.push({ path: relativePath, reason: 'already-exists-non-file' });
            return;
        }
        const existing = fs_1.default.readFileSync(target.absolutePath);
        const incoming = fs_1.default.readFileSync(source.absolutePath);
        result.skipped.push({ path: relativePath, reason: existing.equals(incoming) ? 'already-exists-identical' : 'already-exists-different' });
        return;
    }
    (0, index_1.ensureDir)(path_1.default.dirname(target.absolutePath));
    fs_1.default.copyFileSync(source.absolutePath, target.absolutePath);
    result.copied.push(relativePath);
}
function adoptFromRun(rootDir, options) {
    const runJsonPath = sourceRunPath(options.fromRun);
    const sourceRoot = sourceRootForRunPath(runJsonPath);
    const run = (0, index_1.readJson)(runJsonPath);
    const runDirectoryId = path_1.default.basename(path_1.default.dirname(runJsonPath));
    if (run.runId !== runDirectoryId) {
        throw new Error(`adoption source run id mismatch: run.json says ${run.runId} but directory is ${runDirectoryId}`);
    }
    const result = {
        sourceRunId: run.runId,
        sourceRoot,
        copied: [],
        skipped: [],
        omittedEphemeral: (0, mutation_remediation_1.uniqueStrings)([
            '.ts-quality/runs/',
            '.ts-quality/latest.json',
            '.ts-quality/mutation-manifest.json',
            run.analysis?.coverageLcovPath,
            ...run.behaviorClaims.flatMap((claim) => (claim.evidenceSummary?.executionWitnessFiles ?? []).map((filePath) => filePath.replace(/\.json$/u, '.receipt.json')))
        ].filter((item) => typeof item === 'string' && item.length > 0))
    };
    for (const relativePath of existingAdoptionSourceFiles(sourceRoot, run)) {
        copyAdoptionFile(sourceRoot, rootDir, relativePath, result);
    }
    result.copied.sort();
    result.skipped.sort((left, right) => left.path.localeCompare(right.path));
    return result;
}
//# sourceMappingURL=materialize-adopt.js.map