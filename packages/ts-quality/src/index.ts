/**
 * Public API of the ts-quality package. Implementation lives in the sibling modules; this file only re-exports
 * them, so the exported names and types are the package contract.
 */

export { runAmend } from './amend';
export { refreshExecutionWitnesses } from './analysis';
export { loadVerifiedAttestations } from './attestations';
export type { CheckResult } from './check';
export { renderMutationPreview, runCheck } from './check';
export { renderDoctor, renderDoctorMachine } from './doctor';
export type { ArtifactRetentionPlan, InitPreset } from './init-retention';
export { buildArtifactRetentionPlan, initProject, renderArtifactRetentionPlan, renderArtifactRetentionPlanMachine } from './init-retention';
export { attestGenerateKey, attestSign, attestVerify, runAuthorize } from './legitimacy-commands';
export type { AdoptFromRunResult, MaterializeResult } from './materialize-adopt';
export { adoptFromRun, materializeProject } from './materialize-adopt';
export { inspectPackageIndexFile, renderGovernance, renderLatestExplain, renderLatestReport, renderNavigation, renderPackageIndexInspectionFile, renderPlan, writePackageIndexFile } from './projections';
export { renderTrend } from './trend';
export type { ExecutionWitnessRefreshResult, ExecutionWitnessRefreshSkipped, ExecutionWitnessRefreshSummary } from './witness-commands';
export { runExecutionWitnessCommand } from './witness-commands';
export type { PackageIndex, PackageIndexInspection } from './package-index';
export { parsePackageIndex } from './package-index';
