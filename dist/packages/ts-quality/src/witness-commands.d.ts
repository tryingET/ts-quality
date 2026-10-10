import { spawnSync } from 'child_process';
import { type ExecutionReceipt, type ExecutionWitnessRecord, type ExecutionWitnessRunRecord, type ExecutionWitnessRunSummary, type ExecutionWitnessSkippedRecord } from '../../evidence-model/src/index';
export declare function executionWitnessCommandEnv(baseEnv?: Record<string, string | undefined>): Record<string, string | undefined>;
export declare function executionWitnessCommandDetails(result: ReturnType<typeof spawnSync>): string;
export declare function renderExecutionWitnessSummaryText(summary: ExecutionWitnessRunSummary): string;
export interface ExecutionWitnessRefreshResult extends ExecutionWitnessRunRecord {
}
export interface ExecutionWitnessRefreshSkipped extends ExecutionWitnessSkippedRecord {
}
export interface ExecutionWitnessRefreshSummary extends ExecutionWitnessRunSummary {
}
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
