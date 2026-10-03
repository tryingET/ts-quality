import { type ExecutionWitnessBinding, type ExecutionWitnessRecord } from './index';
export declare function createExecutionWitnessBinding(rootDir: string, sourceFiles: string[], testFiles: string[], command: string[], timeoutMs?: number): ExecutionWitnessBinding;
export declare function assertExecutionWitnessOutputPath(rootDir: string, absolutePath: string): void;
export declare function executionWitnessInputState(rootDir: string, binding: ExecutionWitnessBinding): string;
export declare function executionWitnessBindingIssue(rootDir: string, record: ExecutionWitnessRecord): string | undefined;
