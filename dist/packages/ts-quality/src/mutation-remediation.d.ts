import { type MutationRemediation, type NextEvidenceAction, type RunArtifact, type SymbolEntity } from '../../evidence-model/src/index';
/** Survivor remediation guidance: observable behavior, assertion strategy and masking risk per surviving mutant. */
export declare function buildMutationRemediation(mutations: RunArtifact['mutations']): MutationRemediation | undefined;
export declare function uniqueStrings(values: string[]): string[];
export declare function mutationCommandFor(survivor: RunArtifact['mutations'][number]): string[];
export declare function observableBehaviorForMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement' | 'mutated'>): string;
export declare function assertionStrategyForMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement' | 'mutated'>): string;
export declare function maskingRiskForMutation(survivor: Pick<RunArtifact['mutations'][number], 'operator' | 'original' | 'replacement' | 'mutated'>): string;
export declare function enclosingSymbolForMutation(symbols: SymbolEntity[], survivor: Pick<RunArtifact['mutations'][number], 'filePath' | 'span'>): string | undefined;
export declare function focusedTestsForFile(run: Pick<RunArtifact, 'behaviorClaims'>, filePath: string): string[];
export declare function survivorGroupKey(survivor: RunArtifact['mutations'][number]): string;
export declare function expectedConfidenceLiftFor(run: Pick<RunArtifact, 'verdict'>, actionKind: NextEvidenceAction['primaryAction']['kind']): number | undefined;
