/**
 * Public API of the invariants package. Implementation lives in the sibling modules; this file only re-exports
 * them, so the exported names and types are the package contract.
 */

export type { InvariantEvaluationOptions } from './evaluate';
export { evaluateInvariants } from './evaluate';
export type {
  ExecutionWitnessGenerationPlan,
  ExecutionWitnessPlanSummary,
  ExecutionWitnessSkippedPlan
} from './witness-plans';
export { collectExecutionWitnessPlanSummary, collectExecutionWitnessPlans } from './witness-plans';

