import { type ChangedRegion, type CoverageEvidence, type FunctionSpan, type MutationSelectionLedger, type MutationSite, type MutationTarget } from '../../evidence-model/src/index';
/** Explicit mutation targets and the inert selection ledger: discovered, eligible, selected and excluded sites. */
export interface MutationSelection {
    sites: MutationSite[];
    ledger: MutationSelectionLedger;
}
export interface MutationSelectionOptions {
    repoRoot: string;
    sourceFiles?: string[];
    changedFiles?: string[];
    changedRegions?: ChangedRegion[];
    coverage?: CoverageEvidence[];
    coveredOnly?: boolean;
    targets?: MutationTarget[];
    functions?: FunctionSpan[];
    maxSites?: number;
    maxDurationMs?: number;
}
export declare function parseMutationTarget(spec: string): MutationTarget;
/**
 * Inert mutation selection: discovers, filters and budgets sites and records why each was or was not selected.
 * Runs no command and writes nothing.
 */
export declare function selectMutationSites(options: MutationSelectionOptions): MutationSelection;
