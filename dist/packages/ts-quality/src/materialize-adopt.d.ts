/** Materializing authored config into runtime JSON and adopting reusable control-plane files from a pilot run. */
export interface MaterializeResult {
    configPath: string;
    outDir: string;
    files: string[];
}
export interface AdoptFromRunResult {
    sourceRunId: string;
    sourceRoot: string;
    copied: string[];
    skipped: Array<{
        path: string;
        reason: string;
    }>;
    omittedEphemeral: string[];
}
export declare function writeModuleExport(filePath: string, value: unknown): void;
export declare function relativeToRoot(rootDir: string, targetPath: string): string;
export declare function materializeProject(rootDir: string, options?: {
    configPath?: string;
    outDir?: string;
}): MaterializeResult;
export declare function adoptFromRun(rootDir: string, options: {
    fromRun: string;
}): AdoptFromRunResult;
