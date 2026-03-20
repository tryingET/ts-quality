import { type Agent, type AmendmentDecision, type AmendmentProposal, type Attestation, type AuthorizationDecision, type ConstitutionRule, type OverrideRecord, type RunArtifact } from '../../evidence-model/src/index';
export interface ChangeBundle {
    version: '1';
    kind: 'change-bundle';
    action: string;
    agentId: string;
    runId: string;
    createdAt: string;
    changedFiles: string[];
    fileDigests: Record<string, string>;
    runDigest: string;
}
export declare function parseAttestationRecord(value: unknown): {
    ok: true;
    attestation: Attestation;
} | {
    ok: false;
    reason: string;
};
export declare function generateKeyPair(): {
    publicKeyPem: string;
    privateKeyPem: string;
};
export declare function signAttestation(subject: {
    subjectType: string;
    subjectDigest: string;
    issuer: string;
    claims: string[];
    payload?: Record<string, unknown>;
    keyId: string;
    privateKeyPem: string;
    issuedAt?: string;
}): Attestation;
export declare function verifyAttestation(attestation: Attestation, trustedKeys: Record<string, string>): {
    ok: boolean;
    reason: string;
};
export declare function loadTrustedKeys(keyDir: string): Record<string, string>;
export declare function buildChangeBundle(rootDir: string, run: RunArtifact, agentId: string, action: string): ChangeBundle;
export declare function authorizeChange(agentId: string, action: string, bundle: ChangeBundle, run: RunArtifact, agents: Agent[], constitution: ConstitutionRule[], attestations: Attestation[], overrides: OverrideRecord[]): AuthorizationDecision;
export declare function evaluateAmendment(proposal: AmendmentProposal, constitution: ConstitutionRule[], agents: Agent[]): AmendmentDecision;
export declare function applyAmendment(proposal: AmendmentProposal, constitution: ConstitutionRule[]): ConstitutionRule[];
export declare function saveAttestation(filePath: string, attestation: Attestation): void;
