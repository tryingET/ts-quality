import { type ChangedRegion, type ComplexityEvidence, type InvariantEvidenceMode, type InvariantSpec } from '../../evidence-model/src/index';
import type { InvariantEvaluationOptions } from './evaluate';
/** Execution witness records and plans: which configured witness commands an invariant's changed scope impacts. */
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
export declare function executionWitnessSelection(rootDir: string, invariant: InvariantSpec, scenario: InvariantSpec['scenarios'][number], files: string[]): {
    configured: boolean;
    matched: boolean;
    witnessFiles: string[];
    mode: InvariantEvidenceMode;
    modeReason: string;
};
export declare function impactedFiles(invariant: InvariantSpec, changedFiles: string[], changedRegions: ChangedRegion[], complexity: ComplexityEvidence[]): string[];
export declare function collectExecutionWitnessPlanSummary(options: Pick<InvariantEvaluationOptions, 'invariants' | 'changedFiles' | 'changedRegions' | 'complexity'>): ExecutionWitnessPlanSummary;
export declare function collectExecutionWitnessPlans(options: Pick<InvariantEvaluationOptions, 'invariants' | 'changedFiles' | 'changedRegions' | 'complexity'>): ExecutionWitnessGenerationPlan[];
