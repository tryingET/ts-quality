/**
 * Public API of the ts-mutate package. Implementation lives in the sibling modules; this file only re-exports
 * them, so the exported names and types are the package contract.
 */

export { discoverMutationSites } from './catalog';
export type { MutationManifest } from './execution';
export type { MutationOptions, MutationRun } from './runner';
export { applyMutation, runMutations } from './runner';
export type { MutationSelection, MutationSelectionOptions } from './selection';
export { parseMutationTarget, selectMutationSites } from './selection';
export type { FunctionSpan, MutationExclusionReason, MutationSelectionLedger, MutationTarget, MutationTargetResolution } from '../../evidence-model/src/index';
