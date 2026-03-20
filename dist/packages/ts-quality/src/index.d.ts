import { type Attestation, type AttestationVerificationRecord, type RunArtifact } from '../../evidence-model/src/index';
export interface CheckResult {
    run: RunArtifact;
    artifactDir: string;
}
export interface MaterializeResult {
    configPath: string;
    outDir: string;
    files: string[];
}
export declare function materializeProject(rootDir: string, options?: {
    configPath?: string;
    outDir?: string;
}): MaterializeResult;
export declare function loadVerifiedAttestations(rootDir: string, attestationsDir: string, trustedKeysDir: string): {
    attestations: Attestation[];
    verification: AttestationVerificationRecord[];
};
export declare function runCheck(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    runId?: string;
}): CheckResult;
export declare function initProject(rootDir: string): void;
export declare function renderLatestReport(rootDir: string, format: 'markdown' | 'json'): string;
export declare function renderLatestExplain(rootDir: string): string;
export declare function renderTrend(rootDir: string): string;
export declare function renderGovernance(rootDir: string, options?: {
    configPath?: string;
}): string;
export declare function renderPlan(rootDir: string, options?: {
    configPath?: string;
}): string;
export declare function runAuthorize(rootDir: string, agentId: string, action: string, options?: {
    configPath?: string;
}): {
    decisionPath: string;
    output: string;
};
export declare function attestSign(rootDir: string, issuer: string, keyId: string, privateKeyPath: string, subjectFile: string, claims: string[], outputPath: string): string;
export declare function attestVerify(rootDir: string, attestationFile: string, trustedKeysDir: string, format?: 'text' | 'json'): string;
export declare function attestGenerateKey(outDir: string, keyId: string): string;
export declare function runAmend(rootDir: string, proposalFile: string, apply?: boolean, options?: {
    configPath?: string;
}): string;
