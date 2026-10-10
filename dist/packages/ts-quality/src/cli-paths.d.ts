export declare function resolveCliPath(rootDir: string, candidate: string, options?: {
    preferRoot?: boolean;
}): string;
export declare function lexicalRelativePathInsideRoot(rootDir: string, absolutePath: string): string | undefined;
export declare function resolveCliRepoLocalPath(rootDir: string, candidate: string, options?: {
    allowMissing?: boolean;
    kind?: string;
    preferRoot?: boolean;
}): {
    absolutePath: string;
    relativePath: string;
    canonicalPath: string;
};
export declare function resolveCliAttestationSubject(rootDir: string, candidate: string, options?: {
    allowMissing?: boolean;
}): {
    absolutePath: string;
    canonicalPath: string;
    recordedPath: string;
};
