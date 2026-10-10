import { type MutationSite } from '../../evidence-model/src/index';
import { RepoFileDigest } from './execution';
/** The isolated mutation workspace: copy, node_modules mirroring, pristine reset and runtime mirrors. */
export interface MutationWorkspace {
    tempDir: string;
    snapshot: Map<string, string>;
}
export declare function prepareMutationWorkspace(repoRoot: string, repoFiles: RepoFileDigest[]): MutationWorkspace;
export declare function resetMutationWorkspace(repoRoot: string, workspace: MutationWorkspace): void;
export declare function disposeMutationWorkspace(workspace: MutationWorkspace | undefined): void;
export declare function writeRuntimeMirrors(repoRoot: string, tempDir: string, site: MutationSite, mutatedSource: string, runtimeMirrorRoots: string[]): void;
