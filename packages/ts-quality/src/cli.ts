#!/usr/bin/env node
import path from 'path';
import { renderSafeText } from '../../evidence-model/src/index';
import {
  attestGenerateKey,
  attestSign,
  attestVerify,
  initProject,
  materializeProject,
  renderGovernance,
  renderLatestExplain,
  renderLatestReport,
  renderPlan,
  renderTrend,
  runAmend,
  runAuthorize,
  runCheck
} from './index';

function args(): string[] {
  return process.argv.slice(2);
}

function takeOption(name: string): string | undefined {
  const index = args().indexOf(name);
  return index >= 0 ? args()[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args().includes(name);
}

function rootDir(): string {
  return path.resolve(takeOption('--root') ?? process.cwd());
}

function changedFiles(): string[] | undefined {
  const value = takeOption('--changed');
  return value ? value.split(',').filter(Boolean) : undefined;
}

function runId(): string | undefined {
  return takeOption('--run-id');
}

function configPath(): string | undefined {
  return takeOption('--config');
}

function outDir(): string | undefined {
  return takeOption('--out-dir');
}

function usage(command?: string, subcommand?: string): string {
  if (!command) {
    return `ts-quality commands:\n- init\n- materialize [--out-dir <dir>]\n- check\n- explain\n- report [--json]\n- trend\n- plan\n- govern\n- authorize --agent <id> [--action merge]\n- attest sign|verify|keygen\n- amend --proposal <file> [--apply]\n`;
  }
  if (command === 'materialize') {
    return 'Usage: ts-quality materialize [--root <dir>] [--config <file>] [--out-dir <dir>]\n';
  }
  if (command === 'check') {
    return 'Usage: ts-quality check [--root <dir>] [--config <file>] [--changed <a,b,c>] [--run-id <id>]\n';
  }
  if (command === 'authorize') {
    return 'Usage: ts-quality authorize --agent <id> [--action merge] [--root <dir>] [--config <file>]\n';
  }
  if (command === 'attest' && subcommand === 'sign') {
    return 'Usage: ts-quality attest sign --issuer <id> --key-id <id> --private-key <file> --subject <file> --out <file> [--claims <a,b>] [--root <dir>]\n';
  }
  if (command === 'attest' && subcommand === 'verify') {
    return 'Usage: ts-quality attest verify --attestation <file> [--trusted-keys <dir>] [--json] [--root <dir>]\n';
  }
  if (command === 'attest' && subcommand === 'keygen') {
    return 'Usage: ts-quality attest keygen [--out-dir <dir>] [--key-id <id>] [--root <dir>]\n';
  }
  if (command === 'amend') {
    return 'Usage: ts-quality amend --proposal <file> [--apply] [--root <dir>]\n';
  }
  return `Usage: ts-quality ${command} [--root <dir>]\n`;
}

function main(): void {
  const [command, subcommand] = args();
  const cwd = rootDir();

  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(usage());
    return;
  }

  if (hasFlag('--help') || subcommand === 'help') {
    process.stdout.write(usage(command, subcommand === 'help' ? undefined : subcommand));
    return;
  }

  if (command === 'init') {
    initProject(cwd);
    process.stdout.write(`Initialized ts-quality in ${cwd}\n`);
    return;
  }

  if (command === 'materialize') {
    const explicitConfigPath = configPath();
    const requestedOutDir = outDir();
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

  if (command === 'check') {
    const changed = changedFiles();
    const explicitConfigPath = configPath();
    const checkOptions: { changedFiles?: string[]; runId?: string; configPath?: string } = {};
    if (changed) {
      checkOptions.changedFiles = changed;
    }
    const requestedRunId = runId();
    if (requestedRunId) {
      checkOptions.runId = requestedRunId;
    }
    if (explicitConfigPath) {
      checkOptions.configPath = explicitConfigPath;
    }
    const result = runCheck(cwd, checkOptions);
    process.stdout.write(`Merge confidence: ${result.run.verdict.mergeConfidence}/100\nOutcome: ${result.run.verdict.outcome}\nArtifacts: ${result.artifactDir}\n`);
    return;
  }

  if (command === 'explain') {
    process.stdout.write(renderLatestExplain(cwd));
    return;
  }

  if (command === 'report') {
    process.stdout.write(renderLatestReport(cwd, hasFlag('--json') ? 'json' : 'markdown'));
    return;
  }

  if (command === 'trend') {
    process.stdout.write(renderTrend(cwd));
    return;
  }

  if (command === 'plan') {
    const explicitConfigPath = configPath();
    process.stdout.write(renderPlan(cwd, explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
    return;
  }

  if (command === 'govern') {
    const explicitConfigPath = configPath();
    process.stdout.write(renderGovernance(cwd, explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
    return;
  }

  if (command === 'authorize') {
    const agentId = takeOption('--agent');
    if (!agentId) {
      throw new Error('authorize requires --agent <id>');
    }
    const action = takeOption('--action') ?? 'merge';
    const explicitConfigPath = configPath();
    const result = runAuthorize(cwd, agentId, action, explicitConfigPath ? { configPath: explicitConfigPath } : undefined);
    process.stdout.write(result.output);
    return;
  }

  if (command === 'attest') {
    if (subcommand === 'sign') {
      const issuer = takeOption('--issuer');
      const keyId = takeOption('--key-id');
      const privateKey = takeOption('--private-key');
      const subject = takeOption('--subject');
      const output = takeOption('--out');
      const claims = (takeOption('--claims') ?? '').split(',').filter(Boolean);
      if (issuer === undefined || !keyId || !privateKey || !subject || !output) {
        throw new Error('attest sign requires --issuer --key-id --private-key --subject --out');
      }
      process.stdout.write(`${attestSign(cwd, issuer, keyId, privateKey, subject, claims, output)}\n`);
      return;
    }
    if (subcommand === 'verify') {
      const attestation = takeOption('--attestation');
      const trusted = takeOption('--trusted-keys') ?? '.ts-quality/keys';
      if (!attestation) {
        throw new Error('attest verify requires --attestation <file>');
      }
      process.stdout.write(attestVerify(cwd, attestation, trusted, hasFlag('--json') ? 'json' : 'text'));
      return;
    }
    if (subcommand === 'keygen') {
      const out = path.resolve(cwd, takeOption('--out-dir') ?? path.join('.ts-quality', 'keys'));
      const keyId = takeOption('--key-id') ?? 'generated';
      process.stdout.write(attestGenerateKey(out, keyId));
      return;
    }
    throw new Error('attest requires subcommand sign|verify|keygen');
  }

  if (command === 'amend') {
    const proposal = takeOption('--proposal');
    if (!proposal) {
      throw new Error('amend requires --proposal <file>');
    }
    const explicitConfigPath = configPath();
    process.stdout.write(runAmend(cwd, proposal, hasFlag('--apply'), explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
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
