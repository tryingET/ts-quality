import fs from 'fs';
import path from 'path';
import {
  type AttestationVerificationRecord,
  type AuthorizationAttestationVerificationSummary,
  type AuthorizationDecision,
  ensureDir,
  fileDigest,
  renderSafeText,
  resolveRepoLocalPath,
  type RunArtifact,
  stableStringify,
  writeJson
} from '../../evidence-model/src/index';
import { findFirstRiskyInvariantClaim } from '../../policy-engine/src/index';
import {
  authorizeChange,
  buildChangeBundle,
  generateKeyPair,
  loadTrustedKeys,
  parseAttestationRecord,
  runScopedArtifactReference,
  saveAttestation,
  signAttestation
} from '../../legitimacy/src/index';
import { verifyAttestationRecordAtRoot } from './attestations';
import { resolveCliAttestationSubject, resolveCliPath } from './cli-paths';
import { RunDecisionOptions, projectedRunForDecision, selectedRun } from './run-context';

/** Attestation sign/verify/keygen, attestation loading for runs, and run-bound authorization. */

function authorizationRiskSignals(claim: RunArtifact['behaviorClaims'][number]): NonNullable<NonNullable<AuthorizationDecision['evidenceContext']>['riskyInvariant']>['signals'] {
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
function buildAuthorizationEvidenceContext(
  run: Pick<RunArtifact, 'runId' | 'behaviorClaims' | 'governance' | 'verdict' | 'nextEvidenceAction'>,
  agentId: string,
  action: string,
  attestationVerification: AuthorizationAttestationVerificationSummary
): NonNullable<AuthorizationDecision['evidenceContext']> {
  const riskyInvariant = findFirstRiskyInvariantClaim(run);
  const riskySummary = riskyInvariant?.evidenceSummary;
  const evidenceProvenance = riskySummary?.subSignals.reduce(
    (counts, item) => {
      counts[item.mode] += 1;
      return counts;
    },
    { explicit: 0, inferred: 0, missing: 0 }
  );
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
function renderVerificationText(value: string): string {
  return renderSafeText(value);
}
function renderAttestationVerificationRecord(record: AttestationVerificationRecord): string {
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
export function renderAttestationVerificationReport(records: AttestationVerificationRecord[]): string {
  if (records.length === 0) {
    return '\n';
  }
  return `${records.map((record) => renderAttestationVerificationRecord(record)).join('\n\n')}\n`;
}
function renderAttestationVerificationJson(records: AttestationVerificationRecord[]): string {
  if (records.length === 1) {
    return `${stableStringify(records[0])}\n`;
  }
  return `${stableStringify(records)}\n`;
}
function buildAuthorizationAttestationVerification(records: AttestationVerificationRecord[]): AuthorizationAttestationVerificationSummary {
  return {
    verifiedCount: records.filter((record) => record.ok).length,
    failedCount: records.filter((record) => !record.ok).length,
    records: records.map((record) => ({ ...record }))
  };
}
export function runAuthorize(rootDir: string, agentId: string, action: string, options?: RunDecisionOptions): { decisionPath: string; output: string } {
  const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
  const bundle = buildChangeBundle(rootDir, context.run, agentId, action);
  const attestationVerification = buildAuthorizationAttestationVerification(context.runAttestationVerification);
  const baseDecision = context.drift.length > 0
    ? {
        id: `${context.run.runId}:${agentId}:${action}`,
        agentId,
        action,
        outcome: 'deny' as const,
        reasons: [`Repository changed since run ${context.run.runId} or its control plane drifted. Re-run ts-quality check before authorizing ${action}.`],
        scope: context.run.changedFiles,
        missingProof: [],
        requiredApprovers: [],
        consideredAttestations: context.runAttestations.map((item) => item.issuer)
      }
    : authorizeChange(agentId, action, bundle, context.projectedRun, context.agents, context.constitution, context.runAttestations, context.overrides);
  const decision: AuthorizationDecision = {
    ...baseDecision,
    evidenceContext: buildAuthorizationEvidenceContext(context.projectedRun, agentId, action, attestationVerification)
  };
  const artifactDir = path.join(rootDir, '.ts-quality', 'runs', context.run.runId);
  const bundlePath = path.join(artifactDir, `bundle.${agentId}.${action}.json`);
  const decisionPath = path.join(artifactDir, `authorize.${agentId}.${action}.json`);
  writeJson(bundlePath, {
    ...bundle,
    attestationVerification
  });
  writeJson(decisionPath, decision);
  return { decisionPath, output: `${stableStringify(decision)}\n` };
}
export function attestSign(rootDir: string, issuer: string, keyId: string, privateKeyPath: string, subjectFile: string, claims: string[], outputPath: string): string {
  const resolvedSubject = resolveCliAttestationSubject(rootDir, subjectFile);
  const resolvedKey = resolveCliPath(rootDir, privateKeyPath);
  const scopedSubject = runScopedArtifactReference(resolvedSubject.recordedPath);
  const attestation = signAttestation({
    issuer,
    keyId,
    privateKeyPem: fs.readFileSync(resolvedKey, 'utf8'),
    subjectType: path.extname(resolvedSubject.canonicalPath) === '.json' ? 'json-artifact' : 'file', // ubs:ignore file-extension check, not a secret comparison
    subjectDigest: fileDigest(resolvedSubject.canonicalPath),
    claims,
    payload: {
      subjectFile: resolvedSubject.recordedPath,
      ...(scopedSubject ? { runId: scopedSubject.runId, artifactName: scopedSubject.artifactName } : {})
    }
  });
  const resolvedOutput = resolveCliPath(rootDir, outputPath);
  ensureDir(path.dirname(resolvedOutput));
  saveAttestation(resolvedOutput, attestation);
  return resolvedOutput;
}
export function attestVerify(rootDir: string, attestationFile: string, trustedKeysDir: string, format: 'text' | 'json' = 'text'): string {
  const source = path.basename(attestationFile);
  const render = (records: AttestationVerificationRecord[]): string => (format === 'json'
    ? renderAttestationVerificationJson(records)
    : renderAttestationVerificationReport(records));
  const resolvedAttestation = resolveCliPath(rootDir, attestationFile);
  let rawText: string;
  try {
    rawText = fs.readFileSync(resolvedAttestation, 'utf8');
  } catch {
    throw new Error(`unable to read attestation file ${attestationFile}`);
  }
  let rawAttestation: unknown;
  try {
    rawAttestation = JSON.parse(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return render([{ version: '1', source, ok: false, reason: `invalid JSON: ${message}` }]);
  }
  const parsed = parseAttestationRecord(rawAttestation);
  if (!parsed.ok) {
    return render([{ version: '1', source, ok: false, reason: parsed.reason }]);
  }
  const attestation = parsed.attestation;
  const keysDir = resolveRepoLocalPath(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
  const keys = loadTrustedKeys(keysDir);
  const result = verifyAttestationRecordAtRoot(rootDir, source, attestation, keys);
  return render([result]);
}
export function attestGenerateKey(outDir: string, keyId: string): string {
  ensureDir(outDir);
  const pair = generateKeyPair();
  const privatePath = path.join(outDir, `${keyId}.pem`);
  const publicPath = path.join(outDir, `${keyId}.pub.pem`);
  fs.writeFileSync(privatePath, pair.privateKeyPem, 'utf8');
  fs.writeFileSync(publicPath, pair.publicKeyPem, 'utf8');
  return `${privatePath}\n${publicPath}\n`;
}
