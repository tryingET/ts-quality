import { ChangedRegion, CoverageEvidence, LineSpan, MutationResult, PackageEntity, RepositoryEntity } from './types-core';
import { PolicyFinding, Waiver } from './types-governance';
/** Source and test discovery, glob matching, coverage lookup, package inference, waivers and unified diffs. */
export declare const DEFAULT_SOURCE_PATTERNS: string[];
export declare const DEFAULT_TEST_PATTERNS: readonly ["test/**/*.js", "test/**/*.mjs", "test/**/*.cjs", "test/**/*.ts", "test/**/*.tsx", "tests/**/*.js", "tests/**/*.mjs", "tests/**/*.cjs", "tests/**/*.ts", "tests/**/*.tsx", "**/*.test.js", "**/*.test.mjs", "**/*.test.cjs", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.js", "**/*.spec.mjs", "**/*.spec.cjs", "**/*.spec.ts", "**/*.spec.tsx"];
export declare function listFiles(rootDir: string, options?: {
    include?: RegExp;
    excludeDirs?: string[];
}): string[];
/**
 * Pattern match for source/test discovery. Hidden directories (.next, .turbo, .cache, generated snapshots such as
 * .ontology/snapshots) hold tool state rather than repository code, so a broad pattern like `**\/*.test.ts` must not
 * reach into them; a pattern that names a hidden directory explicitly (for example `.storybook/**`) still does.
 */
export declare function matchesDiscoveryPattern(pattern: string, filePath: string): boolean;
export declare function collectSourceFiles(rootDir: string, patterns?: string[]): string[];
export declare function globToRegExp(pattern: string): RegExp;
export declare function matchPattern(pattern: string, value: string): boolean;
export declare function matchesAny(patterns: string[], value: string): boolean;
export interface CoverageResolution {
    match: 'exact' | 'suffix' | 'missing' | 'ambiguous';
    evidence?: CoverageEvidence | undefined;
    candidates?: string[] | undefined;
}
export declare function resolveCoverageEvidence(filePath: string, coverage: CoverageEvidence[]): CoverageResolution;
export declare function findCoverageEvidence(filePath: string, coverage: CoverageEvidence[]): CoverageEvidence | undefined;
export declare function repoDigest(rootDir: string, filePaths: string[]): string;
export declare function inferPackages(rootDir: string): PackageEntity[];
export declare function resolvePackageName(filePath: string, packages: PackageEntity[]): string | undefined;
export declare function buildRepositoryEntity(rootDir: string, filePaths: string[]): RepositoryEntity;
export declare function loadOptionalJsonArray<T>(filePath: string): T[];
export declare function isWaiverActive(waiver: Waiver, nowIso: string): boolean;
export declare function isFindingWaived(finding: PolicyFinding, waivers: Waiver[], nowIso: string): Waiver | undefined;
export declare function parseUnifiedDiff(diffText: string): ChangedRegion[];
export declare function summarizeMutationScore(results: MutationResult[]): {
    killed: number;
    survived: number;
    total: number;
    measured: boolean;
    score: number;
};
export declare function changedFileSet(changedFiles: string[], changedRegions: ChangedRegion[]): Set<string>;
export declare function spanOverlaps(line: number, span: LineSpan): boolean;
