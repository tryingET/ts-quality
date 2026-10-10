import { type BehaviorClaim, type ChangedRegion, type ComplexityEvidence, type InvariantSpec, type MutationResult, type MutationSite } from '../../evidence-model/src/index';
/** evaluateInvariants: per-scenario evidence sub-signals and the invariant evidence summary. */
export interface InvariantEvaluationOptions {
    rootDir: string;
    invariants: InvariantSpec[];
    changedFiles: string[];
    changedRegions: ChangedRegion[];
    complexity: ComplexityEvidence[];
    mutationSites: MutationSite[];
    mutations: MutationResult[];
    testPatterns?: string[];
}
export declare function evaluateInvariants(options: InvariantEvaluationOptions): BehaviorClaim[];
