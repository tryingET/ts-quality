import { type RunArtifact } from '../../evidence-model/src/index';
import { DEFAULT_PACKAGE_INDEX_PATH, PACKAGE_INDEX_INSPECTION_KIND, PACKAGE_INDEX_KIND, PACKAGE_INDEX_SCHEMA_VERSION, type PackageIndex, type PackageIndexEvidence, type PackageIndexFileRef, type PackageIndexPackage, type PackageIndexRun, parsePackageIndex } from './package-index-schema';
export { DEFAULT_PACKAGE_INDEX_PATH, PACKAGE_INDEX_INSPECTION_KIND, PACKAGE_INDEX_KIND, PACKAGE_INDEX_SCHEMA_VERSION, parsePackageIndex };
export type { PackageIndex, PackageIndexEvidence, PackageIndexFileRef, PackageIndexPackage, PackageIndexRun };
/**
 * Package artifact-reference index writer and inspector: which packages exist (directories with a package.json), which
 * runs hold evidence for them, and digests of the canonical run packet files. It only references; it copies no verdict,
 * computes no plan and claims no coverage. inspect re-reads every reference and reports facts, never approval.
 */
export interface PackageIndexDeps {
    /** Loads a run with repository containment and a supported run version. */
    loadRun(rootDir: string, runId: string): RunArtifact;
    latestRunId(rootDir: string): string;
    /** Every file the run's verdict depends on (changed files, control plane) with the digest recorded at check time. */
    driftSubjects(run: RunArtifact): Array<{
        subject: string;
        path: unknown;
        expected: string;
    }>;
    toolVersion: string;
}
export type ReferenceState = 'fresh' | 'changed' | 'missing';
/** Directories that contain a package.json, outside node_modules, dist, .git and .ts-quality (the ones check skips). */
export declare function discoverIndexPackages(rootDir: string): string[];
/** Builds and atomically writes the index. Identical repository state and run selection give identical bytes. */
export declare function writePackageIndex(rootDir: string, options: {
    packages?: string[];
    all?: boolean;
    runIds?: string[];
    out?: string;
}, deps: PackageIndexDeps): {
    index: PackageIndex;
    indexPath: string;
};
export interface PackageQualityFacts {
    runId: string;
    state: 'available' | 'unavailable';
    reason?: string;
    runOutcome?: string;
    runMergeConfidence?: number;
    findingsInPackage?: {
        error: number;
        warn: number;
        info: number;
    };
    /** current: the evaluated source still matches; drifted: it changed; unavailable: it is absent here (for example an uploaded copy). */
    source?: {
        state: 'current' | 'drifted' | 'unavailable';
        subjects: string[];
    };
}
export interface PackageIndexInspection {
    kind: typeof PACKAGE_INDEX_INSPECTION_KIND;
    version: '1';
    authority: string;
    index: {
        path: string;
        sha256: string;
        toolVersion: string;
    };
    filter: string[] | null;
    references: {
        fresh: number;
        changed: number;
        missing: number;
        state: 'fresh' | 'stale';
    };
    enumeration: {
        mode: 'all' | 'selected';
        state: 'current' | 'changed' | 'not-applicable';
        added: string[];
        removed: string[];
    };
    completeness: PackageIndex['completeness'];
    outsideIndexedPackages: PackageIndexEvidence[];
    runs: Array<{
        runId: string;
        selection: PackageIndexRun['selection'];
        artifacts: Array<{
            path: string;
            state: ReferenceState;
        }>;
    }>;
    /** current: references fresh and source unchanged; source-unavailable: references fresh, source absent; stale: something changed. */
    packages: Array<{
        path: string;
        name: string | null;
        status: PackageIndexPackage['status'];
        manifest: ReferenceState;
        state: 'current' | 'source-unavailable' | 'stale' | 'no-run-evidence';
        quality: PackageQualityFacts[];
    }>;
}
/** Re-reads every reference of an index and reports facts. Read-only; refusals (schema, containment) throw. */
export declare function inspectPackageIndex(rootDir: string, options: {
    index?: string;
    packages?: string[];
}, deps: PackageIndexDeps): PackageIndexInspection;
export declare function renderPackageIndexWrite(index: PackageIndex, indexPath: string): string;
export declare function renderPackageIndexInspection(inspection: PackageIndexInspection): string;
