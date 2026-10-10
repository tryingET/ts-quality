import type { BehaviorClaim, ChangedRegion, ComplexityEvidence, CoverageEvidence, ExecutionWitnessBinding, FileEntity, InvariantSpec, LineSpan, MutationResult, MutationSelectionLedger, MutationSite, Outcome, RepositoryEntity, SymbolEntity } from './types-core';
import type { Agent, Approval, Attestation, ConstitutionRule, GovernanceFinding, OverrideRecord, PolicyFinding } from './types-governance';
/** Run artifact types: receipts, witness runs, analysis, evidence closure, verdicts, control-plane snapshots and the run packet. */
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
export interface ExecutionWitnessReceiptArtifact {
    binding?: ExecutionWitnessBinding | undefined;
    version: '1';
    kind: 'execution-witness-receipt';
    invariantId: string;
    scenarioId: string;
    witnessPath: string;
    command: string[];
    sourceFiles: string[];
    testFiles?: string[] | undefined;
    observedAt?: string | undefined;
    receipt: ExecutionReceipt;
}
export interface ExecutionWitnessRunRecord {
    invariantId: string;
    scenarioId: string;
    outputPath: string;
    receiptPath: string;
    command: string[];
    sourceFiles: string[];
    testFiles?: string[] | undefined;
    observedAt?: string | undefined;
    receipt: ExecutionReceipt;
}
export interface ExecutionWitnessSkippedRecord {
    invariantId: string;
    scenarioId: string;
    outputPath: string;
    command: string[];
    testFiles?: string[] | undefined;
    reason: 'invariant-not-impacted';
}
export interface ExecutionWitnessRunSummary {
    autoRan: ExecutionWitnessRunRecord[];
    skipped: ExecutionWitnessSkippedRecord[];
}
export interface CoverageGenerationRecord {
    lcovPath: string;
    command: string[];
    attemptedAt: string;
    receipt: ExecutionReceipt;
}
export interface AnalysisWarning {
    code: string;
    message: string;
    changedFile?: string | undefined;
    evidence: string[];
    hint?: string | undefined;
}
export interface MutationRemediationSurvivor {
    filePath: string;
    siteId: string;
    span?: LineSpan | undefined;
    operator?: string | undefined;
    original?: string | undefined;
    mutated?: string | undefined;
    replacement?: string | undefined;
    testCommand?: string[] | undefined;
    assertionHint?: string | undefined;
    observableBehavior?: string | undefined;
    assertionStrategy?: string | undefined;
    maskingRisk?: string | undefined;
}
export interface MutationRemediation {
    survivors: MutationRemediationSurvivor[];
}
export interface ConfidenceContribution {
    id: string;
    label: string;
    amount: number;
    details: string[];
}
export interface ConfidenceBreakdown {
    base: number;
    penalties: ConfidenceContribution[];
    credits: ConfidenceContribution[];
    final: number;
}
export interface EvidenceClosureCommand {
    command: string[];
    reason: string;
    cwd?: string | undefined;
}
export interface EvidenceClosureStep {
    id: string;
    title: string;
    rationale: string;
    targetFiles: string[];
    suggestedEditFiles: string[];
    evidenceTargets: string[];
    commands: EvidenceClosureCommand[];
    artifactPaths: Record<string, string>;
    enclosingSymbol?: string | undefined;
    observableBehavior?: string | undefined;
    assertionStrategy?: string | undefined;
    maskingRisk?: string | undefined;
}
export interface EvidenceClosureGroup {
    id: string;
    title: string;
    survivorCount?: number | undefined;
    targetFiles: string[];
    suggestedEditFiles: string[];
    evidenceTargets: string[];
    stepIds: string[];
}
export type EvidenceClosureSufficiencyLevel = 'bounded' | 'actionable' | 'turnkey' | 'misleading';
export interface EvidenceClosureSufficiency {
    level: EvidenceClosureSufficiencyLevel;
    reasons: string[];
}
export interface EvidenceClosureTaskManifest {
    title: string;
    allowedPaths: string[];
    requiredPaths: string[];
    commands: EvidenceClosureCommand[];
    completionCriteria: string[];
    guidance?: string[] | undefined;
    sidecarSufficiency?: EvidenceClosureSufficiency | undefined;
}
export interface EvidenceClosurePrimaryAction {
    id: string;
    kind: 'mutation-survivors' | 'mutation-baseline' | 'mutation-missing' | 'governance' | 'coverage' | 'witness' | 'analysis-warning' | 'none';
    title: string;
    sidecarSufficiency?: EvidenceClosureSufficiency | undefined;
    rationale: string;
    expectedConfidenceLift?: number | undefined;
    targetFiles: string[];
    suggestedEditFiles: string[];
    evidenceTargets: string[];
    commands: EvidenceClosureCommand[];
    artifactPaths: Record<string, string>;
    completionCriteria: string[];
    steps: EvidenceClosureStep[];
    groups: EvidenceClosureGroup[];
    taskManifest: EvidenceClosureTaskManifest;
}
export interface EvidenceBasisSummary {
    coverage: {
        status: string;
        fileCount: number;
        minPct?: number | undefined;
        changedFunctionMinPct?: number | undefined;
        changedFunctionsUnder80: number;
        lcovPath?: string | undefined;
    };
    mutation: {
        status: string;
        sites: number;
        killed: number;
        survived: number;
        errors: number;
    };
    witness: {
        status: string;
        executionWitnessFiles: string[];
    };
    governance: {
        status: string;
        errors: number;
        warnings: number;
    };
    confidence: {
        base?: number | undefined;
        penalties: ConfidenceContribution[];
        credits: ConfidenceContribution[];
        final: number;
    };
    nonBlockingSignals: string[];
}
export interface AuthorizationEvidenceClosureSummary {
    kind: EvidenceClosurePrimaryAction['kind'];
    title: string;
    expectedConfidenceLift?: number | undefined;
    artifactPaths: Record<string, string>;
}
export interface NextEvidenceAction {
    primaryAction: EvidenceClosurePrimaryAction;
    evidenceBasis: EvidenceBasisSummary;
}
export interface AnalysisContext {
    runId: string;
    createdAt: string;
    configPath?: string | undefined;
    coverageLcovPath?: string | undefined;
    runtimeMirrorRoots?: string[] | undefined;
    sourceFiles: string[];
    changedFiles: string[];
    changedRegions: ChangedRegion[];
    executionFingerprint: string;
}
export declare const CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION = 1;
export interface ControlPlaneSnapshot {
    schemaVersion: typeof CONTROL_PLANE_SNAPSHOT_SCHEMA_VERSION;
    configPath: string;
    configDigest: string;
    policy: {
        maxChangedCrap: number;
        minMutationScore: number;
        minMergeConfidence: number;
    };
    constitutionPath: string;
    constitutionDigest: string;
    constitution: ConstitutionRule[];
    agentsPath: string;
    agentsDigest: string;
    agents: Agent[];
    approvalsPath: string;
    waiversPath: string;
    overridesPath: string;
    attestationsDir: string;
    trustedKeysDir: string;
}
export interface Verdict {
    mergeConfidence: number;
    outcome: Outcome;
    reasons: string[];
    warnings: string[];
    blockedBy: string[];
    bestNextAction?: string | undefined;
    confidenceBreakdown?: ConfidenceBreakdown | undefined;
    findings: PolicyFinding[];
}
export interface RunArtifact {
    version: '0.2.0' | '0.1.0';
    runId: string;
    createdAt: string;
    repo: RepositoryEntity;
    changedFiles: string[];
    changedRegions: ChangedRegion[];
    changedFileDigests?: Record<string, string> | undefined;
    analysis?: AnalysisContext | undefined;
    controlPlane?: ControlPlaneSnapshot | undefined;
    executionWitnesses?: ExecutionWitnessRunSummary | undefined;
    coverageGeneration?: CoverageGenerationRecord | undefined;
    analysisWarnings?: AnalysisWarning[] | undefined;
    mutationRemediation?: MutationRemediation | undefined;
    nextEvidenceAction?: NextEvidenceAction | undefined;
    files: FileEntity[];
    symbols: SymbolEntity[];
    coverage: CoverageEvidence[];
    complexity: ComplexityEvidence[];
    mutationSites: MutationSite[];
    mutations: MutationResult[];
    mutationBaseline?: ExecutionReceipt | undefined;
    /** Per-site selection ledger: discovered, eligible, selected, excluded and observed sites for this run. */
    mutationSelection?: MutationSelectionLedger | undefined;
    /** The fixed context mutation outcomes were observed in; intervention lineage compares it between runs. */
    mutationContext?: MutationExecutionContext | undefined;
    invariants: InvariantSpec[];
    behaviorClaims: BehaviorClaim[];
    governance: GovernanceFinding[];
    attestations: Attestation[];
    approvals: Approval[];
    overrides: OverrideRecord[];
    verdict: Verdict;
    trend?: TrendDelta | undefined;
}
export interface MutationExecutionContext {
    version: '1';
    testCommand: string[];
    timeoutMs: number;
    runtime: {
        node: string;
        platform: string;
        arch: string;
    };
    /** Digest of the sanitized environment mutation commands ran with. */
    environmentDigest: string;
    /** Digests of every file matching testPatterns at check time. */
    testFileDigests: Record<string, string>;
    /** Digests of the root package manifest and lockfiles that exist. */
    dependencyDigests: Record<string, string>;
    /** One digest over every non-test repository file outside hidden directories (sources, fixtures, config). */
    nonTestFilesDigest: string;
    tool: {
        tsQuality: string;
    };
}
export interface LatestPointer {
    latestRunId: string;
}
