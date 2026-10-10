import fs from 'fs';
import path from 'path';
import {
  type ChangedRegion,
  type CoverageEvidence,
  ensureDir,
  type ExecutionReceipt,
  type FunctionSpan,
  type MutationResult,
  type MutationSelectionLedger,
  type MutationSite,
  type MutationTarget
} from '../../evidence-model/src/index';
import {
  MutationErrorKind,
  boundedDetails,
  buildExecutionFingerprint,
  canonicalRuntimeMirrorRoots,
  hasSyntaxErrors,
  loadManifest,
  manifestKey,
  repoFileDigests,
  runCommand,
  runCommandReceipt,
  saveManifest
} from './execution';
import { MutationSelectionOptions, selectMutationSites } from './selection';
import {
  MutationWorkspace,
  disposeMutationWorkspace,
  prepareMutationWorkspace,
  resetMutationWorkspace,
  writeRuntimeMirrors
} from './workspace';

/** runMutations: baselines, per-site execution, caching and the mutation run result. */

export interface MutationOptions {
  repoRoot: string;
  testCommand: string[];
  sourceFiles?: string[];
  changedFiles?: string[];
  changedRegions?: ChangedRegion[];
  coverage?: CoverageEvidence[];
  coveredOnly?: boolean;
  runtimeMirrorRoots?: string[];
  manifestPath?: string;
  timeoutMs?: number;
  maxSites?: number;
  /** Stop launching new mutants once the mutant phase has run this long; the first mutant always runs. */
  maxDurationMs?: number;
  targets?: MutationTarget[];
  functions?: FunctionSpan[];
}
export interface MutationRun {
  sites: MutationSite[];
  results: MutationResult[];
  score: number;
  killed: number;
  survived: number;
  baseline: ExecutionReceipt;
  executionFingerprint: string;
  selection: MutationSelectionLedger;
}
export function applyMutation(sourceText: string, site: MutationSite): string {
  return `${sourceText.slice(0, site.startOffset)}${site.replacement}${sourceText.slice(site.endOffset)}`;
}
function assertionHintForMutation(site: MutationSite): string {
  const location = `${site.filePath}:${site.span.startLine}`;
  if (site.operator.includes('equality') || ['===', '!=='].includes(site.original)) {
    return `Assert both equality and inequality behavior around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
  }
  if (site.operator.includes('greater-than') || site.operator.includes('less-than') || ['>', '>=', '<', '<='].includes(site.original)) {
    return `Add a boundary assertion around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
  }
  if (site.operator.includes('boolean') || site.original === 'true' || site.original === 'false') {
    return `Assert the opposite boolean branch around ${location}; this mutant flipped ${site.original} to ${site.replacement}.`;
  }
  if (site.operator.includes('and to or') || site.operator.includes('or to and') || ['&&', '||'].includes(site.original)) {
    return `Assert the combined-condition case around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
  }
  return `Add or tighten a focused assertion around ${location}; this mutant changed ${site.original} to ${site.replacement}.`;
}
function mutationResultForSite(site: MutationSite, input: { status: MutationResult['status']; durationMs: number; details?: string; mutatedSource?: string; testCommand: string[]; origin?: MutationResult['origin']; errorKind?: MutationErrorKind | undefined }): MutationResult {
  const result: MutationResult = {
    kind: 'mutation-result',
    siteId: site.id,
    filePath: site.filePath,
    status: input.status,
    durationMs: input.durationMs,
    span: site.span,
    startOffset: site.startOffset,
    endOffset: site.endOffset,
    operator: site.operator,
    original: site.original,
    replacement: site.replacement,
    testCommand: [...input.testCommand],
    assertionHint: assertionHintForMutation(site)
  };
  if (input.details) {
    result.details = input.details;
  }
  if (input.mutatedSource) {
    result.mutated = input.mutatedSource.slice(site.startOffset, site.startOffset + site.replacement.length);
  }
  if (input.origin) {
    result.origin = input.origin;
  }
  if (input.errorKind) {
    result.errorKind = input.errorKind;
  }
  return result;
}
function runSingleMutation(repoRoot: string, workspace: MutationWorkspace, site: MutationSite, mutatedSource: string, testCommand: string[], timeoutMs: number, runtimeMirrorRoots: string[]): MutationResult {
  if (hasSyntaxErrors(site.filePath, mutatedSource)) {
    return mutationResultForSite(site, {
      status: 'invalid',
      durationMs: 0,
      details: 'Mutation produced syntax errors',
      mutatedSource,
      testCommand,
      origin: 'executed'
    });
  }

  try {
    const targetPath = path.join(workspace.tempDir, site.filePath);
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, mutatedSource, 'utf8');
    writeRuntimeMirrors(repoRoot, workspace.tempDir, site, mutatedSource, runtimeMirrorRoots);
    const { receipt, errorKind } = runCommand(workspace.tempDir, testCommand, timeoutMs);
    return mutationResultForSite(site, {
      status: receipt.status === 'pass' ? 'survived' : receipt.status === 'fail' ? 'killed' : 'error',
      durationMs: receipt.durationMs,
      details: receipt.status === 'timeout' ? `test command timed out: ${receipt.details}` : receipt.details,
      mutatedSource,
      testCommand,
      origin: 'executed',
      errorKind
    });
  } finally {
    resetMutationWorkspace(repoRoot, workspace);
  }
}
/** Killed, survived and invalid outcomes are reusable for the same fingerprint; infrastructure errors are retried, never cached. */
function cacheableResult(result: MutationResult): boolean {
  return result.status === 'killed' || result.status === 'survived' || result.status === 'invalid';
}
export function runMutations(options: MutationOptions): MutationRun {
  const coverage = options.coverage ?? [];
  const selectionOptions: MutationSelectionOptions = {
    repoRoot: options.repoRoot,
    changedFiles: options.changedFiles ?? [],
    changedRegions: options.changedRegions ?? [],
    coverage,
    coveredOnly: options.coveredOnly ?? false
  };
  if (options.sourceFiles) {
    selectionOptions.sourceFiles = options.sourceFiles;
  }
  if (options.targets) {
    selectionOptions.targets = options.targets;
  }
  if (options.functions) {
    selectionOptions.functions = options.functions;
  }
  if (typeof options.maxSites === 'number') {
    selectionOptions.maxSites = options.maxSites;
  }
  if (typeof options.maxDurationMs === 'number') {
    selectionOptions.maxDurationMs = options.maxDurationMs;
  }
  const { sites: limitedSites, ledger } = selectMutationSites(selectionOptions);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const runtimeMirrorRoots = canonicalRuntimeMirrorRoots(options.runtimeMirrorRoots);
  const baseline = runCommandReceipt(options.repoRoot, options.testCommand, timeoutMs);
  const repoFiles = repoFileDigests(options.repoRoot);
  const executionFingerprint = buildExecutionFingerprint(options.testCommand, runtimeMirrorRoots, repoFiles);
  const finish = (results: MutationResult[], runBaseline: ExecutionReceipt): MutationRun => {
    const killed = results.filter((result) => result.status === 'killed').length;
    const survived = results.filter((result) => result.status === 'survived').length;
    const total = killed + survived;
    const counts = {
      ...ledger.counts,
      executed: results.filter((result) => result.origin === 'executed').length,
      cached: results.filter((result) => result.origin === 'cached').length,
      unobserved: results.filter((result) => result.origin === 'not-executed').length
    };
    return {
      sites: limitedSites,
      results,
      // An untrusted baseline scores 0, never a vacuous 1.
      score: runBaseline.status !== 'pass' ? 0 : total === 0 ? 1 : killed / total,
      killed,
      survived,
      baseline: runBaseline,
      executionFingerprint,
      // Complete only when every selected site has an assertion verdict (killed, survived) or is invalid code.
      selection: { ...ledger, counts, complete: runBaseline.status === 'pass' && results.length === limitedSites.length && results.every((result) => cacheableResult(result)) }
    };
  };
  const untrustedRun = (failedBaseline: ExecutionReceipt): MutationRun => finish(limitedSites.map((site) => mutationResultForSite(site, {
    status: 'error',
    durationMs: failedBaseline.durationMs,
    details: boundedDetails(`Baseline test command must pass before mutation scoring is trusted. ${failedBaseline.details ?? ''}`),
    testCommand: options.testCommand,
    origin: 'not-executed',
    errorKind: 'baseline'
  })), failedBaseline);
  if (baseline.status !== 'pass') {
    return untrustedRun(baseline);
  }

  const manifest = loadManifest(options.manifestPath);
  const results: MutationResult[] = [];
  let workspace: MutationWorkspace | undefined;
  let phaseStartedAt: number | undefined;
  let executedCount = 0;

  try {
    for (const site of limitedSites) {
      const key = manifestKey(options.repoRoot, site, executionFingerprint);
      const cached = manifest.entries[key];
      if (cached && cacheableResult(cached)) {
        const cachedInput: { status: MutationResult['status']; durationMs: number; details?: string; testCommand: string[] } = {
          status: cached.status,
          durationMs: cached.durationMs,
          testCommand: options.testCommand
        };
        if (cached.details) {
          cachedInput.details = cached.details;
        }
        results.push({
          ...mutationResultForSite(site, cachedInput),
          ...cached,
          origin: 'cached'
        });
        continue;
      }
      if (typeof options.maxDurationMs === 'number' && executedCount > 0 && phaseStartedAt !== undefined && Date.now() - phaseStartedAt >= options.maxDurationMs) {
        // Budget exhaustion is incomplete evidence: the site has no outcome and is never cached as clean.
        results.push(mutationResultForSite(site, {
          status: 'error',
          durationMs: 0,
          details: `not executed: mutation time budget maxDurationMs=${options.maxDurationMs} exhausted; this site has no observed outcome`,
          testCommand: options.testCommand,
          origin: 'not-executed',
          errorKind: 'budget'
        }));
        continue;
      }
      if (!workspace) {
        workspace = prepareMutationWorkspace(options.repoRoot, repoFiles);
        // A kill is evidence only if the unmutated code passes in this same workspace; otherwise any environment
        // difference (missing install state, excluded files, absolute paths) would count as killing every mutant.
        const workspaceBaseline = runCommandReceipt(workspace.tempDir, options.testCommand, timeoutMs);
        // The baseline run may leave side effects; every mutant must start from the same pristine workspace.
        resetMutationWorkspace(options.repoRoot, workspace);
        if (workspaceBaseline.status !== 'pass') {
          return untrustedRun({
            ...workspaceBaseline,
            details: boundedDetails(`mutation workspace baseline: the unmutated test command fails inside the mutation workspace, so kills there would not be evidence. ${workspaceBaseline.details ?? ''}`)
          });
        }
      }
      const sourceText = fs.readFileSync(path.join(options.repoRoot, site.filePath), 'utf8');
      const mutatedSource = applyMutation(sourceText, site);
      if (!hasSyntaxErrors(site.filePath, mutatedSource)) {
        // The budget clock starts with the first mutant that actually runs the test command.
        phaseStartedAt ??= Date.now();
      }
      const result = runSingleMutation(options.repoRoot, workspace, site, mutatedSource, options.testCommand, timeoutMs, runtimeMirrorRoots);
      if (result.status !== 'invalid') {
        executedCount += 1;
      }
      results.push(result);
      if (cacheableResult(result)) {
        manifest.entries[key] = result;
      }
    }
  } finally {
    disposeMutationWorkspace(workspace);
  }

  saveManifest(options.manifestPath, manifest);
  return finish(results, baseline);
}
