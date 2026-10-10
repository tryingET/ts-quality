import fs from 'fs';
import path from 'path';
import {
  assertSafeRunId,
  normalizePath,
  readJson,
  readLatestRun,
  resolveRepoLocalPath,
  type RunArtifact,
  stableStringify
} from '../../evidence-model/src/index';
import {
  type AuthorizationFact,
  buildNavigation,
  collectGitContext,
  compareInterventionLineage,
  type InterventionLineage,
  renderNavigationText
} from './navigation';
import {
  inspectPackageIndex,
  type PackageIndex,
  type PackageIndexDeps,
  type PackageIndexInspection,
  renderPackageIndexInspection,
  renderPackageIndexWrite,
  writePackageIndex
} from './package-index';
import { renderExplainText, renderMarkdownReport } from '../../policy-engine/src/index';
import { generateGovernancePlan } from '../../governance/src/index';
import { tsQualityPackageVersion } from './check';
import { renderGovernanceText, renderPlanText } from './render-text';
import {
  RunDecisionOptions,
  assertContainedRunFiles,
  assertSupportedRun,
  buildReportJsonArtifact,
  expectedRunFileDigest,
  injectMarkdownNotice,
  loadContainedRun,
  projectedRunForDecision,
  renderRunDriftMarkdownNotice,
  renderRunDriftNotice,
  selectedRun
} from './run-context';

/** Read-only projections of persisted runs: report, explain, navigation, plan, governance and the package index wrappers. */

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
function authorizationFacts(rootDir: string, runId: string): AuthorizationFact[] {
  const runDir = path.join(rootDir, '.ts-quality', 'runs', assertSafeRunId(runId));
  if (!fs.existsSync(runDir)) {
    return [];
  }
  return fs.readdirSync(runDir)
    .filter((name) => name.startsWith('authorize.') && name.endsWith('.json') && name.length > 'authorize..json'.length)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((name) => {
      const record = readJson<{ outcome?: unknown; reasons?: unknown }>(path.join(runDir, name));
      return typeof record.outcome === 'string'
        ? [{ identity: name.replace(/\.json$/, ''), outcome: record.outcome, reasons: Array.isArray(record.reasons) ? record.reasons.filter((item): item is string => typeof item === 'string') : [] }]
        : [];
    });
}
/**
 * Derived navigation for one run: a versioned blocking summary and action queue, optional intervention lineage
 * against an earlier run and optional Git facts pinned to a horizon. Read-only: it writes nothing and runs no test.
 */
export function renderNavigation(rootDir: string, options: { runId?: string; interventionFrom?: string; interventionTests?: string[]; gitHorizon?: string; json?: boolean }): string {
  const run = assertSupportedRun(selectedRun(rootDir, options.runId ? { runId: options.runId } : undefined));
  assertContainedRunFiles(rootDir, run.runId);
  const context = projectedRunForDecision(rootDir, run);
  let lineage: InterventionLineage | undefined;
  if (options.interventionTests !== undefined && options.interventionFrom === undefined) {
    throw new Error('--intervention-tests requires --intervention-from: name the earlier run to compare with.');
  }
  if (options.interventionFrom !== undefined) {
    if (!options.interventionTests || options.interventionTests.length === 0) {
      throw new Error('--intervention-tests is required with --intervention-from: declare the test files you edited.');
    }
    const before = loadContainedRun(rootDir, options.interventionFrom);
    if (before.runId === run.runId || before.createdAt >= run.createdAt) {
      throw new Error(`--intervention-from must name a different earlier run than ${run.runId}.`);
    }
    const knownTests = new Set([...Object.keys(before.mutationContext?.testFileDigests ?? {}), ...Object.keys(run.mutationContext?.testFileDigests ?? {})]);
    const declared = options.interventionTests.map((entry) => {
      const relative = resolveRepoLocalPath(rootDir, entry, { allowMissing: true, kind: 'intervention test' }).relativePath;
      // Without recorded test digests in either run (older packets), lineage reports no-execution-context instead.
      if (knownTests.size > 0 && !knownTests.has(relative)) {
        throw new Error(`${entry} is not a test file in either run; declare only test files you edited.`);
      }
      return relative;
    });
    lineage = compareInterventionLineage(before, run, declared);
  }
  const git = options.gitHorizon !== undefined ? collectGitContext(rootDir, options.gitHorizon, run.changedFiles) : undefined;
  const navigation = buildNavigation({ run: context.projectedRun, drift: context.drift, authorizations: authorizationFacts(rootDir, run.runId), lineage, git });
  return options.json ? `${stableStringify(navigation)}\n` : renderNavigationText(navigation);
}
/** The files a run's verdict depends on with their check-time digests; the package index reads them contained. */
function runDriftSubjects(run: RunArtifact): Array<{ subject: string; path: unknown; expected: string }> {
  const changed = run.changedFiles.map((item) => normalizePath(item)).map((filePath) => ({
    subject: `changed file ${filePath}`,
    path: filePath,
    expected: expectedRunFileDigest(run, filePath) ?? 'sha256:unrecorded'
  }));
  const plane = run.controlPlane;
  return plane
    ? [
      ...changed,
      { subject: 'control plane config', path: plane.configPath, expected: plane.configDigest },
      { subject: 'control plane constitution', path: plane.constitutionPath, expected: plane.constitutionDigest },
      { subject: 'control plane agents', path: plane.agentsPath, expected: plane.agentsDigest }
    ]
    : changed;
}
function packageIndexDeps(): PackageIndexDeps {
  return {
    loadRun: loadContainedRun,
    latestRunId: (rootDir) => readLatestRun(rootDir).runId,
    driftSubjects: runDriftSubjects,
    toolVersion: tsQualityPackageVersion()
  };
}
/**
 * Writes the package artifact-reference index: discovered packages, the runs holding evidence for them and digests
 * of their canonical run packet files. References only; it copies no verdict and claims no coverage.
 */
export function writePackageIndexFile(rootDir: string, options: { packages?: string[]; all?: boolean; runIds?: string[]; out?: string }): { index: PackageIndex; indexPath: string; output: string } {
  const { index, indexPath } = writePackageIndex(rootDir, options, packageIndexDeps());
  return { index, indexPath, output: renderPackageIndexWrite(index, indexPath) };
}
/** Re-reads every reference of a package index and reports facts (fresh/changed/missing, source drift, findings). */
export function inspectPackageIndexFile(rootDir: string, options: { index?: string; packages?: string[] }): PackageIndexInspection {
  return inspectPackageIndex(rootDir, options, packageIndexDeps());
}
export function renderPackageIndexInspectionFile(rootDir: string, options: { index?: string; packages?: string[]; json?: boolean }): string {
  const inspection = inspectPackageIndexFile(rootDir, options);
  return options.json ? `${stableStringify(inspection)}\n` : renderPackageIndexInspection(inspection);
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
