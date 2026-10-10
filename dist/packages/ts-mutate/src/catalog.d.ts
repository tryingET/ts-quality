import ts from 'typescript';
import { type ChangedRegion, type CoverageEvidence, type MutationSite } from '../../evidence-model/src/index';
export declare function isAmbientDeclaration(node: ts.Node): boolean;
/** Every valid mutation site in the file, before change-scope, coverage, target or budget selection. */
export declare function candidateMutationSites(sourceText: string, filePath: string): MutationSite[];
export interface ScopeContext {
    changed: Set<string>;
    changedRegions: ChangedRegion[];
    coverage: CoverageEvidence[];
    coveredOnly: boolean;
}
/** Why an in-scope file's site is not eligible: outside the changed hunks or, with coveredOnly, without covered LCOV evidence. */
export declare function eligibilityExclusion(site: MutationSite, context: ScopeContext): 'outside-changed-hunks' | 'uncovered' | undefined;
export declare function inChangedScope(filePath: string, changed: Set<string>): boolean;
export declare function discoverMutationSites(sourceText: string, filePath: string, coverage?: CoverageEvidence[], changedFiles?: string[], changedRegions?: ChangedRegion[], coveredOnly?: boolean): MutationSite[];
