import fs from 'fs';
import path from 'path';
import {
  type Agent,
  assertSafeRunId,
  type Attestation,
  type AttestationVerificationRecord,
  type ConstitutionRule,
  CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION,
  type ControlPlaneSnapshot,
  fileDigest,
  loadRun,
  normalizePath,
  nowIso,
  readLatestRun,
  renderSafeText,
  resolveRepoLocalPath,
  type RunArtifact
} from '../../evidence-model/src/index';
import { defaultPolicy, evaluatePolicy } from '../../policy-engine/src/index';
import { evaluateGovernance } from '../../governance/src/index';
import {
  loadAgents,
  loadApprovals,
  loadConstitution,
  loadContext,
  loadOverrides,
  loadWaivers
} from './config';
import { attestationAppliesToRun, attestationVerificationAppliesToRun, loadVerifiedAttestations } from './attestations';

/** Run selection, containment, control-plane snapshots, drift and the projected decision context shared by every read command. */

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
interface RunSelectionOptions {
  runId?: string;
}
export interface RunDecisionOptions extends RunSelectionOptions {
  configPath?: string;
}
export function selectedRun(rootDir: string, options?: RunSelectionOptions): RunArtifact {
  return options?.runId ? loadRun(rootDir, options.runId) : readLatestRun(rootDir);
}
export function expectedRunFileDigest(run: RunArtifact, filePath: string): string | undefined {
  if (run.changedFileDigests !== undefined) {
    const snapshot = run.changedFileDigests;
    const digest = snapshot && Object.prototype.hasOwnProperty.call(snapshot, filePath) ? snapshot[filePath] : undefined;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) || typeof digest !== 'string' || !/^sha256:(?:[a-f0-9]{64}|missing)$/u.test(digest)) {
      throw new Error(`Run ${run.runId} carries a malformed changed-file digest snapshot. Re-run ts-quality check with a new run id.`);
    }
    return digest;
  }
  return run.files.find((item) => item.filePath === normalizePath(filePath))?.digest;
}
export function digestOrMissing(absolutePath: string): string {
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
    const expectedDigest = expectedRunFileDigest(run, filePath) ?? 'sha256:unrecorded';
    const absolutePath = resolveRepoLocalPath(rootDir, filePath, { allowMissing: true, kind: 'changed file' }).absolutePath;
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
export function policyConfigFromLoadedContext(loaded: ReturnType<typeof loadContext>): ReturnType<typeof defaultPolicy> {
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
export function buildControlPlaneSnapshot(
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
export function projectedRunForDecision(rootDir: string, run: RunArtifact, options?: { configPath?: string }): RunDecisionContext {
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
export function renderRunDriftNotice(run: Pick<RunArtifact, 'runId'>, drift: RunDriftEntry[]): string {
  const lines = [
    `Run drift detected for ${run.runId}. Re-run ts-quality check before trusting downstream decision surfaces.`,
    ...drift.map((item) => `- ${item.subject}: expected ${item.expected}, actual ${item.actual}`)
  ];
  return `${lines.join('\n')}\n`;
}
export function renderRunDriftMarkdownNotice(run: Pick<RunArtifact, 'runId'>, drift: RunDriftEntry[]): string {
  const lines = [
    `> **Run drift detected for \`${renderSafeText(run.runId)}\`.** Re-run \`ts-quality check\` before trusting this projected report.`,
    ...drift.map((item) => `> - ${renderSafeText(item.subject)}: expected ${renderSafeText(item.expected)}, actual ${renderSafeText(item.actual)}`)
  ];
  return lines.join('\n');
}
export function injectMarkdownNotice(markdown: string, notice: string): string {
  const frontmatter = markdown.match(/^---\n[\s\S]*?\n---\n\n?/u);
  if (!frontmatter) {
    return `${notice}\n\n${markdown}`;
  }
  const insertAt = frontmatter[0].length;
  return `${markdown.slice(0, insertAt)}${notice}\n\n${markdown.slice(insertAt)}`;
}
export function buildReportJsonArtifact(run: RunArtifact, decisionContext: ReportDecisionContext): ReportJsonArtifact {
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
export function assertSupportedRun(run: RunArtifact): RunArtifact {
  if (!SUPPORTED_RUN_VERSIONS.has(String(run.version))) {
    throw new Error(`Run ${run.runId} has an unsupported run version ${String(run.version)}; navigation reads ${[...SUPPORTED_RUN_VERSIONS].join(', ')}.`);
  }
  return run;
}
export function assertContainedRunFiles(rootDir: string, runId: string): void {
  const safeRunId = assertSafeRunId(runId);
  // Both the directory and run.json itself must resolve inside the repository (symlink escapes refused).
  resolveRepoLocalPath(rootDir, `.ts-quality/runs/${safeRunId}`, { kind: 'run directory' });
  resolveRepoLocalPath(rootDir, `.ts-quality/runs/${safeRunId}/run.json`, { kind: 'run packet' });
}
export function loadContainedRun(rootDir: string, runId: string): RunArtifact {
  assertContainedRunFiles(rootDir, runId);
  return assertSupportedRun(loadRun(rootDir, assertSafeRunId(runId)));
}
