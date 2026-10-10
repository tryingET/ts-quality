import { type PackageIndex, type PackageIndexInspection } from './package-index';
import { RunDecisionOptions } from './run-context';
/** Read-only projections of persisted runs: report, explain, navigation, plan, governance and the package index wrappers. */
export declare function renderLatestReport(rootDir: string, format: 'markdown' | 'json', options?: RunDecisionOptions): string;
export declare function renderLatestExplain(rootDir: string, options?: RunDecisionOptions): string;
/**
 * Derived navigation for one run: a versioned blocking summary and action queue, optional intervention lineage
 * against an earlier run and optional Git facts pinned to a horizon. Read-only: it writes nothing and runs no test.
 */
export declare function renderNavigation(rootDir: string, options: {
    runId?: string;
    interventionFrom?: string;
    interventionTests?: string[];
    gitHorizon?: string;
    json?: boolean;
}): string;
/**
 * Writes the package artifact-reference index: discovered packages, the runs holding evidence for them and digests
 * of their canonical run packet files. References only; it copies no verdict and claims no coverage.
 */
export declare function writePackageIndexFile(rootDir: string, options: {
    packages?: string[];
    all?: boolean;
    runIds?: string[];
    out?: string;
}): {
    index: PackageIndex;
    indexPath: string;
    output: string;
};
/** Re-reads every reference of a package index and reports facts (fresh/changed/missing, source drift, findings). */
export declare function inspectPackageIndexFile(rootDir: string, options: {
    index?: string;
    packages?: string[];
}): PackageIndexInspection;
export declare function renderPackageIndexInspectionFile(rootDir: string, options: {
    index?: string;
    packages?: string[];
    json?: boolean;
}): string;
export declare function renderGovernance(rootDir: string, options?: RunDecisionOptions): string;
export declare function renderPlan(rootDir: string, options?: RunDecisionOptions): string;
