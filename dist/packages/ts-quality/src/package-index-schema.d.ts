/**
 * Package artifact-reference index schema: the versioned shapes, the path rules every reference obeys, and the strict
 * reader for an untrusted index. The writer and inspector live in package-index.ts.
 */
export declare const PACKAGE_INDEX_KIND = "ts-quality-package-index";
export declare const PACKAGE_INDEX_SCHEMA_VERSION = 1;
export declare const PACKAGE_INDEX_INSPECTION_KIND = "ts-quality-package-index-inspection";
export declare const DEFAULT_PACKAGE_INDEX_PATH = ".ts-quality/package-index.json";
export interface PackageIndexFileRef {
    path: string;
    sha256: string;
    bytes: number;
}
export interface PackageIndexRun {
    runId: string;
    selection: 'explicit' | 'latest-pointer';
    createdAt: string;
    runVersion: string;
    changedFiles: string[];
    artifacts: PackageIndexFileRef[];
}
export interface PackageIndexEvidence {
    runId: string;
    changedFiles: string[];
}
export interface PackageIndexPackage {
    path: string;
    name: string | null;
    manifest: PackageIndexFileRef;
    status: 'evidence-present' | 'no-run-evidence';
    evidence: PackageIndexEvidence[];
}
export interface PackageIndex {
    kind: typeof PACKAGE_INDEX_KIND;
    schemaVersion: typeof PACKAGE_INDEX_SCHEMA_VERSION;
    tool: {
        name: 'ts-quality';
        version: string;
    };
    authority: 'references-only';
    scope: {
        mode: 'all' | 'selected';
        discovery: 'package-json';
        packages: string[];
    };
    runs: PackageIndexRun[];
    packages: PackageIndexPackage[];
    outsideIndexedPackages: PackageIndexEvidence[];
    completeness: {
        packageCount: number;
        withEvidence: number;
        withoutEvidence: string[];
        complete: boolean;
        executedCoverageClaim: 'none';
    };
    upload: {
        root: '.';
        paths: string[];
    };
}
export declare function fail(message: string): never;
/** Code-unit order, independent of the process locale, so index bytes are identical everywhere. */
export declare function byCodeUnit(left: string, right: string): number;
/** A root-relative POSIX path with no traversal, no absolute form and no control characters. */
export declare function assertRelativeReference(candidate: unknown, kind: string): string;
export declare function manifestPath(packagePath: string): string;
/** Longest enclosing package wins; the root package '.' encloses every file. */
export declare function owningPackage(filePath: string, packages: string[]): string | undefined;
/**
 * Schema check for an untrusted index. Every known field is checked strictly and cross-checked (each run's changed
 * files are partitioned exactly once between packages and outsideIndexedPackages); unknown additive fields are ignored.
 */
export declare function parsePackageIndex(text: string, source: string): PackageIndex;
