import { type ChangedRegion, type CoverageEvidence, type ExecutionReceipt, type MutationResult, type MutationSite } from '../../evidence-model/src/index';
export interface MutationManifest {
    version: '2';
    entries: Record<string, MutationResult>;
}
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
}
export interface MutationRun {
    sites: MutationSite[];
    results: MutationResult[];
    score: number;
    killed: number;
    survived: number;
    baseline: ExecutionReceipt;
    executionFingerprint: string;
}
export declare function discoverMutationSites(sourceText: string, filePath: string, coverage?: CoverageEvidence[], changedFiles?: string[], changedRegions?: ChangedRegion[], coveredOnly?: boolean): MutationSite[];
export declare function applyMutation(sourceText: string, site: MutationSite): string;
export declare function runMutations(options: MutationOptions): MutationRun;
