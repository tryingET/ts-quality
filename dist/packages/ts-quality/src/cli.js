#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("./index");
function args() {
    return process.argv.slice(2);
}
const OPTION_KINDS = new Map([
    ['--root', 'value'],
    ['--changed', 'value'],
    ['--run-id', 'value'],
    ['--config', 'value'],
    ['--out-dir', 'value'],
    ['--agent', 'value'],
    ['--action', 'value'],
    ['--issuer', 'value'],
    ['--key-id', 'value'],
    ['--private-key', 'value'],
    ['--subject', 'value'],
    ['--out', 'value'],
    ['--claims', 'value'],
    ['--attestation', 'value'],
    ['--trusted-keys', 'value'],
    ['--proposal', 'value'],
    ['--invariant', 'value'],
    ['--scenario', 'value'],
    ['--source-files', 'value'],
    ['--test-files', 'value'],
    ['--timeout-ms', 'value'],
    ['--observed-at', 'value'],
    ['--json', 'flag'],
    ['--help', 'flag'],
    ['--apply', 'flag']
]);
const COMMAND_CONTRACTS = new Map([
    ['init', { allowedValues: ['--root'], allowedFlags: [], maxPositionals: 1 }],
    ['materialize', { allowedValues: ['--root', '--config', '--out-dir'], allowedFlags: [], maxPositionals: 1 }],
    ['check', { allowedValues: ['--root', '--config', '--changed', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
    ['explain', { allowedValues: ['--root', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
    ['report', { allowedValues: ['--root', '--run-id'], allowedFlags: ['--json'], maxPositionals: 1 }],
    ['trend', { allowedValues: ['--root'], allowedFlags: [], maxPositionals: 1 }],
    ['plan', { allowedValues: ['--root', '--config', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
    ['govern', { allowedValues: ['--root', '--config', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
    ['authorize', { allowedValues: ['--root', '--config', '--agent', '--action', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
    ['attest sign', { allowedValues: ['--root', '--issuer', '--key-id', '--private-key', '--subject', '--out', '--claims'], allowedFlags: [], maxPositionals: 2 }],
    ['attest verify', { allowedValues: ['--root', '--attestation', '--trusted-keys'], allowedFlags: ['--json'], maxPositionals: 2 }],
    ['attest keygen', { allowedValues: ['--root', '--out-dir', '--key-id'], allowedFlags: [], maxPositionals: 2 }],
    ['witness test', { allowedValues: ['--root', '--invariant', '--scenario', '--source-files', '--test-files', '--out', '--timeout-ms', '--observed-at'], allowedFlags: [], maxPositionals: 64 }],
    ['witness refresh', { allowedValues: ['--root', '--config', '--changed'], allowedFlags: [], maxPositionals: 2 }],
    ['amend', { allowedValues: ['--root', '--proposal', '--config'], allowedFlags: ['--apply'], maxPositionals: 1 }]
]);
function rememberValueOption(values, valueCounts, name, value) {
    values.set(name, value);
    valueCounts.set(name, (valueCounts.get(name) ?? 0) + 1);
}
function parseArgs(argv) {
    const positionals = [];
    const values = new Map();
    const valueCounts = new Map();
    const flags = new Set();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === undefined) {
            break;
        }
        if (token === '--') {
            positionals.push(...argv.slice(index + 1));
            break;
        }
        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }
        const equalsIndex = token.indexOf('=');
        const name = equalsIndex >= 0 ? token.slice(0, equalsIndex) : token;
        const optionKind = OPTION_KINDS.get(name);
        if (!optionKind) {
            throw new Error(`unknown option ${name}`);
        }
        if (equalsIndex >= 0) {
            if (optionKind === 'flag') {
                throw new Error(`${name} does not take a value`);
            }
            rememberValueOption(values, valueCounts, name, token.slice(equalsIndex + 1));
            continue;
        }
        if (optionKind === 'flag') {
            flags.add(name);
            continue;
        }
        const value = argv[index + 1];
        if (value === undefined) {
            throw new Error(`${name} requires a value`);
        }
        if (value.startsWith('--')) {
            const nextName = value.includes('=') ? value.slice(0, value.indexOf('=')) : value;
            if (OPTION_KINDS.has(nextName)) {
                throw new Error(`${name} requires a value`);
            }
            continue;
        }
        rememberValueOption(values, valueCounts, name, value);
        index += 1;
    }
    return { positionals, values, valueCounts, flags };
}
function commandContractKey(command, subcommand) {
    if (!command) {
        return undefined;
    }
    if (command === 'attest' || command === 'witness') {
        return subcommand ? `${command} ${subcommand}` : command;
    }
    return command;
}
function commandLabel(command, subcommand) {
    if (!command) {
        return 'ts-quality';
    }
    return (command === 'attest' || command === 'witness') && subcommand ? `${command} ${subcommand}` : command;
}
function validateParsedArgs(parsed) {
    const [command, subcommand] = parsed.positionals;
    if (!command || command === 'help' || command === '--help') {
        return;
    }
    if (parsed.flags.has('--help') || subcommand === 'help') {
        return;
    }
    const contract = COMMAND_CONTRACTS.get(commandContractKey(command, subcommand) ?? '');
    if (!contract) {
        return;
    }
    if (parsed.positionals.length > contract.maxPositionals) {
        throw new Error(`unexpected positional arguments for ${commandLabel(command, subcommand)}`);
    }
    const allowedValues = new Set(contract.allowedValues);
    for (const name of parsed.values.keys()) {
        if (!allowedValues.has(name)) {
            throw new Error(`unexpected option ${name} for ${commandLabel(command, subcommand)}`);
        }
    }
    const allowedFlags = new Set(contract.allowedFlags);
    for (const name of parsed.flags) {
        if (!allowedFlags.has(name)) {
            throw new Error(`unexpected option ${name} for ${commandLabel(command, subcommand)}`);
        }
    }
    for (const [name, count] of parsed.valueCounts.entries()) {
        if (count > 1 && allowedValues.has(name)) {
            throw new Error(`${name} may only be specified once`);
        }
    }
}
function takeOption(parsed, name) {
    return parsed.values.get(name);
}
function hasFlag(parsed, name) {
    return parsed.flags.has(name);
}
function rootDir(parsed) {
    return path_1.default.resolve(takeOption(parsed, '--root') ?? process.cwd());
}
function changedFiles(parsed) {
    const value = takeOption(parsed, '--changed');
    return value ? value.split(',').filter(Boolean) : undefined;
}
function runId(parsed) {
    return takeOption(parsed, '--run-id');
}
function configPath(parsed) {
    return takeOption(parsed, '--config');
}
function outDir(parsed) {
    return takeOption(parsed, '--out-dir');
}
function csvValues(parsed, name) {
    const value = takeOption(parsed, name);
    return value ? value.split(',').filter(Boolean) : undefined;
}
function usage(command, subcommand) {
    if (!command) {
        return `ts-quality commands:

First bounded review:
  ts-quality init
  # configure ts-quality.config.* for coverage, changed scope, invariants, governance, and agents
  ts-quality check --changed src/file.ts --run-id review-001
  ts-quality explain --run-id review-001
  ts-quality report --run-id review-001

First focused witness:
  # Pick a target-repo proof command before writing the witness: prefer a module-level test or a repo-local npm script over a broad npm test when the broad command cannot target the changed slice.
  ts-quality witness test --invariant auth.refresh.validity --scenario expired-boundary --source-files src/auth/token.ts --test-files test/auth/token.test.ts --out .ts-quality/witnesses/auth-refresh-expired-boundary.json -- npm run test:auth-refresh --silent
  # For dist-based TypeScript witnesses, run the target repo build first; for source-mode loaders/env flags, hide the long command behind an npm script.
  ts-quality check --changed src/auth/token.ts --run-id review-001

Core commands:
- init                                      create starter control-plane files
- materialize [--out-dir <dir>]            write boring runtime JSON from config/support files
- check [--changed <a,b>] [--run-id <id>]  write the immutable evidence run bundle
- explain|report|plan|govern --run-id <id> project a persisted run without re-checking
- authorize --agent <id> [--action merge] --run-id <id>
- witness test|refresh                     create or refresh execution witnesses
- attest sign|verify|keygen                bind or verify run artifacts
- trend                                    compare the nearest comparable prior run
- amend --proposal <file> [--apply]        evaluate a governance amendment

Trust contract:
- check requires explicit changed scope from --changed, config changeSet.files, or a diff file.
- Prefer --run-id in automation; latest.json fallback is only for selected read/projection commands.
- Run coverage and your target repo quality gate before check when coverage/mutation evidence matters.
- Machine truth is under .ts-quality/runs/<run-id>/; stdout and Markdown are projections.

Use: ts-quality <command> --help
`;
    }
    if (command === 'materialize') {
        return `Usage: ts-quality materialize [--root <dir>] [--config <file>] [--out-dir <dir>]

Exports author-authored config/support data into canonical runtime JSON.
Reads: ts-quality.config.* and configured support files.
Writes: .ts-quality/materialized/ts-quality.config.json and related support JSON.
Use this before check when CI or agents should consume generated data instead of source config.
`;
    }
    if (command === 'check') {
        return `Usage: ts-quality check [--root <dir>] [--config <file>] [--changed <a,b,c>] [--run-id <id>]

Runs the evidence, mutation, invariant, governance, and verdict pipeline.
Required trust precondition: explicit changed scope from --changed, config changeSet.files, or a configured diff file.
Recommended precondition: run the target repo's tests/coverage first, or configure coverage.generateCommand so check can create missing LCOV before analysis.
Writes: .ts-quality/runs/<run-id>/{run.json,verdict.json,report.json,report.md,pr-summary.md,check-summary.txt,explain.txt,plan.txt,govern.txt} and .ts-quality/latest.json.
Automation: pass --run-id so explain/report/plan/govern/authorize stay bound to this exact run.
`;
    }
    if (command === 'explain') {
        return `Usage: ts-quality explain [--root <dir>] [--run-id <id>]

Renders the explanation trail for a persisted run. Prefer --run-id; when omitted this command reads .ts-quality/latest.json.
Writes no artifacts; stdout is a projection of run.json and snapped decision context.
`;
    }
    if (command === 'report') {
        return `Usage: ts-quality report [--root <dir>] [--run-id <id>] [--json]

Renders a Markdown or JSON report for a persisted run. Prefer --run-id; when omitted this command reads .ts-quality/latest.json.
Use --json for machine consumers; report JSON includes additive decisionContext metadata.
`;
    }
    if (command === 'trend') {
        return `Usage: ts-quality trend [--root <dir>]

Compares the latest run with the nearest earlier comparable run.
Fails closed instead of comparing unrelated changed scopes or changed evidence baselines.
`;
    }
    if (command === 'plan') {
        return `Usage: ts-quality plan [--root <dir>] [--config <file>] [--run-id <id>]

Renders governance implementation guidance for a persisted run or current config context.
Prefer --run-id for review/release decisions so drift and snapped control-plane truth stay visible.
`;
    }
    if (command === 'govern') {
        return `Usage: ts-quality govern [--root <dir>] [--config <file>] [--run-id <id>]

Renders governance findings for a persisted run or current config context.
Prefer --run-id; findings are downstream of the exact run evidence, not a separate authority.
`;
    }
    if (command === 'authorize') {
        return `Usage: ts-quality authorize --agent <id> [--action merge] [--root <dir>] [--config <file>] [--run-id <id>]

Evaluates whether an agent/human has standing to perform an action against a selected run.
Prefer --run-id; authorization rechecks drift and writes run-bound authorization and bundle JSON.
Writes: .ts-quality/runs/<run-id>/authorize.<agent>.<action>.json and bundle.<agent>.<action>.json.
`;
    }
    if (command === 'attest' && subcommand === 'sign') {
        return `Usage: ts-quality attest sign --issuer <id> --key-id <id> --private-key <file> --subject <file> --out <file> [--claims <a,b>] [--root <dir>]

Signs a repo-local subject artifact. Subject paths must stay inside --root and run-scoped payload metadata must match the subject path when present.
Do not commit private keys.
`;
    }
    if (command === 'attest' && subcommand === 'verify') {
        return `Usage: ts-quality attest verify --attestation <file> [--trusted-keys <dir>] [--json] [--root <dir>]

Verifies a signed attestation against trusted public keys. Use --json for machine consumers.
`;
    }
    if (command === 'attest' && subcommand === 'keygen') {
        return `Usage: ts-quality attest keygen [--out-dir <dir>] [--key-id <id>] [--root <dir>]

Generates an Ed25519 keypair for local attestation workflows. Do not commit private keys.
`;
    }
    if (command === 'witness' && subcommand === 'test') {
        return `Usage: ts-quality witness test --invariant <id> --scenario <id> --source-files <a,b> [--test-files <a,b>] --out <file> [--timeout-ms <ms>] [--observed-at <iso>] [--root <dir>] -- <command...>

Runs one explicit proof command and writes an execution witness plus receipt sidecar.
Use this when a lexical invariant match should graduate to execution-backed support for one scenario.

Choosing the command after --:
1. Start from the changed source file and the focused test file you would trust in code review.
2. Prefer a module-level target-repo command, for example: -- npm run test:auth-refresh --silent or -- node --test test/auth/token.test.js.
3. Use a repo-global npm test only as baseline evidence when it cannot target the changed behavior or leaves long-lived handles.
4. For dist-based TypeScript witnesses, run the target repo build first. For source-mode loaders, env flags, or long inline assertions, put the exact proof command in package.json and invoke that script after --.

Keep commands narrow: one invariant, one scenario, one changed behavior, and one focused test command are stronger product evidence than a repo-global green test run.
`;
    }
    if (command === 'witness' && subcommand === 'refresh') {
        return `Usage: ts-quality witness refresh [--root <dir>] [--config <file>] [--changed <a,b,c>]

Runs configured execution witness commands impacted by the current changed scope.
Use this before check when your invariant scenarios already declare witness commands and you want witness artifact churn to be an explicit stage.
Pass --changed in automation unless config changeSet.files or a diff file supplies scope.
`;
    }
    if (command === 'amend') {
        return `Usage: ts-quality amend --proposal <file> [--apply] [--root <dir>] [--config <file>]

Evaluates a constitutional amendment proposal and writes amendment result JSON/text.
Omit --apply for review-only evaluation.
`;
    }
    return `Usage: ts-quality ${command} [--root <dir>]\n`;
}
function main() {
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
        (0, index_2.initProject)(cwd);
        process.stdout.write(`Initialized ts-quality in ${cwd}\n`);
        return;
    }
    if (command === 'materialize') {
        const explicitConfigPath = configPath(parsed);
        const requestedOutDir = outDir(parsed);
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
    if (command === 'check') {
        const changed = changedFiles(parsed);
        const explicitConfigPath = configPath(parsed);
        const checkOptions = {};
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
        const result = (0, index_2.runCheck)(cwd, checkOptions);
        const coverageSummary = result.run.coverageGeneration
            ? `Coverage generation: ${result.run.coverageGeneration.receipt.status} -> ${result.run.coverageGeneration.lcovPath}\n`
            : '';
        const witnessSummary = result.run.executionWitnesses
            ? `Execution witnesses: auto-ran ${result.run.executionWitnesses.autoRan.length}, skipped ${result.run.executionWitnesses.skipped.length}\n`
            : '';
        process.stdout.write(`Merge confidence: ${result.run.verdict.mergeConfidence}/100\nOutcome: ${result.run.verdict.outcome}\n${coverageSummary}${witnessSummary}Artifacts: ${result.artifactDir}\n`);
        return;
    }
    if (command === 'explain') {
        const requestedRunId = runId(parsed);
        process.stdout.write((0, index_2.renderLatestExplain)(cwd, requestedRunId ? { runId: requestedRunId } : undefined));
        return;
    }
    if (command === 'report') {
        const requestedRunId = runId(parsed);
        process.stdout.write((0, index_2.renderLatestReport)(cwd, hasFlag(parsed, '--json') ? 'json' : 'markdown', requestedRunId ? { runId: requestedRunId } : undefined));
        return;
    }
    if (command === 'trend') {
        process.stdout.write((0, index_2.renderTrend)(cwd));
        return;
    }
    if (command === 'plan') {
        const explicitConfigPath = configPath(parsed);
        const requestedRunId = runId(parsed);
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
        const explicitConfigPath = configPath(parsed);
        const requestedRunId = runId(parsed);
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
        const agentId = takeOption(parsed, '--agent');
        if (!agentId) {
            throw new Error('authorize requires --agent <id>');
        }
        const action = takeOption(parsed, '--action') ?? 'merge';
        const explicitConfigPath = configPath(parsed);
        const requestedRunId = runId(parsed);
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
            const explicitConfigPath = configPath(parsed);
            const changed = changedFiles(parsed);
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
            throw new Error(`execution witness command ${result.receipt.status}; wrote fail witness to ${(0, index_1.renderSafeText)(result.outputPath)} (receipt ${(0, index_1.renderSafeText)(result.receiptPath)})${result.receipt.details ? `\n${(0, index_1.renderSafeText)(result.receipt.details)}` : ''}`);
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
            process.stdout.write(`${(0, index_2.attestSign)(cwd, issuer, keyId, privateKey, subject, claims, output)}\n`);
            return;
        }
        if (subcommand === 'verify') {
            const attestation = takeOption(parsed, '--attestation');
            const trusted = takeOption(parsed, '--trusted-keys') ?? '.ts-quality/keys';
            if (!attestation) {
                throw new Error('attest verify requires --attestation <file>');
            }
            process.stdout.write((0, index_2.attestVerify)(cwd, attestation, trusted, hasFlag(parsed, '--json') ? 'json' : 'text'));
            return;
        }
        if (subcommand === 'keygen') {
            const out = path_1.default.resolve(cwd, takeOption(parsed, '--out-dir') ?? path_1.default.join('.ts-quality', 'keys'));
            const keyId = takeOption(parsed, '--key-id') ?? 'generated';
            process.stdout.write((0, index_2.attestGenerateKey)(out, keyId));
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
        process.stdout.write((0, index_2.runAmend)(cwd, proposal, hasFlag(parsed, '--apply'), explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
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