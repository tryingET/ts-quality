import {
  type ControlPlaneSnapshot,
  IncompleteRunPacketError,
  listRunIds,
  loadRun,
  normalizePath,
  type RunArtifact,
  stableStringify
} from '../../evidence-model/src/index';
import { renderInvariantProvenanceBlock } from './render-text';

/** Comparable-run selection and the trend projection. */

interface TrendComparableRun {
  runId: string;
  changedFiles: string[];
  changedRegions: RunArtifact['changedRegions'];
  mutationSelection?: { policy: NonNullable<RunArtifact['mutationSelection']>['policy'] } | undefined;
  controlPlane?: ControlPlaneSnapshot | undefined;
  invariants: RunArtifact['invariants'];
}
interface TrendComparabilityAssessment {
  comparable: boolean;
  reasons: string[];
}
function orderedRuns(rootDir: string): RunArtifact[] {
  return listRunIds(rootDir)
    .flatMap((runId) => {
      try {
        return [loadRun(rootDir, runId)];
      } catch (error) {
        // An incomplete packet is never a comparison candidate; explicit projections of it still fail closed.
        if (error instanceof IncompleteRunPacketError) {
          return [];
        }
        throw error;
      }
    })
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
  const currentSelection = current.mutationSelection?.policy;
  const previousSelection = previous.mutationSelection?.policy;
  if (currentSelection && previousSelection
    ? stableStringify(currentSelection) !== stableStringify(previousSelection)
    : [currentSelection, previousSelection].some((policy) => policy !== undefined && (policy.targets.length > 0 || policy.maxDurationMs !== null))) {
    // Scores from different mutation selections (targets, budgets) measure different experiments.
    reasons.push('mutation selection differs');
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
export function latestComparableRunOrUndefined(rootDir: string, current: TrendComparableRun): RunArtifact | undefined {
  const runs = orderedRuns(rootDir);
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const candidate = runs[index];
    if (candidate && assessTrendComparability(current, candidate).comparable) {
      return candidate;
    }
  }
  return undefined;
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
