import { type ChangedRegion, type CoverageEvidence, type ExecutionReceipt, type FunctionSpan, type MutationResult, type MutationSelectionLedger, type MutationSite, type MutationTarget } from '../../evidence-model/src/index';
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
export declare function applyMutation(sourceText: string, site: MutationSite): string;
export declare function runMutations(options: MutationOptions): MutationRun;
