import { type Attestation, type AttestationVerificationRecord, type ExecutionReceipt, type ExecutionWitnessRecord, type ExecutionWitnessRunRecord, type ExecutionWitnessRunSummary, type ExecutionWitnessSkippedRecord, type RunArtifact } from '../../evidence-model/src/index';
export interface CheckResult {
    run: RunArtifact;
    artifactDir: string;
}
export interface MaterializeResult {
    configPath: string;
    outDir: string;
    files: string[];
}
interface RunSelectionOptions {
    runId?: string;
}
interface RunDecisionOptions extends RunSelectionOptions {
    configPath?: string;
}
export declare function materializeProject(rootDir: string, options?: {
    configPath?: string;
    outDir?: string;
}): MaterializeResult;
export declare function loadVerifiedAttestations(rootDir: string, attestationsDir: string, trustedKeysDir: string): {
    attestations: Attestation[];
    verification: AttestationVerificationRecord[];
};
export interface ExecutionWitnessRefreshResult extends ExecutionWitnessRunRecord {
}
export interface ExecutionWitnessRefreshSkipped extends ExecutionWitnessSkippedRecord {
}
export interface ExecutionWitnessRefreshSummary extends ExecutionWitnessRunSummary {
}
export declare function refreshExecutionWitnesses(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    observedAt?: string;
}): ExecutionWitnessRefreshSummary;
export declare function runCheck(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
    runId?: string;
}): CheckResult;
export type InitPreset = 'default' | 'node-test' | 'node-test-ts-dist' | 'vitest';
export declare function initProject(rootDir: string, options?: {
    preset?: InitPreset;
}): void;
export declare function renderDoctor(rootDir: string, options?: {
    changedFiles?: string[];
    configPath?: string;
}): string;
export declare function renderLatestReport(rootDir: string, format: 'markdown' | 'json', options?: RunDecisionOptions): string;
export declare function renderLatestExplain(rootDir: string, options?: RunDecisionOptions): string;
export declare function renderTrend(rootDir: string): string;
export declare function renderGovernance(rootDir: string, options?: RunDecisionOptions): string;
export declare function renderPlan(rootDir: string, options?: RunDecisionOptions): string;
export declare function runAuthorize(rootDir: string, agentId: string, action: string, options?: RunDecisionOptions): {
    decisionPath: string;
    output: string;
};
export declare function runExecutionWitnessCommand(rootDir: string, input: {
    invariantId: string;
    scenarioId: string;
    sourceFiles: string[];
    testFiles?: string[];
    outputPath: string;
    command: string[];
    timeoutMs?: number;
    observedAt?: string;
}): {
    outputPath: string;
    recordedOutputPath: string;
    receiptPath: string;
    recordedReceiptPath: string;
    witness: ExecutionWitnessRecord;
    receipt: ExecutionReceipt;
};
export declare function attestSign(rootDir: string, issuer: string, keyId: string, privateKeyPath: string, subjectFile: string, claims: string[], outputPath: string): string;
export declare function attestVerify(rootDir: string, attestationFile: string, trustedKeysDir: string, format?: 'text' | 'json'): string;
export declare function attestGenerateKey(outDir: string, keyId: string): string;
export declare function runAmend(rootDir: string, proposalFile: string, apply?: boolean, options?: {
    configPath?: string;
}): string;
export {};
