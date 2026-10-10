import fs from 'fs';
import path from 'path';
import {
  assertSafeRunId,
  buildRepositoryEntity,
  createRunId,
  DEFAULT_TEST_PATTERNS,
  digestObject,
  fileDigest,
  listFiles,
  matchesDiscoveryPattern,
  normalizePath,
  nowIso,
  publishRunArtifact,
  readJson,
  reserveRunId,
  resolveRepoLocalPath,
  type RunArtifact,
  stableStringify,
  stageRunArtifact,
  writeJson
} from '../../evidence-model/src/index';
import { analyzeCrap } from '../../crap4ts/src/index';
import {
  type MutationSelection,
  type MutationTarget,
  parseMutationTarget,
  runMutations,
  selectMutationSites
} from '../../ts-mutate/src/index';
import { evaluateInvariants } from '../../invariants/src/index';
import {
  evaluatePolicy,
  type PolicyInput,
  renderExplainText,
  renderMarkdownReport,
  renderPrSummary
} from '../../policy-engine/src/index';
import { evaluateGovernance, generateGovernancePlan } from '../../governance/src/index';
import {
  loadAgents,
  loadApprovals,
  loadConstitution,
  loadInvariants,
  loadOverrides,
  loadWaivers
} from './config';
import {
  AnalysisManifest,
  buildAnalysisContext,
  buildAnalysisManifest,
  detectBuiltOutputCoverageWarnings,
  fileEntities,
  refreshExecutionWitnessPlans,
  symbolEntities
} from './analysis';
import { attestationAppliesToRun, loadVerifiedAttestations } from './attestations';
import { buildNextEvidenceAction } from './evidence-closure';
import { renderAttestationVerificationReport } from './legitimacy-commands';
import { buildMutationRemediation } from './mutation-remediation';
import {
  renderCheckSummaryText,
  renderCoverageGenerationText,
  renderEvidenceClosurePromptMarkdown,
  renderEvidenceClosureTaskManifest,
  renderGovernanceArtifactText,
  renderNextEvidenceActionText,
  renderPlanArtifactText
} from './render-text';
import { buildControlPlaneSnapshot, buildReportJsonArtifact, digestOrMissing, policyConfigFromLoadedContext } from './run-context';
import { latestComparableRunOrUndefined } from './trend';
import { renderExecutionWitnessSummaryText } from './witness-commands';

/** The check pipeline: mutation targeting and execution context, the inert mutation preview and runCheck. */

export interface CheckResult {
  run: RunArtifact;
  artifactDir: string;
}
function mutationTargetsFor(loaded: AnalysisManifest['loaded'], overrides: string[] | undefined): MutationTarget[] {
  return (overrides ?? loaded.config.mutations.targets ?? []).map((spec) => parseMutationTarget(spec));
}
function mutationTargetSpec(target: MutationTarget): string {
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
function mutationEnvironmentDigest(): string {
  const env = Object.entries(process.env)
    .filter(([key, value]) => key !== 'NODE_TEST_CONTEXT' && typeof value === 'string' && value.length > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  return digestObject(Object.fromEntries(env));
}
export function tsQualityPackageVersion(): string {
  for (const candidate of [path.resolve(__dirname, '../../../../packages/ts-quality/package.json'), path.resolve(__dirname, '../../../../package.json')]) {
    try {
      const version = readJson<{ version?: unknown }>(candidate).version;
      if (typeof version === 'string') {
        return version;
      }
    } catch {
      // try the next location
    }
  }
  return '0.0.0';
}
function buildMutationExecutionContext(rootDir: string, loaded: AnalysisManifest['loaded']): NonNullable<RunArtifact['mutationContext']> {
  const testPatterns = loaded.config.testPatterns ?? [...DEFAULT_TEST_PATTERNS];
  // Regular files only, like the mutation fingerprint: symlinks (for example a symlinked node_modules) are not read.
  const repoFiles = listFiles(rootDir)
    .filter((filePath) => {
      try {
        return fs.lstatSync(path.join(rootDir, filePath)).isFile();
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.localeCompare(right));
  // Same discovery rules as test selection: hidden directories only when a pattern names them.
  const isTest = (filePath: string): boolean => testPatterns.some((pattern) => matchesDiscoveryPattern(pattern, filePath));
  const testFiles = repoFiles.filter(isTest);
  const nonTestFiles = repoFiles.filter((filePath) => !isTest(filePath) && !filePath.split('/').some((segment) => segment.startsWith('.')));
  const dependencyDigests = Object.fromEntries(DEPENDENCY_MANIFESTS
    .filter((name) => fs.existsSync(path.join(rootDir, name)))
    .map((name) => [name, fileDigest(path.join(rootDir, name))]));
  return {
    version: '1',
    testCommand: [...loaded.config.mutations.testCommand],
    timeoutMs: loaded.config.mutations.timeoutMs ?? 15_000,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    environmentDigest: mutationEnvironmentDigest(),
    testFileDigests: Object.fromEntries(testFiles.map((filePath) => [filePath, fileDigest(path.join(rootDir, filePath))])),
    dependencyDigests,
    nonTestFilesDigest: digestObject(nonTestFiles.map((filePath) => ({ filePath, digest: fileDigest(path.join(rootDir, filePath)) }))),
    tool: { tsQuality: tsQualityPackageVersion() }
  };
}
function refuseUnresolvedMutationTargets(rootDir: string, manifest: AnalysisManifest, overrides: string[] | undefined, functions?: RunArtifact['complexity']): void {
  const targets = mutationTargetsFor(manifest.loaded, overrides);
  if (targets.length === 0) {
    return;
  }
  const inventory = functions ?? analyzeCrap({ rootDir, sourceFiles: manifest.sourceFiles, coverage: [], changedFiles: manifest.changedFiles, changedRegions: manifest.changedRegions }).hotspots;
  const unresolved = previewMutationSelection(rootDir, manifest, inventory, targets).ledger.targets.filter((item) => item.status === 'unresolved');
  if (unresolved.length > 0) {
    throw new Error(`Mutation target(s) unresolved: ${unresolved.map((item) => `${mutationTargetSpec(item.target)} (${item.reason})`).join(', ')}. Run 'ts-quality mutations preview' to inspect current targets; no mutation evidence was produced.`);
  }
}
function previewMutationSelection(rootDir: string, manifest: AnalysisManifest, functions: RunArtifact['complexity'], targets: MutationTarget[]): MutationSelection {
  const mutations = manifest.loaded.config.mutations;
  return selectMutationSites({
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
export function renderMutationPreview(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; mutationTargets?: string[]; json?: boolean }): string {
  const manifest = buildAnalysisManifest(rootDir, { ...options, generateCoverage: false });
  const crapReport = analyzeCrap({ rootDir, sourceFiles: manifest.sourceFiles, coverage: manifest.coverage, changedFiles: manifest.changedFiles, changedRegions: manifest.changedRegions });
  const targets = mutationTargetsFor(manifest.loaded, options?.mutationTargets);
  const selection = previewMutationSelection(rootDir, manifest, crapReport.hotspots, targets);
  const testCommand = manifest.loaded.config.mutations.testCommand;
  if (options?.json) {
    return `${stableStringify({
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
  const reasonCounts = new Map<string, number>();
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
export function runCheck(rootDir: string, options?: { changedFiles?: string[]; configPath?: string; runId?: string; mutationTargets?: string[] }): CheckResult {
  const runId = assertSafeRunId(options?.runId ?? createRunId());
  if (options?.mutationTargets && options.mutationTargets.length > 0) {
    // Resolve command-line targets inertly before the run id is reserved and before any command runs.
    refuseUnresolvedMutationTargets(rootDir, buildAnalysisManifest(rootDir, { ...options, generateCoverage: false }), options.mutationTargets);
  }
  reserveRunId(rootDir, runId);
  const createdAt = nowIso();
  const manifest = buildAnalysisManifest(rootDir, { ...options, generateCoverage: true, observedAt: createdAt });
  const loaded = manifest.loaded;
  const sourceFiles = manifest.sourceFiles;
  const changedFiles = manifest.changedFiles.map((item) => normalizePath(item));
  const changedFileDigests = Object.fromEntries(changedFiles.map((filePath) => [
    filePath,
    digestOrMissing(resolveRepoLocalPath(rootDir, filePath, { allowMissing: true, kind: 'changed file' }).absolutePath)
  ]));
  const changedRegions = manifest.changedRegions;
  const coverage = manifest.coverage;
  const waivers = loadWaivers(rootDir, loaded.config.waiversPath);
  const approvals = loadApprovals(rootDir, loaded.config.approvalsPath);
  const overrides = loadOverrides(rootDir, loaded.config.overridesPath);
  const invariants = loadInvariants(rootDir, loaded.config.invariantsPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const controlPlane = buildControlPlaneSnapshot(rootDir, loaded, constitution, agents);
  const plannedMutationTargets = mutationTargetsFor(loaded, options?.mutationTargets);
  const previousRun = latestComparableRunOrUndefined(rootDir, {
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

  const crapReport = analyzeCrap({
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
    ...(loaded.config.mutations.maxDurationMs !== undefined ? { maxDurationMs: loaded.config.mutations.maxDurationMs } : {}),
    targets: mutationTargets,
    functions: crapReport.hotspots,
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
    changedFileDigests,
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
  run.nextEvidenceAction = buildNextEvidenceAction(run);
  if (evaluated.trend) {
    run.trend = evaluated.trend;
  }

  // Every check-time file is written into a hidden staging directory and published with one rename at the end,
  // so an interrupted check never leaves a visible partial packet or a torn latest pointer.
  const staged = stageRunArtifact(rootDir, run);
  const artifactDir = staged.stagingDir;
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
    fs.writeFileSync(path.join(artifactDir, 'next-evidence-action.prompt.md'), renderEvidenceClosurePromptMarkdown(run.nextEvidenceAction), 'utf8');
    fs.writeFileSync(path.join(artifactDir, 'next-evidence-action.ak-task.json'), renderEvidenceClosureTaskManifest(run.nextEvidenceAction), 'utf8');
  }
  fs.writeFileSync(path.join(artifactDir, 'check-summary.txt'), renderCheckSummaryText(run), 'utf8');
  const plan = generateGovernancePlan(run, constitution, agents);
  fs.writeFileSync(path.join(artifactDir, 'plan.txt'), renderPlanArtifactText(run, plan), 'utf8');
  fs.writeFileSync(path.join(artifactDir, 'govern.txt'), renderGovernanceArtifactText(run, plan), 'utf8');
  return { run, artifactDir: publishRunArtifact(rootDir, staged) };
}
