#!/usr/bin/env node
import path from 'path';
import { renderSafeText, stableStringify } from '../../evidence-model/src/index';
import {
  adoptFromRun,
  attestGenerateKey,
  attestSign,
  attestVerify,
  initProject,
  materializeProject,
  refreshExecutionWitnesses,
  renderArtifactRetentionPlan,
  renderArtifactRetentionPlanMachine,
  renderDoctor,
  renderDoctorMachine,
  renderGovernance,
  renderLatestExplain,
  renderLatestReport,
  renderMutationPreview,
  renderNavigation,
  renderPackageIndexInspectionFile,
  renderPlan,
  renderTrend,
  runAmend,
  runAuthorize,
  runCheck,
  runExecutionWitnessCommand,
  writePackageIndexFile
} from './index';
import {
  changedFiles,
  commaList,
  configPath,
  csvValues,
  fromRun,
  hasFlag,
  mutationTargets,
  outDir,
  parseArgs,
  preset,
  rootDir,
  runId,
  takeOption,
  validateParsedArgs
} from './cli-args';
import { cliVersion, usage } from './cli-usage';

/** The ts-quality command dispatcher over the product API. */

function args(): string[] {
  const argv = process.argv.slice(2);
  if (handleTopLevelVersionRequest(argv)) {
    process.exit(0);
  }
  return argv;
}
function handleTopLevelVersionRequest(argv: string[]): boolean {
  const optionBoundary = argv.indexOf('--');
  const optionArgs = optionBoundary >= 0 ? argv.slice(0, optionBoundary) : argv;
  if (!optionArgs.includes('--version')) {
    return false;
  }
  if (argv.length !== 1) {
    throw new Error('--version is a top-level flag; run exactly ts-quality --version');
  }
  process.stdout.write(`${cliVersion()}\n`);
  return true;
}
function main(): void {
  const parsed = parseArgs(args());
  const [command, subcommand] = parsed.positionals;

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(usage());
    return;
  }

  if (hasFlag(parsed, '--help') || subcommand === 'help') {
    process.stdout.write(usage(command, subcommand === 'help' ? undefined : subcommand));
    return;
  }

  validateParsedArgs(parsed);
  const cwd = rootDir(parsed);

  if (command === 'init') {
    const selectedPreset = preset(parsed);
    initProject(cwd, selectedPreset ? { preset: selectedPreset } : undefined);
    process.stdout.write(`Initialized ts-quality in ${cwd}${selectedPreset ? ` with preset ${selectedPreset}` : ''}\n`);
    return;
  }

  if (command === 'doctor') {
    const doctorOptions: { changedFiles?: string[]; configPath?: string } = {};
    const changed = changedFiles(parsed);
    if (changed) {
      doctorOptions.changedFiles = changed;
    }
    const explicitConfigPath = configPath(parsed);
    if (explicitConfigPath) {
      doctorOptions.configPath = explicitConfigPath;
    }
    process.stdout.write(hasFlag(parsed, '--machine')
      ? renderDoctorMachine(cwd, Object.keys(doctorOptions).length > 0 ? doctorOptions : undefined)
      : renderDoctor(cwd, Object.keys(doctorOptions).length > 0 ? doctorOptions : undefined));
    return;
  }

  if (command === 'materialize') {
    const explicitConfigPath = configPath(parsed);
    const requestedOutDir = outDir(parsed);
    const materializeOptions: { configPath?: string; outDir?: string } = {};
    if (explicitConfigPath) {
      materializeOptions.configPath = explicitConfigPath;
    }
    if (requestedOutDir) {
      materializeOptions.outDir = requestedOutDir;
    }
    const result = materializeProject(cwd, materializeOptions);
    process.stdout.write(`Materialized runtime config: ${result.configPath}\nOutput dir: ${result.outDir}\nFiles:\n- ${result.files.join('\n- ')}\n`);
    return;
  }

  if (command === 'adopt') {
    const requestedFromRun = fromRun(parsed);
    if (!requestedFromRun) {
      throw new Error('adopt requires --from-run <run-dir-or-run.json>');
    }
    const result = adoptFromRun(cwd, { fromRun: requestedFromRun });
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
    const explicitConfigPath = configPath(parsed);
    const retentionOptions = explicitConfigPath ? { configPath: explicitConfigPath } : undefined;
    process.stdout.write(hasFlag(parsed, '--machine')
      ? renderArtifactRetentionPlanMachine(cwd, retentionOptions)
      : renderArtifactRetentionPlan(cwd, retentionOptions));
    return;
  }

  if (command === 'check') {
    const changed = changedFiles(parsed);
    const explicitConfigPath = configPath(parsed);
    const checkOptions: { changedFiles?: string[]; runId?: string; configPath?: string; mutationTargets?: string[] } = {};
    if (changed) {
      checkOptions.changedFiles = changed;
    }
    const requestedRunId = runId(parsed);
    if (requestedRunId) {
      checkOptions.runId = requestedRunId;
    }
    if (explicitConfigPath) {
      checkOptions.configPath = explicitConfigPath;
    }
    const targets = mutationTargets(parsed);
    if (targets) {
      checkOptions.mutationTargets = targets;
    }
    const result = runCheck(cwd, checkOptions);
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
    const navigateOptions: { runId?: string; interventionFrom?: string; interventionTests?: string[]; gitHorizon?: string; json?: boolean } = { json: hasFlag(parsed, '--json') };
    const requestedRunId = runId(parsed);
    if (requestedRunId) {
      navigateOptions.runId = requestedRunId;
    }
    const interventionFrom = takeOption(parsed, '--intervention-from');
    if (interventionFrom !== undefined) {
      navigateOptions.interventionFrom = interventionFrom;
    }
    const interventionTests = takeOption(parsed, '--intervention-tests');
    if (interventionTests !== undefined) {
      navigateOptions.interventionTests = interventionTests.split(',').map((item) => item.trim()).filter(Boolean);
    }
    const gitHorizon = takeOption(parsed, '--git-horizon');
    if (gitHorizon !== undefined) {
      navigateOptions.gitHorizon = gitHorizon;
    }
    process.stdout.write(renderNavigation(cwd, navigateOptions));
    return;
  }

  if (command === 'mutations' && subcommand === 'preview') {
    const previewOptions: { changedFiles?: string[]; configPath?: string; mutationTargets?: string[]; json?: boolean } = { json: hasFlag(parsed, '--json') };
    const changed = changedFiles(parsed);
    if (changed) {
      previewOptions.changedFiles = changed;
    }
    const explicitConfigPath = configPath(parsed);
    if (explicitConfigPath) {
      previewOptions.configPath = explicitConfigPath;
    }
    const targets = mutationTargets(parsed);
    if (targets) {
      previewOptions.mutationTargets = targets;
    }
    process.stdout.write(renderMutationPreview(cwd, previewOptions));
    return;
  }

  if (command === 'index' && subcommand === 'write') {
    const writeOptions: { packages?: string[]; all?: boolean; runIds?: string[]; out?: string } = { all: hasFlag(parsed, '--all') };
    const packages = commaList(parsed, '--package');
    if (packages) {
      writeOptions.packages = packages;
    }
    const runIds = commaList(parsed, '--run-id');
    if (runIds) {
      writeOptions.runIds = runIds;
    }
    const out = takeOption(parsed, '--out');
    if (out) {
      writeOptions.out = out;
    }
    const written = writePackageIndexFile(cwd, writeOptions);
    process.stdout.write(hasFlag(parsed, '--json') ? `${stableStringify(written.index)}\n` : written.output);
    return;
  }

  if (command === 'index' && subcommand === 'inspect') {
    const inspectOptions: { index?: string; packages?: string[]; json?: boolean } = { json: hasFlag(parsed, '--json') };
    const index = takeOption(parsed, '--index');
    if (index) {
      inspectOptions.index = index;
    }
    const packages = commaList(parsed, '--package');
    if (packages) {
      inspectOptions.packages = packages;
    }
    process.stdout.write(renderPackageIndexInspectionFile(cwd, inspectOptions));
    return;
  }

  if (command === 'explain') {
    const requestedRunId = runId(parsed);
    process.stdout.write(renderLatestExplain(cwd, requestedRunId ? { runId: requestedRunId } : undefined));
    return;
  }

  if (command === 'report') {
    const requestedRunId = runId(parsed);
    process.stdout.write(renderLatestReport(cwd, hasFlag(parsed, '--json') ? 'json' : 'markdown', requestedRunId ? { runId: requestedRunId } : undefined));
    return;
  }

  if (command === 'trend') {
    process.stdout.write(renderTrend(cwd));
    return;
  }

  if (command === 'plan') {
    const explicitConfigPath = configPath(parsed);
    const requestedRunId = runId(parsed);
    const planOptions: { configPath?: string; runId?: string } = {};
    if (explicitConfigPath) {
      planOptions.configPath = explicitConfigPath;
    }
    if (requestedRunId) {
      planOptions.runId = requestedRunId;
    }
    process.stdout.write(renderPlan(cwd, Object.keys(planOptions).length > 0 ? planOptions : undefined));
    return;
  }

  if (command === 'govern') {
    const explicitConfigPath = configPath(parsed);
    const requestedRunId = runId(parsed);
    const governOptions: { configPath?: string; runId?: string } = {};
    if (explicitConfigPath) {
      governOptions.configPath = explicitConfigPath;
    }
    if (requestedRunId) {
      governOptions.runId = requestedRunId;
    }
    process.stdout.write(renderGovernance(cwd, Object.keys(governOptions).length > 0 ? governOptions : undefined));
    return;
  }

  if (command === 'authorize') {
    const agentId = takeOption(parsed, '--agent');
    if (!agentId) {
      throw new Error('authorize requires --agent <id>');
    }
    const action = takeOption(parsed, '--action') ?? 'merge';
    const explicitConfigPath = configPath(parsed);
    const requestedRunId = runId(parsed);
    const authorizeOptions: { configPath?: string; runId?: string } = {};
    if (explicitConfigPath) {
      authorizeOptions.configPath = explicitConfigPath;
    }
    if (requestedRunId) {
      authorizeOptions.runId = requestedRunId;
    }
    const result = runAuthorize(cwd, agentId, action, Object.keys(authorizeOptions).length > 0 ? authorizeOptions : undefined);
    process.stdout.write(result.output);
    return;
  }

  if (command === 'witness') {
    if (subcommand === 'refresh') {
      const explicitConfigPath = configPath(parsed);
      const changed = changedFiles(parsed);
      const refreshOptions: { configPath?: string; changedFiles?: string[] } = {};
      if (explicitConfigPath) {
        refreshOptions.configPath = explicitConfigPath;
      }
      if (changed) {
        refreshOptions.changedFiles = changed;
      }
      const result = refreshExecutionWitnesses(cwd, Object.keys(refreshOptions).length > 0 ? refreshOptions : undefined);
      if (result.autoRan.length === 0 && result.skipped.length === 0) {
        process.stdout.write('No configured execution witness plans were found.\n');
        return;
      }
      if (result.autoRan.length === 0) {
        process.stdout.write('No configured execution witness plans matched the current changed scope.\n');
      } else {
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
      const invariantId = takeOption(parsed, '--invariant');
      const scenarioId = takeOption(parsed, '--scenario');
      const sourceFiles = csvValues(parsed, '--source-files');
      const testFiles = csvValues(parsed, '--test-files');
      const output = takeOption(parsed, '--out');
      const timeoutMsRaw = takeOption(parsed, '--timeout-ms');
      const observedAt = takeOption(parsed, '--observed-at');
      const commandArgs = parsed.positionals.slice(2);
      if (!invariantId || !scenarioId || !sourceFiles || sourceFiles.length === 0 || !output) {
        throw new Error('witness test requires --invariant --scenario --source-files --out and a command');
      }
      if (commandArgs.length === 0) {
        throw new Error('witness test requires a command after options; choose a focused target-repo proof command after -- (try a module-level test or repo-local npm script before a broad npm test)');
      }
      let timeoutMs: number | undefined;
      if (timeoutMsRaw !== undefined) {
        timeoutMs = Number(timeoutMsRaw);
        if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
          throw new Error('--timeout-ms must be a non-negative number');
        }
      }
      const result = runExecutionWitnessCommand(cwd, {
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
      const issuer = takeOption(parsed, '--issuer');
      const keyId = takeOption(parsed, '--key-id');
      const privateKey = takeOption(parsed, '--private-key');
      const subject = takeOption(parsed, '--subject');
      const output = takeOption(parsed, '--out');
      const claims = (takeOption(parsed, '--claims') ?? '').split(',').filter(Boolean);
      if (issuer === undefined || !keyId || !privateKey || !subject || !output) {
        throw new Error('attest sign requires --issuer --key-id --private-key --subject --out');
      }
      process.stdout.write(`${attestSign(cwd, issuer, keyId, privateKey, subject, claims, output)}\n`);
      return;
    }
    if (subcommand === 'verify') {
      const attestation = takeOption(parsed, '--attestation');
      const trusted = takeOption(parsed, '--trusted-keys') ?? '.ts-quality/keys';
      if (!attestation) {
        throw new Error('attest verify requires --attestation <file>');
      }
      process.stdout.write(attestVerify(cwd, attestation, trusted, hasFlag(parsed, '--json') ? 'json' : 'text'));
      return;
    }
    if (subcommand === 'keygen') {
      const out = path.resolve(cwd, takeOption(parsed, '--out-dir') ?? path.join('.ts-quality', 'keys'));
      const keyId = takeOption(parsed, '--key-id') ?? 'generated';
      process.stdout.write(attestGenerateKey(out, keyId));
      return;
    }
    throw new Error('attest requires subcommand sign|verify|keygen');
  }

  if (command === 'amend') {
    const proposal = takeOption(parsed, '--proposal');
    if (!proposal) {
      throw new Error('amend requires --proposal <file>');
    }
    const explicitConfigPath = configPath(parsed);
    process.stdout.write(runAmend(cwd, proposal, hasFlag(parsed, '--apply'), explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
    return;
  }

  throw new Error(`Unknown command ${command}`);
}
try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${renderSafeText(message)}\n`);
  process.exitCode = 1;
}
