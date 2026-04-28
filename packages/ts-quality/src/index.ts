import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import {
  type Agent,
  type AmendmentDecision,
  type AmendmentProposal,
  type AnalysisContext,
  type AnalysisWarning,
  type Approval,
  type Attestation,
  type AttestationVerificationRecord,
  type AuthorizationAttestationVerificationSummary,
  type AuthorizationDecision,
  type ConstitutionRule,
  type ControlPlaneSnapshot,
  type CoverageGenerationRecord,
  type ExecutionReceipt,
  type ExecutionWitnessRecord,
  type ExecutionWitnessReceiptArtifact,
  type ExecutionWitnessRunRecord,
  type ExecutionWitnessRunSummary,
  type ExecutionWitnessSkippedRecord,
  type FileEntity,
  type RunArtifact,
  type SymbolEntity,
  type MutationRemediation,
  type NextEvidenceAction,
  CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION,
  DEFAULT_SOURCE_PATTERNS,
  DEFAULT_TEST_PATTERNS,
  assertSafeRunId,
  buildRepositoryEntity,
  collectSourceFiles,
  createRunId,
  ensureDir,
  fileDigest,
  listFiles,
  listRunIds,
  loadRun,
  matchPattern,
  normalizePath,
  nowIso,
  readLatestRun,
  resolvePackageName,
  renderSafeText,
  resolveRepoLocalPath,
  stableStringify,
  writeJson,
  writeRunArtifact
} from '../../evidence-model/src/index';
import { analyzeCrap, parseLcov } from '../../crap4ts/src/index';
import { runMutations } from '../../ts-mutate/src/index';
import { collectExecutionWitnessPlanSummary, evaluateInvariants } from '../../invariants/src/index';
import {
  type PolicyInput,
  defaultPolicy,
  evaluatePolicy,
  findFirstRiskyInvariantClaim,
  renderConciseInvariantProvenance,
  renderExplainText,
  renderMarkdownReport,
  renderPrSummary
} from '../../policy-engine/src/index';
import { evaluateGovernance, generateGovernancePlan } from '../../governance/src/index';
import { applyAmendment, authorizeChange, buildChangeBundle, evaluateAmendment, generateKeyPair, loadTrustedKeys, parseAttestationRecord, runScopedArtifactReference, saveAttestation, signAttestation, validateRenderableAttestationContract, verifyAttestation } from '../../legitimacy/src/index';
import { loadAgents, loadApprovals, loadChangedRegions, loadConstitution, loadContext, loadInvariants, loadOverrides, loadWaivers } from './config';

export interface CheckResult {
  run: RunArtifact;
  artifactDir: string;
}

export interface MaterializeResult {
  configPath: string;
  outDir: string;
  files: string[];
}

interface RunDriftEntry {
  subject: string;
  expected: string;
  actual: string;
}

interface RunDecisionContext {
  run: RunArtifact;
  projectedRun: RunArtifact;
  approvals: ReturnType<typeof loadApprovals>;
  overrides: ReturnType<typeof loadOverrides>;
  agents: ReturnType<typeof loadAgents>;
  constitution: ReturnType<typeof loadConstitution>;
  runAttestations: Attestation[];
  runAttestationVerification: AttestationVerificationRecord[];
  drift: RunDriftEntry[];
}

interface ReportDecisionContext {
  projection: 'persisted' | 'projected';
  drift: RunDriftEntry[];
}

interface ReportJsonArtifact extends RunArtifact {
  decisionContext: ReportDecisionContext;
}

interface TrendComparableRun {
  runId: string;
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  controlPlane?: ControlPlaneSnapshot | undefined;
  invariants: RunArtifact['invariants'];
}

interface TrendComparabilityAssessment {
  comparable: boolean;
  reasons: string[];
}

interface RunSelectionOptions {
  runId?: string;
}

interface RunDecisionOptions extends RunSelectionOptions {
  configPath?: string;
}

function fileEntities(rootDir: string, filePaths: string[]): FileEntity[] {
  const repo = buildRepositoryEntity(rootDir, filePaths);
  return filePaths.map((filePath) => {
    const normalizedFilePath = normalizePath(filePath);
    const result: FileEntity = {
      filePath: normalizedFilePath,
      digest: fileDigest(path.join(rootDir, filePath))
    };
    const packageName = resolvePackageName(normalizedFilePath, repo.packages);
    if (packageName) {
      result.packageName = packageName;
    }
    return result;
  });
}

function symbolEntities(complexity: RunArtifact['complexity']): SymbolEntity[] {
  return complexity.map((item) => ({
    filePath: item.filePath,
    symbol: item.symbol,
    kind: item.symbol.split(':')[0] ?? 'function',
    span: item.span
  }));
}

function renderInvariantProvenanceBlock(
  run: Pick<RunArtifact, 'behaviorClaims'>,
  options?: { linePrefix?: string; includeObligation?: boolean }
): string[] {
  const riskyInvariant = findFirstRiskyInvariantClaim(run);
  if (!riskyInvariant) {
    return [];
  }
  const linePrefix = options?.linePrefix ?? '';
  const witnessPressureNote = renderExecutionWitnessPressureNote(riskyInvariant, linePrefix);
  const lines = [
    `${linePrefix}Invariant evidence at risk: ${riskyInvariant.invariantId}`,
    ...renderConciseInvariantProvenance(riskyInvariant, { linePrefix }),
    ...(witnessPressureNote ? [witnessPressureNote] : [])
  ];
  if (options?.includeObligation !== false && riskyInvariant.obligations.length > 0) {
    lines.push(`${linePrefix}Obligation: ${riskyInvariant.obligations[0]?.description}`);
  }
  return lines;
}

function renderExecutionWitnessPressureNote(claim: RunArtifact['behaviorClaims'][number], linePrefix = ''): string | undefined {
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

function renderAnalysisWarningsText(warnings: AnalysisWarning[] | undefined): string[] {
  if (!warnings || warnings.length === 0) {
    return [];
  }
  return warnings.flatMap((warning) => [
    `Analysis warning: ${warning.message}`,
    ...(warning.hint ? [`Hint: ${warning.hint}`] : []),
    ...warning.evidence.map((item) => `Evidence: ${item}`)
  ]);
}

function renderCheckSummaryText(run: Pick<RunArtifact, 'behaviorClaims' | 'verdict' | 'executionWitnesses' | 'coverageGeneration' | 'analysisWarnings' | 'nextEvidenceAction'>): string {
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

function renderCoverageGenerationText(record: CoverageGenerationRecord): string {
  return [
    `command: ${record.command.join(' ')}`,
    `lcovPath: ${record.lcovPath}`,
    `status: ${record.receipt.status}`,
    `durationMs: ${record.receipt.durationMs}`,
    `exitCode: ${record.receipt.exitCode ?? 'none'}`,
    `details: ${record.receipt.details ?? 'none'}`
  ].join('\n') + '\n';
}

function renderNextEvidenceActionText(action: NextEvidenceAction): string {
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

function renderPlanText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
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

function renderPlanArtifactText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
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

function renderGovernanceText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
  const lines = run.governance.map((item) => `${item.ruleId}: ${item.message}`);
  const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  lines.push('', plan.summary);
  return `${lines.join('\n')}\n`;
}

function renderGovernanceArtifactText(run: RunArtifact, _plan: ReturnType<typeof generateGovernancePlan>): string {
  const lines = run.governance.flatMap((item) => [`${item.ruleId}: ${item.message}`, ...item.evidence.map((evidence) => `- ${evidence}`)]);
  const provenance = renderInvariantProvenanceBlock(run, { linePrefix: '- ' });
  if (provenance.length > 0) {
    lines.push('', ...provenance);
  }
  return `${lines.join('\n')}\n`;
}

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
  run: Pick<RunArtifact, 'runId' | 'behaviorClaims' | 'governance' | 'verdict'>,
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

function orderedRuns(rootDir: string): RunArtifact[] {
  return listRunIds(rootDir)
    .map((runId) => loadRun(rootDir, runId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.runId.localeCompare(right.runId));
}

function sortedUniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map((item) => normalizePath(item)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function changedRegionSignatures(regions: RunArtifact['changedRegions']): string[] {
  return [...new Set(regions.map((region) => `${normalizePath(region.filePath)}:${region.span.startLine}-${region.span.endLine}`))]
    .sort((left, right) => left.localeCompare(right));
}

function equalStringLists(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function assessTrendComparability(current: TrendComparableRun, previous: TrendComparableRun): TrendComparabilityAssessment {
  const reasons: string[] = [];
  if (!equalStringLists(sortedUniqueNormalized(current.changedFiles), sortedUniqueNormalized(previous.changedFiles))) {
    reasons.push('changed file scope differs');
  }
  const currentRegions = changedRegionSignatures(current.changedRegions);
  const previousRegions = changedRegionSignatures(previous.changedRegions);
  if ((currentRegions.length > 0 || previousRegions.length > 0) && !equalStringLists(currentRegions, previousRegions)) {
    reasons.push('changed hunk scope differs');
  }
  if (stableStringify(current.invariants) !== stableStringify(previous.invariants)) {
    reasons.push('invariant baseline differs');
  }
  if (current.controlPlane && previous.controlPlane) {
    if (stableStringify(current.controlPlane.policy) !== stableStringify(previous.controlPlane.policy)) {
      reasons.push('policy baseline differs');
    }
    if (current.controlPlane.constitutionDigest !== previous.controlPlane.constitutionDigest) {
      reasons.push('constitution baseline differs');
    }
  } else if (Boolean(current.controlPlane) !== Boolean(previous.controlPlane)) {
    reasons.push('control-plane snapshot availability differs');
  }
  return {
    comparable: reasons.length === 0,
    reasons
  };
}

function latestComparableRunOrUndefined(rootDir: string, current: TrendComparableRun): RunArtifact | undefined {
  const runs = orderedRuns(rootDir);
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const candidate = runs[index];
    if (candidate && assessTrendComparability(current, candidate).comparable) {
      return candidate;
    }
  }
  return undefined;
}

function selectedRun(rootDir: string, options?: RunSelectionOptions): RunArtifact {
  return options?.runId ? loadRun(rootDir, options.runId) : readLatestRun(rootDir);
}

function expectedRunFileDigest(run: RunArtifact, filePath: string): string | undefined {
  return run.files.find((item) => item.filePath === normalizePath(filePath))?.digest;
}

function digestOrMissing(absolutePath: string): string {
  return fs.existsSync(absolutePath)
    ? fileDigest(absolutePath)
    : 'sha256:missing';
}

function contentDrift(subject: string, absolutePath: string, expected: string): RunDriftEntry | undefined {
  const actual = digestOrMissing(absolutePath);
  if (actual === expected) {
    return undefined;
  }
  return { subject, expected, actual };
}

function detectControlPlaneDrift(rootDir: string, snapshot: ControlPlaneSnapshot): RunDriftEntry[] {
  return [
    contentDrift('control plane config', path.join(rootDir, snapshot.configPath), snapshot.configDigest),
    contentDrift('control plane constitution', path.join(rootDir, snapshot.constitutionPath), snapshot.constitutionDigest),
    contentDrift('control plane agents', path.join(rootDir, snapshot.agentsPath), snapshot.agentsDigest)
  ].filter((item): item is RunDriftEntry => Boolean(item));
}

function detectRunDrift(rootDir: string, run: RunArtifact): RunDriftEntry[] {
  const drift: RunDriftEntry[] = [];
  for (const filePath of run.changedFiles.map((item) => normalizePath(item))) {
    const expectedDigest = expectedRunFileDigest(run, filePath);
    if (!expectedDigest) {
      continue;
    }
    const entry = contentDrift(`changed file ${filePath}`, path.join(rootDir, filePath), expectedDigest);
    if (entry) {
      drift.push(entry);
    }
  }
  if (run.controlPlane) {
    drift.push(...detectControlPlaneDrift(rootDir, run.controlPlane));
  }
  return drift;
}

function policyConfigFromLoadedContext(loaded: ReturnType<typeof loadContext>): ReturnType<typeof defaultPolicy> {
  return {
    ...defaultPolicy(),
    ...loaded.config.policy
  };
}

function policyConfigFromSnapshot(snapshot: ControlPlaneSnapshot): ReturnType<typeof defaultPolicy> {
  return { ...snapshot.policy };
}

function malformedSnapshotError(runId: string, detail: string): Error {
  return new Error(`Run ${runId} carries malformed control-plane snapshot schema ${CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION}: ${detail}. Re-run ts-quality check before trusting downstream decision surfaces.`);
}

function snapshotStringField(snapshot: Record<string, unknown>, field: string, runId: string): string {
  if (typeof snapshot[field] !== 'string' || snapshot[field].length === 0) {
    throw malformedSnapshotError(runId, `field ${field} must be a non-empty string`);
  }
  return snapshot[field] as string;
}

function snapshotNumberField(snapshot: Record<string, unknown>, field: string, runId: string, options: { min?: number; max?: number } = {}): number {
  if (typeof snapshot[field] !== 'number' || !Number.isFinite(snapshot[field])) {
    throw malformedSnapshotError(runId, `field ${field} must be a finite number`);
  }
  const value = snapshot[field] as number;
  if (typeof options.min === 'number' && value < options.min) {
    throw malformedSnapshotError(runId, `field ${field} must be >= ${options.min}`);
  }
  if (typeof options.max === 'number' && value > options.max) {
    throw malformedSnapshotError(runId, `field ${field} must be <= ${options.max}`);
  }
  return value;
}

function snapshotObjectArrayField<T extends object>(
  snapshot: Record<string, unknown>,
  field: string,
  runId: string,
  validateItem: (item: Record<string, unknown>, index: number) => void
): T[] {
  if (!Array.isArray(snapshot[field])) {
    throw malformedSnapshotError(runId, `field ${field} must be an array`);
  }
  const value = snapshot[field] as unknown[];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw malformedSnapshotError(runId, `field ${field}[${index}] must be an object`);
    }
    validateItem(item as Record<string, unknown>, index);
  }
  return value as T[];
}

function validateSnapshotConstitutionRule(rule: Record<string, unknown>, index: number, runId: string): void {
  const ruleId = rule['id'];
  const kind = rule['kind'];
  if (typeof ruleId !== 'string' || ruleId.length === 0) {
    throw malformedSnapshotError(runId, `field constitution[${index}].id must be a non-empty string`);
  }
  if (typeof kind !== 'string' || kind.length === 0) {
    throw malformedSnapshotError(runId, `field constitution[${index}].kind must be a non-empty string`);
  }
}

function validateSnapshotAgent(agent: Record<string, unknown>, index: number, runId: string): void {
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

function validatedControlPlaneSnapshot(run: RunArtifact): ControlPlaneSnapshot | undefined {
  const snapshot = run.controlPlane;
  if (!snapshot) {
    return undefined;
  }
  const record = snapshot as unknown as Record<string, unknown>;
  const schemaVersion = record['schemaVersion'];
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    throw malformedSnapshotError(run.runId, `field schemaVersion must be integer ${CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION}`);
  }
  if (schemaVersion !== CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Run ${run.runId} carries unsupported control-plane snapshot schema ${String(schemaVersion)}. `
      + `Expected ${CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION}. Re-run ts-quality check before trusting downstream decision surfaces.`
    );
  }
  const recordPolicy = record['policy'];
  const policy = (typeof recordPolicy === 'object' && recordPolicy !== null)
    ? recordPolicy as Record<string, unknown>
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
  snapshotObjectArrayField<ConstitutionRule>(record, 'constitution', run.runId, (item, index) => validateSnapshotConstitutionRule(item, index, run.runId));
  snapshotStringField(record, 'agentsPath', run.runId);
  snapshotStringField(record, 'agentsDigest', run.runId);
  snapshotObjectArrayField<Agent>(record, 'agents', run.runId, (item, index) => validateSnapshotAgent(item, index, run.runId));
  snapshotStringField(record, 'approvalsPath', run.runId);
  snapshotStringField(record, 'waiversPath', run.runId);
  snapshotStringField(record, 'overridesPath', run.runId);
  snapshotStringField(record, 'attestationsDir', run.runId);
  snapshotStringField(record, 'trustedKeysDir', run.runId);
  return snapshot;
}

function buildControlPlaneSnapshot(
  rootDir: string,
  loaded: ReturnType<typeof loadContext>,
  constitution: ReturnType<typeof loadConstitution>,
  agents: ReturnType<typeof loadAgents>
): ControlPlaneSnapshot {
  return {
    schemaVersion: CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION,
    configPath: normalizePath(path.relative(rootDir, loaded.configPath)),
    configDigest: digestOrMissing(loaded.configPath),
    policy: policyConfigFromLoadedContext(loaded),
    constitutionPath: loaded.config.constitutionPath,
    constitutionDigest: digestOrMissing(path.join(rootDir, loaded.config.constitutionPath)),
    constitution,
    agentsPath: loaded.config.agentsPath,
    agentsDigest: digestOrMissing(path.join(rootDir, loaded.config.agentsPath)),
    agents,
    approvalsPath: loaded.config.approvalsPath,
    waiversPath: loaded.config.waiversPath,
    overridesPath: loaded.config.overridesPath,
    attestationsDir: loaded.config.attestationsDir,
    trustedKeysDir: loaded.config.trustedKeysDir
  };
}

function projectedRunForDecision(rootDir: string, run: RunArtifact, options?: { configPath?: string }): RunDecisionContext {
  const snapshot = validatedControlPlaneSnapshot(run);
  const loaded = snapshot
    ? undefined
    : loadContext(rootDir, options?.configPath);
  const approvals = loadApprovals(rootDir, snapshot?.approvalsPath ?? loaded?.config.approvalsPath ?? '.ts-quality/approvals.json');
  const overrides = loadOverrides(rootDir, snapshot?.overridesPath ?? loaded?.config.overridesPath ?? '.ts-quality/overrides.json');
  const waivers = loadWaivers(rootDir, snapshot?.waiversPath ?? loaded?.config.waiversPath ?? '.ts-quality/waivers.json');
  const constitution = snapshot?.constitution ?? loadConstitution(rootDir, loaded?.config.constitutionPath ?? '.ts-quality/constitution.ts');
  const agents = snapshot?.agents ?? loadAgents(rootDir, loaded?.config.agentsPath ?? '.ts-quality/agents.ts');
  const { attestations, verification } = loadVerifiedAttestations(
    rootDir,
    snapshot?.attestationsDir ?? loaded?.config.attestationsDir ?? '.ts-quality/attestations',
    snapshot?.trustedKeysDir ?? loaded?.config.trustedKeysDir ?? '.ts-quality/keys'
  );
  const runAttestations = attestations.filter((attestation) => attestationAppliesToRun(attestation, run.runId));
  const runAttestationVerification = verification.filter((record) => attestationVerificationAppliesToRun(record, run.runId));
  const policy = snapshot ? policyConfigFromSnapshot(snapshot) : policyConfigFromLoadedContext(loaded!);
  const preliminary = evaluatePolicy({
    nowIso: nowIso(),
    policy,
    changedComplexity: run.complexity.filter((item) => item.changed),
    mutations: run.mutations,
    ...(run.mutationBaseline ? { mutationBaseline: run.mutationBaseline } : {}),
    behaviorClaims: run.behaviorClaims,
    governance: [],
    waivers
  });
  const governance = evaluateGovernance({
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
  const evaluated = evaluatePolicy({
    nowIso: nowIso(),
    policy,
    changedComplexity: run.complexity.filter((item) => item.changed),
    mutations: run.mutations,
    ...(run.mutationBaseline ? { mutationBaseline: run.mutationBaseline } : {}),
    behaviorClaims: run.behaviorClaims,
    governance,
    waivers
  });
  const projectedRun: RunArtifact = {
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

function renderRunDriftNotice(run: Pick<RunArtifact, 'runId'>, drift: RunDriftEntry[]): string {
  const lines = [
    `Run drift detected for ${run.runId}. Re-run ts-quality check before trusting downstream decision surfaces.`,
    ...drift.map((item) => `- ${item.subject}: expected ${item.expected}, actual ${item.actual}`)
  ];
  return `${lines.join('\n')}\n`;
}

function renderRunDriftMarkdownNotice(run: Pick<RunArtifact, 'runId'>, drift: RunDriftEntry[]): string {
  const lines = [
    `> **Run drift detected for \`${renderSafeText(run.runId)}\`.** Re-run \`ts-quality check\` before trusting this projected report.`,
    ...drift.map((item) => `> - ${renderSafeText(item.subject)}: expected ${renderSafeText(item.expected)}, actual ${renderSafeText(item.actual)}`)
  ];
  return lines.join('\n');
}

function injectMarkdownNotice(markdown: string, notice: string): string {
  const frontmatter = markdown.match(/^---\n[\s\S]*?\n---\n\n?/u);
  if (!frontmatter) {
    return `${notice}\n\n${markdown}`;
  }
  const insertAt = frontmatter[0].length;
  return `${markdown.slice(0, insertAt)}${notice}\n\n${markdown.slice(insertAt)}`;
}

function buildReportJsonArtifact(run: RunArtifact, decisionContext: ReportDecisionContext): ReportJsonArtifact {
  return {
    ...run,
    decisionContext: {
      projection: decisionContext.projection,
      drift: decisionContext.drift.map((item) => ({ ...item }))
    }
  };
}

function portablePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function resolveCliPath(rootDir: string, candidate: string, options?: { preferRoot?: boolean }): string {
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  const cwdResolved = path.resolve(process.cwd(), candidate);
  const rootResolved = path.resolve(rootDir, candidate);
  const rootRelativeFromCwd = portablePath(path.relative(process.cwd(), rootDir));
  const normalizedCandidate = portablePath(candidate);
  if (fs.existsSync(rootResolved)) {
    return rootResolved;
  }
  if (fs.existsSync(cwdResolved)) {
    return cwdResolved;
  }
  if (rootRelativeFromCwd && (normalizedCandidate === rootRelativeFromCwd || normalizedCandidate.startsWith(`${rootRelativeFromCwd}/`) )) {
    return cwdResolved;
  }
  return options?.preferRoot === false ? cwdResolved : rootResolved;
}

function lexicalRelativePathInsideRoot(rootDir: string, absolutePath: string): string | undefined {
  const relative = portablePath(path.relative(rootDir, absolutePath));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return undefined;
  }
  return normalizePath(relative);
}

function remapCliRepoLocalError(error: unknown, kind: string, candidate: string): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith(`${kind} must stay inside repository root:`)) {
    throw new Error(`${kind} must be inside --root: ${candidate}`);
  }
  if (message.startsWith(`${kind} not found:`)) {
    throw new Error(`${kind} not found: ${candidate}`);
  }
  throw error instanceof Error ? error : new Error(message);
}

function resolveCliRepoLocalPath(rootDir: string, candidate: string, options?: { allowMissing?: boolean; kind?: string; preferRoot?: boolean }): { absolutePath: string; relativePath: string; canonicalPath: string } {
  const pathOptions = options?.preferRoot !== undefined ? { preferRoot: options.preferRoot } : undefined;
  const resolvedCandidate = resolveCliPath(rootDir, candidate, pathOptions);
  const resolutionOptions: { allowMissing?: boolean; kind?: string } = {};
  if (options?.allowMissing !== undefined) {
    resolutionOptions.allowMissing = options.allowMissing;
  }
  if (options?.kind !== undefined) {
    resolutionOptions.kind = options.kind;
  }
  try {
    return resolveRepoLocalPath(rootDir, resolvedCandidate, resolutionOptions);
  } catch (error) {
    remapCliRepoLocalError(error, options?.kind ?? 'path', candidate);
  }
}

function resolveCliAttestationSubject(rootDir: string, candidate: string, options?: { allowMissing?: boolean }): { absolutePath: string; canonicalPath: string; recordedPath: string } {
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

function renderVerificationText(value: string): string {
  return renderSafeText(value);
}

const SANITIZED_WITNESS_ENV_KEYS = ['NODE_TEST_CONTEXT'];

function executionWitnessCommandEnv(baseEnv: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = { ...baseEnv };
  for (const key of SANITIZED_WITNESS_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function stdioText(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}

function executionWitnessCommandDetails(result: ReturnType<typeof spawnSync>): string {
  return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}

function executionWitnessReceiptPath(relativeWitnessPath: string): string {
  return relativeWitnessPath.endsWith('.json')
    ? relativeWitnessPath.replace(/\.json$/u, '.receipt.json')
    : `${relativeWitnessPath}.receipt.json`;
}

function executionWitnessSkipReasonText(reason: ExecutionWitnessSkippedRecord['reason']): string {
  return reason === 'invariant-not-impacted'
    ? 'invariant not impacted by changed scope'
    : reason;
}

function renderExecutionWitnessSummaryText(summary: ExecutionWitnessRunSummary): string {
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

function verifyAttestationRecordAtRoot(rootDir: string, source: string, attestation: Attestation, trustedKeys: Record<string, string>): AttestationVerificationRecord {
  const contract = validateRenderableAttestationContract(attestation, { requireSubjectFile: true });
  const contextFields = contract.context;
  const record: AttestationVerificationRecord = {
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
  let subjectResolution: { absolutePath: string; relativePath: string; canonicalPath: string };
  let relativeSubject: string | undefined;
  try {
    subjectResolution = resolveRepoLocalPath(rootDir, subjectFile, { allowMissing: true, kind: 'attestation subject' });
    relativeSubject = lexicalRelativePathInsideRoot(rootDir, subjectResolution.absolutePath);
  } catch {
    return { ...record, reason: 'subject file escapes repository root' };
  }
  if (!relativeSubject || relativeSubject !== subjectFile) {
    return { ...record, reason: 'subject file escapes repository root' };
  }
  if (!fs.existsSync(subjectResolution.canonicalPath)) {
    return { ...record, reason: `subject file missing: ${subjectFile}` };
  }
  const signature = verifyAttestation(attestation, trustedKeys);
  if (!signature.ok) {
    return { ...record, reason: signature.reason };
  }
  const digest = fileDigest(subjectResolution.canonicalPath);
  if (digest !== attestation.subjectDigest) {
    return { ...record, reason: 'subject digest mismatch' };
  }
  return { ...record, ok: true, reason: 'verified' };
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

function renderAttestationVerificationReport(records: AttestationVerificationRecord[]): string {
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

function renderAmendmentChangeSummary(change: NonNullable<AmendmentDecision['proposalContext']>['changes'][number]): string {
  const currentRuleKind = renderSafeText(change.currentRuleKind ?? 'none');
  const proposedRuleKind = renderSafeText(change.proposedRuleKind ?? 'none');
  return `- ${renderSafeText(change.action)} ${renderSafeText(change.ruleId)} (current=${currentRuleKind}; proposed=${proposedRuleKind}; sensitivity=${renderSafeText(change.sensitivity)})`;
}

function renderAmendmentDecisionText(decision: AmendmentDecision): string {
  const proposalContext = decision.proposalContext;
  const lines = [
    `Proposal: ${renderSafeText(proposalContext?.title ?? decision.proposalId)}`,
    `Proposal ID: ${renderSafeText(decision.proposalId)}`,
    `Outcome: ${renderSafeText(decision.outcome)}`,
    `Required approvals: ${String(decision.requiredApprovals)}`,
    `Accepted approvals: ${decision.approvalsAccepted.length > 0 ? decision.approvalsAccepted.map((item) => renderSafeText(item)).join(', ') : 'none'}`
  ];
  if (proposalContext) {
    lines.push(`Approval burden basis: ${renderSafeText(proposalContext.approvalBurdenBasis)}`);
    lines.push(`Sensitive rules: ${proposalContext.sensitiveRuleIds.length > 0 ? proposalContext.sensitiveRuleIds.map((item) => renderSafeText(item)).join(', ') : 'none'}`);
    lines.push(`Rationale: ${renderSafeText(proposalContext.rationale)}`);
    lines.push('', 'Evidence:');
    lines.push(...(proposalContext.evidence.length > 0
      ? proposalContext.evidence.map((item) => `- ${renderSafeText(item)}`)
      : ['- none']));
    lines.push('', 'Changes:');
    lines.push(...(proposalContext.changes.length > 0
      ? proposalContext.changes.map((change) => renderAmendmentChangeSummary(change))
      : ['- none']));
  }
  lines.push('', 'Reasons:');
  lines.push(...(decision.reasons.length > 0
    ? decision.reasons.map((reason) => `- ${renderSafeText(reason)}`)
    : ['- none']));
  return `${lines.join('\n')}\n`;
}

function attestationAppliesToRun(attestation: Attestation, runId: string): boolean {
  const payload = attestation.payload;
  const subjectFile = typeof payload?.['subjectFile'] === 'string' ? payload['subjectFile'] : undefined;
  if (!subjectFile || path.isAbsolute(subjectFile)) {
    return false;
  }
  const scopedSubject = runScopedArtifactReference(subjectFile);
  if (!scopedSubject || scopedSubject.runId !== runId) {
    return false;
  }
  const payloadRunId = typeof payload?.['runId'] === 'string' ? payload['runId'] : undefined;
  return payloadRunId === undefined || payloadRunId === runId;
}

function attestationVerificationAppliesToRun(record: AttestationVerificationRecord, runId: string): boolean {
  if (record.runId) {
    return record.runId === runId;
  }
  if (!record.subjectFile || path.isAbsolute(record.subjectFile)) {
    return false;
  }
  const scopedSubject = runScopedArtifactReference(record.subjectFile);
  return scopedSubject?.runId === runId;
}

function buildAuthorizationAttestationVerification(records: AttestationVerificationRecord[]): AuthorizationAttestationVerificationSummary {
  return {
    verifiedCount: records.filter((record) => record.ok).length,
    failedCount: records.filter((record) => !record.ok).length,
    records: records.map((record) => ({ ...record }))
  };
}

function writeModuleExport(filePath: string, value: unknown): void {
  if (filePath.endsWith('.json')) {
    writeJson(filePath, value);
    return;
  }
  ensureDir(path.dirname(filePath));
  const existingText = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const useCommonJs = filePath.endsWith('.cjs') || /\bmodule\.exports\b|\bexports\.default\b/.test(existingText);
  const moduleText = useCommonJs
    ? `module.exports = ${stableStringify(value)};\n`
    : `export default ${stableStringify(value)};\n`;
  fs.writeFileSync(filePath, moduleText, 'utf8');
}

function attestationFiles(rootDir: string, dirRelative: string): string[] {
  const directory = resolveRepoLocalPath(rootDir, dirRelative, { allowMissing: true, kind: 'attestations dir' }).absolutePath;
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs.readdirSync(directory).filter((entry: string) => entry.endsWith('.json')).map((entry: string) => path.join(directory, entry)).sort();
}

function relativeToRoot(rootDir: string, targetPath: string): string {
  return normalizePath(path.relative(rootDir, targetPath));
}

function materializedOutputDir(rootDir: string, outDir?: string): string {
  const target = outDir ?? '.ts-quality/materialized';
  return resolveRepoLocalPath(rootDir, target, { allowMissing: true, kind: 'materialized output dir' }).absolutePath;
}

function materializedFilePath(outDir: string, fileName: string): string {
  return path.join(outDir, fileName);
}

function materializedInputRelativePath(sourceRelativePath: string): string {
  return path.posix.join('inputs', normalizePath(sourceRelativePath));
}

export function materializeProject(rootDir: string, options?: { configPath?: string; outDir?: string }): MaterializeResult {
  const loaded = loadContext(rootDir, options?.configPath);
  const outputDir = materializedOutputDir(rootDir, options?.outDir);
  ensureDir(outputDir);

  const invariants = loadInvariants(rootDir, loaded.config.invariantsPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const approvals = loadApprovals(rootDir, loaded.config.approvalsPath);
  const waivers = loadWaivers(rootDir, loaded.config.waiversPath);
  const overrides = loadOverrides(rootDir, loaded.config.overridesPath);

  const files: string[] = [];
  const writeMaterializedJson = (fileName: string, value: unknown): string => {
    const absolutePath = materializedFilePath(outputDir, fileName);
    writeJson(absolutePath, value);
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
    const diffSourceResolution = resolveRepoLocalPath(rootDir, loaded.config.changeSet.diffFile, { allowMissing: true, kind: 'diff file' });
    if (fs.existsSync(diffSourceResolution.absolutePath)) {
      const diffTarget = materializedFilePath(outputDir, materializedInputRelativePath(diffSourceResolution.relativePath));
      ensureDir(path.dirname(diffTarget));
      fs.copyFileSync(diffSourceResolution.absolutePath, diffTarget);
      materializedConfig.changeSet = {
        ...materializedConfig.changeSet,
        diffFile: relativeToRoot(rootDir, diffTarget)
      };
      files.push(relativeToRoot(rootDir, diffTarget));
    }
  }

  const configTarget = materializedFilePath(outputDir, 'ts-quality.config.json');
  writeJson(configTarget, materializedConfig);
  const configPath = relativeToRoot(rootDir, configTarget);
  files.push(configPath);

  return {
    configPath,
    outDir: relativeToRoot(rootDir, outputDir),
    files
  };
}

export function loadVerifiedAttestations(rootDir: string, attestationsDir: string, trustedKeysDir: string): { attestations: Attestation[]; verification: AttestationVerificationRecord[] } {
  const keysDir = resolveRepoLocalPath(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
  const keys = loadTrustedKeys(keysDir);
  const verification: AttestationVerificationRecord[] = [];
  const attestations: Attestation[] = [];
  for (const filePath of attestationFiles(rootDir, attestationsDir)) {
    const source = path.basename(filePath);
    let rawText: string;
    try {
      rawText = fs.readFileSync(filePath, 'utf8');
    } catch {
      verification.push({ version: '1', source, ok: false, reason: 'unreadable attestation file' });
      continue;
    }
    let rawAttestation: unknown;
    try {
      rawAttestation = JSON.parse(rawText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      verification.push({ version: '1', source, ok: false, reason: `invalid JSON: ${message}` });
      continue;
    }
    const parsed = parseAttestationRecord(rawAttestation);
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

interface AnalysisManifest {
  loaded: ReturnType<typeof loadContext>;
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  coveragePath: string;
  coverage: RunArtifact['coverage'];
  coverageGeneration?: CoverageGenerationRecord | undefined;
  runtimeMirrorRoots: string[];
}

export interface ExecutionWitnessRefreshResult extends ExecutionWitnessRunRecord {}
export interface ExecutionWitnessRefreshSkipped extends ExecutionWitnessSkippedRecord {}
export interface ExecutionWitnessRefreshSummary extends ExecutionWitnessRunSummary {}

function resolveChangedFileOverride(rootDir: string, filePath: string): string {
  return resolveRepoLocalPath(rootDir, filePath, { allowMissing: true, kind: 'changed file override' }).relativePath;
}

function uniquePaths(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map((item) => normalizePath(item)).filter(Boolean)) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function missingChangeScopeError(diffFile?: string): Error {
  const detail = diffFile
    ? ` Configured diff file ${diffFile} did not contribute any changed hunks.`
    : '';
  return new Error(`Changed scope is required.${detail} Provide --changed <a,b,c> or configure changeSet.files / changeSet.diffFile with at least one changed file or hunk before running ts-quality check.`);
}

function runCoverageGenerationCommand(rootDir: string, input: { lcovPath: string; command: string[]; timeoutMs: number; attemptedAt: string }): CoverageGenerationRecord {
  const command = input.command.filter((item) => item.length > 0);
  if (command.length === 0) {
    throw new Error('coverage.generateCommand must contain at least one executable argument');
  }
  const executable = command[0];
  if (!executable) {
    throw new Error('coverage.generateCommand must contain an executable argument');
  }
  const started = Date.now();
  const result = spawnSync(executable, command.slice(1), {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: input.timeoutMs,
    shell: process.platform === 'win32',
    env: executionWitnessCommandEnv()
  });
  const durationMs = Date.now() - started;
  const receipt: ExecutionReceipt = result.error
    ? {
        status: (result.error as { code?: string }).code === 'ETIMEDOUT' ? 'timeout' : 'error',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: (result.error as { message?: string }).message ?? 'unknown coverage generation command error'
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

function readCoverageWithOptionalGeneration(rootDir: string, input: { coveragePath: string; generateCommand: string[]; generateWhenMissing: boolean; generateTimeoutMs: number; generateCoverage: boolean; attemptedAt: string }): { coverage: RunArtifact['coverage']; coverageGeneration?: CoverageGenerationRecord | undefined } {
  const coverageAbsolutePath = path.join(rootDir, input.coveragePath);
  if (fs.existsSync(coverageAbsolutePath)) {
    return { coverage: parseLcov(fs.readFileSync(coverageAbsolutePath, 'utf8')) };
  }
  if (!input.generateCoverage || !input.generateWhenMissing || input.generateCommand.length === 0) {
    return { coverage: [] };
  }
  ensureDir(path.dirname(coverageAbsolutePath));
  const coverageGeneration = runCoverageGenerationCommand(rootDir, {
    lcovPath: input.coveragePath,
    command: input.generateCommand,
    timeoutMs: input.generateTimeoutMs,
    attemptedAt: input.attemptedAt
  });
  if (coverageGeneration.receipt.status !== 'pass') {
    throw new Error(`coverage generation command ${coverageGeneration.receipt.status}; expected LCOV at ${renderSafeText(input.coveragePath)}${coverageGeneration.receipt.details ? `\n${renderSafeText(coverageGeneration.receipt.details)}` : ''}`);
  }
  if (!fs.existsSync(coverageAbsolutePath)) {
    throw new Error(`coverage generation command passed but did not create expected LCOV at ${renderSafeText(input.coveragePath)}`);
  }
  return {
    coverage: parseLcov(fs.readFileSync(coverageAbsolutePath, 'utf8')),
    coverageGeneration
  };
}

function buildAnalysisManifest(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; generateCoverage?: boolean; observedAt?: string }): AnalysisManifest {
  const loaded = loadContext(rootDir, options?.configPath);
  const sourceFiles = collectSourceFiles(rootDir, loaded.config.sourcePatterns);
  const changedRegions = loaded.config.changeSet.diffFile ? loadChangedRegions(rootDir, loaded.config.changeSet.diffFile) : [];
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
    attemptedAt: options?.observedAt ?? nowIso()
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

function refreshExecutionWitnessPlans(rootDir: string, input: {
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  coverage: RunArtifact['coverage'];
  invariants: ReturnType<typeof loadInvariants>;
  observedAt: string;
}): ExecutionWitnessRefreshSummary {
  const crapReport = analyzeCrap({
    rootDir,
    sourceFiles: input.sourceFiles,
    coverage: input.coverage,
    changedFiles: input.changedFiles,
    changedRegions: input.changedRegions
  });
  const planSummary = collectExecutionWitnessPlanSummary({
    invariants: input.invariants,
    changedFiles: input.changedFiles,
    changedRegions: input.changedRegions,
    complexity: crapReport.hotspots
  });
  const autoRan: ExecutionWitnessRefreshResult[] = [];
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
  const skipped: ExecutionWitnessRefreshSkipped[] = planSummary.skipped.map((item) => ({
    invariantId: item.invariantId,
    scenarioId: item.scenarioId,
    outputPath: item.outputPath,
    command: [...item.command],
    ...(item.testFiles.length > 0 ? { testFiles: [...item.testFiles] } : {}),
    reason: item.reason
  }));
  return { autoRan, skipped };
}

function buildAnalysisContext(input: {
  runId: string;
  createdAt: string;
  configPath: string;
  coverageLcovPath: string;
  runtimeMirrorRoots: string[];
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  executionFingerprint: string;
}): AnalysisContext {
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

function isSourceTsFile(filePath: string): boolean {
  return /^src\/.*\.tsx?$/.test(normalizePath(filePath));
}

function builtOutputRoots(runtimeMirrorRoots: string[]): string[] {
  return uniquePaths(['dist', 'lib', 'build', ...runtimeMirrorRoots]);
}

function coverageHasFile(coverage: RunArtifact['coverage'], filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return coverage.some((item) => normalizePath(item.filePath) === normalized);
}

function detectBuiltOutputCoverageWarnings(input: { changedFiles: string[]; coverage: RunArtifact['coverage']; runtimeMirrorRoots: string[] }): AnalysisWarning[] {
  const roots = builtOutputRoots(input.runtimeMirrorRoots);
  const warnings: AnalysisWarning[] = [];
  const coveredBuiltFiles = input.coverage.map((item) => normalizePath(item.filePath)).filter((filePath) => roots.some((root) => filePath === root || filePath.startsWith(`${root}/`)));
  if (coveredBuiltFiles.length === 0) {
    return warnings;
  }
  for (const changedFile of input.changedFiles.map((item) => normalizePath(item)).filter(isSourceTsFile)) {
    if (coverageHasFile(input.coverage, changedFile)) {
      continue;
    }
    const stem = changedFile.replace(/^src\//, '').replace(/\.tsx?$/, '');
    const matchingBuilt = coveredBuiltFiles.filter((filePath) => filePath.replace(/^(dist|lib|build)\//, '').replace(/\.jsx?$/, '') === stem || filePath.endsWith(`/${path.basename(stem)}.js`));
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

function buildMutationRemediation(mutations: RunArtifact['mutations']): MutationRemediation | undefined {
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

function statusFromCount(clear: boolean, clearText: string, missingText: string): string {
  return clear ? clearText : missingText;
}

function buildNextEvidenceAction(run: Pick<RunArtifact, 'runId' | 'coverage' | 'coverageGeneration' | 'executionWitnesses' | 'mutations' | 'governance' | 'verdict'>): NextEvidenceAction {
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

export function refreshExecutionWitnesses(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; observedAt?: string }): ExecutionWitnessRefreshSummary {
  const manifest = buildAnalysisManifest(rootDir, options);
  const invariants = loadInvariants(rootDir, manifest.loaded.config.invariantsPath);
  return refreshExecutionWitnessPlans(rootDir, {
    sourceFiles: manifest.sourceFiles,
    changedFiles: manifest.changedFiles.map((item) => normalizePath(item)),
    changedRegions: manifest.changedRegions,
    coverage: manifest.coverage,
    invariants,
    observedAt: options?.observedAt ?? nowIso()
  });
}

export function runCheck(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; runId?: string }): CheckResult {
  const runId = assertSafeRunId(options?.runId ?? createRunId());
  const createdAt = nowIso();
  const manifest = buildAnalysisManifest(rootDir, { ...options, generateCoverage: true, observedAt: createdAt });
  const loaded = manifest.loaded;
  const sourceFiles = manifest.sourceFiles;
  const changedFiles = manifest.changedFiles.map((item) => normalizePath(item));
  const changedRegions = manifest.changedRegions;
  const coverage = manifest.coverage;
  const waivers = loadWaivers(rootDir, loaded.config.waiversPath);
  const approvals = loadApprovals(rootDir, loaded.config.approvalsPath);
  const overrides = loadOverrides(rootDir, loaded.config.overridesPath);
  const invariants = loadInvariants(rootDir, loaded.config.invariantsPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const controlPlane = buildControlPlaneSnapshot(rootDir, loaded, constitution, agents);
  const previousRun = latestComparableRunOrUndefined(rootDir, {
    runId,
    changedFiles,
    changedRegions,
    controlPlane,
    invariants
  });

  const crapReport = analyzeCrap({
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

  const mutationRun = runMutations({
    repoRoot: rootDir,
    sourceFiles,
    changedFiles,
    changedRegions,
    coverage,
    coveredOnly: loaded.config.mutations.coveredOnly ?? false,
    testCommand: loaded.config.mutations.testCommand,
    manifestPath: path.join(rootDir, '.ts-quality', 'mutation-manifest.json'),
    timeoutMs: loaded.config.mutations.timeoutMs ?? 15_000,
    maxSites: loaded.config.mutations.maxSites ?? 25,
    runtimeMirrorRoots: manifest.runtimeMirrorRoots
  });

  const claims = evaluateInvariants({
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

  const preliminaryInput: PolicyInput = {
    nowIso: nowIso(),
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
  const preliminary = evaluatePolicy(preliminaryInput);

  const governance = evaluateGovernance({
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

  const evaluatedInput: PolicyInput = {
    nowIso: nowIso(),
    policy: policyConfigFromLoadedContext(loaded),
    changedComplexity: crapReport.hotspots.filter((item) => item.changed),
    mutations: mutationRun.results,
    mutationBaseline: mutationRun.baseline,
    behaviorClaims: claims,
    governance,
    waivers,
    ...(previousRun ? { previousRun } : {})
  };
  const evaluated = evaluatePolicy(evaluatedInput);
  const analysisWarnings = detectBuiltOutputCoverageWarnings({ changedFiles, coverage, runtimeMirrorRoots: manifest.runtimeMirrorRoots });
  const mutationRemediation = buildMutationRemediation(mutationRun.results);

  const repo = buildRepositoryEntity(rootDir, sourceFiles);
  const analysis = buildAnalysisContext({
    runId,
    createdAt,
    configPath: normalizePath(path.relative(rootDir, loaded.configPath)),
    coverageLcovPath: manifest.coveragePath,
    runtimeMirrorRoots: manifest.runtimeMirrorRoots,
    sourceFiles,
    changedFiles,
    changedRegions,
    executionFingerprint: mutationRun.executionFingerprint
  });
  const run: RunArtifact = {
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

  const artifactDir = writeRunArtifact(rootDir, run);
  writeJson(path.join(artifactDir, 'report.json'), buildReportJsonArtifact(run, { projection: 'persisted', drift: [] }));
  fs.writeFileSync(path.join(artifactDir, 'report.md'), `${renderMarkdownReport(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'pr-summary.md'), `${renderPrSummary(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'explain.txt'), `${renderExplainText(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'attestation-verify.txt'), renderAttestationVerificationReport(verifiedAttestations.verification), 'utf8');
  if (run.executionWitnesses) {
    writeJson(path.join(artifactDir, 'execution-witnesses.json'), run.executionWitnesses);
    fs.writeFileSync(path.join(artifactDir, 'execution-witnesses.txt'), renderExecutionWitnessSummaryText(run.executionWitnesses), 'utf8');
  }
  if (run.coverageGeneration) {
    writeJson(path.join(artifactDir, 'coverage-generation.json'), run.coverageGeneration);
    fs.writeFileSync(path.join(artifactDir, 'coverage-generation.txt'), renderCoverageGenerationText(run.coverageGeneration), 'utf8');
  }
  if (run.mutationRemediation) {
    writeJson(path.join(artifactDir, 'mutation-remediation.json'), run.mutationRemediation);
  }
  if (run.nextEvidenceAction) {
    writeJson(path.join(artifactDir, 'next-evidence-action.json'), run.nextEvidenceAction);
    fs.writeFileSync(path.join(artifactDir, 'next-evidence-action.txt'), renderNextEvidenceActionText(run.nextEvidenceAction), 'utf8');
  }
  fs.writeFileSync(path.join(artifactDir, 'check-summary.txt'), renderCheckSummaryText(run), 'utf8');
  const plan = generateGovernancePlan(run, constitution, agents);
  fs.writeFileSync(path.join(artifactDir, 'plan.txt'), renderPlanArtifactText(run, plan), 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'govern.txt'), renderGovernanceArtifactText(run, plan), 'utf8');
  return { run, artifactDir };
}

export type InitPreset = 'default' | 'node-test' | 'node-test-ts-dist' | 'vitest';

function initConfigText(preset: InitPreset): string {
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
  return `// ts-quality init preset: ${preset}\n// ${presetComment}\nexport default {\n  sourcePatterns: ${stableStringify([...DEFAULT_SOURCE_PATTERNS])},\n  testPatterns: ${stableStringify([...DEFAULT_TEST_PATTERNS])},\n  coverage: {\n    lcovPath: 'coverage/lcov.info',\n    // When lcovPath is missing, check can run this command after creating the parent directory.\n    ${coverageCommand}\n    generateTimeoutMs: 60000\n  },\n  mutations: { testCommand: ${mutationCommand}, coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ${runtimeMirrorRoots} },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  // Provide --changed <a,b,c> or set changeSet.files / changeSet.diffFile before running check.\n  changeSet: { files: [] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`;
}

export function initProject(rootDir: string, options?: { preset?: InitPreset }): void {
  ensureDir(path.join(rootDir, '.ts-quality', 'attestations'));
  ensureDir(path.join(rootDir, '.ts-quality', 'keys'));
  ensureDir(path.join(rootDir, '.ts-quality', 'witnesses'));
  const preset = options?.preset ?? 'default';
  const configPath = path.join(rootDir, 'ts-quality.config.ts');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, initConfigText(preset), 'utf8');
  }
  const invariantsPath = path.join(rootDir, '.ts-quality', 'invariants.ts');
  if (!fs.existsSync(invariantsPath)) {
    fs.writeFileSync(invariantsPath, `export default [\n  {\n    id: 'auth.refresh.validity',\n    title: 'Refresh token validity',\n    description: 'Expired refresh tokens must never authorize access.',\n    severity: 'high',\n    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],\n    scenarios: [\n      {\n        id: 'expired',\n        description: 'expired token is denied',\n        keywords: ['expired', 'deny'],\n        failurePathKeywords: ['boundary', 'expiry'],\n        // Optional execution-backed witness generation during \`ts-quality check\`:\n        // executionWitnessCommand: ['node', '--test', 'test/token.test.js'],\n        // executionWitnessOutput: '.ts-quality/witnesses/auth-refresh-expired.json',\n        // executionWitnessTestFiles: ['test/token.test.js'],\n        // executionWitnessTimeoutMs: 5000,\n        expected: 'deny'\n      }\n    ]\n  }\n];\n`, 'utf8');
  }
  const constitutionPath = path.join(rootDir, '.ts-quality', 'constitution.ts');
  if (!fs.existsSync(constitutionPath)) {
    fs.writeFileSync(constitutionPath, `export default [\n  { kind: 'risk', id: 'default-risk', paths: ['src/**'], message: 'Changed source must stay within risk budgets.', maxCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  { kind: 'approval', id: 'payments-review', paths: ['src/payments/**'], message: 'Payments changes require a maintainer approval.', minApprovals: 1, roles: ['maintainer'] }\n];\n`, 'utf8');
  }
  const agentsPath = path.join(rootDir, '.ts-quality', 'agents.ts');
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, `export default [\n  { id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [{ id: 'maintainer-merge', actions: ['merge', 'override', 'amend'], paths: ['src/**'], minMergeConfidence: 60 }] },\n  { id: 'release-bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'release-bot-merge', actions: ['merge'], paths: ['src/**'], minMergeConfidence: 80, requireAttestations: ['ci.tests.passed'], requireHumanReview: true }] }\n];\n`, 'utf8');
  }
  for (const fileName of ['waivers.json', 'approvals.json', 'overrides.json']) {
    const filePath = path.join(rootDir, '.ts-quality', fileName);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]\n', 'utf8');
    }
  }
  const keyBase = path.join(rootDir, '.ts-quality', 'keys', 'sample');
  if (!fs.existsSync(`${keyBase}.pem`) || !fs.existsSync(`${keyBase}.pub.pem`)) {
    const pair = generateKeyPair();
    fs.writeFileSync(`${keyBase}.pem`, pair.privateKeyPem, 'utf8');
    fs.writeFileSync(`${keyBase}.pub.pem`, pair.publicKeyPem, 'utf8');
  }
}

function readPackageScripts(rootDir: string): Record<string, string> {
  const packagePath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return {};
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { scripts?: Record<string, string> };
    return parsed.scripts ?? {};
  } catch {
    return {};
  }
}

function likelyScriptNames(scripts: Record<string, string>, tokens: string[]): string[] {
  return Object.keys(scripts).filter((name) => tokens.some((token) => name.includes(token) || scripts[name]?.includes(token))).sort();
}

interface DoctorDiagnostic {
  surface: 'ts-quality.doctor';
  schemaVersion: 1;
  rootDir: string;
  config: {
    loaded: boolean;
    path?: string | undefined;
    error?: string | undefined;
  };
  changedScope: {
    present: boolean;
    files: string[];
    source: 'cli-or-config';
  };
  files: {
    sourceCount: number;
    testCount: number;
  };
  packageScripts: {
    names: string[];
    coverageCandidates: string[];
    testCandidates: string[];
  };
  coverage: {
    lcovPath: string;
    lcovExists: boolean;
    generateCommandConfigured: boolean;
    generateCommand: string[];
  };
  mutations: {
    testCommand: string[];
    runtimeMirrorRoots: string[];
  };
  risks: Array<{
    code: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    hint: string;
    evidence: string[];
  }>;
  recommendations: Array<{
    id: string;
    kind: 'changed-scope' | 'coverage' | 'source-map' | 'focused-test' | 'witness' | 'script-snippet';
    summary: string;
    command?: string[] | undefined;
  }>;
}

function buildDoctorDiagnostic(rootDir: string, options?: { changedFiles?: string[]; configPath?: string }): DoctorDiagnostic {
  const scripts = readPackageScripts(rootDir);
  let loaded: ReturnType<typeof loadContext> | undefined;
  let configError: string | undefined;
  try {
    loaded = loadContext(rootDir, options?.configPath);
  } catch (error) {
    configError = error instanceof Error ? error.message : String(error);
  }
  const config = loaded?.config;
  const sourcePatterns = config?.sourcePatterns ?? [...DEFAULT_SOURCE_PATTERNS];
  const testPatterns = config?.testPatterns ?? [...DEFAULT_TEST_PATTERNS];
  const sources = collectSourceFiles(rootDir, sourcePatterns);
  const tests = listFiles(rootDir).filter((filePath) => testPatterns.some((pattern) => matchPattern(pattern, filePath)));
  const changed = uniquePaths([...(options?.changedFiles ?? []), ...(config?.changeSet.files ?? [])]);
  const lcovPath = config?.coverage.lcovPath ?? 'coverage/lcov.info';
  const lcovExists = fs.existsSync(path.join(rootDir, lcovPath));
  const generateCommand = config?.coverage.generateCommand ?? [];
  const runtimeMirrorRoots = config?.mutations.runtimeMirrorRoots ?? ['dist'];
  const sourceDistRisk = changed.some(isSourceTsFile) && builtOutputRoots(runtimeMirrorRoots).some((root) => fs.existsSync(path.join(rootDir, root)));
  const coverageScripts = likelyScriptNames(scripts, ['coverage', 'lcov']);
  const testScripts = likelyScriptNames(scripts, ['test']);
  const recommendations: DoctorDiagnostic['recommendations'] = [];
  const risks: DoctorDiagnostic['risks'] = [];
  if (changed.length === 0) {
    recommendations.push({ id: 'changed-scope', kind: 'changed-scope', summary: 'Add changed scope with --changed <a,b,c>, changeSet.files, or changeSet.diffFile before check.' });
    risks.push({ code: 'changed-scope-missing', level: 'error', message: 'Changed scope is missing.', hint: 'Provide --changed <a,b,c> or configure changeSet.files / changeSet.diffFile.', evidence: [] });
  }
  if (!lcovExists && generateCommand.length === 0) {
    recommendations.push(coverageScripts.length > 0
      ? { id: 'coverage-generate-command', kind: 'coverage', summary: `Configure coverage.generateCommand to run an existing script such as npm run ${coverageScripts[0]}.`, command: ['npm', 'run', coverageScripts[0] ?? 'coverage'] }
      : { id: 'coverage-generate-command', kind: 'coverage', summary: 'Configure coverage.generateCommand to create coverage/lcov.info.', command: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'] });
    risks.push({ code: 'coverage-missing-without-generator', level: 'warn', message: 'LCOV is missing and coverage.generateCommand is not configured.', hint: 'Configure a deterministic coverage command or create the LCOV before check.', evidence: [`lcovPath=${lcovPath}`] });
  }
  if (sourceDistRisk) {
    recommendations.push({ id: 'source-map-coverage', kind: 'source-map', summary: 'Enable source-map coverage mapping, for example NODE_OPTIONS=--enable-source-maps, or configure coverage to map back to src/**.' });
    risks.push({ code: 'source-dist-coverage-risk', level: 'warn', message: 'Changed TypeScript source and built runtime roots are present.', hint: 'Ensure LCOV maps back to changed src/**/*.ts files rather than only built output.', evidence: [`changed=${changed.join(', ')}`, `runtimeMirrorRoots=${runtimeMirrorRoots.join(', ')}`] });
  }
  if (testScripts.length > 0) {
    recommendations.push({ id: 'focused-test-command', kind: 'focused-test', summary: `Candidate focused test command: npm run ${testScripts[0]} -- --runInBand (adjust to the smallest trustworthy slice).`, command: ['npm', 'run', testScripts[0] ?? 'test', '--', '--runInBand'] });
  } else if (tests.length > 0) {
    recommendations.push({ id: 'focused-test-command', kind: 'focused-test', summary: `Candidate focused test command: node --test ${tests[0]}.`, command: ['node', '--test', tests[0] ?? 'test'] });
  }
  recommendations.push({ id: 'witness-command-shape', kind: 'witness', summary: 'Candidate witness command shape: ts-quality witness test --invariant <id> --scenario <id> --source-files <src> --test-files <test> --out .ts-quality/witnesses/<id>.json -- <focused command>' });
  recommendations.push({ id: 'script-snippets', kind: 'script-snippet', summary: 'Suggested package.json snippets are advisory only: coverage:<slice>, witness:<slice>, quality:<slice>.' });
  return {
    surface: 'ts-quality.doctor',
    schemaVersion: 1,
    rootDir,
    config: loaded ? { loaded: true, path: normalizePath(path.relative(rootDir, loaded.configPath)) } : { loaded: false, ...(configError ? { error: configError } : {}) },
    changedScope: { present: changed.length > 0, files: changed, source: 'cli-or-config' },
    files: { sourceCount: sources.length, testCount: tests.length },
    packageScripts: { names: Object.keys(scripts).sort(), coverageCandidates: coverageScripts, testCandidates: testScripts },
    coverage: { lcovPath, lcovExists, generateCommandConfigured: generateCommand.length > 0, generateCommand },
    mutations: { testCommand: config?.mutations.testCommand ?? [], runtimeMirrorRoots },
    risks,
    recommendations
  };
}

export function renderDoctor(rootDir: string, options?: { changedFiles?: string[]; configPath?: string }): string {
  const diagnostic = buildDoctorDiagnostic(rootDir, options);
  const lines = [
    'ts-quality doctor',
    `root: ${diagnostic.rootDir}`,
    `config: ${diagnostic.config.loaded ? diagnostic.config.path : `not loaded (${diagnostic.config.error ?? 'missing'})`}`,
    `changed scope: ${diagnostic.changedScope.present ? diagnostic.changedScope.files.join(', ') : 'missing'}`,
    `source files: ${diagnostic.files.sourceCount}`,
    `test files: ${diagnostic.files.testCount}`,
    `package scripts: ${diagnostic.packageScripts.names.length > 0 ? diagnostic.packageScripts.names.join(', ') : 'none'}`,
    `coverage lcovPath: ${diagnostic.coverage.lcovPath} (${diagnostic.coverage.lcovExists ? 'exists' : 'missing'})`,
    `coverage.generateCommand: ${diagnostic.coverage.generateCommandConfigured ? diagnostic.coverage.generateCommand.join(' ') : 'not configured'}`,
    `mutation testCommand: ${diagnostic.mutations.testCommand.length > 0 ? diagnostic.mutations.testCommand.join(' ') : 'not configured'}`,
    `runtimeMirrorRoots: ${diagnostic.mutations.runtimeMirrorRoots.join(', ')}`,
    ...(diagnostic.risks.length > 0 ? ['', 'Risks:', ...diagnostic.risks.map((risk) => `- ${risk.message} ${risk.hint}`)] : []),
    '',
    'Recommendations:',
    ...diagnostic.recommendations.map((item) => `- ${item.summary}`)
  ];
  return `${lines.join('\n')}\n`;
}

function machineValue(value: string): string {
  return value.replace(/[\t\r\n]/gu, ' ').trim();
}

function machineList(values: string[]): string {
  return values.map(machineValue).join(',');
}

export function renderDoctorMachine(rootDir: string, options?: { changedFiles?: string[]; configPath?: string }): string {
  const diagnostic = buildDoctorDiagnostic(rootDir, options);
  const lines = [
    'TSQ_DOCTOR_MACHINE_V1',
    `root\t${machineValue(diagnostic.rootDir)}`,
    diagnostic.config.loaded
      ? `config\tok\tpath=${machineValue(diagnostic.config.path ?? '')}`
      : `config\terror\tmessage=${machineValue(diagnostic.config.error ?? 'missing')}`,
    `changed\t${diagnostic.changedScope.present ? 'ok' : 'missing'}\tfiles=${machineList(diagnostic.changedScope.files)}`,
    `files\tsources=${diagnostic.files.sourceCount}\ttests=${diagnostic.files.testCount}`,
    `scripts\tnames=${machineList(diagnostic.packageScripts.names)}\tcoverage=${machineList(diagnostic.packageScripts.coverageCandidates)}\ttests=${machineList(diagnostic.packageScripts.testCandidates)}`,
    `coverage\t${diagnostic.coverage.lcovExists ? 'ok' : 'missing'}\tlcovPath=${machineValue(diagnostic.coverage.lcovPath)}\tgenerateCommand=${diagnostic.coverage.generateCommandConfigured ? machineList(diagnostic.coverage.generateCommand) : 'none'}`,
    `mutation\ttestCommand=${machineList(diagnostic.mutations.testCommand)}\truntimeMirrorRoots=${machineList(diagnostic.mutations.runtimeMirrorRoots)}`,
    ...diagnostic.risks.map((risk) => `risk\t${risk.level}\t${risk.code}\t${machineValue(risk.message)}\thint=${machineValue(risk.hint)}`),
    ...diagnostic.recommendations.map((recommendation) => `recommend\t${recommendation.kind}\t${recommendation.id}\t${machineValue(recommendation.summary)}`)
  ];
  return `${lines.join('\n')}\n`;
}

export function renderLatestReport(rootDir: string, format: 'markdown' | 'json', options?: RunDecisionOptions): string {
  const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
  if (format === 'json') {
    return `${stableStringify(buildReportJsonArtifact(context.projectedRun, { projection: 'projected', drift: context.drift }))}\n`;
  }
  const body = renderMarkdownReport(context.projectedRun);
  const rendered = context.drift.length === 0
    ? body
    : injectMarkdownNotice(body, renderRunDriftMarkdownNotice(context.run, context.drift));
  return `${rendered}\n`;
}

export function renderLatestExplain(rootDir: string, options?: RunDecisionOptions): string {
  const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
  const body = renderExplainText(context.projectedRun);
  if (context.drift.length === 0) {
    return `${body}\n`;
  }
  return `${renderRunDriftNotice(context.run, context.drift)}\n${body}\n`;
}

export function renderTrend(rootDir: string): string {
  const runs = orderedRuns(rootDir);
  if (runs.length < 2) {
    return 'Not enough runs for trend analysis.\n';
  }
  const current = runs[runs.length - 1];
  if (!current) {
    return 'Not enough runs for trend analysis.\n';
  }
  let previous: RunArtifact | undefined;
  let nearestAssessment: { run: RunArtifact; assessment: TrendComparabilityAssessment } | undefined;
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

export function renderGovernance(rootDir: string, options?: RunDecisionOptions): string {
  const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
  const plan = generateGovernancePlan(context.projectedRun, context.constitution, context.agents);
  const body = renderGovernanceText(context.projectedRun, plan);
  if (context.drift.length === 0) {
    return body;
  }
  return `${renderRunDriftNotice(context.run, context.drift)}\n${body}`;
}

export function renderPlan(rootDir: string, options?: RunDecisionOptions): string {
  const context = projectedRunForDecision(rootDir, selectedRun(rootDir, options), options);
  const plan = generateGovernancePlan(context.projectedRun, context.constitution, context.agents);
  const body = renderPlanText(context.projectedRun, plan);
  if (context.drift.length === 0) {
    return body;
  }
  return `${renderRunDriftNotice(context.run, context.drift)}\n${body}`;
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

export function runExecutionWitnessCommand(rootDir: string, input: {
  invariantId: string;
  scenarioId: string;
  sourceFiles: string[];
  testFiles?: string[];
  outputPath: string;
  command: string[];
  timeoutMs?: number;
  observedAt?: string;
}): { outputPath: string; recordedOutputPath: string; receiptPath: string; recordedReceiptPath: string; witness: ExecutionWitnessRecord; receipt: ExecutionReceipt } {
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
  ensureDir(path.dirname(outputResolution.absolutePath));
  ensureDir(path.dirname(receiptResolution.absolutePath));
  const executable = command[0];
  if (!executable) {
    throw new Error('execution witness command requires an executable argument');
  }
  const started = Date.now();
  const result = spawnSync(executable, command.slice(1), {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: input.timeoutMs,
    shell: process.platform === 'win32',
    env: executionWitnessCommandEnv()
  });
  const durationMs = Date.now() - started;
  const receipt: ExecutionReceipt = result.error
    ? {
        status: (result.error as { code?: string }).code === 'ETIMEDOUT' ? 'timeout' : 'error',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: (result.error as { message?: string }).message ?? 'unknown execution witness command error'
      }
    : {
        status: result.status === 0 ? 'pass' : 'fail',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: executionWitnessCommandDetails(result)
      };
  const witness: ExecutionWitnessRecord = {
    version: '1',
    kind: 'execution-witness',
    invariantId: input.invariantId,
    scenarioId: input.scenarioId,
    status: receipt.status === 'pass' ? 'pass' : 'fail',
    sourceFiles,
    ...(testFiles.length > 0 ? { testFiles } : {}),
    ...(input.observedAt ? { observedAt: input.observedAt } : {})
  };
  const receiptArtifact: ExecutionWitnessReceiptArtifact = {
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
  writeJson(outputResolution.absolutePath, witness);
  writeJson(receiptResolution.absolutePath, receiptArtifact);
  return {
    outputPath: outputResolution.absolutePath,
    recordedOutputPath: outputResolution.relativePath,
    receiptPath: receiptResolution.absolutePath,
    recordedReceiptPath,
    witness,
    receipt
  };
}

export function attestSign(rootDir: string, issuer: string, keyId: string, privateKeyPath: string, subjectFile: string, claims: string[], outputPath: string): string {
  const resolvedSubject = resolveCliAttestationSubject(rootDir, subjectFile);
  const resolvedKey = resolveCliPath(rootDir, privateKeyPath);
  const scopedSubject = runScopedArtifactReference(resolvedSubject.recordedPath);
  const attestation = signAttestation({
    issuer,
    keyId,
    privateKeyPem: fs.readFileSync(resolvedKey, 'utf8'),
    subjectType: path.extname(resolvedSubject.canonicalPath) === '.json' ? 'json-artifact' : 'file',
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidAmendmentProposal(sourceLabel: string, message: string): Error {
  return new Error(`invalid amendment proposal in ${sourceLabel}: ${message}`);
}

function invalidAmendmentProposalJson(sourceLabel: string, message: string): Error {
  return new Error(`invalid amendment proposal JSON in ${sourceLabel}: ${message}`);
}

function amendmentStringField(record: Record<string, unknown>, field: string, sourceLabel: string, options?: { optional?: boolean }): string | undefined {
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

function amendmentArrayField(record: Record<string, unknown>, field: string, sourceLabel: string): unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw invalidAmendmentProposal(sourceLabel, `field ${field} must be an array`);
  }
  return value;
}

function readAmendmentProposal(proposalPath: string): AmendmentProposal {
  const sourceLabel = path.basename(proposalPath);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  } catch (error) {
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
    const action = amendmentStringField(item, 'action', sourceLabel) as AmendmentProposal['changes'][number]['action'];
    const ruleId = amendmentStringField(item, 'ruleId', sourceLabel) as string;
    const ruleValue = item['rule'];
    if (ruleValue !== undefined && !isPlainRecord(ruleValue)) {
      throw invalidAmendmentProposal(sourceLabel, `field changes[${index}].rule must be an object when provided`);
    }
    return {
      action,
      ruleId,
      ...(ruleValue !== undefined ? { rule: ruleValue as unknown as ConstitutionRule } : {})
    };
  });

  const approvals = amendmentArrayField(raw, 'approvals', sourceLabel).map((item, index) => {
    if (!isPlainRecord(item)) {
      throw invalidAmendmentProposal(sourceLabel, `field approvals[${index}] must be an object`);
    }
    const by = amendmentStringField(item, 'by', sourceLabel) as string;
    const rationale = amendmentStringField(item, 'rationale', sourceLabel) as string;
    const createdAt = amendmentStringField(item, 'createdAt', sourceLabel) as string;
    const targetId = amendmentStringField(item, 'targetId', sourceLabel) as string;
    const role = amendmentStringField(item, 'role', sourceLabel, { optional: true });
    const standing = amendmentStringField(item, 'standing', sourceLabel, { optional: true });
    return {
      by,
      rationale,
      createdAt,
      targetId,
      ...(role !== undefined ? { role } : {}),
      ...(standing !== undefined ? { standing } : {})
    } satisfies Approval;
  });

  return {
    id: amendmentStringField(raw, 'id', sourceLabel) as string,
    title: amendmentStringField(raw, 'title', sourceLabel) as string,
    rationale: amendmentStringField(raw, 'rationale', sourceLabel) as string,
    evidence,
    changes,
    approvals
  };
}

export function runAmend(rootDir: string, proposalFile: string, apply = false, options?: { configPath?: string }): string {
  const loaded = loadContext(rootDir, options?.configPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const proposalPath = resolveCliRepoLocalPath(rootDir, proposalFile, { kind: 'amendment proposal' }).absolutePath;
  const proposal = readAmendmentProposal(proposalPath);
  const decision = evaluateAmendment(proposal, constitution, agents);
  const resultPath = path.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.json`);
  const resultTextPath = path.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.txt`);
  ensureDir(path.dirname(resultPath));
  writeJson(resultPath, decision);
  fs.writeFileSync(resultTextPath, renderAmendmentDecisionText(decision), 'utf8');
  if (apply && decision.outcome === 'approved') {
    const nextConstitution = applyAmendment(proposal, constitution);
    const constitutionPath = resolveRepoLocalPath(rootDir, loaded.config.constitutionPath, { allowMissing: true, kind: 'constitution path' }).absolutePath;
    writeModuleExport(constitutionPath, nextConstitution);
  }
  return `${stableStringify(decision)}
`;
}
