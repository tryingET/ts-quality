import ts from 'typescript';
export type Severity = 'info' | 'warn' | 'error';
export type Outcome = 'pass' | 'warn' | 'fail';
export interface LineSpan {
    startLine: number;
    endLine: number;
}
export interface RepositoryEntity {
    rootDir: string;
    name: string;
    packages: PackageEntity[];
    digest: string;
}
export interface PackageEntity {
    name: string;
    dir: string;
}
export interface FileEntity {
    filePath: string;
    digest: string;
    packageName?: string | undefined;
}
export interface SymbolEntity {
    filePath: string;
    symbol: string;
    kind: string;
    span: LineSpan;
}
export interface ChangedRegion {
    filePath: string;
    hunkId: string;
    span: LineSpan;
}
export interface CoverageEvidence {
    kind: 'coverage';
    filePath: string;
    lines: Record<string, number>;
    coveredLines: number;
    totalLines: number;
    pct: number;
    source?: string | undefined;
}
export interface ComplexityEvidence {
    kind: 'complexity';
    filePath: string;
    symbol: string;
    span: LineSpan;
    complexity: number;
    coveragePct: number;
    crap: number;
    changed: boolean;
}
export interface MutationSite {
    id: string;
    filePath: string;
    span: LineSpan;
    startOffset: number;
    endOffset: number;
    operator: string;
    original: string;
    replacement: string;
    description: string;
}
export type MutationStatus = 'killed' | 'survived' | 'skipped' | 'invalid' | 'error';
export interface MutationResult {
    kind: 'mutation-result';
    siteId: string;
    filePath: string;
    status: MutationStatus;
    durationMs: number;
    details?: string | undefined;
}
export interface InvariantSpec {
    id: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    selectors: string[];
    domains?: string[] | undefined;
    scenarios: InvariantScenario[];
    requiredTestPatterns?: string[] | undefined;
}
export interface InvariantScenario {
    id: string;
    description: string;
    keywords: string[];
    failurePathKeywords?: string[] | undefined;
    expected: string;
}
export interface InvariantChangedFunctionSummary {
    filePath: string;
    symbol: string;
    coveragePct: number;
    crap: number;
}
export interface InvariantScenarioResult {
    scenarioId: string;
    description: string;
    expected: string;
    keywordsMatched: boolean;
    failurePathKeywordsMatched: boolean;
    supported: boolean;
}
export type InvariantEvidenceSignalId = 'focused-test-alignment' | 'scenario-support' | 'coverage-pressure' | 'mutation-pressure' | 'changed-function-pressure';
export type InvariantEvidenceSignalLevel = 'clear' | 'warning' | 'missing' | 'info';
export type InvariantEvidenceMode = 'explicit' | 'inferred' | 'missing';
export interface InvariantEvidenceSubSignal {
    signalId: InvariantEvidenceSignalId;
    label: string;
    level: InvariantEvidenceSignalLevel;
    mode: InvariantEvidenceMode;
    modeReason: string;
    summary: string;
    facts: string[];
}
export interface InvariantEvidenceSummary {
    invariantId: string;
    impactedFiles: string[];
    focusedTests: string[];
    changedFunctions: InvariantChangedFunctionSummary[];
    changedFunctionsUnder80Coverage: number;
    maxChangedCrap: number;
    mutationSitesInScope: number;
    killedMutantsInScope: number;
    survivingMutantsInScope: number;
    scenarioResults: InvariantScenarioResult[];
    subSignals: InvariantEvidenceSubSignal[];
}
export interface BehaviorClaim {
    id: string;
    invariantId: string;
    description: string;
    status: 'supported' | 'unsupported' | 'at-risk';
    evidence: string[];
    obligations: TestObligation[];
    evidenceSummary?: InvariantEvidenceSummary | undefined;
}
export interface TestObligation {
    id: string;
    invariantId: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    scenarioId: string;
    fileHints: string[];
}
export interface PolicyFinding {
    id: string;
    code: string;
    level: Severity;
    message: string;
    scope: string[];
    evidence: string[];
    ruleId?: string | undefined;
    waived?: boolean | undefined;
    waiverId?: string | undefined;
}
export interface Waiver {
    id: string;
    ruleId: string;
    scope: string[];
    owner: string;
    reason: string;
    createdAt: string;
    expiresAt?: string | undefined;
}
export type ConstitutionRule = BoundaryRule | OwnershipRule | RiskBudgetRule | ApprovalRule | RollbackRule;
export interface BoundaryRule {
    kind: 'boundary';
    id: string;
    from: string[];
    to: string[];
    mode: 'forbid';
    severity?: Severity | undefined;
    message: string;
}
export interface OwnershipRule {
    kind: 'ownership';
    id: string;
    owner: string;
    paths: string[];
    severity?: Severity | undefined;
    message: string;
    allowedAgents?: string[] | undefined;
}
export interface RiskBudgetRule {
    kind: 'risk';
    id: string;
    paths: string[];
    severity?: Severity | undefined;
    message: string;
    maxCrap?: number | undefined;
    minMutationScore?: number | undefined;
    minMergeConfidence?: number | undefined;
}
export interface ApprovalRule {
    kind: 'approval';
    id: string;
    paths: string[];
    severity?: Severity | undefined;
    message: string;
    minApprovals: number;
    roles: string[];
}
export interface RollbackRule {
    kind: 'rollback';
    id: string;
    paths: string[];
    severity?: Severity | undefined;
    message: string;
    requireEvidence: string[];
}
export interface GovernanceFinding {
    id: string;
    ruleId: string;
    level: Severity;
    message: string;
    evidence: string[];
    scope: string[];
}
export interface OwnershipBoundary {
    owner: string;
    paths: string[];
}
export interface AuthorityGrant {
    id: string;
    actions: string[];
    paths: string[];
    denyPaths?: string[] | undefined;
    minMergeConfidence?: number | undefined;
    requireAttestations?: string[];
    requireHumanReview?: boolean;
}
export interface Agent {
    id: string;
    kind: 'human' | 'automation' | 'service';
    roles: string[];
    standing?: string[] | undefined;
    grants: AuthorityGrant[];
    publicKeys?: string[] | undefined;
}
export interface LicenseGrant {
    agentId: string;
    grantId: string;
    actions: string[];
    paths: string[];
}
export interface Attestation {
    version: '1';
    kind: 'attestation';
    issuer: string;
    subjectType: string;
    subjectDigest: string;
    claims: string[];
    issuedAt: string;
    payload?: Record<string, unknown> | undefined;
    signature: {
        algorithm: 'ed25519';
        keyId: string;
        value: string;
    };
}
export interface Approval {
    by: string;
    role?: string | undefined;
    standing?: string | undefined;
    rationale: string;
    createdAt: string;
    targetId: string;
}
export interface OverrideRecord extends Approval {
    kind: 'override';
}
export interface AuthorizationEvidenceArtifactPaths {
    run: string;
    verdict: string;
    governance: string;
    bundle: string;
}
export interface AuthorizationRiskyInvariantSummary {
    invariantId: string;
    description: string;
    evidenceProvenance: {
        explicit: number;
        inferred: number;
        missing: number;
    };
    signals: Array<Pick<InvariantEvidenceSubSignal, 'signalId' | 'label' | 'level' | 'mode' | 'summary'>>;
    obligation?: string | undefined;
}
export interface AuthorizationEvidenceContext {
    runId: string;
    runOutcome: Outcome;
    mergeConfidence: number;
    bestNextAction?: string | undefined;
    artifactPaths: AuthorizationEvidenceArtifactPaths;
    governanceErrors: Array<Pick<GovernanceFinding, 'ruleId' | 'message' | 'evidence' | 'scope'>>;
    riskyInvariant?: AuthorizationRiskyInvariantSummary | undefined;
}
export interface AuthorizationDecision {
    id: string;
    agentId: string;
    action: string;
    outcome: 'approve' | 'deny' | 'narrow-scope' | 'request-more-proof' | 'require-human-approver';
    reasons: string[];
    scope: string[];
    missingProof: string[];
    requiredApprovers: string[];
    consideredAttestations: string[];
    overrideUsed?: string | undefined;
    evidenceContext?: AuthorizationEvidenceContext | undefined;
}
export interface AmendmentProposal {
    id: string;
    title: string;
    rationale: string;
    evidence: string[];
    changes: Array<{
        action: 'add' | 'remove' | 'replace';
        ruleId: string;
        rule?: ConstitutionRule;
    }>;
    approvals: Approval[];
}
export interface AmendmentDecision {
    proposalId: string;
    outcome: 'approved' | 'denied' | 'needs-approvals';
    reasons: string[];
    approvalsAccepted: string[];
    requiredApprovals: number;
}
export interface TrendDelta {
    previousRunId?: string | undefined;
    mergeConfidenceDelta: number;
    survivingMutantDelta: number;
    hotspotDelta: number;
}
export interface ExecutionReceipt {
    status: 'pass' | 'fail' | 'error' | 'timeout';
    exitCode?: number | undefined;
    durationMs: number;
    details: string;
}
export interface AnalysisContext {
    runId: string;
    createdAt: string;
    sourceFiles: string[];
    changedFiles: string[];
    changedRegions: ChangedRegion[];
    executionFingerprint: string;
}
export interface Verdict {
    mergeConfidence: number;
    outcome: Outcome;
    reasons: string[];
    warnings: string[];
    blockedBy: string[];
    bestNextAction?: string | undefined;
    findings: PolicyFinding[];
}
export interface RunArtifact {
    version: '5.0.0';
    runId: string;
    createdAt: string;
    repo: RepositoryEntity;
    changedFiles: string[];
    changedRegions: ChangedRegion[];
    analysis?: AnalysisContext | undefined;
    files: FileEntity[];
    symbols: SymbolEntity[];
    coverage: CoverageEvidence[];
    complexity: ComplexityEvidence[];
    mutationSites: MutationSite[];
    mutations: MutationResult[];
    mutationBaseline?: ExecutionReceipt | undefined;
    invariants: InvariantSpec[];
    behaviorClaims: BehaviorClaim[];
    governance: GovernanceFinding[];
    attestations: Attestation[];
    approvals: Approval[];
    overrides: OverrideRecord[];
    verdict: Verdict;
    trend?: TrendDelta | undefined;
}
export interface LatestPointer {
    latestRunId: string;
}
export declare const DEFAULT_SOURCE_PATTERNS: string[];
export declare const DEFAULT_TEST_PATTERNS: readonly ["test/**/*.js", "test/**/*.mjs", "test/**/*.cjs", "test/**/*.ts", "test/**/*.tsx", "tests/**/*.js", "tests/**/*.mjs", "tests/**/*.cjs", "tests/**/*.ts", "tests/**/*.tsx", "**/*.test.js", "**/*.test.mjs", "**/*.test.cjs", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.js", "**/*.spec.mjs", "**/*.spec.cjs", "**/*.spec.ts", "**/*.spec.tsx"];
export declare function resolveRepoLocalPath(rootDir: string, candidate: string, options?: {
    allowMissing?: boolean;
    kind?: string;
}): {
    absolutePath: string;
    relativePath: string;
};
export declare function compilerOptionsForRepoFile(rootDir: string, filePath: string): ReturnType<typeof ts.parseJsonConfigFileContent>['options'] | undefined;
export declare function resolveRepoImport(rootDir: string, importerPath: string, specifier: string): string | undefined;
export declare function runtimeMirrorCandidates(sourcePath: string, mirrorRoots?: string[]): string[];
export declare function normalizePath(value: string): string;
export declare function createRunId(date?: Date): string;
export declare function assertSafeRunId(runId: string): string;
export declare function ensureDir(dirPath: string): void;
export declare function stableSortKeys<T>(value: T): T;
export declare function stableStringify(value: unknown): string;
export declare function sha256Hex(input: string | Uint8Array): string;
export declare function digestObject(value: unknown): string;
export declare function readText(filePath: string): string;
export declare function writeText(filePath: string, contents: string): void;
export declare function readJson<T>(filePath: string): T;
export declare function writeJson(filePath: string, value: unknown): void;
export declare function fileDigest(filePath: string): string;
export declare function listFiles(rootDir: string, options?: {
    include?: RegExp;
    excludeDirs?: string[];
}): string[];
export declare function collectSourceFiles(rootDir: string, patterns?: string[]): string[];
export declare function globToRegExp(pattern: string): RegExp;
export declare function matchPattern(pattern: string, value: string): boolean;
export declare function matchesAny(patterns: string[], value: string): boolean;
export declare function findCoverageEvidence(filePath: string, coverage: CoverageEvidence[]): CoverageEvidence | undefined;
export declare function repoDigest(rootDir: string, filePaths: string[]): string;
export declare function inferPackages(rootDir: string): PackageEntity[];
export declare function resolvePackageName(filePath: string, packages: PackageEntity[]): string | undefined;
export declare function buildRepositoryEntity(rootDir: string, filePaths: string[]): RepositoryEntity;
export declare function loadOptionalJsonArray<T>(filePath: string): T[];
export declare function isWaiverActive(waiver: Waiver, nowIso: string): boolean;
export declare function isFindingWaived(finding: PolicyFinding, waivers: Waiver[], nowIso: string): Waiver | undefined;
export declare function parseUnifiedDiff(diffText: string): ChangedRegion[];
export declare function writeRunArtifact(rootDir: string, run: RunArtifact): string;
export declare function readLatestRun(rootDir: string): RunArtifact;
export declare function listRunIds(rootDir: string): string[];
export declare function loadRun(rootDir: string, runId: string): RunArtifact;
export declare function readMaybe<T>(filePath: string): T | undefined;
export declare function clamp(value: number, minimum: number, maximum: number): number;
export declare function nowIso(): string;
export declare function summarizeMutationScore(results: MutationResult[]): {
    killed: number;
    survived: number;
    score: number;
};
export declare function changedFileSet(changedFiles: string[], changedRegions: ChangedRegion[]): Set<string>;
export declare function spanOverlaps(line: number, span: LineSpan): boolean;
