import { type Attestation, type AttestationVerificationRecord } from '../../evidence-model/src/index';
/** Loading and verifying the attestations that apply to a run; shared by projections and authorization. */
export declare function verifyAttestationRecordAtRoot(rootDir: string, source: string, attestation: Attestation, trustedKeys: Record<string, string>): AttestationVerificationRecord;
export declare function attestationAppliesToRun(attestation: Attestation, runId: string): boolean;
export declare function attestationVerificationAppliesToRun(record: AttestationVerificationRecord, runId: string): boolean;
export declare function loadVerifiedAttestations(rootDir: string, attestationsDir: string, trustedKeysDir: string): {
    attestations: Attestation[];
    verification: AttestationVerificationRecord[];
};
