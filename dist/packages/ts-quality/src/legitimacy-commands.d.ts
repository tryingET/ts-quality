import { type AttestationVerificationRecord } from '../../evidence-model/src/index';
import { RunDecisionOptions } from './run-context';
export declare function renderAttestationVerificationReport(records: AttestationVerificationRecord[]): string;
export declare function runAuthorize(rootDir: string, agentId: string, action: string, options?: RunDecisionOptions): {
    decisionPath: string;
    output: string;
};
export declare function attestSign(rootDir: string, issuer: string, keyId: string, privateKeyPath: string, subjectFile: string, claims: string[], outputPath: string): string;
export declare function attestVerify(rootDir: string, attestationFile: string, trustedKeysDir: string, format?: 'text' | 'json'): string;
export declare function attestGenerateKey(outDir: string, keyId: string): string;
