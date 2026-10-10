import { type AnalysisContext, type AnalysisWarning, type CoverageGenerationRecord, type FileEntity, type RunArtifact, type SymbolEntity } from '../../evidence-model/src/index';
import { loadContext, loadInvariants } from './config';
import { ExecutionWitnessRefreshSummary } from './witness-commands';
/** Check-time analysis: changed scope, coverage generation and reading, witness plans and the analysis context. */
export declare function fileEntities(rootDir: string, filePaths: string[]): FileEntity[];
export declare function symbolEntities(complexity: RunArtifact['complexity']): SymbolEntity[];
export interface AnalysisManifest {
    loaded: ReturnType<typeof loadContext>;
    sourceFiles: string[];
    changedFiles: string[];
    changedRegions: RunArtifact['changedRegions'];
    coveragePath: string;
    coverage: RunArtifact['coverage'];
    coverageGeneration?: CoverageGenerationRecord | undefined;
    runtimeMirrorRoots: string[];
}
export declare function uniquePaths(values: string[]): string[];
export declare function buildAnalysisManifest(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    generateCoverage?: boolean;
    observedAt?: string;
}): AnalysisManifest;
export declare function refreshExecutionWitnessPlans(rootDir: string, input: {
    sourceFiles: string[];
    changedFiles: string[];
    changedRegions: RunArtifact['changedRegions'];
    coverage: RunArtifact['coverage'];
    invariants: ReturnType<typeof loadInvariants>;
    observedAt: string;
}): ExecutionWitnessRefreshSummary;
export declare function buildAnalysisContext(input: {
    runId: string;
    createdAt: string;
    configPath: string;
    coverageLcovPath: string;
    runtimeMirrorRoots: string[];
    sourceFiles: string[];
    changedFiles: string[];
    changedRegions: RunArtifact['changedRegions'];
    executionFingerprint: string;
}): AnalysisContext;
export declare function isSourceTsFile(filePath: string): boolean;
export declare function builtOutputRoots(runtimeMirrorRoots: string[]): string[];
export declare function detectBuiltOutputCoverageWarnings(input: {
    changedFiles: string[];
    coverage: RunArtifact['coverage'];
    runtimeMirrorRoots: string[];
}): AnalysisWarning[];
export declare function refreshExecutionWitnesses(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    observedAt?: string;
}): ExecutionWitnessRefreshSummary;
/** Source files are never test files, even when tests are colocated under a source root such as src/__tests__. */
export declare function sourceFilesExcludingTests(rootDir: string, sourcePatterns: string[], testPatterns: string[]): string[];
