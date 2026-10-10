"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAttestationVerificationReport = renderAttestationVerificationReport;
exports.runAuthorize = runAuthorize;
exports.attestSign = attestSign;
exports.attestVerify = attestVerify;
exports.attestGenerateKey = attestGenerateKey;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../policy-engine/src/index");
const index_3 = require("../../legitimacy/src/index");
const attestations_1 = require("./attestations");
const cli_paths_1 = require("./cli-paths");
const run_context_1 = require("./run-context");
/** Attestation sign/verify/keygen, attestation loading for runs, and run-bound authorization. */
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
    const riskyInvariant = (0, index_2.findFirstRiskyInvariantClaim)(run);
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
        ...(run.nextEvidenceAction ? {
            evidenceClosure: {
                kind: run.nextEvidenceAction.primaryAction.kind,
                title: run.nextEvidenceAction.primaryAction.title,
                ...(typeof run.nextEvidenceAction.primaryAction.expectedConfidenceLift === 'number' ? { expectedConfidenceLift: run.nextEvidenceAction.primaryAction.expectedConfidenceLift } : {}),
                artifactPaths: run.nextEvidenceAction.primaryAction.artifactPaths
            }
        } : {}),
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
function renderVerificationText(value) {
    return (0, index_1.renderSafeText)(value);
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
function buildAuthorizationAttestationVerification(records) {
    return {
        verifiedCount: records.filter((record) => record.ok).length,
        failedCount: records.filter((record) => !record.ok).length,
        records: records.map((record) => ({ ...record }))
    };
}
function runAuthorize(rootDir, agentId, action, options) {
    const context = (0, run_context_1.projectedRunForDecision)(rootDir, (0, run_context_1.selectedRun)(rootDir, options), options);
    const bundle = (0, index_3.buildChangeBundle)(rootDir, context.run, agentId, action);
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
        : (0, index_3.authorizeChange)(agentId, action, bundle, context.projectedRun, context.agents, context.constitution, context.runAttestations, context.overrides);
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
function attestSign(rootDir, issuer, keyId, privateKeyPath, subjectFile, claims, outputPath) {
    const resolvedSubject = (0, cli_paths_1.resolveCliAttestationSubject)(rootDir, subjectFile);
    const resolvedKey = (0, cli_paths_1.resolveCliPath)(rootDir, privateKeyPath);
    const scopedSubject = (0, index_3.runScopedArtifactReference)(resolvedSubject.recordedPath);
    const attestation = (0, index_3.signAttestation)({
        issuer,
        keyId,
        privateKeyPem: fs_1.default.readFileSync(resolvedKey, 'utf8'),
        subjectType: path_1.default.extname(resolvedSubject.canonicalPath) === '.json' ? 'json-artifact' : 'file', // ubs:ignore file-extension check, not a secret comparison
        subjectDigest: (0, index_1.fileDigest)(resolvedSubject.canonicalPath),
        claims,
        payload: {
            subjectFile: resolvedSubject.recordedPath,
            ...(scopedSubject ? { runId: scopedSubject.runId, artifactName: scopedSubject.artifactName } : {})
        }
    });
    const resolvedOutput = (0, cli_paths_1.resolveCliPath)(rootDir, outputPath);
    (0, index_1.ensureDir)(path_1.default.dirname(resolvedOutput));
    (0, index_3.saveAttestation)(resolvedOutput, attestation);
    return resolvedOutput;
}
function attestVerify(rootDir, attestationFile, trustedKeysDir, format = 'text') {
    const source = path_1.default.basename(attestationFile);
    const render = (records) => (format === 'json'
        ? renderAttestationVerificationJson(records)
        : renderAttestationVerificationReport(records));
    const resolvedAttestation = (0, cli_paths_1.resolveCliPath)(rootDir, attestationFile);
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
    const parsed = (0, index_3.parseAttestationRecord)(rawAttestation);
    if (!parsed.ok) {
        return render([{ version: '1', source, ok: false, reason: parsed.reason }]);
    }
    const attestation = parsed.attestation;
    const keysDir = (0, index_1.resolveRepoLocalPath)(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
    const keys = (0, index_3.loadTrustedKeys)(keysDir);
    const result = (0, attestations_1.verifyAttestationRecordAtRoot)(rootDir, source, attestation, keys);
    return render([result]);
}
function attestGenerateKey(outDir, keyId) {
    (0, index_1.ensureDir)(outDir);
    const pair = (0, index_3.generateKeyPair)();
    const privatePath = path_1.default.join(outDir, `${keyId}.pem`);
    const publicPath = path_1.default.join(outDir, `${keyId}.pub.pem`);
    fs_1.default.writeFileSync(privatePath, pair.privateKeyPem, 'utf8');
    fs_1.default.writeFileSync(publicPath, pair.publicKeyPem, 'utf8');
    return `${privatePath}\n${publicPath}\n`;
}
//# sourceMappingURL=legitimacy-commands.js.map