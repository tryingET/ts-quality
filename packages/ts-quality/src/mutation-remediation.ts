import {
  type MutationRemediation,
  type NextEvidenceAction,
  normalizePath,
  type RunArtifact,
  type SymbolEntity
} from '../../evidence-model/src/index';

/** Survivor remediation guidance: observable behavior, assertion strategy and masking risk per surviving mutant. */

export function buildMutationRemediation(mutations: RunArtifact['mutations']): MutationRemediation | undefined {
  const survivors = mutations.filter((item) => item.status === 'survived').map((item) => ({
    filePath: item.filePath,
    siteId: item.siteId,
    ...(item.span ? { span: item.span } : {}),
    ...(item.operator ? { operator: item.operator } : {}),
    ...(item.original ? { original: item.original } : {}),
    ...(item.mutated ? { mutated: item.mutated } : {}),
    ...(item.replacement ? { replacement: item.replacement } : {}),
    ...(item.testCommand ? { testCommand: item.testCommand } : {}),
    ...(item.assertionHint ? { assertionHint: item.assertionHint } : {}),
    observableBehavior: observableBehaviorForMutation(item),
    assertionStrategy: assertionStrategyForMutation(item),
    maskingRisk: maskingRiskForMutation(item)
  }));
  return survivors.length > 0 ? { survivors } : undefined;
}
export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
export function mutationCommandFor(survivor: RunArtifact['mutations'][number]): string[] {
  return survivor.testCommand && survivor.testCommand.length > 0 ? survivor.testCommand : [];
}
function mutationChangeText(survivor: Pick<RunArtifact['mutations'][number], 'original' | 'replacement' | 'mutated'>): string {
  const before = survivor.original ?? 'original behavior';
  const after = survivor.replacement ?? survivor.mutated ?? 'mutated behavior';
  return `${before} -> ${after}`;
}
function isBoundaryMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement'>): boolean {
  return Boolean(survivor.operator?.includes('greater-than') || survivor.operator?.includes('less-than') || ['>', '>=', '<', '<='].includes(survivor.original ?? '') || ['>', '>=', '<', '<='].includes(survivor.replacement ?? ''));
}
function isCombinedConditionMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement'>): boolean {
  return Boolean(survivor.operator?.includes('and to or') || survivor.operator?.includes('or to and') || ['&&', '||'].includes(survivor.original ?? '') || ['&&', '||'].includes(survivor.replacement ?? ''));
}
function isEqualityMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement'>): boolean {
  return Boolean(survivor.operator?.includes('equality') || ['===', '!==', '==', '!='].includes(survivor.original ?? '') || ['===', '!==', '==', '!='].includes(survivor.replacement ?? ''));
}
export function observableBehaviorForMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement' | 'mutated'>): string {
  const change = mutationChangeText(survivor);
  if (isBoundaryMutation(survivor)) {
    return `Boundary behavior changed (${change}); the exact boundary value may now be accepted, rejected, included, or omitted differently.`;
  }
  if (isCombinedConditionMutation(survivor)) {
    return `Combined-condition behavior changed (${change}); an input satisfying only one side of the condition may now take the opposite branch.`;
  }
  if (isEqualityMutation(survivor)) {
    return `Equality behavior changed (${change}); matching and non-matching values may now take opposite branches.`;
  }
  if (survivor.operator?.includes('boolean') || survivor.original === 'true' || survivor.original === 'false') {
    return `Boolean behavior changed (${change}); the opposite branch may now be externally visible.`;
  }
  return `Mutated behavior changed (${change}); choose an input where the changed value reaches an externally visible result.`;
}
export function assertionStrategyForMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement' | 'mutated'>): string {
  if (isBoundaryMutation(survivor)) {
    return 'Assert the exact changed boundary through a public or exported behavior, then check the returned value, thrown error, side effect, or serialized artifact.';
  }
  if (isCombinedConditionMutation(survivor)) {
    return 'Assert the mixed-input case where only one side of the condition is true, using an observable public behavior rather than the internal condition alone.';
  }
  if (isEqualityMutation(survivor)) {
    return 'Assert both the equality case and a nearby inequality case through the externally observable API behavior.';
  }
  if (survivor.operator?.includes('boolean') || survivor.original === 'true' || survivor.original === 'false') {
    return 'Assert both boolean branches through the externally observable API behavior.';
  }
  return 'Create a focused input that distinguishes original and mutated behavior at the nearest externally observable boundary.';
}
export function maskingRiskForMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement' | 'mutated'>): string {
  const prefix = isBoundaryMutation(survivor) || isCombinedConditionMutation(survivor) || isEqualityMutation(survivor)
    ? 'The obvious assertion path may still pass if a later guard, fallback, normalization, or serialization step collapses original and mutated values.'
    : 'A survivor can remain if the tested call path masks the changed value before it reaches an assertion.';
  return `${prefix} Prefer a call path where the mutated value changes returned output, thrown error, side effect, or persisted artifact.`;
}
export function enclosingSymbolForMutation(symbols: SymbolEntity[], survivor: Pick<RunArtifact['mutations'][number], 'filePath' | 'span'>): string | undefined {
  if (!survivor.span) {
    return undefined;
  }
  const filePath = normalizePath(survivor.filePath);
  const line = survivor.span.startLine;
  const candidates = symbols
    .filter((symbol) => normalizePath(symbol.filePath) === filePath && symbol.span.startLine <= line && symbol.span.endLine >= line)
    .sort((left, right) => (left.span.endLine - left.span.startLine) - (right.span.endLine - right.span.startLine));
  return candidates[0]?.symbol;
}
export function focusedTestsForFile(run: Pick<RunArtifact, 'behaviorClaims'>, filePath: string): string[] {
  const normalized = normalizePath(filePath);
  return uniqueStrings(run.behaviorClaims
    .filter((claim) => (claim.evidenceSummary?.impactedFiles ?? []).map((item) => normalizePath(item)).includes(normalized))
    .flatMap((claim) => claim.evidenceSummary?.focusedTests ?? []));
}
export function survivorGroupKey(survivor: RunArtifact['mutations'][number]): string {
  return [
    normalizePath(survivor.filePath),
    survivor.span?.startLine ?? 'unknown',
    survivor.original ?? survivor.operator ?? 'unknown',
    survivor.replacement ?? survivor.mutated ?? 'unknown'
  ].join(':');
}
export function expectedConfidenceLiftFor(run: Pick<RunArtifact, 'verdict'>, actionKind: NextEvidenceAction['primaryAction']['kind']): number | undefined {
  const penalties = run.verdict.confidenceBreakdown?.penalties ?? [];
  const ids = actionKind === 'mutation-survivors'
    ? ['surviving-mutants', 'mutation-score', 'risky-invariants']
    : actionKind === 'mutation-baseline'
      ? ['mutation-baseline']
      : actionKind === 'mutation-missing'
        ? ['mutation-missing']
        : actionKind === 'governance'
          ? ['governance']
          : actionKind === 'coverage'
            ? ['crap']
            : actionKind === 'witness'
              ? ['lexical-invariants', 'risky-invariants']
              : [];
  const amount = penalties.filter((item) => ids.includes(item.id)).reduce((total, item) => total + item.amount, 0);
  return amount > 0 ? amount : undefined;
}
