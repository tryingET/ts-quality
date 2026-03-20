import fs from 'fs';
import path from 'path';
import {
  type AmendmentProposal,
  type AnalysisContext,
  type Approval,
  type Attestation,
  type AuthorizationDecision,
  type FileEntity,
  type OverrideRecord,
  type RunArtifact,
  type SymbolEntity,
  DEFAULT_SOURCE_PATTERNS,
  DEFAULT_TEST_PATTERNS,
  assertSafeRunId,
  buildRepositoryEntity,
  collectSourceFiles,
  createRunId,
  digestObject,
  ensureDir,
  fileDigest,
  listRunIds,
  loadRun,
  normalizePath,
  nowIso,
  readLatestRun,
  resolvePackageName,
  resolveRepoLocalPath,
  stableStringify,
  writeJson,
  writeRunArtifact
} from '../../evidence-model/src/index';
import { analyzeCrap, parseLcov } from '../../crap4ts/src/index';
import { runMutations } from '../../ts-mutate/src/index';
import { evaluateInvariants } from '../../invariants/src/index';
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
import { applyAmendment, authorizeChange, buildChangeBundle, evaluateAmendment, generateKeyPair, loadTrustedKeys, parseAttestationRecord, saveAttestation, signAttestation, verifyAttestation } from '../../legitimacy/src/index';
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
  const lines = [
    `${linePrefix}Invariant evidence at risk: ${riskyInvariant.invariantId}`,
    ...renderConciseInvariantProvenance(riskyInvariant, { linePrefix })
  ];
  if (options?.includeObligation !== false && riskyInvariant.obligations.length > 0) {
    lines.push(`${linePrefix}Obligation: ${riskyInvariant.obligations[0]?.description}`);
  }
  return lines;
}

function renderCheckSummaryText(run: Pick<RunArtifact, 'behaviorClaims' | 'verdict'>): string {
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

function renderGovernanceArtifactText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string {
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
  action: string
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

function latestRunOrUndefined(rootDir: string): RunArtifact | undefined {
  try {
    return readLatestRun(rootDir);
  } catch {
    return undefined;
  }
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

function relativePathInsideRoot(rootDir: string, absolutePath: string): string | undefined {
  const relative = portablePath(path.relative(rootDir, absolutePath));
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return undefined;
  }
  return normalizePath(relative);
}

function runScopedArtifactReference(subjectFile: string): { runId: string; artifactName: string } | undefined {
  const match = /^\.ts-quality\/runs\/([^/]+)\/([^/]+)$/.exec(normalizePath(subjectFile));
  if (!match) {
    return undefined;
  }
  return {
    runId: match[1] ?? '',
    artifactName: match[2] ?? ''
  };
}

function recordSubjectPath(rootDir: string, resolvedSubject: string, originalCandidate: string): string {
  const relative = relativePathInsideRoot(rootDir, resolvedSubject);
  if (relative) {
    return relative;
  }
  throw new Error(`attestation subject must be inside --root: ${originalCandidate}`);
}

function verifyAttestationAtRoot(rootDir: string, attestation: Attestation, trustedKeys: Record<string, string>): { ok: boolean; reason: string } {
  const signature = verifyAttestation(attestation, trustedKeys);
  if (!signature.ok) {
    return signature;
  }
  const subjectFile = typeof attestation.payload?.subjectFile === 'string' ? attestation.payload.subjectFile : undefined;
  if (!subjectFile) {
    return { ok: false, reason: 'subject file missing from attestation payload' };
  }
  if (path.isAbsolute(subjectFile)) {
    return { ok: false, reason: 'subject file must be repo-relative' };
  }
  const normalizedSubject = normalizePath(subjectFile);
  const resolvedSubject = path.resolve(rootDir, normalizedSubject);
  const relativeSubject = relativePathInsideRoot(rootDir, resolvedSubject);
  if (!relativeSubject || relativeSubject !== normalizedSubject) {
    return { ok: false, reason: 'subject file escapes repository root' };
  }
  const scopedSubject = runScopedArtifactReference(normalizedSubject);
  const payloadRunId = typeof attestation.payload?.runId === 'string' ? attestation.payload.runId : undefined;
  if (payloadRunId && scopedSubject && payloadRunId !== scopedSubject.runId) {
    return { ok: false, reason: 'attestation payload runId does not match subject path' };
  }
  if (!fs.existsSync(resolvedSubject)) {
    return { ok: false, reason: `subject file missing: ${subjectFile}` };
  }
  const digest = digestObject(fs.readFileSync(resolvedSubject, 'utf8'));
  if (digest !== attestation.subjectDigest) {
    return { ok: false, reason: 'subject digest mismatch' };
  }
  return { ok: true, reason: 'verified' };
}

function attestationAppliesToRun(attestation: Attestation, runId: string): boolean {
  const subjectFile = typeof attestation.payload?.subjectFile === 'string' ? attestation.payload.subjectFile : undefined;
  if (!subjectFile || path.isAbsolute(subjectFile)) {
    return false;
  }
  const scopedSubject = runScopedArtifactReference(subjectFile);
  if (!scopedSubject || scopedSubject.runId !== runId) {
    return false;
  }
  const payloadRunId = typeof attestation.payload?.runId === 'string' ? attestation.payload.runId : undefined;
  return payloadRunId === undefined || payloadRunId === runId;
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

export function loadVerifiedAttestations(rootDir: string, attestationsDir: string, trustedKeysDir: string): { attestations: Attestation[]; verification: Array<{ issuer: string; ok: boolean; reason: string }> } {
  const keysDir = resolveRepoLocalPath(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
  const keys = loadTrustedKeys(keysDir);
  const verification: Array<{ issuer: string; ok: boolean; reason: string }> = [];
  const attestations: Attestation[] = [];
  for (const filePath of attestationFiles(rootDir, attestationsDir)) {
    let rawAttestation: unknown;
    try {
      rawAttestation = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      verification.push({ issuer: path.basename(filePath), ok: false, reason: `invalid JSON: ${message}` });
      continue;
    }
    const parsed = parseAttestationRecord(rawAttestation);
    if (!parsed.ok) {
      verification.push({ issuer: path.basename(filePath), ok: false, reason: parsed.reason });
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

function buildAnalysisContext(input: {
  runId: string;
  createdAt: string;
  sourceFiles: string[];
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  executionFingerprint: string;
}): AnalysisContext {
  return {
    runId: input.runId,
    createdAt: input.createdAt,
    sourceFiles: [...input.sourceFiles],
    changedFiles: [...input.changedFiles],
    changedRegions: [...input.changedRegions],
    executionFingerprint: input.executionFingerprint
  };
}

export function runCheck(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; runId?: string }): CheckResult {
  const loaded = loadContext(rootDir, options?.configPath);
  const sourceFiles = collectSourceFiles(rootDir, loaded.config.sourcePatterns);
  const changedRegions = loaded.config.changeSet.diffFile ? loadChangedRegions(rootDir, loaded.config.changeSet.diffFile) : [];

  const configuredChangedFiles = loaded.config.changeSet.files ?? [];
  const changedFiles = (options?.changedFiles ?? (configuredChangedFiles.length > 0 ? configuredChangedFiles : sourceFiles)).map((item) => normalizePath(item));
  const runId = assertSafeRunId(options?.runId ?? createRunId());
  const createdAt = nowIso();
  const lcovPath = path.join(rootDir, loaded.config.coverage.lcovPath);
  const coverage = fs.existsSync(lcovPath) ? parseLcov(fs.readFileSync(lcovPath, 'utf8')) : [];
  const waivers = loadWaivers(rootDir, loaded.config.waiversPath);
  const approvals = loadApprovals(rootDir, loaded.config.approvalsPath);
  const overrides = loadOverrides(rootDir, loaded.config.overridesPath);
  const invariants = loadInvariants(rootDir, loaded.config.invariantsPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const previousRun = latestRunOrUndefined(rootDir);

  const crapReport = analyzeCrap({
    rootDir,
    sourceFiles,
    coverage,
    changedFiles,
    changedRegions
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
    runtimeMirrorRoots: loaded.config.mutations.runtimeMirrorRoots ?? ['dist']
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

  const preliminaryInput: any = {
    nowIso: nowIso(),
    policy: {
      ...defaultPolicy(),
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
  const preliminary = evaluatePolicy(preliminaryInput);

  const governance = evaluateGovernance({
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

  const evaluatedInput: PolicyInput = {
    nowIso: nowIso(),
    policy: {
      ...defaultPolicy(),
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
  const evaluated = evaluatePolicy(evaluatedInput);

  const repo = buildRepositoryEntity(rootDir, sourceFiles);
  const analysis = buildAnalysisContext({
    runId,
    createdAt,
    sourceFiles,
    changedFiles,
    changedRegions,
    executionFingerprint: mutationRun.executionFingerprint
  });
  const run: RunArtifact = {
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

  const artifactDir = writeRunArtifact(rootDir, run);
  writeJson(path.join(artifactDir, 'report.json'), run);
  fs.writeFileSync(path.join(artifactDir, 'report.md'), `${renderMarkdownReport(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'pr-summary.md'), `${renderPrSummary(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'explain.txt'), `${renderExplainText(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'attestation-verify.txt'), `${verifiedAttestations.verification.map((item) => `${item.issuer}: ${item.ok ? 'ok' : 'failed'} (${item.reason})`).join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'check-summary.txt'), renderCheckSummaryText(run), 'utf8');
  const plan = generateGovernancePlan(run, constitution, agents);
  fs.writeFileSync(path.join(artifactDir, 'plan.txt'), renderPlanArtifactText(run, plan), 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'govern.txt'), renderGovernanceArtifactText(run, plan), 'utf8');
  return { run, artifactDir };
}

export function initProject(rootDir: string): void {
  ensureDir(path.join(rootDir, '.ts-quality', 'attestations'));
  ensureDir(path.join(rootDir, '.ts-quality', 'keys'));
  const configPath = path.join(rootDir, 'ts-quality.config.ts');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `export default {\n  sourcePatterns: ${stableStringify([...DEFAULT_SOURCE_PATTERNS])},\n  testPatterns: ${stableStringify([...DEFAULT_TEST_PATTERNS])},\n  coverage: { lcovPath: 'coverage/lcov.info' },\n  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ['dist'] },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  changeSet: { files: [] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`, 'utf8');
  }
  const invariantsPath = path.join(rootDir, '.ts-quality', 'invariants.ts');
  if (!fs.existsSync(invariantsPath)) {
    fs.writeFileSync(invariantsPath, `export default [\n  {\n    id: 'auth.refresh.validity',\n    title: 'Refresh token validity',\n    description: 'Expired refresh tokens must never authorize access.',\n    severity: 'high',\n    selectors: ['path:src/auth/**', 'symbol:isRefreshExpired'],\n    scenarios: [\n      { id: 'expired', description: 'expired token is denied', keywords: ['expired', 'deny'], failurePathKeywords: ['boundary', 'expiry'], expected: 'deny' }\n    ]\n  }\n];\n`, 'utf8');
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

export function renderLatestReport(rootDir: string, format: 'markdown' | 'json'): string {
  const run = readLatestRun(rootDir);
  return format === 'json' ? `${stableStringify(run)}\n` : `${renderMarkdownReport(run)}\n`;
}

export function renderLatestExplain(rootDir: string): string {
  return `${renderExplainText(readLatestRun(rootDir))}\n`;
}

export function renderTrend(rootDir: string): string {
  const runs = listRunIds(rootDir)
    .map((runId) => loadRun(rootDir, runId))
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

export function renderGovernance(rootDir: string, options?: { configPath?: string }): string {
  const loaded = loadContext(rootDir, options?.configPath);
  const run = readLatestRun(rootDir);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const plan = generateGovernancePlan(run, constitution, agents);
  return renderGovernanceText(run, plan);
}

export function renderPlan(rootDir: string, options?: { configPath?: string }): string {
  const loaded = loadContext(rootDir, options?.configPath);
  const run = readLatestRun(rootDir);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const plan = generateGovernancePlan(run, constitution, agents);
  return renderPlanText(run, plan);
}

export function runAuthorize(rootDir: string, agentId: string, action: string, options?: { configPath?: string }): { decisionPath: string; output: string } {
  const loaded = loadContext(rootDir, options?.configPath);
  const run = readLatestRun(rootDir);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const overrides = loadOverrides(rootDir, loaded.config.overridesPath);
  const { attestations } = loadVerifiedAttestations(rootDir, loaded.config.attestationsDir, loaded.config.trustedKeysDir);
  const runAttestations = attestations.filter((attestation) => attestationAppliesToRun(attestation, run.runId));
  const bundle = buildChangeBundle(rootDir, run, agentId, action);
  const baseDecision = authorizeChange(agentId, action, bundle, run, agents, constitution, runAttestations, overrides);
  const decision: AuthorizationDecision = {
    ...baseDecision,
    evidenceContext: buildAuthorizationEvidenceContext(run, agentId, action)
  };
  const artifactDir = path.join(rootDir, '.ts-quality', 'runs', run.runId);
  const bundlePath = path.join(artifactDir, `bundle.${agentId}.${action}.json`);
  const decisionPath = path.join(artifactDir, `authorize.${agentId}.${action}.json`);
  writeJson(bundlePath, bundle);
  writeJson(decisionPath, decision);
  return { decisionPath, output: `${stableStringify(decision)}\n` };
}

export function attestSign(rootDir: string, issuer: string, keyId: string, privateKeyPath: string, subjectFile: string, claims: string[], outputPath: string): string {
  const resolvedSubject = resolveCliPath(rootDir, subjectFile);
  const resolvedKey = resolveCliPath(rootDir, privateKeyPath);
  const recordedSubjectPath = recordSubjectPath(rootDir, resolvedSubject, subjectFile);
  const scopedSubject = runScopedArtifactReference(recordedSubjectPath);
  const subjectText = fs.readFileSync(resolvedSubject, 'utf8');
  const attestation = signAttestation({
    issuer,
    keyId,
    privateKeyPem: fs.readFileSync(resolvedKey, 'utf8'),
    subjectType: path.extname(resolvedSubject) === '.json' ? 'json-artifact' : 'file',
    subjectDigest: digestObject(subjectText),
    claims,
    payload: {
      subjectFile: recordedSubjectPath,
      ...(scopedSubject ? { runId: scopedSubject.runId, artifactName: scopedSubject.artifactName } : {})
    }
  });
  const resolvedOutput = resolveCliPath(rootDir, outputPath);
  ensureDir(path.dirname(resolvedOutput));
  saveAttestation(resolvedOutput, attestation);
  return resolvedOutput;
}

export function attestVerify(rootDir: string, attestationFile: string, trustedKeysDir: string): string {
  const parsed = parseAttestationRecord(JSON.parse(fs.readFileSync(resolveCliPath(rootDir, attestationFile), 'utf8')));
  if (!parsed.ok) {
    return `${path.basename(attestationFile)}: failed (${parsed.reason})\n`;
  }
  const attestation = parsed.attestation;
  const keysDir = resolveRepoLocalPath(rootDir, trustedKeysDir, { allowMissing: true, kind: 'trusted keys dir' }).absolutePath;
  const keys = loadTrustedKeys(keysDir);
  const result = verifyAttestationAtRoot(rootDir, attestation, keys);
  return `${attestation.issuer}: ${result.ok ? 'verified' : 'failed'} (${result.reason})\n`;
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

export function runAmend(rootDir: string, proposalFile: string, apply = false, options?: { configPath?: string }): string {
  const loaded = loadContext(rootDir, options?.configPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const proposal = JSON.parse(fs.readFileSync(resolveCliPath(rootDir, proposalFile), 'utf8')) as AmendmentProposal;
  const decision = evaluateAmendment(proposal, constitution, agents);
  const resultPath = path.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.json`);
  ensureDir(path.dirname(resultPath));
  writeJson(resultPath, decision);
  if (apply && decision.outcome === 'approved') {
    const nextConstitution = applyAmendment(proposal, constitution);
    const constitutionPath = resolveRepoLocalPath(rootDir, loaded.config.constitutionPath, { allowMissing: true, kind: 'constitution path' }).absolutePath;
    writeModuleExport(constitutionPath, nextConstitution);
  }
  return `${stableStringify(decision)}\n`;
}
