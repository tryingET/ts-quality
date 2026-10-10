interface ParsedArgs {
    positionals: string[];
    values: Map<string, string>;
    valueCounts: Map<string, number>;
    flags: Set<string>;
}
export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function validateParsedArgs(parsed: ParsedArgs): void;
export declare function takeOption(parsed: ParsedArgs, name: string): string | undefined;
export declare function hasFlag(parsed: ParsedArgs, name: string): boolean;
export declare function commaList(parsed: ParsedArgs, name: string): string[] | undefined;
export declare function rootDir(parsed: ParsedArgs): string;
export declare function changedFiles(parsed: ParsedArgs): string[] | undefined;
export declare function runId(parsed: ParsedArgs): string | undefined;
export declare function mutationTargets(parsed: ParsedArgs): string[] | undefined;
export declare function configPath(parsed: ParsedArgs): string | undefined;
export declare function outDir(parsed: ParsedArgs): string | undefined;
export declare function fromRun(parsed: ParsedArgs): string | undefined;
export declare function preset(parsed: ParsedArgs): 'default' | 'node-test' | 'node-test-ts-dist' | 'vitest' | 'jest' | undefined;
export declare function csvValues(parsed: ParsedArgs, name: string): string[] | undefined;
export {};
