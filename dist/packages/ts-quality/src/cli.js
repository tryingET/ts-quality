#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const index_1 = require("./index");
function args() {
    return process.argv.slice(2);
}
function takeOption(name) {
    const index = args().indexOf(name);
    return index >= 0 ? args()[index + 1] : undefined;
}
function hasFlag(name) {
    return args().includes(name);
}
function rootDir() {
    return path_1.default.resolve(takeOption('--root') ?? process.cwd());
}
function changedFiles() {
    const value = takeOption('--changed');
    return value ? value.split(',').filter(Boolean) : undefined;
}
function runId() {
    return takeOption('--run-id');
}
function configPath() {
    return takeOption('--config');
}
function outDir() {
    return takeOption('--out-dir');
}
function usage(command, subcommand) {
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
function main() {
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
        (0, index_1.initProject)(cwd);
        process.stdout.write(`Initialized ts-quality in ${cwd}\n`);
        return;
    }
    if (command === 'materialize') {
        const explicitConfigPath = configPath();
        const requestedOutDir = outDir();
        const materializeOptions = {};
        if (explicitConfigPath) {
            materializeOptions.configPath = explicitConfigPath;
        }
        if (requestedOutDir) {
            materializeOptions.outDir = requestedOutDir;
        }
        const result = (0, index_1.materializeProject)(cwd, materializeOptions);
        process.stdout.write(`Materialized runtime config: ${result.configPath}\nOutput dir: ${result.outDir}\nFiles:\n- ${result.files.join('\n- ')}\n`);
        return;
    }
    if (command === 'check') {
        const changed = changedFiles();
        const explicitConfigPath = configPath();
        const checkOptions = {};
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
        const result = (0, index_1.runCheck)(cwd, checkOptions);
        process.stdout.write(`Merge confidence: ${result.run.verdict.mergeConfidence}/100\nOutcome: ${result.run.verdict.outcome}\nArtifacts: ${result.artifactDir}\n`);
        return;
    }
    if (command === 'explain') {
        process.stdout.write((0, index_1.renderLatestExplain)(cwd));
        return;
    }
    if (command === 'report') {
        process.stdout.write((0, index_1.renderLatestReport)(cwd, hasFlag('--json') ? 'json' : 'markdown'));
        return;
    }
    if (command === 'trend') {
        process.stdout.write((0, index_1.renderTrend)(cwd));
        return;
    }
    if (command === 'plan') {
        const explicitConfigPath = configPath();
        process.stdout.write((0, index_1.renderPlan)(cwd, explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
        return;
    }
    if (command === 'govern') {
        const explicitConfigPath = configPath();
        process.stdout.write((0, index_1.renderGovernance)(cwd, explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
        return;
    }
    if (command === 'authorize') {
        const agentId = takeOption('--agent');
        if (!agentId) {
            throw new Error('authorize requires --agent <id>');
        }
        const action = takeOption('--action') ?? 'merge';
        const explicitConfigPath = configPath();
        const result = (0, index_1.runAuthorize)(cwd, agentId, action, explicitConfigPath ? { configPath: explicitConfigPath } : undefined);
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
            if (!issuer || !keyId || !privateKey || !subject || !output) {
                throw new Error('attest sign requires --issuer --key-id --private-key --subject --out');
            }
            process.stdout.write(`${(0, index_1.attestSign)(cwd, issuer, keyId, privateKey, subject, claims, output)}\n`);
            return;
        }
        if (subcommand === 'verify') {
            const attestation = takeOption('--attestation');
            const trusted = takeOption('--trusted-keys') ?? '.ts-quality/keys';
            if (!attestation) {
                throw new Error('attest verify requires --attestation <file>');
            }
            process.stdout.write((0, index_1.attestVerify)(cwd, attestation, trusted, hasFlag('--json') ? 'json' : 'text'));
            return;
        }
        if (subcommand === 'keygen') {
            const out = path_1.default.resolve(cwd, takeOption('--out-dir') ?? path_1.default.join('.ts-quality', 'keys'));
            const keyId = takeOption('--key-id') ?? 'generated';
            process.stdout.write((0, index_1.attestGenerateKey)(out, keyId));
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
        process.stdout.write((0, index_1.runAmend)(cwd, proposal, hasFlag('--apply'), explicitConfigPath ? { configPath: explicitConfigPath } : undefined));
        return;
    }
    throw new Error(`Unknown command ${command}`);
}
try {
    main();
}
catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
}
//# sourceMappingURL=cli.js.map