"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionWitnessCommandEnv = executionWitnessCommandEnv;
exports.executionWitnessCommandDetails = executionWitnessCommandDetails;
exports.renderExecutionWitnessSummaryText = renderExecutionWitnessSummaryText;
exports.runExecutionWitnessCommand = runExecutionWitnessCommand;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const witness_1 = require("../../evidence-model/src/witness");
const child_process_1 = require("child_process");
const index_1 = require("../../evidence-model/src/index");
const cli_paths_1 = require("./cli-paths");
/** Execution witness commands: refresh of configured witnesses and the single witness test command. */
const SANITIZED_WITNESS_ENV_KEYS = ['NODE_TEST_CONTEXT'];
function executionWitnessCommandEnv(baseEnv = process.env) {
    const env = { ...baseEnv };
    for (const key of SANITIZED_WITNESS_ENV_KEYS) {
        delete env[key];
    }
    return env;
}
function stdioText(value) {
    return typeof value === 'string' ? value : value ? value.toString('utf8') : '';
}
function executionWitnessCommandDetails(result) {
    return `${stdioText(result.stdout).trim()}\n${stdioText(result.stderr).trim()}`.trim().slice(0, 280);
}
function executionWitnessReceiptPath(relativeWitnessPath) {
    return relativeWitnessPath.endsWith('.json')
        ? relativeWitnessPath.replace(/\.json$/u, '.receipt.json')
        : `${relativeWitnessPath}.receipt.json`;
}
function executionWitnessSkipReasonText(reason) {
    return reason === 'invariant-not-impacted'
        ? 'invariant not impacted by changed scope'
        : reason;
}
function renderExecutionWitnessSummaryText(summary) {
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
function runExecutionWitnessCommand(rootDir, input) {
    const command = input.command.filter((item) => item.length > 0);
    if (command.length === 0) {
        throw new Error('execution witness command requires an executable and arguments');
    }
    const sourceFiles = [...new Set(input.sourceFiles.map((candidate) => (0, cli_paths_1.resolveCliRepoLocalPath)(rootDir, candidate, { kind: 'execution witness source file' }).relativePath))];
    if (sourceFiles.length === 0) {
        throw new Error('execution witness command requires at least one --source-files entry');
    }
    const testFiles = [...new Set((input.testFiles ?? []).map((candidate) => (0, cli_paths_1.resolveCliRepoLocalPath)(rootDir, candidate, { kind: 'execution witness test file' }).relativePath))];
    const outputResolution = (0, cli_paths_1.resolveCliRepoLocalPath)(rootDir, input.outputPath, { allowMissing: true, kind: 'execution witness output' });
    const recordedReceiptPath = executionWitnessReceiptPath(outputResolution.relativePath);
    const receiptResolution = (0, cli_paths_1.resolveCliRepoLocalPath)(rootDir, recordedReceiptPath, { allowMissing: true, kind: 'execution witness receipt output' });
    (0, witness_1.assertExecutionWitnessOutputPath)(rootDir, outputResolution.absolutePath);
    (0, witness_1.assertExecutionWitnessOutputPath)(rootDir, receiptResolution.absolutePath);
    (0, index_1.ensureDir)(path_1.default.dirname(outputResolution.absolutePath));
    (0, index_1.ensureDir)(path_1.default.dirname(receiptResolution.absolutePath));
    const executable = command[0];
    if (!executable) {
        throw new Error('execution witness command requires an executable argument');
    }
    const binding = (0, witness_1.createExecutionWitnessBinding)(rootDir, sourceFiles, testFiles, command, input.timeoutMs);
    const boundPaths = [...Object.keys(binding.sourceDigests), ...Object.keys(binding.testDigests), ...Object.keys(binding.contextDigests)];
    const assertSafeOutputTargets = () => {
        for (const output of [outputResolution, receiptResolution]) {
            (0, witness_1.assertExecutionWitnessOutputPath)(rootDir, output.absolutePath);
            // Revalidate the original publication path, not only its old canonical label.
            const current = (0, cli_paths_1.resolveCliRepoLocalPath)(rootDir, output.absolutePath, { allowMissing: true, kind: 'execution witness output' });
            if (current.canonicalPath !== output.canonicalPath || boundPaths.includes(current.relativePath)) {
                throw new Error('execution witness outputs cannot overwrite bound inputs or change containment');
            }
            if (fs_1.default.existsSync(current.absolutePath)) {
                const stat = fs_1.default.statSync(current.absolutePath);
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
    const inputState = (0, witness_1.executionWitnessInputState)(rootDir, binding);
    const started = Date.now();
    const result = (0, child_process_1.spawnSync)(executable, command.slice(1), {
        cwd: rootDir,
        encoding: 'utf8',
        timeout: input.timeoutMs,
        shell: process.platform === 'win32',
        env: executionWitnessCommandEnv()
    });
    const durationMs = Date.now() - started;
    const receipt = result.error
        ? {
            status: result.error.code === 'ETIMEDOUT' ? 'timeout' : 'error',
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: result.error.message ?? 'unknown execution witness command error'
        }
        : {
            status: result.status === 0 ? 'pass' : 'fail',
            exitCode: typeof result.status === 'number' ? result.status : undefined,
            durationMs,
            details: executionWitnessCommandDetails(result)
        };
    const witness = {
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
    const receiptArtifact = {
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
    const bindingIssue = (0, witness_1.executionWitnessBindingIssue)(rootDir, witness)
        ?? ((0, witness_1.executionWitnessInputState)(rootDir, binding) !== inputState ? 'bound input metadata changed (including rewrite/restore)' : undefined);
    if (bindingIssue) {
        witness.status = 'fail';
        receipt.status = 'error';
        receipt.details = `Bound inputs changed during witness execution: ${bindingIssue}`;
    }
    // Commands can retarget paths; renew containment before either publication.
    assertSafeOutputTargets();
    (0, index_1.writeJson)(outputResolution.absolutePath, witness);
    (0, index_1.writeJson)(receiptResolution.absolutePath, receiptArtifact);
    return {
        outputPath: outputResolution.absolutePath,
        recordedOutputPath: outputResolution.relativePath,
        receiptPath: receiptResolution.absolutePath,
        recordedReceiptPath,
        witness,
        receipt
    };
}
//# sourceMappingURL=witness-commands.js.map