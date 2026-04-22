import { type BehaviorClaim, type ChangedRegion, type ComplexityEvidence, type InvariantSpec, type MutationResult, type MutationSite } from '../../evidence-model/src/index';
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
export interface ExecutionWitnessGenerationPlan {
    invariantId: string;
    scenarioId: string;
    sourceFiles: string[];
    testFiles: string[];
    outputPath: string;
    command: string[];
    timeoutMs?: number;
}
export interface ExecutionWitnessSkippedPlan {
    invariantId: string;
    scenarioId: string;
    outputPath: string;
    command: string[];
    testFiles: string[];
    reason: 'invariant-not-impacted';
}
export interface ExecutionWitnessPlanSummary {
    autoRun: ExecutionWitnessGenerationPlan[];
    skipped: ExecutionWitnessSkippedPlan[];
}
export declare function collectExecutionWitnessPlanSummary(options: Pick<InvariantEvaluationOptions, 'invariants' | 'changedFiles' | 'changedRegions' | 'complexity'>): ExecutionWitnessPlanSummary;
export declare function collectExecutionWitnessPlans(options: Pick<InvariantEvaluationOptions, 'invariants' | 'changedFiles' | 'changedRegions' | 'complexity'>): ExecutionWitnessGenerationPlan[];
export declare function evaluateInvariants(options: InvariantEvaluationOptions): BehaviorClaim[];
