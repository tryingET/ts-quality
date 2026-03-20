"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.materializeProject = materializeProject;
exports.loadVerifiedAttestations = loadVerifiedAttestations;
exports.runCheck = runCheck;
exports.initProject = initProject;
exports.renderLatestReport = renderLatestReport;
exports.renderLatestExplain = renderLatestExplain;
exports.renderTrend = renderTrend;
exports.renderGovernance = renderGovernance;
exports.renderPlan = renderPlan;
exports.runAuthorize = runAuthorize;
exports.attestSign = attestSign;
exports.attestVerify = attestVerify;
exports.attestGenerateKey = attestGenerateKey;
exports.runAmend = runAmend;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../crap4ts/src/index");
const index_3 = require("../../ts-mutate/src/index");
const index_4 = require("../../invariants/src/index");
const index_5 = require("../../policy-engine/src/index");
const index_6 = require("../../governance/src/index");
const index_7 = require("../../legitimacy/src/index");
const config_1 = require("./config");
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
function renderInvariantProvenanceBlock(run, options) {
    const riskyInvariant = (0, index_5.findFirstRiskyInvariantClaim)(run);
    if (!riskyInvariant) {
        return [];
    }
    const linePrefix = options?.linePrefix ?? '';
    const lines = [
        `${linePrefix}Invariant evidence at risk: ${riskyInvariant.invariantId}`,
        ...(0, index_5.renderConciseInvariantProvenance)(riskyInvariant, { linePrefix })
    ];
    if (options?.includeObligation !== false && riskyInvariant.obligations.length > 0) {
        lines.push(`${linePrefix}Obligation: ${riskyInvariant.obligations[0]?.description}`);
    }
    return lines;
}
function renderCheckSummaryText(run) {
    const lines = [
        `Merge confidence: ${run.verdict.mergeConfidence}/100`,
        `Outcome: ${run.verdict.outcome}`,
        `Best next action: ${run.verdict.bestNextAction ?? 'none'}`
    ];
    const provenance = renderInvariantProvenanceBlock(run, { includeObligation: false });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    return `${lines.join('\n')}\n`;
}
function renderPlanText(run, plan) {
    const lines = [plan.summary];
    const provenance = renderInvariantProvenanceBlock(run);
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    if (plan.steps.length > 0) {
        lines.push('', ...plan.steps.map((step, index) => `${index + 1}. ${step.title}\n   ${step.rationale}\n   evidence: ${step.evidence.join('; ')}\n   tradeoffs: ${step.tradeoffs.join('; ')}`));
    }
    return `${lines.join('\n')}\n`;
}
function renderPlanArtifactText(run, plan) {
    const lines = [plan.summary];
    const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    if (plan.steps.length > 0) {
        lines.push('', ...plan.steps.map((step, index) => `${index + 1}. [${step.type}] ${step.title}\n   rationale: ${step.rationale}\n   evidence: ${step.evidence.join('; ')}\n   tradeoffs: ${step.tradeoffs.join('; ')}`));
    }
    return `${lines.join('\n')}\n`;
}
function renderGovernanceText(run, plan) {
    const lines = run.governance.map((item) => `${item.ruleId}: ${item.message}`);
    const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    lines.push('', plan.summary);
    return `${lines.join('\n')}\n`;
}
function renderGovernanceArtifactText(run, plan) {
    const lines = run.governance.flatMap((item) => [`${item.ruleId}: ${item.message}`, ...item.evidence.map((evidence) => `- ${evidence}`)]);
    const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    return `${lines.join('\n')}\n`;
}
function authorizationRiskSignals(claim) {
    const summary = claim.evidenceSummary;
    if (!summary || summary.subSignals.length === 0) {
        return [];
    }
    const projectedSignals = summary.subSignals
        .filter((item) => item.mode !== 'explicit' || item.level !== 'clear')
        .slice(0, 3);
    const selectedSignals = projectedSignals.length > 0 ? projectedSignals : summary.subSignals.slice(0, Math.min(2, 3));
    return selectedSignals.map(({ signalId, label, level, mode, summary: signalSummary }) => ({
        signalId,
        label,
        level,
        mode,
        summary: signalSummary
    }));
}
function buildAuthorizationEvidenceContext(run, agentId, action) {
    const riskyInvariant = (0, index_5.findFirstRiskyInvariantClaim)(run);
    const riskySummary = riskyInvariant?.evidenceSummary;
    const evidenceProvenance = riskySummary?.subSignals.reduce((counts, item) => {
        counts[item.mode] += 1;
        return counts;
    }, { explicit: 0, inferred: 0, missing: 0 });
    return {
        runId: run.runId,
        runOutcome: run.verdict.outcome,
        mergeConfidence: run.verdict.mergeConfidence,
        bestNextAction: run.verdict.bestNextAction,
        artifactPaths: {
            run: `.ts-quality/runs/${run.runId}/run.json`,
            verdict: `.ts-quality/runs/${run.runId}/verdict.json`,
            governance: `.ts-quality/runs/${run.runId}/govern.txt`,
            bundle: `.ts-quality/runs/${run.runId}/bundle.${agentId}.${action}.json`
        },
        governanceErrors: run.governance
            .filter((item) => item.level === 'error')
            .map(({ ruleId, message, evidence, scope }) => ({ ruleId, message, evidence, scope })),
        riskyInvariant: riskyInvariant && evidenceProvenance
            ? {
                invariantId: riskyInvariant.invariantId,
                description: riskyInvariant.description,
                evidenceProvenance,
                signals: authorizationRiskSignals(riskyInvariant),
                obligation: riskyInvariant.obligations[0]?.description
            }
            : undefined
    };
}
function latestRunOrUndefined(rootDir) {
    try {
        return (0, index_1.readLatestRun)(rootDir);
    }
    catch {
        return undefined;
    }
}
function portablePath(value) {
    return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}
function resolveCliPath(rootDir, candidate, options) {
    if (path_1.default.isAbsolute(candidate)) {
        return candidate;
    }
    const cwdResolved = path_1.default.resolve(process.cwd(), candidate);
    const rootResolved = path_1.default.resolve(rootDir, candidate);
    const rootRelativeFromCwd = portablePath(path_1.default.relative(process.cwd(), rootDir));
    const normalizedCandidate = portablePath(candidate);
    if (fs_1.default.existsSync(rootResolved)) {
        return rootResolved;
    }
    if (fs_1.default.existsSync(cwdResolved)) {
        return cwdResolved;
    }
    if (rootRelativeFromCwd && (normalizedCandidate === rootRelativeFromCwd || normalizedCandidate.startsWith(`${rootRelativeFromCwd}/`))) {
        return cwdResolved;
    }
    return options?.preferRoot === false ? cwdResolved : rootResolved;
}
function relativePathInsideRoot(rootDir, absolutePath) {
    const relative = portablePath(path_1.default.relative(rootDir, absolutePath));
    if (!relative || relative === '..' || relative.startsWith('../') || path_1.default.isAbsolute(relative)) {
        return undefined;
    }
    return (0, index_1.normalizePath)(relative);
}
function runScopedArtifactReference(subjectFile) {
    const match = /^\.ts-quality\/runs\/([^/]+)\/([^/]+)$/.exec((0, index_1.normalizePath)(subjectFile));
    if (!match) {
        return undefined;
    }
    return {
        runId: match[1] ?? '',
        artifactName: match[2] ?? ''
    };
}
function recordSubjectPath(rootDir, resolvedSubject, originalCandidate) {
    const relative = relativePathInsideRoot(rootDir, resolvedSubject);
    if (relative) {
        return relative;
    }
    throw new Error(`attestation subject must be inside --root: ${originalCandidate}`);
}
function verifyAttestationAtRoot(rootDir, attestation, trustedKeys) {
    const signature = (0, index_7.verifyAttestation)(attestation, trustedKeys);
    if (!signature.ok) {
        return signature;
    }
    const subjectFile = typeof attestation.payload?.subjectFile === 'string' ? attestation.payload.subjectFile : undefined;
    if (!subjectFile) {
        return { ok: false, reason: 'subject file missing from attestation payload' };
    }
    if (path_1.default.isAbsolute(subjectFile)) {
        return { ok: false, reason: 'subject file must be repo-relative' };
    }
    const normalizedSubject = (0, index_1.normalizePath)(subjectFile);
    const resolvedSubject = path_1.default.resolve(rootDir, normalizedSubject);
    const relativeSubject = relativePathInsideRoot(rootDir, resolvedSubject);
    if (!relativeSubject || relativeSubject !== normalizedSubject) {
        return { ok: false, reason: 'subject file escapes repository root' };
    }
    const scopedSubject = runScopedArtifactReference(normalizedSubject);
    const payloadRunId = typeof attestation.payload?.runId === 'string' ? attestation.payload.runId : undefined;
    if (payloadRunId && scopedSubject && payloadRunId !== scopedSubject.runId) {
        return { ok: false, reason: 'attestation payload runId does not match subject path' };
    }
    if (!fs_1.default.existsSync(resolvedSubject)) {
        return { ok: false, reason: `subject file missing: ${subjectFile}` };
    }
    const digest = (0, index_1.digestObject)(fs_1.default.readFileSync(resolvedSubject, 'utf8'));
    if (digest !== attestation.subjectDigest) {
        return { ok: false, reason: 'subject digest mismatch' };
    }
    return { ok: true, reason: 'verified' };
}
function attestationAppliesToRun(attestation, runId) {
    const subjectFile = typeof attestation.payload?.subjectFile === 'string' ? attestation.payload.subjectFile : undefined;
    if (!subjectFile || path_1.default.isAbsolute(subjectFile)) {
        return false;
    }
    const scopedSubject = runScopedArtifactReference(subjectFile);
    if (!scopedSubject || scopedSubject.runId !== runId) {
        return false;
    }
    const payloadRunId = typeof attestation.payload?.runId === 'string' ? attestation.payload.runId : undefined;
    return payloadRunId === undefined || payloadRunId === runId;
}
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
function attestationFiles(rootDir, dirRelative) {
    const directory = (0, index_1.resolveRepoLocalPath)(rootDir, dirRelative, { allowMissing: true, kind: 'attestations dir' }).absolutePath;
    if (!fs_1.default.existsSync(directory)) {
        return [];
    }
    return fs_1.default.readdirSync(directory).filter((entry) => entry.endsWith('.json')).map((entry) => path_1.default.join(directory, entry)).sort();
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
function loadVerifiedAttestations(rootDir, attestationsDir, trustedKeysDir) {
    const keysDir = (0, index_1.resolveRepoLocalPath)(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
    const keys = (0, index_7.loadTrustedKeys)(keysDir);
    const verification = [];
    const attestations = [];
    for (const filePath of attestationFiles(rootDir, attestationsDir)) {
        let rawAttestation;
        try {
            rawAttestation = JSON.parse(fs_1.default.readFileSync(filePath, 'utf8'));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            verification.push({ issuer: path_1.default.basename(filePath), ok: false, reason: `invalid JSON: ${message}` });
            continue;
        }
        const parsed = (0, index_7.parseAttestationRecord)(rawAttestation);
        if (!parsed.ok) {
            verification.push({ issuer: path_1.default.basename(filePath), ok: false, reason: parsed.reason });
            continue;
        }
        const attestation = parsed.attestation;
        const result = verifyAttestationAtRoot(rootDir, attestation, keys);
        verification.push({ issuer: attestation.issuer, ok: result.ok, reason: result.reason });
        if (result.ok) {
            attestations.push(attestation);
        }
    }
    return { attestations, verification };
}
function buildAnalysisContext(input) {
    return {
        runId: input.runId,
        createdAt: input.createdAt,
        sourceFiles: [...input.sourceFiles],
        changedFiles: [...input.changedFiles],
        changedRegions: [...input.changedRegions],
        executionFingerprint: input.executionFingerprint
    };
}
function runCheck(rootDir, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const sourceFiles = (0, index_1.collectSourceFiles)(rootDir, loaded.config.sourcePatterns);
    const changedRegions = loaded.config.changeSet.diffFile ? (0, config_1.loadChangedRegions)(rootDir, loaded.config.changeSet.diffFile) : [];
    const configuredChangedFiles = loaded.config.changeSet.files ?? [];
    const changedFiles = (options?.changedFiles ?? (configuredChangedFiles.length > 0 ? configuredChangedFiles : sourceFiles)).map((item) => (0, index_1.normalizePath)(item));
    const runId = (0, index_1.assertSafeRunId)(options?.runId ?? (0, index_1.createRunId)());
    const createdAt = (0, index_1.nowIso)();
    const lcovPath = path_1.default.join(rootDir, loaded.config.coverage.lcovPath);
    const coverage = fs_1.default.existsSync(lcovPath) ? (0, index_2.parseLcov)(fs_1.default.readFileSync(lcovPath, 'utf8')) : [];
    const waivers = (0, config_1.loadWaivers)(rootDir, loaded.config.waiversPath);
    const approvals = (0, config_1.loadApprovals)(rootDir, loaded.config.approvalsPath);
    const overrides = (0, config_1.loadOverrides)(rootDir, loaded.config.overridesPath);
    const invariants = (0, config_1.loadInvariants)(rootDir, loaded.config.invariantsPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const previousRun = latestRunOrUndefined(rootDir);
    const crapReport = (0, index_2.analyzeCrap)({
        rootDir,
        sourceFiles,
        coverage,
        changedFiles,
        changedRegions
    });
    const mutationRun = (0, index_3.runMutations)({
        repoRoot: rootDir,
        sourceFiles,
        changedFiles,
        changedRegions,
        coverage,
        coveredOnly: loaded.config.mutations.coveredOnly ?? false,
        testCommand: loaded.config.mutations.testCommand,
        manifestPath: path_1.default.join(rootDir, '.ts-quality', 'mutation-manifest.json'),
        timeoutMs: loaded.config.mutations.timeoutMs ?? 15_000,
        maxSites: loaded.config.mutations.maxSites ?? 25,
        runtimeMirrorRoots: loaded.config.mutations.runtimeMirrorRoots ?? ['dist']
    });
    const claims = (0, index_4.evaluateInvariants)({
        rootDir,
        invariants,
        changedFiles,
        changedRegions,
        complexity: crapReport.hotspots,
        mutationSites: mutationRun.sites,
        mutations: mutationRun.results,
        testPatterns: loaded.config.testPatterns
    });
    const verifiedAttestations = loadVerifiedAttestations(rootDir, loaded.config.attestationsDir, loaded.config.trustedKeysDir);
    const preliminaryInput = {
        nowIso: (0, index_1.nowIso)(),
        policy: {
            ...(0, index_5.defaultPolicy)(),
            ...loaded.config.policy
        },
        changedComplexity: crapReport.hotspots.filter((item) => item.changed),
        mutations: mutationRun.results,
        mutationBaseline: mutationRun.baseline,
        behaviorClaims: claims,
        governance: [],
        waivers
    };
    if (previousRun) {
        preliminaryInput.previousRun = previousRun;
    }
    const preliminary = (0, index_5.evaluatePolicy)(preliminaryInput);
    const governance = (0, index_6.evaluateGovernance)({
        rootDir,
        constitution,
        changedFiles,
        changedRegions,
        approvals,
        runId,
        attestationsClaims: verifiedAttestations.attestations.flatMap((item) => item.claims),
        run: {
            complexity: crapReport.hotspots,
            mutations: mutationRun.results,
            verdict: preliminary.verdict
        }
    });
    const evaluatedInput = {
        nowIso: (0, index_1.nowIso)(),
        policy: {
            ...(0, index_5.defaultPolicy)(),
            ...loaded.config.policy
        },
        changedComplexity: crapReport.hotspots.filter((item) => item.changed),
        mutations: mutationRun.results,
        mutationBaseline: mutationRun.baseline,
        behaviorClaims: claims,
        governance,
        waivers,
        ...(previousRun ? { previousRun } : {})
    };
    const evaluated = (0, index_5.evaluatePolicy)(evaluatedInput);
    const repo = (0, index_1.buildRepositoryEntity)(rootDir, sourceFiles);
    const analysis = buildAnalysisContext({
        runId,
        createdAt,
        sourceFiles,
        changedFiles,
        changedRegions,
        executionFingerprint: mutationRun.executionFingerprint
    });
    const run = {
        version: '5.0.0',
        runId,
        createdAt,
        repo,
        changedFiles,
        changedRegions,
        analysis,
        files: fileEntities(rootDir, sourceFiles),
        symbols: symbolEntities(crapReport.hotspots),
        coverage,
        complexity: crapReport.hotspots,
        mutationSites: mutationRun.sites,
        mutations: mutationRun.results,
        mutationBaseline: mutationRun.baseline,
        invariants,
        behaviorClaims: claims,
        governance,
        attestations: verifiedAttestations.attestations,
        approvals,
        overrides,
        verdict: evaluated.verdict
    };
    if (evaluated.trend) {
        run.trend = evaluated.trend;
    }
    const artifactDir = (0, index_1.writeRunArtifact)(rootDir, run);
    (0, index_1.writeJson)(path_1.default.join(artifactDir, 'report.json'), run);
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'report.md'), `${(0, index_5.renderMarkdownReport)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'pr-summary.md'), `${(0, index_5.renderPrSummary)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'explain.txt'), `${(0, index_5.renderExplainText)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'attestation-verify.txt'), `${verifiedAttestations.verification.map((item) => `${item.issuer}: ${item.ok ? 'ok' : 'failed'} (${item.reason})`).join('\n')}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'check-summary.txt'), renderCheckSummaryText(run), 'utf8');
    const plan = (0, index_6.generateGovernancePlan)(run, constitution, agents);
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'plan.txt'), renderPlanArtifactText(run, plan), 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'govern.txt'), renderGovernanceArtifactText(run, plan), 'utf8');
    return { run, artifactDir };
}
function initProject(rootDir) {
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'attestations'));
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'keys'));
    const configPath = path_1.default.join(rootDir, 'ts-quality.config.ts');
    if (!fs_1.default.existsSync(configPath)) {
        fs_1.default.writeFileSync(configPath, `export default {\n  sourcePatterns: ${(0, index_1.stableStringify)([...index_1.DEFAULT_SOURCE_PATTERNS])},\n  testPatterns: ${(0, index_1.stableStringify)([...index_1.DEFAULT_TEST_PATTERNS])},\n  coverage: { lcovPath: 'coverage/lcov.info' },\n  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ['dist'] },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  changeSet: { files: [] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`, 'utf8');
    }
    const invariantsPath = path_1.default.join(rootDir, '.ts-quality', 'invariants.ts');
    if (!fs_1.default.existsSync(invariantsPath)) {
        fs_1.default.writeFileSync(invariantsPath, `export default [\n  {\n    id: 'auth.refresh.validity',\n    title: 'Refresh token validity',\n    description: 'Expired refresh tokens must never authorize access.',\n    severity: 'high',\n    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],\n    scenarios: [\n      { id: 'expired', description: 'expired token is denied', keywords: ['expired', 'deny'], failurePathKeywords: ['boundary', 'expiry'], expected: 'deny' }\n    ]\n  }\n];\n`, 'utf8');
    }
    const constitutionPath = path_1.default.join(rootDir, '.ts-quality', 'constitution.ts');
    if (!fs_1.default.existsSync(constitutionPath)) {
        fs_1.default.writeFileSync(constitutionPath, `export default [\n  { kind: 'risk', id: 'default-risk', paths: ['src/**'], message: 'Changed source must stay within risk budgets.', maxCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  { kind: 'approval', id: 'payments-review', paths: ['src/payments/**'], message: 'Payments changes require a maintainer approval.', minApprovals: 1, roles: ['maintainer'] }\n];\n`, 'utf8');
    }
    const agentsPath = path_1.default.join(rootDir, '.ts-quality', 'agents.ts');
    if (!fs_1.default.existsSync(agentsPath)) {
        fs_1.default.writeFileSync(agentsPath, `export default [\n  { id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [{ id: 'maintainer-merge', actions: ['merge', 'override', 'amend'], paths: ['src/**'], minMergeConfidence: 60 }] },\n  { id: 'release-bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'release-bot-merge', actions: ['merge'], paths: ['src/**'], minMergeConfidence: 80, requireAttestations: ['ci.tests.passed'], requireHumanReview: true }] }\n];\n`, 'utf8');
    }
    for (const fileName of ['waivers.json', 'approvals.json', 'overrides.json']) {
        const filePath = path_1.default.join(rootDir, '.ts-quality', fileName);
        if (!fs_1.default.existsSync(filePath)) {
            fs_1.default.writeFileSync(filePath, '[]\n', 'utf8');
        }
    }
    const keyBase = path_1.default.join(rootDir, '.ts-quality', 'keys', 'sample');
    if (!fs_1.default.existsSync(`${keyBase}.pem`) || !fs_1.default.existsSync(`${keyBase}.pub.pem`)) {
        const pair = (0, index_7.generateKeyPair)();
        fs_1.default.writeFileSync(`${keyBase}.pem`, pair.privateKeyPem, 'utf8');
        fs_1.default.writeFileSync(`${keyBase}.pub.pem`, pair.publicKeyPem, 'utf8');
    }
}
function renderLatestReport(rootDir, format) {
    const run = (0, index_1.readLatestRun)(rootDir);
    return format === 'json' ? `${(0, index_1.stableStringify)(run)}\n` : `${(0, index_5.renderMarkdownReport)(run)}\n`;
}
function renderLatestExplain(rootDir) {
    return `${(0, index_5.renderExplainText)((0, index_1.readLatestRun)(rootDir))}\n`;
}
function renderTrend(rootDir) {
    const runs = (0, index_1.listRunIds)(rootDir)
        .map((runId) => (0, index_1.loadRun)(rootDir, runId))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.runId.localeCompare(right.runId));
    if (runs.length < 2) {
        return 'Not enough runs for trend analysis.\n';
    }
    const current = runs[runs.length - 1];
    const previous = runs[runs.length - 2];
    if (!current || !previous) {
        return 'Not enough runs for trend analysis.\n';
    }
    const survivingCurrent = current.mutations.filter((item) => item.status === 'survived').length;
    const survivingPrevious = previous.mutations.filter((item) => item.status === 'survived').length;
    const lines = [
        `Current run: ${current.runId}`,
        `Previous run: ${previous.runId}`,
        `Merge confidence delta: ${current.verdict.mergeConfidence - previous.verdict.mergeConfidence}`,
        `Surviving mutant delta: ${survivingCurrent - survivingPrevious}`,
        `Outcome transition: ${previous.verdict.outcome} -> ${current.verdict.outcome}`
    ];
    const provenance = renderInvariantProvenanceBlock(current, { includeObligation: false });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    return `${lines.join('\n')}\n`;
}
function renderGovernance(rootDir, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const run = (0, index_1.readLatestRun)(rootDir);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const plan = (0, index_6.generateGovernancePlan)(run, constitution, agents);
    return renderGovernanceText(run, plan);
}
function renderPlan(rootDir, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const run = (0, index_1.readLatestRun)(rootDir);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const plan = (0, index_6.generateGovernancePlan)(run, constitution, agents);
    return renderPlanText(run, plan);
}
function runAuthorize(rootDir, agentId, action, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const run = (0, index_1.readLatestRun)(rootDir);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const overrides = (0, config_1.loadOverrides)(rootDir, loaded.config.overridesPath);
    const { attestations } = loadVerifiedAttestations(rootDir, loaded.config.attestationsDir, loaded.config.trustedKeysDir);
    const runAttestations = attestations.filter((attestation) => attestationAppliesToRun(attestation, run.runId));
    const bundle = (0, index_7.buildChangeBundle)(rootDir, run, agentId, action);
    const baseDecision = (0, index_7.authorizeChange)(agentId, action, bundle, run, agents, constitution, runAttestations, overrides);
    const decision = {
        ...baseDecision,
        evidenceContext: buildAuthorizationEvidenceContext(run, agentId, action)
    };
    const artifactDir = path_1.default.join(rootDir, '.ts-quality', 'runs', run.runId);
    const bundlePath = path_1.default.join(artifactDir, `bundle.${agentId}.${action}.json`);
    const decisionPath = path_1.default.join(artifactDir, `authorize.${agentId}.${action}.json`);
    (0, index_1.writeJson)(bundlePath, bundle);
    (0, index_1.writeJson)(decisionPath, decision);
    return { decisionPath, output: `${(0, index_1.stableStringify)(decision)}\n` };
}
function attestSign(rootDir, issuer, keyId, privateKeyPath, subjectFile, claims, outputPath) {
    const resolvedSubject = resolveCliPath(rootDir, subjectFile);
    const resolvedKey = resolveCliPath(rootDir, privateKeyPath);
    const recordedSubjectPath = recordSubjectPath(rootDir, resolvedSubject, subjectFile);
    const scopedSubject = runScopedArtifactReference(recordedSubjectPath);
    const subjectText = fs_1.default.readFileSync(resolvedSubject, 'utf8');
    const attestation = (0, index_7.signAttestation)({
        issuer,
        keyId,
        privateKeyPem: fs_1.default.readFileSync(resolvedKey, 'utf8'),
        subjectType: path_1.default.extname(resolvedSubject) === '.json' ? 'json-artifact' : 'file',
        subjectDigest: (0, index_1.digestObject)(subjectText),
        claims,
        payload: {
            subjectFile: recordedSubjectPath,
            ...(scopedSubject ? { runId: scopedSubject.runId, artifactName: scopedSubject.artifactName } : {})
        }
    });
    const resolvedOutput = resolveCliPath(rootDir, outputPath);
    (0, index_1.ensureDir)(path_1.default.dirname(resolvedOutput));
    (0, index_7.saveAttestation)(resolvedOutput, attestation);
    return resolvedOutput;
}
function attestVerify(rootDir, attestationFile, trustedKeysDir) {
    const parsed = (0, index_7.parseAttestationRecord)(JSON.parse(fs_1.default.readFileSync(resolveCliPath(rootDir, attestationFile), 'utf8')));
    if (!parsed.ok) {
        return `${path_1.default.basename(attestationFile)}: failed (${parsed.reason})\n`;
    }
    const attestation = parsed.attestation;
    const keysDir = (0, index_1.resolveRepoLocalPath)(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
    const keys = (0, index_7.loadTrustedKeys)(keysDir);
    const result = verifyAttestationAtRoot(rootDir, attestation, keys);
    return `${attestation.issuer}: ${result.ok ? 'verified' : 'failed'} (${result.reason})\n`;
}
function attestGenerateKey(outDir, keyId) {
    (0, index_1.ensureDir)(outDir);
    const pair = (0, index_7.generateKeyPair)();
    const privatePath = path_1.default.join(outDir, `${keyId}.pem`);
    const publicPath = path_1.default.join(outDir, `${keyId}.pub.pem`);
    fs_1.default.writeFileSync(privatePath, pair.privateKeyPem, 'utf8');
    fs_1.default.writeFileSync(publicPath, pair.publicKeyPem, 'utf8');
    return `${privatePath}\n${publicPath}\n`;
}
function runAmend(rootDir, proposalFile, apply = false, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const proposal = JSON.parse(fs_1.default.readFileSync(resolveCliPath(rootDir, proposalFile), 'utf8'));
    const decision = (0, index_7.evaluateAmendment)(proposal, constitution, agents);
    const resultPath = path_1.default.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.json`);
    (0, index_1.ensureDir)(path_1.default.dirname(resultPath));
    (0, index_1.writeJson)(resultPath, decision);
    if (apply && decision.outcome === 'approved') {
        const nextConstitution = (0, index_7.applyAmendment)(proposal, constitution);
        const constitutionPath = (0, index_1.resolveRepoLocalPath)(rootDir, loaded.config.constitutionPath, { allowMissing: true, kind: 'constitution path' }).absolutePath;
        writeModuleExport(constitutionPath, nextConstitution);
    }
    return `${(0, index_1.stableStringify)(decision)}\n`;
}
//# sourceMappingURL=index.js.map