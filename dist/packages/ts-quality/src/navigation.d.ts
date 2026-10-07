import { type RunArtifact } from '../../evidence-model/src/index';
/**
 * Derived, read-only navigation over one run: a versioned blocking summary and action queue, optional
 * intervention lineage against an earlier run, and optional Git facts. It never changes the run, the protected
 * nextEvidenceAction.primaryAction, or any decision; experiments are inert argv suggestions.
 */
export type NavigationClass = 'evidence-invalidity' | 'governance-veto' | 'legitimacy-denial' | 'behavioral-counterexample' | 'coverage-witness-insufficiency' | 'policy-burden' | 'context-suggestion';
type Severity = 'blocking' | 'warning' | 'info';
export interface NavigationExperiment {
    argv: string[];
    cwd: '.';
    inputs: string[];
    stopCriteria: string;
    executed: false;
}
export interface NavigationItem {
    class: NavigationClass;
    severity: Severity;
    scope: string[];
    identity: string;
    why: string;
    experiment?: NavigationExperiment | undefined;
    orderKey: [number, number, string, string];
}
export interface DriftFact {
    subject: string;
    expected: string;
    actual: string;
}
export interface AuthorizationFact {
    identity: string;
    outcome: string;
    reasons: string[];
}
export type LineageContextChange = 'test-deleted' | 'undeclared-test-change' | 'declared-test-unchanged' | 'source-changed' | 'support-file-changed' | 'config-changed' | 'tool-changed' | 'command-changed' | 'timeout-changed' | 'runtime-changed' | 'environment-changed' | 'dependency-changed' | 'policy-changed';
export interface LineageSite {
    siteId: string;
    filePath: string;
    line: number | null;
    original: string | null;
    replacement: string | null;
    status: 'observed-kill-after-declared-intervention' | 'killed-with-context-change' | 'still-survived' | 'unknown';
    reason?: 'no-execution-context' | 'outside-after-scope' | 'site-identity-missing' | 'not-selected-after' | 'no-verdict-after' | 'cached-after' | 'baseline-not-green-after' | undefined;
    contextChanges: LineageContextChange[];
    statement: string;
    clearsObligation: boolean;
}
export interface InterventionLineage {
    comparison: 'intervention-lineage';
    beforeRunId: string;
    afterRunId: string;
    declaredTests: string[];
    contextChanges: LineageContextChange[];
    sites: LineageSite[];
    clearsBroaderInvariants: false;
    note: string;
}
export interface GitFileFacts {
    filePath: string;
    commitsSinceHorizon: number;
    lastCommitAt: string | null;
    authorCount: number;
    uncommittedChanges: boolean;
    untracked: boolean;
    renamedFrom?: string | undefined;
}
export interface GitContext {
    available: boolean;
    reason?: 'git-unavailable' | 'not-a-git-repository' | 'horizon-not-in-history' | 'horizon-not-ancestor' | undefined;
    horizon: string;
    horizonCommit?: string | undefined;
    head?: string | undefined;
    shallow?: boolean | undefined;
    note: string;
    files: GitFileFacts[];
    hints: Array<{
        filePath: string;
        hint: 'uncommitted-changes' | 'high-churn' | 'renamed';
    }>;
}
export interface NavigationProjection {
    version: '1';
    kind: 'ts-quality-navigation';
    runId: string;
    derived: true;
    primaryAction: {
        kind: string;
        title: string;
        source: string;
    } | null;
    headline: {
        class: NavigationClass | 'none';
        identity: string;
        why: string;
    };
    orderingExplanation: string;
    queue: NavigationItem[];
    comparisons: Array<{
        type: 'cache-reuse' | 'aggregate-trend' | 'intervention-lineage';
        basis: string;
        claim: string;
    }>;
    lineage?: InterventionLineage | undefined;
    context?: {
        git: GitContext;
    } | undefined;
}
export declare function buildNavigation(input: {
    run: RunArtifact;
    drift: DriftFact[];
    authorizations: AuthorizationFact[];
    lineage?: InterventionLineage | undefined;
    git?: GitContext | undefined;
}): NavigationProjection;
/**
 * Compares an observed survivor in `before` with the same site in `after`. A site counts as cleared only when it
 * was freshly executed and killed behind a green baseline, its identity and source are unchanged, and the only
 * context change is an edit to the declared test files.
 */
export declare function compareInterventionLineage(before: RunArtifact, after: RunArtifact, declaredTests: string[]): InterventionLineage;
/** Read-only Git facts for the given files, pinned to an explicit ancestor commit. Facts, not evidence. */
export declare function collectGitContext(rootDir: string, horizon: string, files: string[]): GitContext;
export declare function renderNavigationText(nav: NavigationProjection): string;
export {};
