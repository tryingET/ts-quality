import ts from 'typescript';
export declare function resolveRepoLocalPath(rootDir: string, candidate: string, options?: {
    allowMissing?: boolean;
    kind?: string;
}): {
    absolutePath: string;
    relativePath: string;
    canonicalPath: string;
};
export declare function compilerOptionsForRepoFile(rootDir: string, filePath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined;
export declare function resolveRepoImport(rootDir: string, importerPath: string, specifier: string): string | undefined;
export declare function runtimeMirrorCandidates(sourcePath: string, mirrorRoots?: string[]): string[];
export declare function normalizePath(value: string): string;
