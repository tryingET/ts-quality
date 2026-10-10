import { type ControlPlaneSnapshot, type RunArtifact } from '../../evidence-model/src/index';
/** Comparable-run selection and the trend projection. */
interface TrendComparableRun {
    runId: string;
    changedFiles: string[];
    changedRegions: RunArtifact['changedRegions'];
    mutationSelection?: {
        policy: NonNullable<RunArtifact['mutationSelection']>['policy'];
    } | undefined;
    controlPlane?: ControlPlaneSnapshot | undefined;
    invariants: RunArtifact['invariants'];
}
export declare function latestComparableRunOrUndefined(rootDir: string, current: TrendComparableRun): RunArtifact | undefined;
export declare function renderTrend(rootDir: string): string;
export {};
