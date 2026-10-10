"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectedRun = selectedRun;
exports.expectedRunFileDigest = expectedRunFileDigest;
exports.digestOrMissing = digestOrMissing;
exports.policyConfigFromLoadedContext = policyConfigFromLoadedContext;
exports.buildControlPlaneSnapshot = buildControlPlaneSnapshot;
exports.projectedRunForDecision = projectedRunForDecision;
exports.renderRunDriftNotice = renderRunDriftNotice;
exports.renderRunDriftMarkdownNotice = renderRunDriftMarkdownNotice;
exports.injectMarkdownNotice = injectMarkdownNotice;
exports.buildReportJsonArtifact = buildReportJsonArtifact;
exports.assertSupportedRun = assertSupportedRun;
exports.assertContainedRunFiles = assertContainedRunFiles;
exports.loadContainedRun = loadContainedRun;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../policy-engine/src/index");
const index_3 = require("../../governance/src/index");
const config_1 = require("./config");
const attestations_1 = require("./attestations");
function selectedRun(rootDir, options) {
    return options?.runId ? (0, index_1.loadRun)(rootDir, options.runId) : (0, index_1.readLatestRun)(rootDir);
}
function expectedRunFileDigest(run, filePath) {
    if (run.changedFileDigests !== undefined) {
        const snapshot = run.changedFileDigests;
        const digest = snapshot && Object.prototype.hasOwnProperty.call(snapshot, filePath) ? snapshot[filePath] : undefined;
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || typeof digest !== 'string' || !/^sha256:(?:[a-f0-9]{64}|missing)$/u.test(digest)) {
            throw new Error(`Run ${run.runId} carries a malformed changed-file digest snapshot. Re-run ts-quality check with a new run id.`);
        }
        return digest;
    }
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
        const expectedDigest = expectedRunFileDigest(run, filePath) ?? 'sha256:unrecorded';
        const absolutePath = (0, index_1.resolveRepoLocalPath)(rootDir, filePath, { allowMissing: true, kind: 'changed file' }).absolutePath;
        const entry = contentDrift(`changed file ${filePath}`, absolutePath, expectedDigest);
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
        ...(0, index_2.defaultPolicy)(),
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
    const { attestations, verification } = (0, attestations_1.loadVerifiedAttestations)(rootDir, snapshot?.attestationsDir ?? loaded?.config.attestationsDir ?? '.ts-quality/attestations', snapshot?.trustedKeysDir ?? loaded?.config.trustedKeysDir ?? '.ts-quality/keys');
    const runAttestations = attestations.filter((attestation) => (0, attestations_1.attestationAppliesToRun)(attestation, run.runId));
    const runAttestationVerification = verification.filter((record) => (0, attestations_1.attestationVerificationAppliesToRun)(record, run.runId));
    const policy = snapshot ? policyConfigFromSnapshot(snapshot) : policyConfigFromLoadedContext(loaded);
    const preliminary = (0, index_2.evaluatePolicy)({
        nowIso: (0, index_1.nowIso)(),
        policy,
        changedComplexity: run.complexity.filter((item) => item.changed),
        mutations: run.mutations,
        ...(run.mutationBaseline ? { mutationBaseline: run.mutationBaseline } : {}),
        behaviorClaims: run.behaviorClaims,
        governance: [],
        waivers
    });
    const governance = (0, index_3.evaluateGovernance)({
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
    const evaluated = (0, index_2.evaluatePolicy)({
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
const SUPPORTED_RUN_VERSIONS = new Set(['0.1.0', '0.2.0']);
/** Loads another run for comparison with repo containment (symlink escapes refused) and a supported schema version. */
function assertSupportedRun(run) {
    if (!SUPPORTED_RUN_VERSIONS.has(String(run.version))) {
        throw new Error(`Run ${run.runId} has an unsupported run version ${String(run.version)}; navigation reads ${[...SUPPORTED_RUN_VERSIONS].join(', ')}.`);
    }
    return run;
}
function assertContainedRunFiles(rootDir, runId) {
    const safeRunId = (0, index_1.assertSafeRunId)(runId);
    // Both the directory and run.json itself must resolve inside the repository (symlink escapes refused).
    (0, index_1.resolveRepoLocalPath)(rootDir, `.ts-quality/runs/${safeRunId}`, { kind: 'run directory' });
    (0, index_1.resolveRepoLocalPath)(rootDir, `.ts-quality/runs/${safeRunId}/run.json`, { kind: 'run packet' });
}
function loadContainedRun(rootDir, runId) {
    assertContainedRunFiles(rootDir, runId);
    return assertSupportedRun((0, index_1.loadRun)(rootDir, (0, index_1.assertSafeRunId)(runId)));
}
//# sourceMappingURL=run-context.js.map