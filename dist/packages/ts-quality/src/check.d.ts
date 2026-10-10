import { type RunArtifact } from '../../evidence-model/src/index';
/** The check pipeline: mutation targeting and execution context, the inert mutation preview and runCheck. */
export interface CheckResult {
    run: RunArtifact;
    artifactDir: string;
}
export declare function tsQualityPackageVersion(): string;
/**
 * Inert mutation selection preview: the sites `check` would mutate for this scope, targets and budget, with every
 * exclusion reason. Runs no command (not even coverage generation) and writes nothing.
 */
export declare function renderMutationPreview(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    mutationTargets?: string[];
    json?: boolean;
}): string;
export declare function runCheck(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    runId?: string;
    mutationTargets?: string[];
}): CheckResult;
