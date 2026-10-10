import fs from 'fs';
import path from 'path';
import { assertExecutionWitnessOutputPath, createExecutionWitnessBinding, executionWitnessBindingIssue, executionWitnessInputState } from '../../evidence-model/src/witness';
import { spawnSync } from 'child_process';
import {
  ensureDir,
  type ExecutionReceipt,
  type ExecutionWitnessReceiptArtifact,
  type ExecutionWitnessRecord,
  type ExecutionWitnessRunRecord,
  type ExecutionWitnessRunSummary,
  type ExecutionWitnessSkippedRecord,
  writeJson
} from '../../evidence-model/src/index';
import { resolveCliRepoLocalPath } from './cli-paths';

/** Execution witness commands: refresh of configured witnesses and the single witness test command. */

const SANITIZED_WITNESS_ENV_KEYS = ['NODE_TEST_CONTEXT'];
export function executionWitnessCommandEnv(baseEnv: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = { ...baseEnv };
  for (const key of SANITIZED_WITNESS_ENV_KEYS) {
    delete env[key];
  }
  return env;
}
function stdioText(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}
export function executionWitnessCommandDetails(result: ReturnType<typeof spawnSync>): string {
  return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}
function executionWitnessReceiptPath(relativeWitnessPath: string): string {
  return relativeWitnessPath.endsWith('.json')
    ? relativeWitnessPath.replace(/\.json$/u, '.receipt.json')
    : `${relativeWitnessPath}.receipt.json`;
}
function executionWitnessSkipReasonText(reason: ExecutionWitnessSkippedRecord['reason']): string {
  return reason === 'invariant-not-impacted'
    ? 'invariant not impacted by changed scope'
    : reason;
}
export function renderExecutionWitnessSummaryText(summary: ExecutionWitnessRunSummary): string {
  const lines = [`Execution witnesses: auto-ran ${summary.autoRan.length}, skipped ${summary.skipped.length}`];
  if (summary.autoRan.length > 0) {
    lines.push('Ran:');
    lines.push(...summary.autoRan.map((item) => `- ${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${item.receipt.status}; receipt=${item.receiptPath})`));
  }
  if (summary.skipped.length > 0) {
    lines.push('Skipped:');
    lines.push(...summary.skipped.map((item) => `- ${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${executionWitnessSkipReasonText(item.reason)})`));
  }
  return `${lines.join('\n')}\n`;
}
export interface ExecutionWitnessRefreshResult extends ExecutionWitnessRunRecord {}
export interface ExecutionWitnessRefreshSkipped extends ExecutionWitnessSkippedRecord {}
export interface ExecutionWitnessRefreshSummary extends ExecutionWitnessRunSummary {}
export function runExecutionWitnessCommand(rootDir: string, input: {
  invariantId: string;
  scenarioId: string;
  sourceFiles: string[];
  testFiles?: string[];
  outputPath: string;
  command: string[];
  timeoutMs?: number;
  observedAt?: string;
}): { outputPath: string; recordedOutputPath: string; receiptPath: string; recordedReceiptPath: string; witness: ExecutionWitnessRecord; receipt: ExecutionReceipt } {
  const command = input.command.filter((item) => item.length > 0);
  if (command.length === 0) {
    throw new Error('execution witness command requires an executable and arguments');
  }
  const sourceFiles = [...new Set(input.sourceFiles.map((candidate) => resolveCliRepoLocalPath(rootDir, candidate, { kind: 'execution witness source file' }).relativePath))];
  if (sourceFiles.length === 0) {
    throw new Error('execution witness command requires at least one --source-files entry');
  }
  const testFiles = [...new Set((input.testFiles ?? []).map((candidate) => resolveCliRepoLocalPath(rootDir, candidate, { kind: 'execution witness test file' }).relativePath))];
  const outputResolution = resolveCliRepoLocalPath(rootDir, input.outputPath, { allowMissing: true, kind: 'execution witness output' });
  const recordedReceiptPath = executionWitnessReceiptPath(outputResolution.relativePath);
  const receiptResolution = resolveCliRepoLocalPath(rootDir, recordedReceiptPath, { allowMissing: true, kind: 'execution witness receipt output' });
  assertExecutionWitnessOutputPath(rootDir, outputResolution.absolutePath);
  assertExecutionWitnessOutputPath(rootDir, receiptResolution.absolutePath);
  ensureDir(path.dirname(outputResolution.absolutePath));
  ensureDir(path.dirname(receiptResolution.absolutePath));
  const executable = command[0];
  if (!executable) {
    throw new Error('execution witness command requires an executable argument');
  }
  const binding = createExecutionWitnessBinding(rootDir, sourceFiles, testFiles, command, input.timeoutMs);
  const boundPaths = [...Object.keys(binding.sourceDigests), ...Object.keys(binding.testDigests), ...Object.keys(binding.contextDigests)];
  const assertSafeOutputTargets = (): void => {
    for (const output of [outputResolution, receiptResolution]) {
      assertExecutionWitnessOutputPath(rootDir, output.absolutePath);
      // Revalidate the original publication path, not only its old canonical label.
      const current = resolveCliRepoLocalPath(rootDir, output.absolutePath, { allowMissing: true, kind: 'execution witness output' });
      if (current.canonicalPath !== output.canonicalPath || boundPaths.includes(current.relativePath)) {
        throw new Error('execution witness outputs cannot overwrite bound inputs or change containment');
      }
      if (fs.existsSync(current.absolutePath)) {
        const stat = fs.statSync(current.absolutePath);
        if (!stat.isFile() || stat.nlink > 1) {
          throw new Error('execution witness outputs must be regular files without hardlink aliases');
        }
      }
    }
    if (outputResolution.canonicalPath === receiptResolution.canonicalPath) {
      throw new Error('execution witness and receipt outputs must be distinct');
    }
  };
  assertSafeOutputTargets();
  const inputState = executionWitnessInputState(rootDir, binding);
  const started = Date.now();
  const result = spawnSync(executable, command.slice(1), {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: input.timeoutMs,
    shell: process.platform === 'win32',
    env: executionWitnessCommandEnv()
  });
  const durationMs = Date.now() - started;
  const receipt: ExecutionReceipt = result.error
    ? {
        status: (result.error as { code?: string }).code === 'ETIMEDOUT' ? 'timeout' : 'error',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: (result.error as { message?: string }).message ?? 'unknown execution witness command error'
      }
    : {
        status: result.status === 0 ? 'pass' : 'fail',
        exitCode: typeof result.status === 'number' ? result.status : undefined,
        durationMs,
        details: executionWitnessCommandDetails(result)
      };
  const witness: ExecutionWitnessRecord = {
    binding,
    version: '1',
    kind: 'execution-witness',
    invariantId: input.invariantId,
    scenarioId: input.scenarioId,
    status: receipt.status === 'pass' ? 'pass' : 'fail',
    sourceFiles,
    ...(testFiles.length > 0 ? { testFiles } : {}),
    ...(input.observedAt ? { observedAt: input.observedAt } : {})
  };
  const receiptArtifact: ExecutionWitnessReceiptArtifact = {
    binding,
    version: '1',
    kind: 'execution-witness-receipt',
    invariantId: input.invariantId,
    scenarioId: input.scenarioId,
    witnessPath: outputResolution.relativePath,
    command: [...command],
    sourceFiles,
    ...(testFiles.length > 0 ? { testFiles } : {}),
    ...(input.observedAt ? { observedAt: input.observedAt } : {}),
    receipt
  };
  const bindingIssue = executionWitnessBindingIssue(rootDir, witness)
    ?? (executionWitnessInputState(rootDir, binding) !== inputState ? 'bound input metadata changed (including rewrite/restore)' : undefined);
  if (bindingIssue) {
    witness.status = 'fail';
    receipt.status = 'error';
    receipt.details = `Bound inputs changed during witness execution: ${bindingIssue}`;
  }
  // Commands can retarget paths; renew containment before either publication.
  assertSafeOutputTargets();
  writeJson(outputResolution.absolutePath, witness);
  writeJson(receiptResolution.absolutePath, receiptArtifact);
  return {
    outputPath: outputResolution.absolutePath,
    recordedOutputPath: outputResolution.relativePath,
    receiptPath: receiptResolution.absolutePath,
    recordedReceiptPath,
    witness,
    receipt
  };
}
