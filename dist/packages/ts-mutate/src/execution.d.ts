import { type ExecutionReceipt, type MutationResult, type MutationSite } from '../../evidence-model/src/index';
/** Running test commands with bounded output, the execution fingerprint and the mutation result cache. */
export interface MutationManifest {
    version: '2';
    entries: Record<string, MutationResult>;
}
export type MutationErrorKind = NonNullable<MutationResult['errorKind']>;
interface CommandOutcome {
    receipt: ExecutionReceipt;
    errorKind?: MutationErrorKind | undefined;
}
export interface RepoFileDigest {
    filePath: string;
    digest: string;
}
export declare const MUTATION_WORKSPACE_EXCLUDE_SET: Set<string>;
export declare function hasSyntaxErrors(filePath: string, sourceText: string): boolean;
/**
 * Bounds recorded command output but keeps both ends: the start says what failed, and test runners name the failing
 * tests at the end. The omitted middle is marked.
 */
export declare function boundedDetails(text: string): string;
export declare function runCommand(cwd: string, testCommand: string[], timeoutMs: number): CommandOutcome;
export declare function runCommandReceipt(cwd: string, testCommand: string[], timeoutMs: number): ExecutionReceipt;
export declare function canonicalRuntimeMirrorRoots(runtimeMirrorRoots: string[] | undefined): string[];
export declare function repoFileDigests(repoRoot: string): RepoFileDigest[];
export declare function buildExecutionFingerprint(testCommand: string[], runtimeMirrorRoots: string[], repoFiles: RepoFileDigest[]): string;
export declare function manifestKey(repoRoot: string, site: MutationSite, executionFingerprint: string): string;
export declare function loadManifest(filePath: string | undefined): MutationManifest;
export declare function saveManifest(filePath: string | undefined, manifest: MutationManifest): void;
export {};
