import { type ChangedRegion, type CoverageEvidence, type FunctionSpan, type MutationExclusionReason, type MutationSelectionLedger, type MutationTarget, type MutationTargetResolution, type ExecutionReceipt, type MutationResult, type MutationSite } from '../../evidence-model/src/index';
export interface MutationManifest {
    version: '2';
    entries: Record<string, MutationResult>;
}
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
export declare function discoverMutationSites(sourceText: string, filePath: string, coverage?: CoverageEvidence[], changedFiles?: string[], changedRegions?: ChangedRegion[], coveredOnly?: boolean): MutationSite[];
export type { FunctionSpan, MutationExclusionReason, MutationSelectionLedger, MutationTarget, MutationTargetResolution };
export interface MutationSelection {
    sites: MutationSite[];
    ledger: MutationSelectionLedger;
}
export interface MutationSelectionOptions {
    repoRoot: string;
    sourceFiles?: string[];
    changedFiles?: string[];
    changedRegions?: ChangedRegion[];
    coverage?: CoverageEvidence[];
    coveredOnly?: boolean;
    targets?: MutationTarget[];
    functions?: FunctionSpan[];
    maxSites?: number;
    maxDurationMs?: number;
}
export declare function parseMutationTarget(spec: string): MutationTarget;
/**
 * Inert mutation selection: discovers, filters and budgets sites and records why each was or was not selected.
 * Runs no command and writes nothing.
 */
export declare function selectMutationSites(options: MutationSelectionOptions): MutationSelection;
export declare function applyMutation(sourceText: string, site: MutationSite): string;
export declare function runMutations(options: MutationOptions): MutationRun;
