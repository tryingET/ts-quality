import type { InvariantEvidenceSemantics, InvariantEvidenceSubSignal, Outcome, Severity } from './types-core';
import type { AuthorizationEvidenceClosureSummary } from './types-run';
/** Policy, governance, legitimacy, authorization and amendment types. */
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
export interface AttestationVerificationRecord {
    version: '1';
    source: string;
    issuer?: string | undefined;
    ok: boolean;
    reason: string;
    subjectFile?: string | undefined;
    runId?: string | undefined;
    artifactName?: string | undefined;
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
    evidenceSemantics?: InvariantEvidenceSemantics | undefined;
    evidenceSemanticsSummary?: string | undefined;
    evidenceProvenance: {
        explicit: number;
        inferred: number;
        missing: number;
    };
    signals: Array<Pick<InvariantEvidenceSubSignal, 'signalId' | 'label' | 'level' | 'mode' | 'summary'>>;
    obligation?: string | undefined;
}
export interface AuthorizationAttestationVerificationSummary {
    verifiedCount: number;
    failedCount: number;
    records: AttestationVerificationRecord[];
}
export interface AuthorizationEvidenceContext {
    runId: string;
    runOutcome: Outcome;
    mergeConfidence: number;
    bestNextAction?: string | undefined;
    artifactPaths: AuthorizationEvidenceArtifactPaths;
    evidenceClosure?: AuthorizationEvidenceClosureSummary | undefined;
    governanceErrors: Array<Pick<GovernanceFinding, 'ruleId' | 'message' | 'evidence' | 'scope'>>;
    attestationVerification?: AuthorizationAttestationVerificationSummary | undefined;
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
export type AmendmentDecisionApprovalBurdenBasis = 'standard-rule-change' | 'sensitive-rule-change';
export interface AmendmentDecisionChangeContext {
    action: string;
    ruleId: string;
    currentRuleKind?: ConstitutionRule['kind'] | undefined;
    proposedRuleKind?: ConstitutionRule['kind'] | undefined;
    sensitivity: 'standard' | 'sensitive';
}
export interface AmendmentDecisionProposalContext {
    title: string;
    rationale: string;
    evidence: string[];
    changes: AmendmentDecisionChangeContext[];
    approvalBurdenBasis: AmendmentDecisionApprovalBurdenBasis;
    sensitiveRuleIds: string[];
}
export interface AmendmentDecision {
    proposalId: string;
    outcome: 'approved' | 'denied' | 'needs-approvals';
    reasons: string[];
    approvalsAccepted: string[];
    requiredApprovals: number;
    proposalContext?: AmendmentDecisionProposalContext | undefined;
}
