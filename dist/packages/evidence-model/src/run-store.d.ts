import { RunArtifact } from './types-run';
/** Run id reservation, staged atomic publication of run packets, the latest pointer and loading of published runs. */
export declare function reserveRunId(rootDir: string, runId: string): void;
/** Lists the check-time files of a run packet; it is written last, just before the packet becomes visible. */
export interface RunPacketPublication {
    version: '1';
    kind: 'run-packet-publication';
    runId: string;
    files: string[];
}
export interface StagedRunArtifact {
    runId: string;
    stagingDir: string;
}
export declare class IncompleteRunPacketError extends Error {
}
/** Test-only fault injection for crash-recovery proofs: TS_QUALITY_TEST_FAULT=<point> aborts at that point. */
export declare function injectTestFault(point: 'after-run-json' | 'before-publish' | 'before-latest'): void;
/** Builds a run packet in a hidden staging directory; nothing under the run id is visible until it is published. */
export declare function stageRunArtifact(rootDir: string, run: RunArtifact): StagedRunArtifact;
/**
 * Publishes a staged packet with one directory rename. An existing run is never replaced; on failure the staging
 * directory is removed. The latest pointer moves only after the complete packet is visible.
 */
export declare function publishRunArtifact(rootDir: string, staged: StagedRunArtifact): string;
export declare function writeRunArtifact(rootDir: string, run: RunArtifact): string;
export declare function readLatestRun(rootDir: string): RunArtifact;
/** Published run ids; hidden staging directories left by an interrupted check are never listed. */
export declare function listRunIds(rootDir: string): string[];
/**
 * Loads a run packet. A packet with a publication record must still contain every listed file; packets from
 * versions before publication records (run.json only) stay readable for compatibility.
 */
export declare function loadRun(rootDir: string, runId: string): RunArtifact;
