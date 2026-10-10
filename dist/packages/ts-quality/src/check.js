"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tsQualityPackageVersion = tsQualityPackageVersion;
exports.renderMutationPreview = renderMutationPreview;
exports.runCheck = runCheck;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../crap4ts/src/index");
const index_3 = require("../../ts-mutate/src/index");
const index_4 = require("../../invariants/src/index");
const index_5 = require("../../policy-engine/src/index");
const index_6 = require("../../governance/src/index");
const config_1 = require("./config");
const analysis_1 = require("./analysis");
const attestations_1 = require("./attestations");
const evidence_closure_1 = require("./evidence-closure");
const legitimacy_commands_1 = require("./legitimacy-commands");
const mutation_remediation_1 = require("./mutation-remediation");
const render_text_1 = require("./render-text");
const run_context_1 = require("./run-context");
const trend_1 = require("./trend");
const witness_commands_1 = require("./witness-commands");
function mutationTargetsFor(loaded, overrides) {
    return (overrides ?? loaded.config.mutations.targets ?? []).map((spec) => (0, index_3.parseMutationTarget)(spec));
}
function mutationTargetSpec(target) {
    if (target.kind === 'site') {
        return `site:${target.siteId}`;
    }
    if (target.kind === 'file') {
        return `file:${target.filePath}`;
    }
    if (target.kind === 'span') {
        return `span:${target.filePath}:${target.startLine}-${target.endLine}`;
    }
    return `symbol:${target.filePath}#${target.symbol}${target.startLine !== undefined ? `@${target.startLine}-${target.endLine}` : ''}`;
}
const DEPENDENCY_MANIFESTS = ['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
/** Mirrors the mutation runner's sanitized environment (inherited nested test-runner context removed). */
function mutationEnvironmentDigest() {
    const env = Object.entries(process.env)
        .filter(([key, value]) => key !== 'NODE_TEST_CONTEXT' && typeof value === 'string' && value.length > 0)
        .sort(([left], [right]) => left.localeCompare(right));
    return (0, index_1.digestObject)(Object.fromEntries(env));
}
function tsQualityPackageVersion() {
    for (const candidate of [path_1.default.resolve(__dirname, '../../../../packages/ts-quality/package.json'), path_1.default.resolve(__dirname, '../../../../package.json')]) {
        try {
            const version = (0, index_1.readJson)(candidate).version;
            if (typeof version === 'string') {
                return version;
            }
        }
        catch {
            // try the next location
        }
    }
    return '0.0.0';
}
function buildMutationExecutionContext(rootDir, loaded) {
    const testPatterns = loaded.config.testPatterns ?? [...index_1.DEFAULT_TEST_PATTERNS];
    // Regular files only, like the mutation fingerprint: symlinks (for example a symlinked node_modules) are not read.
    const repoFiles = (0, index_1.listFiles)(rootDir)
        .filter((filePath) => {
        try {
            return fs_1.default.lstatSync(path_1.default.join(rootDir, filePath)).isFile();
        }
        catch {
            return false;
        }
    })
        .sort((left, right) => left.localeCompare(right));
    // Same discovery rules as test selection: hidden directories only when a pattern names them.
    const isTest = (filePath) => testPatterns.some((pattern) => (0, index_1.matchesDiscoveryPattern)(pattern, filePath));
    const testFiles = repoFiles.filter(isTest);
    const nonTestFiles = repoFiles.filter((filePath) => !isTest(filePath) && !filePath.split('/').some((segment) => segment.startsWith('.')));
    const dependencyDigests = Object.fromEntries(DEPENDENCY_MANIFESTS
        .filter((name) => fs_1.default.existsSync(path_1.default.join(rootDir, name)))
        .map((name) => [name, (0, index_1.fileDigest)(path_1.default.join(rootDir, name))]));
    return {
        version: '1',
        testCommand: [...loaded.config.mutations.testCommand],
        timeoutMs: loaded.config.mutations.timeoutMs ?? 15_000,
        runtime: { node: process.version, platform: process.platform, arch: process.arch },
        environmentDigest: mutationEnvironmentDigest(),
        testFileDigests: Object.fromEntries(testFiles.map((filePath) => [filePath, (0, index_1.fileDigest)(path_1.default.join(rootDir, filePath))])),
        dependencyDigests,
        nonTestFilesDigest: (0, index_1.digestObject)(nonTestFiles.map((filePath) => ({ filePath, digest: (0, index_1.fileDigest)(path_1.default.join(rootDir, filePath)) }))),
        tool: { tsQuality: tsQualityPackageVersion() }
    };
}
function refuseUnresolvedMutationTargets(rootDir, manifest, overrides, functions) {
    const targets = mutationTargetsFor(manifest.loaded, overrides);
    if (targets.length === 0) {
        return;
    }
    const inventory = functions ?? (0, index_2.analyzeCrap)({ rootDir, sourceFiles: manifest.sourceFiles, coverage: [], changedFiles: manifest.changedFiles, changedRegions: manifest.changedRegions }).hotspots;
    const unresolved = previewMutationSelection(rootDir, manifest, inventory, targets).ledger.targets.filter((item) => item.status === 'unresolved');
    if (unresolved.length > 0) {
        throw new Error(`Mutation target(s) unresolved: ${unresolved.map((item) => `${mutationTargetSpec(item.target)} (${item.reason})`).join(', ')}. Run 'ts-quality mutations preview' to inspect current targets; no mutation evidence was produced.`);
    }
}
function previewMutationSelection(rootDir, manifest, functions, targets) {
    const mutations = manifest.loaded.config.mutations;
    return (0, index_3.selectMutationSites)({
        repoRoot: rootDir,
        sourceFiles: manifest.sourceFiles,
        changedFiles: manifest.changedFiles,
        changedRegions: manifest.changedRegions,
        coverage: manifest.coverage,
        coveredOnly: mutations.coveredOnly ?? false,
        targets,
        functions,
        maxSites: mutations.maxSites ?? 25,
        ...(mutations.maxDurationMs !== undefined ? { maxDurationMs: mutations.maxDurationMs } : {})
    });
}
/**
 * Inert mutation selection preview: the sites `check` would mutate for this scope, targets and budget, with every
 * exclusion reason. Runs no command (not even coverage generation) and writes nothing.
 */
function renderMutationPreview(rootDir, options) {
    const manifest = (0, analysis_1.buildAnalysisManifest)(rootDir, { ...options, generateCoverage: false });
    const crapReport = (0, index_2.analyzeCrap)({ rootDir, sourceFiles: manifest.sourceFiles, coverage: manifest.coverage, changedFiles: manifest.changedFiles, changedRegions: manifest.changedRegions });
    const targets = mutationTargetsFor(manifest.loaded, options?.mutationTargets);
    const selection = previewMutationSelection(rootDir, manifest, crapReport.hotspots, targets);
    const testCommand = manifest.loaded.config.mutations.testCommand;
    if (options?.json) {
        return `${(0, index_1.stableStringify)({
            version: '1',
            kind: 'mutation-preview',
            executed: false,
            changedFiles: manifest.changedFiles,
            coverageLcovPath: manifest.coveragePath,
            coverageRecords: manifest.coverage.length,
            // Inert suggestion: check runs this argv once per selected site in an isolated copy of the repository root.
            testCommand: { cwd: '.', argv: testCommand },
            selection: selection.ledger,
            sites: selection.sites.map((site) => ({ id: site.id, filePath: site.filePath, span: site.span, operator: site.operator, original: site.original, replacement: site.replacement, description: site.description }))
        })}\n`;
    }
    const { counts, policy } = selection.ledger;
    const reasonCounts = new Map();
    for (const item of selection.ledger.excluded) {
        reasonCounts.set(item.reason, (reasonCounts.get(item.reason) ?? 0) + 1);
    }
    const lines = [
        'Mutation preview (inert: no command ran and nothing was written)',
        `Changed scope: ${manifest.changedFiles.length} file(s)`,
        `Coverage: ${manifest.coverage.length > 0 ? `${manifest.coverage.length} LCOV record(s) from ${manifest.coveragePath}` : `no LCOV at ${manifest.coveragePath} (preview never generates coverage)`}`,
        `Sites: discovered ${counts.discovered}, eligible ${counts.eligible}, selected ${counts.selected}, excluded ${counts.excluded}`,
        `Budget: maxSites ${policy.maxSites ?? 'none'}, maxDurationMs ${policy.maxDurationMs ?? 'none'}; coveredOnly ${policy.coveredOnly}`
    ];
    if (selection.ledger.targets.length > 0) {
        lines.push('Targets:');
        for (const item of selection.ledger.targets) {
            lines.push(`- ${mutationTargetSpec(item.target)}: ${item.status === 'resolved' ? `resolved, ${item.matchedSites} eligible, ${item.selectedSites} selected` : `unresolved (${item.reason}); check refuses to run`}`);
        }
    }
    if (reasonCounts.size > 0) {
        lines.push(`Excluded: ${[...reasonCounts.entries()].map(([reason, count]) => `${reason} ${count}`).join(', ')}`);
    }
    lines.push('Selected sites:');
    for (const site of selection.sites) {
        lines.push(`- ${site.filePath}:${site.span.startLine} ${JSON.stringify(site.original)} -> ${JSON.stringify(site.replacement)} (${site.description}) site:${site.id}`);
    }
    if (selection.sites.length === 0) {
        lines.push('- none');
    }
    lines.push(`Mutation command per selected site (not run): ${JSON.stringify(testCommand)} in an isolated copy of the repository root`);
    return `${lines.join('\n')}\n`;
}
function runCheck(rootDir, options) {
    const runId = (0, index_1.assertSafeRunId)(options?.runId ?? (0, index_1.createRunId)());
    if (options?.mutationTargets && options.mutationTargets.length > 0) {
        // Resolve command-line targets inertly before the run id is reserved and before any command runs.
        refuseUnresolvedMutationTargets(rootDir, (0, analysis_1.buildAnalysisManifest)(rootDir, { ...options, generateCoverage: false }), options.mutationTargets);
    }
    (0, index_1.reserveRunId)(rootDir, runId);
    const createdAt = (0, index_1.nowIso)();
    const manifest = (0, analysis_1.buildAnalysisManifest)(rootDir, { ...options, generateCoverage: true, observedAt: createdAt });
    const loaded = manifest.loaded;
    const sourceFiles = manifest.sourceFiles;
    const changedFiles = manifest.changedFiles.map((item) => (0, index_1.normalizePath)(item));
    const changedFileDigests = Object.fromEntries(changedFiles.map((filePath) => [
        filePath,
        (0, run_context_1.digestOrMissing)((0, index_1.resolveRepoLocalPath)(rootDir, filePath, { allowMissing: true, kind: 'changed file' }).absolutePath)
    ]));
    const changedRegions = manifest.changedRegions;
    const coverage = manifest.coverage;
    const waivers = (0, config_1.loadWaivers)(rootDir, loaded.config.waiversPath);
    const approvals = (0, config_1.loadApprovals)(rootDir, loaded.config.approvalsPath);
    const overrides = (0, config_1.loadOverrides)(rootDir, loaded.config.overridesPath);
    const invariants = (0, config_1.loadInvariants)(rootDir, loaded.config.invariantsPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const controlPlane = (0, run_context_1.buildControlPlaneSnapshot)(rootDir, loaded, constitution, agents);
    const plannedMutationTargets = mutationTargetsFor(loaded, options?.mutationTargets);
    const previousRun = (0, trend_1.latestComparableRunOrUndefined)(rootDir, {
        runId,
        changedFiles,
        changedRegions,
        controlPlane,
        invariants,
        mutationSelection: {
            policy: {
                coveredOnly: loaded.config.mutations.coveredOnly ?? false,
                maxSites: loaded.config.mutations.maxSites ?? 25,
                maxDurationMs: loaded.config.mutations.maxDurationMs ?? null,
                targets: plannedMutationTargets
            }
        }
    });
    const crapReport = (0, index_2.analyzeCrap)({
        rootDir,
        sourceFiles,
        coverage,
        changedFiles,
        changedRegions
    });
    // Configured targets resolve here, after coverage generation but before any witness or mutant command runs.
    const mutationTargets = plannedMutationTargets;
    refuseUnresolvedMutationTargets(rootDir, manifest, options?.mutationTargets, crapReport.hotspots);
    const refreshObservedAt = createdAt;
    const executionWitnessSummary = (0, analysis_1.refreshExecutionWitnessPlans)(rootDir, {
        sourceFiles,
        changedFiles,
        changedRegions,
        coverage,
        invariants,
        observedAt: refreshObservedAt
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
        ...(loaded.config.mutations.maxDurationMs !== undefined ? { maxDurationMs: loaded.config.mutations.maxDurationMs } : {}),
        targets: mutationTargets,
        functions: crapReport.hotspots,
        runtimeMirrorRoots: manifest.runtimeMirrorRoots
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
    const verifiedAttestations = (0, attestations_1.loadVerifiedAttestations)(rootDir, loaded.config.attestationsDir, loaded.config.trustedKeysDir);
    const runAttestations = verifiedAttestations.attestations.filter((attestation) => (0, attestations_1.attestationAppliesToRun)(attestation, runId));
    const preliminaryInput = {
        nowIso: (0, index_1.nowIso)(),
        policy: (0, run_context_1.policyConfigFromLoadedContext)(loaded),
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
        attestationsClaims: runAttestations.flatMap((item) => item.claims),
        run: {
            complexity: crapReport.hotspots,
            mutations: mutationRun.results,
            verdict: preliminary.verdict
        }
    });
    const evaluatedInput = {
        nowIso: (0, index_1.nowIso)(),
        policy: (0, run_context_1.policyConfigFromLoadedContext)(loaded),
        changedComplexity: crapReport.hotspots.filter((item) => item.changed),
        mutations: mutationRun.results,
        mutationBaseline: mutationRun.baseline,
        behaviorClaims: claims,
        governance,
        waivers,
        ...(previousRun ? { previousRun } : {})
    };
    const evaluated = (0, index_5.evaluatePolicy)(evaluatedInput);
    const analysisWarnings = (0, analysis_1.detectBuiltOutputCoverageWarnings)({ changedFiles, coverage, runtimeMirrorRoots: manifest.runtimeMirrorRoots });
    const mutationRemediation = (0, mutation_remediation_1.buildMutationRemediation)(mutationRun.results);
    const repo = (0, index_1.buildRepositoryEntity)(rootDir, sourceFiles);
    const analysis = (0, analysis_1.buildAnalysisContext)({
        runId,
        createdAt,
        configPath: (0, index_1.normalizePath)(path_1.default.relative(rootDir, loaded.configPath)),
        coverageLcovPath: manifest.coveragePath,
        runtimeMirrorRoots: manifest.runtimeMirrorRoots,
        sourceFiles,
        changedFiles,
        changedRegions,
        executionFingerprint: mutationRun.executionFingerprint
    });
    const run = {
        version: '0.2.0',
        runId,
        createdAt,
        repo,
        changedFiles,
        changedFileDigests,
        changedRegions,
        analysis,
        controlPlane,
        ...(executionWitnessSummary.autoRan.length > 0 || executionWitnessSummary.skipped.length > 0 ? { executionWitnesses: executionWitnessSummary } : {}),
        ...(manifest.coverageGeneration ? { coverageGeneration: manifest.coverageGeneration } : {}),
        ...(analysisWarnings.length > 0 ? { analysisWarnings } : {}),
        ...(mutationRemediation ? { mutationRemediation } : {}),
        files: (0, analysis_1.fileEntities)(rootDir, sourceFiles),
        symbols: (0, analysis_1.symbolEntities)(crapReport.hotspots),
        coverage,
        complexity: crapReport.hotspots,
        mutationSites: mutationRun.sites,
        mutations: mutationRun.results,
        mutationBaseline: mutationRun.baseline,
        mutationSelection: mutationRun.selection,
        mutationContext: buildMutationExecutionContext(rootDir, loaded),
        invariants,
        behaviorClaims: claims,
        governance,
        attestations: runAttestations,
        approvals,
        overrides,
        verdict: evaluated.verdict
    };
    run.nextEvidenceAction = (0, evidence_closure_1.buildNextEvidenceAction)(run);
    if (evaluated.trend) {
        run.trend = evaluated.trend;
    }
    // Every check-time file is written into a hidden staging directory and published with one rename at the end,
    // so an interrupted check never leaves a visible partial packet or a torn latest pointer.
    const staged = (0, index_1.stageRunArtifact)(rootDir, run);
    const artifactDir = staged.stagingDir;
    (0, index_1.writeJson)(path_1.default.join(artifactDir, 'report.json'), (0, run_context_1.buildReportJsonArtifact)(run, { projection: 'persisted', drift: [] }));
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'report.md'), `${(0, index_5.renderMarkdownReport)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'pr-summary.md'), `${(0, index_5.renderPrSummary)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'explain.txt'), `${(0, index_5.renderExplainText)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'attestation-verify.txt'), (0, legitimacy_commands_1.renderAttestationVerificationReport)(verifiedAttestations.verification), 'utf8');
    if (run.executionWitnesses) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'execution-witnesses.json'), run.executionWitnesses);
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'execution-witnesses.txt'), (0, witness_commands_1.renderExecutionWitnessSummaryText)(run.executionWitnesses), 'utf8');
    }
    if (run.coverageGeneration) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'coverage-generation.json'), run.coverageGeneration);
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'coverage-generation.txt'), (0, render_text_1.renderCoverageGenerationText)(run.coverageGeneration), 'utf8');
    }
    if (run.mutationRemediation) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'mutation-remediation.json'), run.mutationRemediation);
    }
    if (run.nextEvidenceAction) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'next-evidence-action.json'), run.nextEvidenceAction);
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'next-evidence-action.txt'), (0, render_text_1.renderNextEvidenceActionText)(run.nextEvidenceAction), 'utf8');
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'next-evidence-action.prompt.md'), (0, render_text_1.renderEvidenceClosurePromptMarkdown)(run.nextEvidenceAction), 'utf8');
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'next-evidence-action.ak-task.json'), (0, render_text_1.renderEvidenceClosureTaskManifest)(run.nextEvidenceAction), 'utf8');
    }
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'check-summary.txt'), (0, render_text_1.renderCheckSummaryText)(run), 'utf8');
    const plan = (0, index_6.generateGovernancePlan)(run, constitution, agents);
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'plan.txt'), (0, render_text_1.renderPlanArtifactText)(run, plan), 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'govern.txt'), (0, render_text_1.renderGovernanceArtifactText)(run, plan), 'utf8');
    return { run, artifactDir: (0, index_1.publishRunArtifact)(rootDir, staged) };
}
//# sourceMappingURL=check.js.map