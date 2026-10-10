/** Starter control-plane generation (init) and the read-only artifact retention projection. */
export type InitPreset = 'default' | 'node-test' | 'node-test-ts-dist' | 'vitest' | 'jest';
export declare function initProject(rootDir: string, options?: {
    preset?: InitPreset;
}): void;
interface ArtifactRetentionPlanEntry {
    path: string;
    reason: string;
    status?: 'present' | 'missing' | 'pattern';
}
export interface ArtifactRetentionPlan {
    surface: 'ts-quality.artifact-retention';
    schemaVersion: 1;
    rootDir: string;
    config: {
        loaded: boolean;
        path?: string | undefined;
        error?: string | undefined;
    };
    keep: ArtifactRetentionPlanEntry[];
    ignore: ArtifactRetentionPlanEntry[];
    warnings: string[];
}
export declare function buildArtifactRetentionPlan(rootDir: string, options?: {
    configPath?: string;
}): ArtifactRetentionPlan;
export declare function renderArtifactRetentionPlan(rootDir: string, options?: {
    configPath?: string;
}): string;
export declare function renderArtifactRetentionPlanMachine(rootDir: string, options?: {
    configPath?: string;
}): string;
export {};
