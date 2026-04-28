"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.materializeProject = materializeProject;
exports.loadVerifiedAttestations = loadVerifiedAttestations;
exports.refreshExecutionWitnesses = refreshExecutionWitnesses;
exports.runCheck = runCheck;
exports.initProject = initProject;
exports.renderDoctor = renderDoctor;
exports.renderLatestReport = renderLatestReport;
exports.renderLatestExplain = renderLatestExplain;
exports.renderTrend = renderTrend;
exports.renderGovernance = renderGovernance;
exports.renderPlan = renderPlan;
exports.runAuthorize = runAuthorize;
exports.runExecutionWitnessCommand = runExecutionWitnessCommand;
exports.attestSign = attestSign;
exports.attestVerify = attestVerify;
exports.attestGenerateKey = attestGenerateKey;
exports.runAmend = runAmend;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
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
    const witnessPressureNote = renderExecutionWitnessPressureNote(riskyInvariant, linePrefix);
    const lines = [
        `${linePrefix}Invariant evidence at risk: ${riskyInvariant.invariantId}`,
        ...(0, index_5.renderConciseInvariantProvenance)(riskyInvariant, { linePrefix }),
        ...(witnessPressureNote ? [witnessPressureNote] : [])
    ];
    if (options?.includeObligation !== false && riskyInvariant.obligations.length > 0) {
        lines.push(`${linePrefix}Obligation: ${riskyInvariant.obligations[0]?.description}`);
    }
    return lines;
}
function renderExecutionWitnessPressureNote(claim, linePrefix = '') {
    const summary = claim.evidenceSummary;
    if (!summary || summary.evidenceSemantics !== 'execution-backed') {
        return undefined;
    }
    const remainingPressure = summary.subSignals
        .filter((item) => !['focused-test-alignment', 'execution-witness', 'scenario-support'].includes(item.signalId))
        .filter((item) => item.level === 'warning' || item.level === 'missing' || item.mode === 'missing')
        .map((item) => item.signalId);
    if (remainingPressure.length === 0) {
        return undefined;
    }
    return `${linePrefix}Execution witness is present; remaining risk comes from ${remainingPressure.join(', ')}.`;
}
function renderAnalysisWarningsText(warnings) {
    if (!warnings || warnings.length === 0) {
        return [];
    }
    return warnings.flatMap((warning) => [
        `Analysis warning: ${warning.message}`,
        ...(warning.hint ? [`Hint: ${warning.hint}`] : []),
        ...warning.evidence.map((item) => `Evidence: ${item}`)
    ]);
}
function renderCheckSummaryText(run) {
    const lines = [
        `Merge confidence: ${run.verdict.mergeConfidence}/100`,
        `Outcome: ${run.verdict.outcome}`,
        `Best next action: ${run.verdict.bestNextAction ?? 'none'}`
    ];
    if (run.nextEvidenceAction) {
        lines.push(`Remaining blocker: ${run.nextEvidenceAction.remainingBlocker}`);
    }
    if (run.verdict.confidenceBreakdown) {
        lines.push('', `Confidence breakdown: base ${run.verdict.confidenceBreakdown.base}`);
        lines.push(...run.verdict.confidenceBreakdown.penalties.map((item) => `-${item.amount} ${item.label}`));
        lines.push(...run.verdict.confidenceBreakdown.credits.map((item) => `+${item.amount} ${item.label}`));
        lines.push(`final ${run.verdict.confidenceBreakdown.final}`);
    }
    if (run.coverageGeneration) {
        lines.push('', `Coverage generation: ${run.coverageGeneration.receipt.status} -> ${run.coverageGeneration.lcovPath}`);
    }
    const analysisWarnings = renderAnalysisWarningsText(run.analysisWarnings);
    if (analysisWarnings.length > 0) {
        lines.push('', ...analysisWarnings);
    }
    if (run.executionWitnesses) {
        lines.push('', ...renderExecutionWitnessSummaryText(run.executionWitnesses).trimEnd().split('\n'));
    }
    const provenance = renderInvariantProvenanceBlock(run, { includeObligation: false });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    return `${lines.join('\n')}\n`;
}
function renderCoverageGenerationText(record) {
    return [
        `command: ${record.command.join(' ')}`,
        `lcovPath: ${record.lcovPath}`,
        `status: ${record.receipt.status}`,
        `durationMs: ${record.receipt.durationMs}`,
        `exitCode: ${record.receipt.exitCode ?? 'none'}`,
        `details: ${record.receipt.details ?? 'none'}`
    ].join('\n') + '\n';
}
function renderNextEvidenceActionText(action) {
    return [
        `remainingBlocker: ${action.remainingBlocker}`,
        `bestNextAction: ${action.bestNextAction}`,
        `coverage: ${action.coverageStatus}`,
        `witness: ${action.witnessStatus}`,
        `mutation: ${action.mutationStatus}`,
        `governance: ${action.governanceStatus}`,
        'artifacts:',
        ...Object.entries(action.artifactPaths).map(([key, value]) => `- ${key}: ${value}`)
    ].join('\n') + '\n';
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
function renderGovernanceArtifactText(run, _plan) {
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
function buildAuthorizationEvidenceContext(run, agentId, action, attestationVerification) {
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
        attestationVerification,
        riskyInvariant: riskyInvariant && evidenceProvenance
            ? {
                invariantId: riskyInvariant.invariantId,
                description: riskyInvariant.description,
                ...(riskySummary?.evidenceSemantics ? { evidenceSemantics: riskySummary.evidenceSemantics } : {}),
                ...(riskySummary?.evidenceSemanticsSummary ? { evidenceSemanticsSummary: riskySummary.evidenceSemanticsSummary } : {}),
                evidenceProvenance,
                signals: authorizationRiskSignals(riskyInvariant),
                obligation: riskyInvariant.obligations[0]?.description
            }
            : undefined
    };
}
function orderedRuns(rootDir) {
    return (0, index_1.listRunIds)(rootDir)
        .map((runId) => (0, index_1.loadRun)(rootDir, runId))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.runId.localeCompare(right.runId));
}
function sortedUniqueNormalized(values) {
    return [...new Set(values.map((item) => (0, index_1.normalizePath)(item)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
function changedRegionSignatures(regions) {
    return [...new Set(regions.map((region) => `${(0, index_1.normalizePath)(region.filePath)}:${region.span.startLine}-${region.span.endLine}`))]
        .sort((left, right) => left.localeCompare(right));
}
function equalStringLists(left, right) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
}
function assessTrendComparability(current, previous) {
    const reasons = [];
    if (!equalStringLists(sortedUniqueNormalized(current.changedFiles), sortedUniqueNormalized(previous.changedFiles))) {
        reasons.push('changed file scope differs');
    }
    const currentRegions = changedRegionSignatures(current.changedRegions);
    const previousRegions = changedRegionSignatures(previous.changedRegions);
    if ((currentRegions.length > 0 || previousRegions.length > 0) && !equalStringLists(currentRegions, previousRegions)) {
        reasons.push('changed hunk scope differs');
    }
    if ((0, index_1.stableStringify)(current.invariants) !== (0, index_1.stableStringify)(previous.invariants)) {
        reasons.push('invariant baseline differs');
    }
    if (current.controlPlane && previous.controlPlane) {
        if ((0, index_1.stableStringify)(current.controlPlane.policy) !== (0, index_1.stableStringify)(previous.controlPlane.policy)) {
            reasons.push('policy baseline differs');
        }
        if (current.controlPlane.constitutionDigest !== previous.controlPlane.constitutionDigest) {
            reasons.push('constitution baseline differs');
        }
    }
    else if (Boolean(current.controlPlane) !== Boolean(previous.controlPlane)) {
        reasons.push('control-plane snapshot availability differs');
    }
    return {
        comparable: reasons.length === 0,
        reasons
    };
}
function latestComparableRunOrUndefined(rootDir, current) {
    const runs = orderedRuns(rootDir);
    for (let index = runs.length - 1; index >= 0; index -= 1) {
        const candidate = runs[index];
        if (candidate && assessTrendComparability(current, candidate).comparable) {
            return candidate;
        }
    }
    return undefined;
}
function selectedRun(rootDir, options) {
    return options?.runId ? (0, index_1.loadRun)(rootDir, options.runId) : (0, index_1.readLatestRun)(rootDir);
}
function expectedRunFileDigest(run, filePath) {
    return run.files.find((item) => item.filePath === (0, index_1.normalizePath)(filePath))?.digest;
}
function digestOrMissing(absolutePath) {
    return fs_1.default.existsSync(absolutePath)
        ? (0, index_1.fileDigest)(absolutePath)
        : 'sha256:missing';
}
function contentDrift(subject, absolutePath, expected) {
    const actual = digestOrMissing(absolutePath);
    if (actual === expected) {
        return undefined;
    }
    return { subject, expected, actual };
}
function detectControlPlaneDrift(rootDir, snapshot) {
    return [
        contentDrift('control plane config', path_1.default.join(rootDir, snapshot.configPath), snapshot.configDigest),
        contentDrift('control plane constitution', path_1.default.join(rootDir, snapshot.constitutionPath), snapshot.constitutionDigest),
        contentDrift('control plane agents', path_1.default.join(rootDir, snapshot.agentsPath), snapshot.agentsDigest)
    ].filter((item) => Boolean(item));
}
function detectRunDrift(rootDir, run) {
    const drift = [];
    for (const filePath of run.changedFiles.map((item) => (0, index_1.normalizePath)(item))) {
        const expectedDigest = expectedRunFileDigest(run, filePath);
        if (!expectedDigest) {
            continue;
        }
        const entry = contentDrift(`changed file ${filePath}`, path_1.default.join(rootDir, filePath), expectedDigest);
        if (entry) {
            drift.push(entry);
        }
    }
    if (run.controlPlane) {
        drift.push(...detectControlPlaneDrift(rootDir, run.controlPlane));
    }
    return drift;
}
function policyConfigFromLoadedContext(loaded) {
    return {
        ...(0, index_5.defaultPolicy)(),
        ...loaded.config.policy
    };
}
function policyConfigFromSnapshot(snapshot) {
    return { ...snapshot.policy };
}
function malformedSnapshotError(runId, detail) {
    return new Error(`Run ${runId} carries malformed control-plane snapshot schema ${index_1.CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION}: ${detail}. Re-run ts-quality check before trusting downstream decision surfaces.`);
}
function snapshotStringField(snapshot, field, runId) {
    if (typeof snapshot[field] !== 'string' || snapshot[field].length === 0) {
        throw malformedSnapshotError(runId, `field ${field} must be a non-empty string`);
    }
    return snapshot[field];
}
function snapshotNumberField(snapshot, field, runId, options = {}) {
    if (typeof snapshot[field] !== 'number' || !Number.isFinite(snapshot[field])) {
        throw malformedSnapshotError(runId, `field ${field} must be a finite number`);
    }
    const value = snapshot[field];
    if (typeof options.min === 'number' && value < options.min) {
        throw malformedSnapshotError(runId, `field ${field} must be >= ${options.min}`);
    }
    if (typeof options.max === 'number' && value > options.max) {
        throw malformedSnapshotError(runId, `field ${field} must be <= ${options.max}`);
    }
    return value;
}
function snapshotObjectArrayField(snapshot, field, runId, validateItem) {
    if (!Array.isArray(snapshot[field])) {
        throw malformedSnapshotError(runId, `field ${field} must be an array`);
    }
    const value = snapshot[field];
    for (const [index, item] of value.entries()) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw malformedSnapshotError(runId, `field ${field}[${index}] must be an object`);
        }
        validateItem(item, index);
    }
    return value;
}
function validateSnapshotConstitutionRule(rule, index, runId) {
    const ruleId = rule['id'];
    const kind = rule['kind'];
    if (typeof ruleId !== 'string' || ruleId.length === 0) {
        throw malformedSnapshotError(runId, `field constitution[${index}].id must be a non-empty string`);
    }
    if (typeof kind !== 'string' || kind.length === 0) {
        throw malformedSnapshotError(runId, `field constitution[${index}].kind must be a non-empty string`);
    }
}
function validateSnapshotAgent(agent, index, runId) {
    const agentId = agent['id'];
    const kind = agent['kind'];
    const roles = agent['roles'];
    const grants = agent['grants'];
    if (typeof agentId !== 'string' || agentId.length === 0) {
        throw malformedSnapshotError(runId, `field agents[${index}].id must be a non-empty string`);
    }
    if (typeof kind !== 'string' || kind.length === 0) {
        throw malformedSnapshotError(runId, `field agents[${index}].kind must be a non-empty string`);
    }
    if (!Array.isArray(roles) || roles.some((item) => typeof item !== 'string')) {
        throw malformedSnapshotError(runId, `field agents[${index}].roles must be an array of strings`);
    }
    if (!Array.isArray(grants)) {
        throw malformedSnapshotError(runId, `field agents[${index}].grants must be an array`);
    }
}
function validatedControlPlaneSnapshot(run) {
    const snapshot = run.controlPlane;
    if (!snapshot) {
        return undefined;
    }
    const record = snapshot;
    const schemaVersion = record['schemaVersion'];
    if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
        throw malformedSnapshotError(run.runId, `field schemaVersion must be integer ${index_1.CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION}`);
    }
    if (schemaVersion !== index_1.CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION) {
        throw new Error(`Run ${run.runId} carries unsupported control-plane snapshot schema ${String(schemaVersion)}. `
            + `Expected ${index_1.CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION}. Re-run ts-quality check before trusting downstream decision surfaces.`);
    }
    const recordPolicy = record['policy'];
    const policy = (typeof recordPolicy === 'object' && recordPolicy !== null)
        ? recordPolicy
        : undefined;
    if (!policy) {
        throw malformedSnapshotError(run.runId, 'field policy must be an object');
    }
    snapshotStringField(record, 'configPath', run.runId);
    snapshotStringField(record, 'configDigest', run.runId);
    snapshotNumberField(policy, 'maxChangedCrap', run.runId, { min: 0 });
    snapshotNumberField(policy, 'minMutationScore', run.runId, { min: 0, max: 1 });
    snapshotNumberField(policy, 'minMergeConfidence', run.runId, { min: 0, max: 100 });
    snapshotStringField(record, 'constitutionPath', run.runId);
    snapshotStringField(record, 'constitutionDigest', run.runId);
    snapshotObjectArrayField(record, 'constitution', run.runId, (item, index) => validateSnapshotConstitutionRule(item, index, run.runId));
    snapshotStringField(record, 'agentsPath', run.runId);
    snapshotStringField(record, 'agentsDigest', run.runId);
    snapshotObjectArrayField(record, 'agents', run.runId, (item, index) => validateSnapshotAgent(item, index, run.runId));
    snapshotStringField(record, 'approvalsPath', run.runId);
    snapshotStringField(record, 'waiversPath', run.runId);
    snapshotStringField(record, 'overridesPath', run.runId);
    snapshotStringField(record, 'attestationsDir', run.runId);
    snapshotStringField(record, 'trustedKeysDir', run.runId);
    return snapshot;
}
function buildControlPlaneSnapshot(rootDir, loaded, constitution, agents) {
    return {
        schemaVersion: index_1.CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION,
        configPath: (0, index_1.normalizePath)(path_1.default.relative(rootDir, loaded.configPath)),
        configDigest: digestOrMissing(loaded.configPath),
        policy: policyConfigFromLoadedContext(loaded),
        constitutionPath: loaded.config.constitutionPath,
        constitutionDigest: digestOrMissing(path_1.default.join(rootDir, loaded.config.constitutionPath)),
        constitution,
        agentsPath: loaded.config.agentsPath,
        agentsDigest: digestOrMissing(path_1.default.join(rootDir, loaded.config.agentsPath)),
        agents,
        approvalsPath: loaded.config.approvalsPath,
        waiversPath: loaded.config.waiversPath,
        overridesPath: loaded.config.overridesPath,
        attestationsDir: loaded.config.attestationsDir,
        trustedKeysDir: loaded.config.trustedKeysDir
    };
}
function projectedRunForDecision(rootDir, run, options) {
    const snapshot = validatedControlPlaneSnapshot(run);
    const loaded = snapshot
        ? undefined
        : (0, config_1.loadContext)(rootDir, options?.configPath);
    const approvals = (0, config_1.loadApprovals)(rootDir, snapshot?.approvalsPath ?? loaded?.config.approvalsPath ?? '.ts-quality/approvals.json');
    const overrides = (0, config_1.loadOverrides)(rootDir, snapshot?.overridesPath ?? loaded?.config.overridesPath ?? '.ts-quality/overrides.json');
    const waivers = (0, config_1.loadWaivers)(rootDir, snapshot?.waiversPath ?? loaded?.config.waiversPath ?? '.ts-quality/waivers.json');
    const constitution = snapshot?.constitution ?? (0, config_1.loadConstitution)(rootDir, loaded?.config.constitutionPath ?? '.ts-quality/constitution.ts');
    const agents = snapshot?.agents ?? (0, config_1.loadAgents)(rootDir, loaded?.config.agentsPath ?? '.ts-quality/agents.ts');
    const { attestations, verification } = loadVerifiedAttestations(rootDir, snapshot?.attestationsDir ?? loaded?.config.attestationsDir ?? '.ts-quality/attestations', snapshot?.trustedKeysDir ?? loaded?.config.trustedKeysDir ?? '.ts-quality/keys');
    const runAttestations = attestations.filter((attestation) => attestationAppliesToRun(attestation, run.runId));
    const runAttestationVerification = verification.filter((record) => attestationVerificationAppliesToRun(record, run.runId));
    const policy = snapshot ? policyConfigFromSnapshot(snapshot) : policyConfigFromLoadedContext(loaded);
    const preliminary = (0, index_5.evaluatePolicy)({
        nowIso: (0, index_1.nowIso)(),
        policy,
        changedComplexity: run.complexity.filter((item) => item.changed),
        mutations: run.mutations,
        ...(run.mutationBaseline ? { mutationBaseline: run.mutationBaseline } : {}),
        behaviorClaims: run.behaviorClaims,
        governance: [],
        waivers
    });
    const governance = (0, index_6.evaluateGovernance)({
        rootDir,
        constitution,
        changedFiles: run.changedFiles,
        changedRegions: run.changedRegions,
        approvals,
        runId: run.runId,
        attestationsClaims: runAttestations.flatMap((item) => item.claims),
        run: {
            complexity: run.complexity,
            mutations: run.mutations,
            verdict: preliminary.verdict
        }
    });
    const evaluated = (0, index_5.evaluatePolicy)({
        nowIso: (0, index_1.nowIso)(),
        policy,
        changedComplexity: run.complexity.filter((item) => item.changed),
        mutations: run.mutations,
        ...(run.mutationBaseline ? { mutationBaseline: run.mutationBaseline } : {}),
        behaviorClaims: run.behaviorClaims,
        governance,
        waivers
    });
    const projectedRun = {
        ...run,
        approvals,
        overrides,
        attestations: runAttestations,
        governance,
        verdict: evaluated.verdict,
        ...(run.trend ? { trend: run.trend } : {})
    };
    return {
        run,
        projectedRun,
        approvals,
        overrides,
        agents,
        constitution,
        runAttestations,
        runAttestationVerification,
        drift: detectRunDrift(rootDir, run)
    };
}
function renderRunDriftNotice(run, drift) {
    const lines = [
        `Run drift detected for ${run.runId}. Re-run ts-quality check before trusting downstream decision surfaces.`,
        ...drift.map((item) => `- ${item.subject}: expected ${item.expected}, actual ${item.actual}`)
    ];
    return `${lines.join('\n')}\n`;
}
function renderRunDriftMarkdownNotice(run, drift) {
    const lines = [
        `> **Run drift detected for \`${(0, index_1.renderSafeText)(run.runId)}\`.** Re-run \`ts-quality check\` before trusting this projected report.`,
        ...drift.map((item) => `> - ${(0, index_1.renderSafeText)(item.subject)}: expected ${(0, index_1.renderSafeText)(item.expected)}, actual ${(0, index_1.renderSafeText)(item.actual)}`)
    ];
    return lines.join('\n');
}
function injectMarkdownNotice(markdown, notice) {
    const frontmatter = markdown.match(/^---\n[\s\S]*?\n---\n\n?/u);
    if (!frontmatter) {
        return `${notice}\n\n${markdown}`;
    }
    const insertAt = frontmatter[0].length;
    return `${markdown.slice(0, insertAt)}${notice}\n\n${markdown.slice(insertAt)}`;
}
function buildReportJsonArtifact(run, decisionContext) {
    return {
        ...run,
        decisionContext: {
            projection: decisionContext.projection,
            drift: decisionContext.drift.map((item) => ({ ...item }))
        }
    };
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
function lexicalRelativePathInsideRoot(rootDir, absolutePath) {
    const relative = portablePath(path_1.default.relative(rootDir, absolutePath));
    if (!relative || relative === '..' || relative.startsWith('../') || path_1.default.isAbsolute(relative)) {
        return undefined;
    }
    return (0, index_1.normalizePath)(relative);
}
function remapCliRepoLocalError(error, kind, candidate) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith(`${kind} must stay inside repository root:`)) {
        throw new Error(`${kind} must be inside --root: ${candidate}`);
    }
    if (message.startsWith(`${kind} not found:`)) {
        throw new Error(`${kind} not found: ${candidate}`);
    }
    throw error instanceof Error ? error : new Error(message);
}
function resolveCliRepoLocalPath(rootDir, candidate, options) {
    const pathOptions = options?.preferRoot !== undefined ? { preferRoot: options.preferRoot } : undefined;
    const resolvedCandidate = resolveCliPath(rootDir, candidate, pathOptions);
    const resolutionOptions = {};
    if (options?.allowMissing !== undefined) {
        resolutionOptions.allowMissing = options.allowMissing;
    }
    if (options?.kind !== undefined) {
        resolutionOptions.kind = options.kind;
    }
    try {
        return (0, index_1.resolveRepoLocalPath)(rootDir, resolvedCandidate, resolutionOptions);
    }
    catch (error) {
        remapCliRepoLocalError(error, options?.kind ?? 'path', candidate);
    }
}
function resolveCliAttestationSubject(rootDir, candidate, options) {
    const resolution = resolveCliRepoLocalPath(rootDir, candidate, options?.allowMissing !== undefined ? { allowMissing: options.allowMissing, kind: 'attestation subject' } : { kind: 'attestation subject' });
    const recordedPath = lexicalRelativePathInsideRoot(rootDir, resolution.absolutePath);
    if (!recordedPath) {
        throw new Error(`attestation subject must be inside --root: ${candidate}`);
    }
    return {
        absolutePath: resolution.absolutePath,
        canonicalPath: resolution.canonicalPath,
        recordedPath
    };
}
function renderVerificationText(value) {
    return (0, index_1.renderSafeText)(value);
}
const SANITIZED_WITNESS_ENV_KEYS = ['NODE_TEST_CONTEXT'];
function executionWitnessCommandEnv(baseEnv = process.env) {
    const env = { ...baseEnv };
    for (const key of SANITIZED_WITNESS_ENV_KEYS) {
        delete env[key];
    }
    return env;
}
function stdioText(value) {
    return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}
function executionWitnessCommandDetails(result) {
    return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}
function executionWitnessReceiptPath(relativeWitnessPath) {
    return relativeWitnessPath.endsWith('.json')
        ? relativeWitnessPath.replace(/\.json$/u, '.receipt.json')
        : `${relativeWitnessPath}.receipt.json`;
}
function executionWitnessSkipReasonText(reason) {
    return reason === 'invariant-not-impacted'
        ? 'invariant not impacted by changed scope'
        : reason;
}
function renderExecutionWitnessSummaryText(summary) {
    const lines = [`Execution witnesses: auto-ran ${summary.autoRan.length}, skipped ${summary.skipped.length}`];
    if (summary.autoRan.length > 0) {
        lines.push('Ran:');
        lines.push(...summary.autoRan.map((item) => `- ${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${item.receipt.status}; receipt=${item.receiptPath})`));
    }
    if (summary.skipped.length > 0) {
        lines.push('Skipped:');
        lines.push(...summary.skipped.map((item) => `- ${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${executionWitnessSkipReasonText(item.reason)})`));
    }
    return `${lines.join('\n')}\n`;
}
function verifyAttestationRecordAtRoot(rootDir, source, attestation, trustedKeys) {
    const contract = (0, index_7.validateRenderableAttestationContract)(attestation, { requireSubjectFile: true });
    const contextFields = contract.context;
    const record = {
        version: '1',
        source,
        ...(contextFields.issuer ? { issuer: contextFields.issuer } : {}),
        ok: false,
        reason: 'verification did not run',
        ...(contextFields.subjectFile ? { subjectFile: contextFields.subjectFile } : {}),
        ...(contextFields.runId ? { runId: contextFields.runId } : {}),
        ...(contextFields.artifactName ? { artifactName: contextFields.artifactName } : {})
    };
    if (!contract.ok) {
        return { ...record, reason: contract.reason };
    }
    const subjectFile = contextFields.subjectFile;
    if (!subjectFile) {
        return { ...record, reason: 'subject file missing from attestation payload' };
    }
    let subjectResolution;
    let relativeSubject;
    try {
        subjectResolution = (0, index_1.resolveRepoLocalPath)(rootDir, subjectFile, { allowMissing: true, kind: 'attestation subject' });
        relativeSubject = lexicalRelativePathInsideRoot(rootDir, subjectResolution.absolutePath);
    }
    catch {
        return { ...record, reason: 'subject file escapes repository root' };
    }
    if (!relativeSubject || relativeSubject !== subjectFile) {
        return { ...record, reason: 'subject file escapes repository root' };
    }
    if (!fs_1.default.existsSync(subjectResolution.canonicalPath)) {
        return { ...record, reason: `subject file missing: ${subjectFile}` };
    }
    const signature = (0, index_7.verifyAttestation)(attestation, trustedKeys);
    if (!signature.ok) {
        return { ...record, reason: signature.reason };
    }
    const digest = (0, index_1.fileDigest)(subjectResolution.canonicalPath);
    if (digest !== attestation.subjectDigest) {
        return { ...record, reason: 'subject digest mismatch' };
    }
    return { ...record, ok: true, reason: 'verified' };
}
function renderAttestationVerificationRecord(record) {
    const lines = [`${renderVerificationText(record.issuer ?? record.source)}: ${record.ok ? 'verified' : 'failed'} (${renderVerificationText(record.reason)})`];
    if (record.subjectFile) {
        lines.push(`Subject: ${renderVerificationText(record.subjectFile)}`);
    }
    if (record.runId) {
        lines.push(`Run: ${renderVerificationText(record.runId)}`);
    }
    if (record.artifactName) {
        lines.push(`Artifact: ${renderVerificationText(record.artifactName)}`);
    }
    return lines.join('\n');
}
function renderAttestationVerificationReport(records) {
    if (records.length === 0) {
        return '\n';
    }
    return `${records.map((record) => renderAttestationVerificationRecord(record)).join('\n\n')}\n`;
}
function renderAttestationVerificationJson(records) {
    if (records.length === 1) {
        return `${(0, index_1.stableStringify)(records[0])}\n`;
    }
    return `${(0, index_1.stableStringify)(records)}\n`;
}
function renderAmendmentChangeSummary(change) {
    const currentRuleKind = (0, index_1.renderSafeText)(change.currentRuleKind ?? 'none');
    const proposedRuleKind = (0, index_1.renderSafeText)(change.proposedRuleKind ?? 'none');
    return `- ${(0, index_1.renderSafeText)(change.action)} ${(0, index_1.renderSafeText)(change.ruleId)} (current=${currentRuleKind}; proposed=${proposedRuleKind}; sensitivity=${(0, index_1.renderSafeText)(change.sensitivity)})`;
}
function renderAmendmentDecisionText(decision) {
    const proposalContext = decision.proposalContext;
    const lines = [
        `Proposal: ${(0, index_1.renderSafeText)(proposalContext?.title ?? decision.proposalId)}`,
        `Proposal ID: ${(0, index_1.renderSafeText)(decision.proposalId)}`,
        `Outcome: ${(0, index_1.renderSafeText)(decision.outcome)}`,
        `Required approvals: ${String(decision.requiredApprovals)}`,
        `Accepted approvals: ${decision.approvalsAccepted.length > 0 ? decision.approvalsAccepted.map((item) => (0, index_1.renderSafeText)(item)).join(', ') : 'none'}`
    ];
    if (proposalContext) {
        lines.push(`Approval burden basis: ${(0, index_1.renderSafeText)(proposalContext.approvalBurdenBasis)}`);
        lines.push(`Sensitive rules: ${proposalContext.sensitiveRuleIds.length > 0 ? proposalContext.sensitiveRuleIds.map((item) => (0, index_1.renderSafeText)(item)).join(', ') : 'none'}`);
        lines.push(`Rationale: ${(0, index_1.renderSafeText)(proposalContext.rationale)}`);
        lines.push('', 'Evidence:');
        lines.push(...(proposalContext.evidence.length > 0
            ? proposalContext.evidence.map((item) => `- ${(0, index_1.renderSafeText)(item)}`)
            : ['- none']));
        lines.push('', 'Changes:');
        lines.push(...(proposalContext.changes.length > 0
            ? proposalContext.changes.map((change) => renderAmendmentChangeSummary(change))
            : ['- none']));
    }
    lines.push('', 'Reasons:');
    lines.push(...(decision.reasons.length > 0
        ? decision.reasons.map((reason) => `- ${(0, index_1.renderSafeText)(reason)}`)
        : ['- none']));
    return `${lines.join('\n')}\n`;
}
function attestationAppliesToRun(attestation, runId) {
    const payload = attestation.payload;
    const subjectFile = typeof payload?.['subjectFile'] === 'string' ? payload['subjectFile'] : undefined;
    if (!subjectFile || path_1.default.isAbsolute(subjectFile)) {
        return false;
    }
    const scopedSubject = (0, index_7.runScopedArtifactReference)(subjectFile);
    if (!scopedSubject || scopedSubject.runId !== runId) {
        return false;
    }
    const payloadRunId = typeof payload?.['runId'] === 'string' ? payload['runId'] : undefined;
    return payloadRunId === undefined || payloadRunId === runId;
}
function attestationVerificationAppliesToRun(record, runId) {
    if (record.runId) {
        return record.runId === runId;
    }
    if (!record.subjectFile || path_1.default.isAbsolute(record.subjectFile)) {
        return false;
    }
    const scopedSubject = (0, index_7.runScopedArtifactReference)(record.subjectFile);
    return scopedSubject?.runId === runId;
}
function buildAuthorizationAttestationVerification(records) {
    return {
        verifiedCount: records.filter((record) => record.ok).length,
        failedCount: records.filter((record) => !record.ok).length,
        records: records.map((record) => ({ ...record }))
    };
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
        const source = path_1.default.basename(filePath);
        let rawText;
        try {
            rawText = fs_1.default.readFileSync(filePath, 'utf8');
        }
        catch {
            verification.push({ version: '1', source, ok: false, reason: 'unreadable attestation file' });
            continue;
        }
        let rawAttestation;
        try {
            rawAttestation = JSON.parse(rawText);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            verification.push({ version: '1', source, ok: false, reason: `invalid JSON: ${message}` });
            continue;
        }
        const parsed = (0, index_7.parseAttestationRecord)(rawAttestation);
        if (!parsed.ok) {
            verification.push({ version: '1', source, ok: false, reason: parsed.reason });
            continue;
        }
        const attestation = parsed.attestation;
        const result = verifyAttestationRecordAtRoot(rootDir, source, attestation, keys);
        verification.push(result);
        if (result.ok) {
            attestations.push(attestation);
        }
    }
    return { attestations, verification };
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
        env: executionWitnessCommandEnv()
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
            details: executionWitnessCommandDetails(result)
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
        throw new Error(`coverage generation command ${coverageGeneration.receipt.status}; expected LCOV at ${(0, index_1.renderSafeText)(input.coveragePath)}${coverageGeneration.receipt.details ? `\n${(0, index_1.renderSafeText)(coverageGeneration.receipt.details)}` : ''}`);
    }
    if (!fs_1.default.existsSync(coverageAbsolutePath)) {
        throw new Error(`coverage generation command passed but did not create expected LCOV at ${(0, index_1.renderSafeText)(input.coveragePath)}`);
    }
    return {
        coverage: (0, index_2.parseLcov)(fs_1.default.readFileSync(coverageAbsolutePath, 'utf8')),
        coverageGeneration
    };
}
function buildAnalysisManifest(rootDir, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const sourceFiles = (0, index_1.collectSourceFiles)(rootDir, loaded.config.sourcePatterns);
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
    const planSummary = (0, index_4.collectExecutionWitnessPlanSummary)({
        invariants: input.invariants,
        changedFiles: input.changedFiles,
        changedRegions: input.changedRegions,
        complexity: crapReport.hotspots
    });
    const autoRan = [];
    for (const witnessPlan of planSummary.autoRun) {
        const witnessResult = runExecutionWitnessCommand(rootDir, {
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
    return /^src\/.*\.tsx?$/.test((0, index_1.normalizePath)(filePath));
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
    const coveredBuiltFiles = input.coverage.map((item) => (0, index_1.normalizePath)(item.filePath)).filter((filePath) => roots.some((root) => filePath === root || filePath.startsWith(`${root}/`)));
    if (coveredBuiltFiles.length === 0) {
        return warnings;
    }
    for (const changedFile of input.changedFiles.map((item) => (0, index_1.normalizePath)(item)).filter(isSourceTsFile)) {
        if (coverageHasFile(input.coverage, changedFile)) {
            continue;
        }
        const stem = changedFile.replace(/^src\//, '').replace(/\.tsx?$/, '');
        const matchingBuilt = coveredBuiltFiles.filter((filePath) => filePath.replace(/^(dist|lib|build)\//, '').replace(/\.jsx?$/, '') === stem || filePath.endsWith(`/${path_1.default.basename(stem)}.js`));
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
function buildMutationRemediation(mutations) {
    const survivors = mutations.filter((item) => item.status === 'survived').map((item) => ({
        filePath: item.filePath,
        siteId: item.siteId,
        ...(item.span ? { span: item.span } : {}),
        ...(item.operator ? { operator: item.operator } : {}),
        ...(item.original ? { original: item.original } : {}),
        ...(item.mutated ? { mutated: item.mutated } : {}),
        ...(item.replacement ? { replacement: item.replacement } : {}),
        ...(item.testCommand ? { testCommand: item.testCommand } : {}),
        ...(item.assertionHint ? { assertionHint: item.assertionHint } : {})
    }));
    return survivors.length > 0 ? { survivors } : undefined;
}
function statusFromCount(clear, clearText, missingText) {
    return clear ? clearText : missingText;
}
function buildNextEvidenceAction(run) {
    const surviving = run.mutations.filter((item) => item.status === 'survived');
    const mutationErrors = run.mutations.filter((item) => item.status === 'error' || item.status === 'invalid');
    const remainingBlocker = run.verdict.findings.find((item) => item.code === 'surviving-mutant' || item.code === 'mutation-score-budget')
        ? 'mutation-pressure'
        : run.verdict.findings.find((item) => item.code === 'mutation-baseline')
            ? 'mutation-baseline'
            : run.verdict.findings.find((item) => item.code === 'mutation-evidence-missing')
                ? 'mutation-evidence-missing'
                : run.governance.some((item) => item.level === 'error')
                    ? 'governance'
                    : run.verdict.outcome;
    return {
        remainingBlocker,
        bestNextAction: run.verdict.bestNextAction ?? 'No next evidence action is currently required.',
        coverageStatus: statusFromCount(run.coverage.length > 0, 'coverage evidence present', run.coverageGeneration ? `coverage generation ${run.coverageGeneration.receipt.status}` : 'coverage evidence missing'),
        witnessStatus: run.executionWitnesses && run.executionWitnesses.autoRan.length > 0 ? 'execution-backed witness considered' : 'no execution witness auto-ran',
        mutationStatus: surviving.length > 0
            ? `${surviving.length} surviving mutant(s); tighten focused assertions`
            : mutationErrors.length > 0
                ? `${mutationErrors.length} mutation execution error(s)`
                : 'mutation pressure clear or not blocking',
        governanceStatus: run.governance.some((item) => item.level === 'error') ? `blocked by ${run.governance.filter((item) => item.level === 'error').length} governance error(s)` : 'no governance errors',
        artifactPaths: {
            run: `.ts-quality/runs/${run.runId}/run.json`,
            explain: `.ts-quality/runs/${run.runId}/explain.txt`,
            checkSummary: `.ts-quality/runs/${run.runId}/check-summary.txt`,
            mutationRemediation: `.ts-quality/runs/${run.runId}/mutation-remediation.json`,
            coverageGeneration: `.ts-quality/runs/${run.runId}/coverage-generation.json`
        }
    };
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
function runCheck(rootDir, options) {
    const runId = (0, index_1.assertSafeRunId)(options?.runId ?? (0, index_1.createRunId)());
    const createdAt = (0, index_1.nowIso)();
    const manifest = buildAnalysisManifest(rootDir, { ...options, generateCoverage: true, observedAt: createdAt });
    const loaded = manifest.loaded;
    const sourceFiles = manifest.sourceFiles;
    const changedFiles = manifest.changedFiles.map((item) => (0, index_1.normalizePath)(item));
    const changedRegions = manifest.changedRegions;
    const coverage = manifest.coverage;
    const waivers = (0, config_1.loadWaivers)(rootDir, loaded.config.waiversPath);
    const approvals = (0, config_1.loadApprovals)(rootDir, loaded.config.approvalsPath);
    const overrides = (0, config_1.loadOverrides)(rootDir, loaded.config.overridesPath);
    const invariants = (0, config_1.loadInvariants)(rootDir, loaded.config.invariantsPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const controlPlane = buildControlPlaneSnapshot(rootDir, loaded, constitution, agents);
    const previousRun = latestComparableRunOrUndefined(rootDir, {
        runId,
        changedFiles,
        changedRegions,
        controlPlane,
        invariants
    });
    const crapReport = (0, index_2.analyzeCrap)({
        rootDir,
        sourceFiles,
        coverage,
        changedFiles,
        changedRegions
    });
    const refreshObservedAt = createdAt;
    const executionWitnessSummary = refreshExecutionWitnessPlans(rootDir, {
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
    const verifiedAttestations = loadVerifiedAttestations(rootDir, loaded.config.attestationsDir, loaded.config.trustedKeysDir);
    const runAttestations = verifiedAttestations.attestations.filter((attestation) => attestationAppliesToRun(attestation, runId));
    const preliminaryInput = {
        nowIso: (0, index_1.nowIso)(),
        policy: policyConfigFromLoadedContext(loaded),
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
        policy: policyConfigFromLoadedContext(loaded),
        changedComplexity: crapReport.hotspots.filter((item) => item.changed),
        mutations: mutationRun.results,
        mutationBaseline: mutationRun.baseline,
        behaviorClaims: claims,
        governance,
        waivers,
        ...(previousRun ? { previousRun } : {})
    };
    const evaluated = (0, index_5.evaluatePolicy)(evaluatedInput);
    const analysisWarnings = detectBuiltOutputCoverageWarnings({ changedFiles, coverage, runtimeMirrorRoots: manifest.runtimeMirrorRoots });
    const mutationRemediation = buildMutationRemediation(mutationRun.results);
    const repo = (0, index_1.buildRepositoryEntity)(rootDir, sourceFiles);
    const analysis = buildAnalysisContext({
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
        changedRegions,
        analysis,
        controlPlane,
        ...(executionWitnessSummary.autoRan.length > 0 || executionWitnessSummary.skipped.length > 0 ? { executionWitnesses: executionWitnessSummary } : {}),
        ...(manifest.coverageGeneration ? { coverageGeneration: manifest.coverageGeneration } : {}),
        ...(analysisWarnings.length > 0 ? { analysisWarnings } : {}),
        ...(mutationRemediation ? { mutationRemediation } : {}),
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
        attestations: runAttestations,
        approvals,
        overrides,
        verdict: evaluated.verdict
    };
    run.nextEvidenceAction = buildNextEvidenceAction(run);
    if (evaluated.trend) {
        run.trend = evaluated.trend;
    }
    const artifactDir = (0, index_1.writeRunArtifact)(rootDir, run);
    (0, index_1.writeJson)(path_1.default.join(artifactDir, 'report.json'), buildReportJsonArtifact(run, { projection: 'persisted', drift: [] }));
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'report.md'), `${(0, index_5.renderMarkdownReport)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'pr-summary.md'), `${(0, index_5.renderPrSummary)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'explain.txt'), `${(0, index_5.renderExplainText)(run)}\n`, 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'attestation-verify.txt'), renderAttestationVerificationReport(verifiedAttestations.verification), 'utf8');
    if (run.executionWitnesses) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'execution-witnesses.json'), run.executionWitnesses);
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'execution-witnesses.txt'), renderExecutionWitnessSummaryText(run.executionWitnesses), 'utf8');
    }
    if (run.coverageGeneration) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'coverage-generation.json'), run.coverageGeneration);
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'coverage-generation.txt'), renderCoverageGenerationText(run.coverageGeneration), 'utf8');
    }
    if (run.mutationRemediation) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'mutation-remediation.json'), run.mutationRemediation);
    }
    if (run.nextEvidenceAction) {
        (0, index_1.writeJson)(path_1.default.join(artifactDir, 'next-evidence-action.json'), run.nextEvidenceAction);
        fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'next-evidence-action.txt'), renderNextEvidenceActionText(run.nextEvidenceAction), 'utf8');
    }
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'check-summary.txt'), renderCheckSummaryText(run), 'utf8');
    const plan = (0, index_6.generateGovernancePlan)(run, constitution, agents);
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'plan.txt'), renderPlanArtifactText(run, plan), 'utf8');
    fs_1.default.writeFileSync(path_1.default.join(artifactDir, 'govern.txt'), renderGovernanceArtifactText(run, plan), 'utf8');
    return { run, artifactDir };
}
function initConfigText(preset) {
    const coverageCommand = preset === 'node-test-ts-dist'
        ? "generateCommand: ['node', '--enable-source-maps', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'],"
        : preset === 'node-test'
            ? "generateCommand: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'],"
            : preset === 'vitest'
                ? "generateCommand: ['npm', 'run', 'coverage'],"
                : "// generateCommand: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'],";
    const mutationCommand = preset === 'vitest' ? "['npm', 'test', '--', '--run']" : "['node', '--test']";
    const runtimeMirrorRoots = preset === 'node-test-ts-dist' ? "['dist', 'lib', 'build']" : "['dist']";
    const presetComment = preset === 'node-test-ts-dist'
        ? 'TypeScript projects that execute built output should keep source-map coverage enabled so LCOV maps back to src/**.'
        : preset === 'vitest'
            ? 'Vitest projects should make npm run coverage write coverage/lcov.info deterministically.'
            : 'Node test projects can let check create coverage/lcov.info when it is missing.';
    return `// ts-quality init preset: ${preset}\n// ${presetComment}\nexport default {\n  sourcePatterns: ${(0, index_1.stableStringify)([...index_1.DEFAULT_SOURCE_PATTERNS])},\n  testPatterns: ${(0, index_1.stableStringify)([...index_1.DEFAULT_TEST_PATTERNS])},\n  coverage: {\n    lcovPath: 'coverage/lcov.info',\n    // When lcovPath is missing, check can run this command after creating the parent directory.\n    ${coverageCommand}\n    generateTimeoutMs: 60000\n  },\n  mutations: { testCommand: ${mutationCommand}, coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ${runtimeMirrorRoots} },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  // Provide --changed <a,b,c> or set changeSet.files / changeSet.diffFile before running check.\n  changeSet: { files: [] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`;
}
function initProject(rootDir, options) {
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'attestations'));
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'keys'));
    (0, index_1.ensureDir)(path_1.default.join(rootDir, '.ts-quality', 'witnesses'));
    const preset = options?.preset ?? 'default';
    const configPath = path_1.default.join(rootDir, 'ts-quality.config.ts');
    if (!fs_1.default.existsSync(configPath)) {
        fs_1.default.writeFileSync(configPath, initConfigText(preset), 'utf8');
    }
    const invariantsPath = path_1.default.join(rootDir, '.ts-quality', 'invariants.ts');
    if (!fs_1.default.existsSync(invariantsPath)) {
        fs_1.default.writeFileSync(invariantsPath, `export default [\n  {\n    id: 'auth.refresh.validity',\n    title: 'Refresh token validity',\n    description: 'Expired refresh tokens must never authorize access.',\n    severity: 'high',\n    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],\n    scenarios: [\n      {\n        id: 'expired',\n        description: 'expired token is denied',\n        keywords: ['expired', 'deny'],\n        failurePathKeywords: ['boundary', 'expiry'],\n        // Optional execution-backed witness generation during \`ts-quality check\`:\n        // executionWitnessCommand: ['node', '--test', 'test/token.test.js'],\n        // executionWitnessOutput: '.ts-quality/witnesses/auth-refresh-expired.json',\n        // executionWitnessTestFiles: ['test/token.test.js'],\n        // executionWitnessTimeoutMs: 5000,\n        expected: 'deny'\n      }\n    ]\n  }\n];\n`, 'utf8');
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
function readPackageScripts(rootDir) {
    const packagePath = path_1.default.join(rootDir, 'package.json');
    if (!fs_1.default.existsSync(packagePath)) {
        return {};
    }
    try {
        const parsed = JSON.parse(fs_1.default.readFileSync(packagePath, 'utf8'));
        return parsed.scripts ?? {};
    }
    catch {
        return {};
    }
}
function likelyScriptNames(scripts, tokens) {
    return Object.keys(scripts).filter((name) => tokens.some((token) => name.includes(token) || scripts[name]?.includes(token))).sort();
}
function renderDoctor(rootDir, options) {
    const scripts = readPackageScripts(rootDir);
    let loaded;
    let configError;
    try {
        loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    }
    catch (error) {
        configError = error instanceof Error ? error.message : String(error);
    }
    const config = loaded?.config;
    const sourcePatterns = config?.sourcePatterns ?? [...index_1.DEFAULT_SOURCE_PATTERNS];
    const testPatterns = config?.testPatterns ?? [...index_1.DEFAULT_TEST_PATTERNS];
    const sources = (0, index_1.collectSourceFiles)(rootDir, sourcePatterns);
    const tests = (0, index_1.listFiles)(rootDir).filter((filePath) => testPatterns.some((pattern) => (0, index_1.matchPattern)(pattern, filePath)));
    const changed = uniquePaths([...(options?.changedFiles ?? []), ...(config?.changeSet.files ?? [])]);
    const lcovPath = config?.coverage.lcovPath ?? 'coverage/lcov.info';
    const lcovExists = fs_1.default.existsSync(path_1.default.join(rootDir, lcovPath));
    const generateCommand = config?.coverage.generateCommand ?? [];
    const runtimeMirrorRoots = config?.mutations.runtimeMirrorRoots ?? ['dist'];
    const sourceDistRisk = changed.some(isSourceTsFile) && builtOutputRoots(runtimeMirrorRoots).some((root) => fs_1.default.existsSync(path_1.default.join(rootDir, root)));
    const coverageScripts = likelyScriptNames(scripts, ['coverage', 'lcov']);
    const testScripts = likelyScriptNames(scripts, ['test']);
    const lines = [
        'ts-quality doctor',
        `root: ${rootDir}`,
        `config: ${loaded ? (0, index_1.normalizePath)(path_1.default.relative(rootDir, loaded.configPath)) : `not loaded (${configError ?? 'missing'})`}`,
        `changed scope: ${changed.length > 0 ? changed.join(', ') : 'missing'}`,
        `source files: ${sources.length}`,
        `test files: ${tests.length}`,
        `package scripts: ${Object.keys(scripts).length > 0 ? Object.keys(scripts).sort().join(', ') : 'none'}`,
        `coverage lcovPath: ${lcovPath} (${lcovExists ? 'exists' : 'missing'})`,
        `coverage.generateCommand: ${generateCommand.length > 0 ? generateCommand.join(' ') : 'not configured'}`,
        `mutation testCommand: ${config?.mutations.testCommand.join(' ') ?? 'not configured'}`,
        `runtimeMirrorRoots: ${runtimeMirrorRoots.join(', ')}`,
        '',
        'Recommendations:'
    ];
    if (changed.length === 0) {
        lines.push('- Add changed scope with --changed <a,b,c>, changeSet.files, or changeSet.diffFile before check.');
    }
    if (!lcovExists && generateCommand.length === 0) {
        lines.push(coverageScripts.length > 0
            ? `- Configure coverage.generateCommand to run an existing script such as npm run ${coverageScripts[0]}.`
            : '- Configure coverage.generateCommand to create coverage/lcov.info, for example node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info.');
    }
    if (sourceDistRisk) {
        lines.push('- Coverage risk: changed src/**/*.ts files and built runtime roots are present. Enable source-map coverage mapping, for example NODE_OPTIONS=--enable-source-maps, or configure coverage to map back to src/**.');
    }
    if (testScripts.length > 0) {
        lines.push(`- Candidate focused test command: npm run ${testScripts[0]} -- --runInBand (adjust to the smallest trustworthy slice).`);
    }
    else if (tests.length > 0) {
        lines.push(`- Candidate focused test command: node --test ${tests[0]}.`);
    }
    lines.push('- Candidate witness command shape: ts-quality witness test --invariant <id> --scenario <id> --source-files <src> --test-files <test> --out .ts-quality/witnesses/<id>.json -- <focused command>');
    lines.push('- Suggested package.json snippets are advisory only: coverage:<slice>, witness:<slice>, quality:<slice>.');
    return `${lines.join('\n')}\n`;
}
function renderLatestReport(rootDir, format, options) {
    const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
    if (format === 'json') {
        return `${(0, index_1.stableStringify)(buildReportJsonArtifact(context.projectedRun, { projection: 'projected', drift: context.drift }))}\n`;
    }
    const body = (0, index_5.renderMarkdownReport)(context.projectedRun);
    const rendered = context.drift.length === 0
        ? body
        : injectMarkdownNotice(body, renderRunDriftMarkdownNotice(context.run, context.drift));
    return `${rendered}\n`;
}
function renderLatestExplain(rootDir, options) {
    const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
    const body = (0, index_5.renderExplainText)(context.projectedRun);
    if (context.drift.length === 0) {
        return `${body}\n`;
    }
    return `${renderRunDriftNotice(context.run, context.drift)}\n${body}\n`;
}
function renderTrend(rootDir) {
    const runs = orderedRuns(rootDir);
    if (runs.length < 2) {
        return 'Not enough runs for trend analysis.\n';
    }
    const current = runs[runs.length - 1];
    if (!current) {
        return 'Not enough runs for trend analysis.\n';
    }
    let previous;
    let nearestAssessment;
    for (let index = runs.length - 2; index >= 0; index -= 1) {
        const candidate = runs[index];
        if (!candidate) {
            continue;
        }
        const assessment = assessTrendComparability(current, candidate);
        if (!nearestAssessment) {
            nearestAssessment = { run: candidate, assessment };
        }
        if (!assessment.comparable) {
            continue;
        }
        previous = candidate;
        break;
    }
    if (!previous) {
        const lines = [
            `Current run: ${current.runId}`,
            'No comparable prior run for trend analysis.',
            'Trend comparisons require the same changed scope and invariant/policy baseline.'
        ];
        if (nearestAssessment) {
            lines.push(`Nearest earlier run: ${nearestAssessment.run.runId}`);
            lines.push(...nearestAssessment.assessment.reasons.map((reason) => `- ${reason}`));
        }
        return `${lines.join('\n')}\n`;
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
    const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
    const plan = (0, index_6.generateGovernancePlan)(context.projectedRun, context.constitution, context.agents);
    const body = renderGovernanceText(context.projectedRun, plan);
    if (context.drift.length === 0) {
        return body;
    }
    return `${renderRunDriftNotice(context.run, context.drift)}\n${body}`;
}
function renderPlan(rootDir, options) {
    const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
    const plan = (0, index_6.generateGovernancePlan)(context.projectedRun, context.constitution, context.agents);
    const body = renderPlanText(context.projectedRun, plan);
    if (context.drift.length === 0) {
        return body;
    }
    return `${renderRunDriftNotice(context.run, context.drift)}\n${body}`;
}
function runAuthorize(rootDir, agentId, action, options) {
    const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
    const bundle = (0, index_7.buildChangeBundle)(rootDir, context.run, agentId, action);
    const attestationVerification = buildAuthorizationAttestationVerification(context.runAttestationVerification);
    const baseDecision = context.drift.length > 0
        ? {
            id: `${context.run.runId}:${agentId}:${action}`,
            agentId,
            action,
            outcome: 'deny',
            reasons: [`Repository changed since run ${context.run.runId} or its control plane drifted. Re-run ts-quality check before authorizing ${action}.`],
            scope: context.run.changedFiles,
            missingProof: [],
            requiredApprovers: [],
            consideredAttestations: context.runAttestations.map((item) => item.issuer)
        }
        : (0, index_7.authorizeChange)(agentId, action, bundle, context.projectedRun, context.agents, context.constitution, context.runAttestations, context.overrides);
    const decision = {
        ...baseDecision,
        evidenceContext: buildAuthorizationEvidenceContext(context.projectedRun, agentId, action, attestationVerification)
    };
    const artifactDir = path_1.default.join(rootDir, '.ts-quality', 'runs', context.run.runId);
    const bundlePath = path_1.default.join(artifactDir, `bundle.${agentId}.${action}.json`);
    const decisionPath = path_1.default.join(artifactDir, `authorize.${agentId}.${action}.json`);
    (0, index_1.writeJson)(bundlePath, {
        ...bundle,
        attestationVerification
    });
    (0, index_1.writeJson)(decisionPath, decision);
    return { decisionPath, output: `${(0, index_1.stableStringify)(decision)}\n` };
}
function runExecutionWitnessCommand(rootDir, input) {
    const command = input.command.filter((item) => item.length > 0);
    if (command.length === 0) {
        throw new Error('execution witness command requires an executable and arguments');
    }
    const sourceFiles = [...new Set(input.sourceFiles.map((candidate) => resolveCliRepoLocalPath(rootDir, candidate, { kind: 'execution witness source file' }).relativePath))];
    if (sourceFiles.length === 0) {
        throw new Error('execution witness command requires at least one --source-files entry');
    }
    const testFiles = [...new Set((input.testFiles ?? []).map((candidate) => resolveCliRepoLocalPath(rootDir, candidate, { kind: 'execution witness test file' }).relativePath))];
    const outputResolution = resolveCliRepoLocalPath(rootDir, input.outputPath, { allowMissing: true, kind: 'execution witness output' });
    const recordedReceiptPath = executionWitnessReceiptPath(outputResolution.relativePath);
    const receiptResolution = resolveCliRepoLocalPath(rootDir, recordedReceiptPath, { allowMissing: true, kind: 'execution witness receipt output' });
    (0, index_1.ensureDir)(path_1.default.dirname(outputResolution.absolutePath));
    (0, index_1.ensureDir)(path_1.default.dirname(receiptResolution.absolutePath));
    const executable = command[0];
    if (!executable) {
        throw new Error('execution witness command requires an executable argument');
    }
    const started = Date.now();
    const result = (0, child_process_1.spawnSync)(executable, command.slice(1), {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: input.timeoutMs,
        shell: process.platform === 'win32',
        env: executionWitnessCommandEnv()
    });
    const durationMs = Date.now() - started;
    const receipt = result.error
        ? {
            status: result.error.code === 'ETIMEDOUT' ? 'timeout' : 'error',
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: result.error.message ?? 'unknown execution witness command error'
        }
        : {
            status: result.status === 0 ? 'pass' : 'fail',
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: executionWitnessCommandDetails(result)
        };
    const witness = {
        version: '1',
        kind: 'execution-witness',
        invariantId: input.invariantId,
        scenarioId: input.scenarioId,
        status: receipt.status === 'pass' ? 'pass' : 'fail',
        sourceFiles,
        ...(testFiles.length > 0 ? { testFiles } : {}),
        ...(input.observedAt ? { observedAt: input.observedAt } : {})
    };
    const receiptArtifact = {
        version: '1',
        kind: 'execution-witness-receipt',
        invariantId: input.invariantId,
        scenarioId: input.scenarioId,
        witnessPath: outputResolution.relativePath,
        command: [...command],
        sourceFiles,
        ...(testFiles.length > 0 ? { testFiles } : {}),
        ...(input.observedAt ? { observedAt: input.observedAt } : {}),
        receipt
    };
    (0, index_1.writeJson)(outputResolution.absolutePath, witness);
    (0, index_1.writeJson)(receiptResolution.absolutePath, receiptArtifact);
    return {
        outputPath: outputResolution.absolutePath,
        recordedOutputPath: outputResolution.relativePath,
        receiptPath: receiptResolution.absolutePath,
        recordedReceiptPath,
        witness,
        receipt
    };
}
function attestSign(rootDir, issuer, keyId, privateKeyPath, subjectFile, claims, outputPath) {
    const resolvedSubject = resolveCliAttestationSubject(rootDir, subjectFile);
    const resolvedKey = resolveCliPath(rootDir, privateKeyPath);
    const scopedSubject = (0, index_7.runScopedArtifactReference)(resolvedSubject.recordedPath);
    const attestation = (0, index_7.signAttestation)({
        issuer,
        keyId,
        privateKeyPem: fs_1.default.readFileSync(resolvedKey, 'utf8'),
        subjectType: path_1.default.extname(resolvedSubject.canonicalPath) === '.json' ? 'json-artifact' : 'file',
        subjectDigest: (0, index_1.fileDigest)(resolvedSubject.canonicalPath),
        claims,
        payload: {
            subjectFile: resolvedSubject.recordedPath,
            ...(scopedSubject ? { runId: scopedSubject.runId, artifactName: scopedSubject.artifactName } : {})
        }
    });
    const resolvedOutput = resolveCliPath(rootDir, outputPath);
    (0, index_1.ensureDir)(path_1.default.dirname(resolvedOutput));
    (0, index_7.saveAttestation)(resolvedOutput, attestation);
    return resolvedOutput;
}
function attestVerify(rootDir, attestationFile, trustedKeysDir, format = 'text') {
    const source = path_1.default.basename(attestationFile);
    const render = (records) => (format === 'json'
        ? renderAttestationVerificationJson(records)
        : renderAttestationVerificationReport(records));
    const resolvedAttestation = resolveCliPath(rootDir, attestationFile);
    let rawText;
    try {
        rawText = fs_1.default.readFileSync(resolvedAttestation, 'utf8');
    }
    catch {
        throw new Error(`unable to read attestation file ${attestationFile}`);
    }
    let rawAttestation;
    try {
        rawAttestation = JSON.parse(rawText);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return render([{ version: '1', source, ok: false, reason: `invalid JSON: ${message}` }]);
    }
    const parsed = (0, index_7.parseAttestationRecord)(rawAttestation);
    if (!parsed.ok) {
        return render([{ version: '1', source, ok: false, reason: parsed.reason }]);
    }
    const attestation = parsed.attestation;
    const keysDir = (0, index_1.resolveRepoLocalPath)(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
    const keys = (0, index_7.loadTrustedKeys)(keysDir);
    const result = verifyAttestationRecordAtRoot(rootDir, source, attestation, keys);
    return render([result]);
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
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function invalidAmendmentProposal(sourceLabel, message) {
    return new Error(`invalid amendment proposal in ${sourceLabel}: ${message}`);
}
function invalidAmendmentProposalJson(sourceLabel, message) {
    return new Error(`invalid amendment proposal JSON in ${sourceLabel}: ${message}`);
}
function amendmentStringField(record, field, sourceLabel, options) {
    const value = record[field];
    if (value === undefined) {
        if (options?.optional) {
            return undefined;
        }
        throw invalidAmendmentProposal(sourceLabel, `field ${field} must be a non-empty string`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw invalidAmendmentProposal(sourceLabel, `field ${field} must be a non-empty string`);
    }
    return value;
}
function amendmentArrayField(record, field, sourceLabel) {
    const value = record[field];
    if (!Array.isArray(value)) {
        throw invalidAmendmentProposal(sourceLabel, `field ${field} must be an array`);
    }
    return value;
}
function readAmendmentProposal(proposalPath) {
    const sourceLabel = path_1.default.basename(proposalPath);
    let raw;
    try {
        raw = JSON.parse(fs_1.default.readFileSync(proposalPath, 'utf8'));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw invalidAmendmentProposalJson(sourceLabel, message);
    }
    if (!isPlainRecord(raw)) {
        throw invalidAmendmentProposal(sourceLabel, 'top-level value must be an object');
    }
    const evidence = amendmentArrayField(raw, 'evidence', sourceLabel).map((item, index) => {
        if (typeof item !== 'string' || item.trim().length === 0) {
            throw invalidAmendmentProposal(sourceLabel, `field evidence[${index}] must be a non-empty string`);
        }
        return item;
    });
    const changes = amendmentArrayField(raw, 'changes', sourceLabel).map((item, index) => {
        if (!isPlainRecord(item)) {
            throw invalidAmendmentProposal(sourceLabel, `field changes[${index}] must be an object`);
        }
        const action = amendmentStringField(item, 'action', sourceLabel);
        const ruleId = amendmentStringField(item, 'ruleId', sourceLabel);
        const ruleValue = item['rule'];
        if (ruleValue !== undefined && !isPlainRecord(ruleValue)) {
            throw invalidAmendmentProposal(sourceLabel, `field changes[${index}].rule must be an object when provided`);
        }
        return {
            action,
            ruleId,
            ...(ruleValue !== undefined ? { rule: ruleValue } : {})
        };
    });
    const approvals = amendmentArrayField(raw, 'approvals', sourceLabel).map((item, index) => {
        if (!isPlainRecord(item)) {
            throw invalidAmendmentProposal(sourceLabel, `field approvals[${index}] must be an object`);
        }
        const by = amendmentStringField(item, 'by', sourceLabel);
        const rationale = amendmentStringField(item, 'rationale', sourceLabel);
        const createdAt = amendmentStringField(item, 'createdAt', sourceLabel);
        const targetId = amendmentStringField(item, 'targetId', sourceLabel);
        const role = amendmentStringField(item, 'role', sourceLabel, { optional: true });
        const standing = amendmentStringField(item, 'standing', sourceLabel, { optional: true });
        return {
            by,
            rationale,
            createdAt,
            targetId,
            ...(role !== undefined ? { role } : {}),
            ...(standing !== undefined ? { standing } : {})
        };
    });
    return {
        id: amendmentStringField(raw, 'id', sourceLabel),
        title: amendmentStringField(raw, 'title', sourceLabel),
        rationale: amendmentStringField(raw, 'rationale', sourceLabel),
        evidence,
        changes,
        approvals
    };
}
function runAmend(rootDir, proposalFile, apply = false, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const proposalPath = resolveCliRepoLocalPath(rootDir, proposalFile, { kind: 'amendment proposal' }).absolutePath;
    const proposal = readAmendmentProposal(proposalPath);
    const decision = (0, index_7.evaluateAmendment)(proposal, constitution, agents);
    const resultPath = path_1.default.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.json`);
    const resultTextPath = path_1.default.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.txt`);
    (0, index_1.ensureDir)(path_1.default.dirname(resultPath));
    (0, index_1.writeJson)(resultPath, decision);
    fs_1.default.writeFileSync(resultTextPath, renderAmendmentDecisionText(decision), 'utf8');
    if (apply && decision.outcome === 'approved') {
        const nextConstitution = (0, index_7.applyAmendment)(proposal, constitution);
        const constitutionPath = (0, index_1.resolveRepoLocalPath)(rootDir, loaded.config.constitutionPath, { allowMissing: true, kind: 'constitution path' }).absolutePath;
        writeModuleExport(constitutionPath, nextConstitution);
    }
    return `${(0, index_1.stableStringify)(decision)}
`;
}
//# sourceMappingURL=index.js.map