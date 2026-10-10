#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("./index");
const cli_args_1 = require("./cli-args");
const cli_usage_1 = require("./cli-usage");
/** The ts-quality command dispatcher over the product API. */
function args() {
    const argv = process.argv.slice(2);
    if (handleTopLevelVersionRequest(argv)) {
        process.exit(0);
    }
    return argv;
}
function handleTopLevelVersionRequest(argv) {
    const optionBoundary = argv.indexOf('--');
    const optionArgs = optionBoundary >= 0 ? argv.slice(0, optionBoundary) : argv;
    if (!optionArgs.includes('--version')) {
        return false;
    }
    if (argv.length !== 1) {
        throw new Error('--version is a top-level flag; run exactly ts-quality --version');
    }
    process.stdout.write(`${(0, cli_usage_1.cliVersion)()}\n`);
    return true;
}
function main() {
    const parsed = (0, cli_args_1.parseArgs)(args());
    const [command, subcommand] = parsed.positionals;
    if (!command || command === 'help' || command === '--help') {
        process.stdout.write((0, cli_usage_1.usage)());
        return;
    }
    if ((0, cli_args_1.hasFlag)(parsed, '--help') || subcommand === 'help') {
        process.stdout.write((0, cli_usage_1.usage)(command, subcommand === 'help' ? undefined : subcommand));
        return;
    }
    (0, cli_args_1.validateParsedArgs)(parsed);
    const cwd = (0, cli_args_1.rootDir)(parsed);
    if (command === 'init') {
        const selectedPreset = (0, cli_args_1.preset)(parsed);
        (0, index_2.initProject)(cwd, selectedPreset ? { preset: selectedPreset } : undefined);
        process.stdout.write(`Initialized ts-quality in ${cwd}${selectedPreset ? ` with preset ${selectedPreset}` : ''}\n`);
        return;
    }
    if (command === 'doctor') {
        const doctorOptions = {};
        const changed = (0, cli_args_1.changedFiles)(parsed);
        if (changed) {
            doctorOptions.changedFiles = changed;
        }
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        if (explicitConfigPath) {
            doctorOptions.configPath = explicitConfigPath;
        }
        process.stdout.write((0, cli_args_1.hasFlag)(parsed, '--machine')
            ? (0, index_2.renderDoctorMachine)(cwd, Object.keys(doctorOptions).length > 0 ? doctorOptions : undefined)
            : (0, index_2.renderDoctor)(cwd, Object.keys(doctorOptions).length > 0 ? doctorOptions : undefined));
        return;
    }
    if (command === 'materialize') {
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        const requestedOutDir = (0, cli_args_1.outDir)(parsed);
        const materializeOptions = {};
        if (explicitConfigPath) {
            materializeOptions.configPath = explicitConfigPath;
        }
        if (requestedOutDir) {
            materializeOptions.outDir = requestedOutDir;
        }
        const result = (0, index_2.materializeProject)(cwd, materializeOptions);
        process.stdout.write(`Materialized runtime config: ${result.configPath}\nOutput dir: ${result.outDir}\nFiles:\n- ${result.files.join('\n- ')}\n`);
        return;
    }
    if (command === 'adopt') {
        const requestedFromRun = (0, cli_args_1.fromRun)(parsed);
        if (!requestedFromRun) {
            throw new Error('adopt requires --from-run <run-dir-or-run.json>');
        }
        const result = (0, index_2.adoptFromRun)(cwd, { fromRun: requestedFromRun });
        process.stdout.write([
            `Adopted ts-quality pilot run: ${result.sourceRunId}`,
            `Source root: ${result.sourceRoot}`,
            `Copied files: ${result.copied.length}`,
            ...result.copied.map((filePath) => `- copied ${filePath}`),
            `Skipped files: ${result.skipped.length}`,
            ...result.skipped.map((item) => `- skipped ${item.path} (${item.reason})`),
            'Omitted ephemeral artifacts:',
            ...result.omittedEphemeral.map((filePath) => `- ${filePath}`)
        ].join('\n') + '\n');
        return;
    }
    if (command === 'retention') {
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        const retentionOptions = explicitConfigPath ? { configPath: explicitConfigPath } : undefined;
        process.stdout.write((0, cli_args_1.hasFlag)(parsed, '--machine')
            ? (0, index_2.renderArtifactRetentionPlanMachine)(cwd, retentionOptions)
            : (0, index_2.renderArtifactRetentionPlan)(cwd, retentionOptions));
        return;
    }
    if (command === 'check') {
        const changed = (0, cli_args_1.changedFiles)(parsed);
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        const checkOptions = {};
        if (changed) {
            checkOptions.changedFiles = changed;
        }
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        if (requestedRunId) {
            checkOptions.runId = requestedRunId;
        }
        if (explicitConfigPath) {
            checkOptions.configPath = explicitConfigPath;
        }
        const targets = (0, cli_args_1.mutationTargets)(parsed);
        if (targets) {
            checkOptions.mutationTargets = targets;
        }
        const result = (0, index_2.runCheck)(cwd, checkOptions);
        const coverageSummary = result.run.coverageGeneration
            ? `Coverage generation: ${result.run.coverageGeneration.receipt.status} -> ${result.run.coverageGeneration.lcovPath}\n`
            : '';
        const witnessSummary = result.run.executionWitnesses
            ? `Execution witnesses: auto-ran ${result.run.executionWitnesses.autoRan.length}, skipped ${result.run.executionWitnesses.skipped.length}\n`
            : '';
        const closureSummary = result.run.nextEvidenceAction
            ? `Evidence closure: ${result.run.nextEvidenceAction.primaryAction.title}\n${typeof result.run.nextEvidenceAction.primaryAction.expectedConfidenceLift === 'number' ? `Expected confidence lift: +${result.run.nextEvidenceAction.primaryAction.expectedConfidenceLift}\n` : ''}${result.run.nextEvidenceAction.primaryAction.suggestedEditFiles.length > 0 ? `Suggested edit files: ${result.run.nextEvidenceAction.primaryAction.suggestedEditFiles.join(', ')}\n` : ''}Coverage basis: ${result.run.nextEvidenceAction.evidenceBasis.coverage.fileCount} file(s)${typeof result.run.nextEvidenceAction.evidenceBasis.coverage.changedFunctionMinPct === 'number' ? `, changed-function min ${result.run.nextEvidenceAction.evidenceBasis.coverage.changedFunctionMinPct}%` : typeof result.run.nextEvidenceAction.evidenceBasis.coverage.minPct === 'number' ? `, min ${result.run.nextEvidenceAction.evidenceBasis.coverage.minPct}%` : ''}, changed functions under80 ${result.run.nextEvidenceAction.evidenceBasis.coverage.changedFunctionsUnder80}\nMutation basis: ${result.run.nextEvidenceAction.evidenceBasis.mutation.killed} killed / ${result.run.nextEvidenceAction.evidenceBasis.mutation.sites} site(s), ${result.run.nextEvidenceAction.evidenceBasis.mutation.survived} survived, ${result.run.nextEvidenceAction.evidenceBasis.mutation.errors} error(s)\n`
            : '';
        process.stdout.write(`Merge confidence: ${result.run.verdict.mergeConfidence}/100\nOutcome: ${result.run.verdict.outcome}\n${coverageSummary}${witnessSummary}${closureSummary}Artifacts: ${result.artifactDir}\n`);
        return;
    }
    if (command === 'navigate') {
        const navigateOptions = { json: (0, cli_args_1.hasFlag)(parsed, '--json') };
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        if (requestedRunId) {
            navigateOptions.runId = requestedRunId;
        }
        const interventionFrom = (0, cli_args_1.takeOption)(parsed, '--intervention-from');
        if (interventionFrom !== undefined) {
            navigateOptions.interventionFrom = interventionFrom;
        }
        const interventionTests = (0, cli_args_1.takeOption)(parsed, '--intervention-tests');
        if (interventionTests !== undefined) {
            navigateOptions.interventionTests = interventionTests.split(',').map((item) => item.trim()).filter(Boolean);
        }
        const gitHorizon = (0, cli_args_1.takeOption)(parsed, '--git-horizon');
        if (gitHorizon !== undefined) {
            navigateOptions.gitHorizon = gitHorizon;
        }
        process.stdout.write((0, index_2.renderNavigation)(cwd, navigateOptions));
        return;
    }
    if (command === 'mutations' && subcommand === 'preview') {
        const previewOptions = { json: (0, cli_args_1.hasFlag)(parsed, '--json') };
        const changed = (0, cli_args_1.changedFiles)(parsed);
        if (changed) {
            previewOptions.changedFiles = changed;
        }
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        if (explicitConfigPath) {
            previewOptions.configPath = explicitConfigPath;
        }
        const targets = (0, cli_args_1.mutationTargets)(parsed);
        if (targets) {
            previewOptions.mutationTargets = targets;
        }
        process.stdout.write((0, index_2.renderMutationPreview)(cwd, previewOptions));
        return;
    }
    if (command === 'index' && subcommand === 'write') {
        const writeOptions = { all: (0, cli_args_1.hasFlag)(parsed, '--all') };
        const packages = (0, cli_args_1.commaList)(parsed, '--package');
        if (packages) {
            writeOptions.packages = packages;
        }
        const runIds = (0, cli_args_1.commaList)(parsed, '--run-id');
        if (runIds) {
            writeOptions.runIds = runIds;
        }
        const out = (0, cli_args_1.takeOption)(parsed, '--out');
        if (out) {
            writeOptions.out = out;
        }
        const written = (0, index_2.writePackageIndexFile)(cwd, writeOptions);
        process.stdout.write((0, cli_args_1.hasFlag)(parsed, '--json') ? `${(0, index_1.stableStringify)(written.index)}\n` : written.output);
        return;
    }
    if (command === 'index' && subcommand === 'inspect') {
        const inspectOptions = { json: (0, cli_args_1.hasFlag)(parsed, '--json') };
        const index = (0, cli_args_1.takeOption)(parsed, '--index');
        if (index) {
            inspectOptions.index = index;
        }
        const packages = (0, cli_args_1.commaList)(parsed, '--package');
        if (packages) {
            inspectOptions.packages = packages;
        }
        process.stdout.write((0, index_2.renderPackageIndexInspectionFile)(cwd, inspectOptions));
        return;
    }
    if (command === 'explain') {
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        process.stdout.write((0, index_2.renderLatestExplain)(cwd, requestedRunId ? { runId: requestedRunId } : undefined));
        return;
    }
    if (command === 'report') {
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        process.stdout.write((0, index_2.renderLatestReport)(cwd, (0, cli_args_1.hasFlag)(parsed, '--json') ? 'json' : 'markdown', requestedRunId ? { runId: requestedRunId } : undefined));
        return;
    }
    if (command === 'trend') {
        process.stdout.write((0, index_2.renderTrend)(cwd));
        return;
    }
    if (command === 'plan') {
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        const planOptions = {};
        if (explicitConfigPath) {
            planOptions.configPath = explicitConfigPath;
        }
        if (requestedRunId) {
            planOptions.runId = requestedRunId;
        }
        process.stdout.write((0, index_2.renderPlan)(cwd, Object.keys(planOptions).length > 0 ? planOptions : undefined));
        return;
    }
    if (command === 'govern') {
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        const governOptions = {};
        if (explicitConfigPath) {
            governOptions.configPath = explicitConfigPath;
        }
        if (requestedRunId) {
            governOptions.runId = requestedRunId;
        }
        process.stdout.write((0, index_2.renderGovernance)(cwd, Object.keys(governOptions).length > 0 ? governOptions : undefined));
        return;
    }
    if (command === 'authorize') {
        const agentId = (0, cli_args_1.takeOption)(parsed, '--agent');
        if (!agentId) {
            throw new Error('authorize requires --agent <id>');
        }
        const action = (0, cli_args_1.takeOption)(parsed, '--action') ?? 'merge';
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        const requestedRunId = (0, cli_args_1.runId)(parsed);
        const authorizeOptions = {};
        if (explicitConfigPath) {
            authorizeOptions.configPath = explicitConfigPath;
        }
        if (requestedRunId) {
            authorizeOptions.runId = requestedRunId;
        }
        const result = (0, index_2.runAuthorize)(cwd, agentId, action, Object.keys(authorizeOptions).length > 0 ? authorizeOptions : undefined);
        process.stdout.write(result.output);
        return;
    }
    if (command === 'witness') {
        if (subcommand === 'refresh') {
            const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
            const changed = (0, cli_args_1.changedFiles)(parsed);
            const refreshOptions = {};
            if (explicitConfigPath) {
                refreshOptions.configPath = explicitConfigPath;
            }
            if (changed) {
                refreshOptions.changedFiles = changed;
            }
            const result = (0, index_2.refreshExecutionWitnesses)(cwd, Object.keys(refreshOptions).length > 0 ? refreshOptions : undefined);
            if (result.autoRan.length === 0 && result.skipped.length === 0) {
                process.stdout.write('No configured execution witness plans were found.\n');
                return;
            }
            if (result.autoRan.length === 0) {
                process.stdout.write('No configured execution witness plans matched the current changed scope.\n');
            }
            else {
                process.stdout.write(`${result.autoRan.map((item) => `${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (${item.receipt.status}; receipt=${item.receiptPath})`).join('\n')}\n`);
            }
            if (result.skipped.length > 0) {
                process.stdout.write(`${result.skipped.map((item) => `skipped ${item.invariantId}:${item.scenarioId} -> ${item.outputPath} (invariant not impacted by changed scope)`).join('\n')}\n`);
            }
            const failed = result.autoRan.filter((item) => item.receipt.status !== 'pass');
            if (failed.length > 0) {
                throw new Error(`execution witness refresh failed for ${failed.map((item) => `${item.invariantId}:${item.scenarioId}`).join(', ')}`);
            }
            return;
        }
        if (subcommand === 'test') {
            const invariantId = (0, cli_args_1.takeOption)(parsed, '--invariant');
            const scenarioId = (0, cli_args_1.takeOption)(parsed, '--scenario');
            const sourceFiles = (0, cli_args_1.csvValues)(parsed, '--source-files');
            const testFiles = (0, cli_args_1.csvValues)(parsed, '--test-files');
            const output = (0, cli_args_1.takeOption)(parsed, '--out');
            const timeoutMsRaw = (0, cli_args_1.takeOption)(parsed, '--timeout-ms');
            const observedAt = (0, cli_args_1.takeOption)(parsed, '--observed-at');
            const commandArgs = parsed.positionals.slice(2);
            if (!invariantId || !scenarioId || !sourceFiles || sourceFiles.length === 0 || !output) {
                throw new Error('witness test requires --invariant --scenario --source-files --out and a command');
            }
            if (commandArgs.length === 0) {
                throw new Error('witness test requires a command after options; choose a focused target-repo proof command after -- (try a module-level test or repo-local npm script before a broad npm test)');
            }
            let timeoutMs;
            if (timeoutMsRaw !== undefined) {
                timeoutMs = Number(timeoutMsRaw);
                if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
                    throw new Error('--timeout-ms must be a non-negative number');
                }
            }
            const result = (0, index_2.runExecutionWitnessCommand)(cwd, {
                invariantId,
                scenarioId,
                sourceFiles,
                ...(testFiles ? { testFiles } : {}),
                outputPath: output,
                command: commandArgs,
                ...(timeoutMs !== undefined ? { timeoutMs } : {}),
                ...(observedAt ? { observedAt } : {})
            });
            if (result.receipt.status === 'pass') {
                process.stdout.write(`Wrote execution witness: ${result.outputPath}\nReceipt: ${result.receiptPath}\nStatus: pass\n`);
                return;
            }
            // Raw text: the error boundary below escapes control characters once.
            throw new Error(`execution witness command ${result.receipt.status}; wrote fail witness to ${result.outputPath} (receipt ${result.receiptPath})${result.receipt.details ? `\n${result.receipt.details}` : ''}`);
        }
        throw new Error('witness requires subcommand test|refresh');
    }
    if (command === 'attest') {
        if (subcommand === 'sign') {
            const issuer = (0, cli_args_1.takeOption)(parsed, '--issuer');
            const keyId = (0, cli_args_1.takeOption)(parsed, '--key-id');
            const privateKey = (0, cli_args_1.takeOption)(parsed, '--private-key');
            const subject = (0, cli_args_1.takeOption)(parsed, '--subject');
            const output = (0, cli_args_1.takeOption)(parsed, '--out');
            const claims = ((0, cli_args_1.takeOption)(parsed, '--claims') ?? '').split(',').filter(Boolean);
            if (issuer === undefined || !keyId || !privateKey || !subject || !output) {
                throw new Error('attest sign requires --issuer --key-id --private-key --subject --out');
            }
            process.stdout.write(`${(0, index_2.attestSign)(cwd, issuer, keyId, privateKey, subject, claims, output)}\n`);
            return;
        }
        if (subcommand === 'verify') {
            const attestation = (0, cli_args_1.takeOption)(parsed, '--attestation');
            const trusted = (0, cli_args_1.takeOption)(parsed, '--trusted-keys') ?? '.ts-quality/keys';
            if (!attestation) {
                throw new Error('attest verify requires --attestation <file>');
            }
            process.stdout.write((0, index_2.attestVerify)(cwd, attestation, trusted, (0, cli_args_1.hasFlag)(parsed, '--json') ? 'json' : 'text'));
            return;
        }
        if (subcommand === 'keygen') {
            const out = path_1.default.resolve(cwd, (0, cli_args_1.takeOption)(parsed, '--out-dir') ?? path_1.default.join('.ts-quality', 'keys'));
            const keyId = (0, cli_args_1.takeOption)(parsed, '--key-id') ?? 'generated';
            process.stdout.write((0, index_2.attestGenerateKey)(out, keyId));
            return;
        }
        throw new Error('attest requires subcommand sign|verify|keygen');
    }
    if (command === 'amend') {
        const proposal = (0, cli_args_1.takeOption)(parsed, '--proposal');
        if (!proposal) {
            throw new Error('amend requires --proposal <file>');
        }
        const explicitConfigPath = (0, cli_args_1.configPath)(parsed);
        process.stdout.write((0, index_2.runAmend)(cwd, proposal, (0, cli_args_1.hasFlag)(parsed, '--apply'), explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
        return;
    }
    throw new Error(`Unknown command ${command}`);
}
try {
    main();
}
catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${(0, index_1.renderSafeText)(message)}\n`);
    process.exitCode = 1;
}
//# sourceMappingURL=cli.js.map