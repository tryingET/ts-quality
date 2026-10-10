import path from 'path';

/** Strict CLI argument parsing: option kinds, per-command contracts, duplicate and unknown option refusal, and typed option readers. */

type OptionKind = 'value' | 'flag';
interface ParsedArgs {
  positionals: string[];
  values: Map<string, string>;
  valueCounts: Map<string, number>;
  flags: Set<string>;
}
interface CommandContract {
  allowedValues: string[];
  allowedFlags: string[];
  maxPositionals: number;
}
const OPTION_KINDS = new Map<string, OptionKind>([
  ['--root', 'value'],
  ['--changed', 'value'],
  ['--run-id', 'value'],
  ['--config', 'value'],
  ['--out-dir', 'value'],
  ['--from-run', 'value'],
  ['--preset', 'value'],
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
  ['--mutation-targets', 'value'],
  ['--intervention-from', 'value'],
  ['--intervention-tests', 'value'],
  ['--git-horizon', 'value'],
  ['--package', 'value'],
  ['--index', 'value'],
  ['--all', 'flag'],
  ['--json', 'flag'],
  ['--machine', 'flag'],
  ['--help', 'flag'],
  ['--apply', 'flag'],
  ['--version', 'flag']
]);
const COMMAND_CONTRACTS = new Map<string, CommandContract>([
  ['init', { allowedValues: ['--root', '--preset'], allowedFlags: [], maxPositionals: 1 }],
  ['doctor', { allowedValues: ['--root', '--config', '--changed'], allowedFlags: ['--machine'], maxPositionals: 1 }],
  ['materialize', { allowedValues: ['--root', '--config', '--out-dir'], allowedFlags: [], maxPositionals: 1 }],
  ['adopt', { allowedValues: ['--root', '--from-run'], allowedFlags: [], maxPositionals: 1 }],
  ['retention', { allowedValues: ['--root', '--config'], allowedFlags: ['--machine'], maxPositionals: 1 }],
  ['check', { allowedValues: ['--root', '--config', '--changed', '--run-id', '--mutation-targets'], allowedFlags: [], maxPositionals: 1 }],
  ['explain', { allowedValues: ['--root', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
  ['report', { allowedValues: ['--root', '--run-id'], allowedFlags: ['--json'], maxPositionals: 1 }],
  ['trend', { allowedValues: ['--root'], allowedFlags: [], maxPositionals: 1 }],
  ['navigate', { allowedValues: ['--root', '--run-id', '--intervention-from', '--intervention-tests', '--git-horizon'], allowedFlags: ['--json'], maxPositionals: 1 }],
  ['plan', { allowedValues: ['--root', '--config', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
  ['govern', { allowedValues: ['--root', '--config', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
  ['authorize', { allowedValues: ['--root', '--config', '--agent', '--action', '--run-id'], allowedFlags: [], maxPositionals: 1 }],
  ['attest sign', { allowedValues: ['--root', '--issuer', '--key-id', '--private-key', '--subject', '--out', '--claims'], allowedFlags: [], maxPositionals: 2 }],
  ['attest verify', { allowedValues: ['--root', '--attestation', '--trusted-keys'], allowedFlags: ['--json'], maxPositionals: 2 }],
  ['attest keygen', { allowedValues: ['--root', '--out-dir', '--key-id'], allowedFlags: [], maxPositionals: 2 }],
  ['witness test', { allowedValues: ['--root', '--invariant', '--scenario', '--source-files', '--test-files', '--out', '--timeout-ms', '--observed-at'], allowedFlags: [], maxPositionals: 64 }],
  ['witness refresh', { allowedValues: ['--root', '--config', '--changed'], allowedFlags: [], maxPositionals: 2 }],
  ['mutations preview', { allowedValues: ['--root', '--config', '--changed', '--mutation-targets'], allowedFlags: ['--json'], maxPositionals: 2 }],
  ['index write', { allowedValues: ['--root', '--package', '--run-id', '--out'], allowedFlags: ['--all', '--json'], maxPositionals: 2 }],
  ['index inspect', { allowedValues: ['--root', '--index', '--package'], allowedFlags: ['--json'], maxPositionals: 2 }],
  ['amend', { allowedValues: ['--root', '--proposal', '--config'], allowedFlags: ['--apply'], maxPositionals: 1 }]
]);
function rememberValueOption(values: Map<string, string>, valueCounts: Map<string, number>, name: string, value: string): void {
  values.set(name, value);
  valueCounts.set(name, (valueCounts.get(name) ?? 0) + 1);
}
export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const values = new Map<string, string>();
  const valueCounts = new Map<string, number>();
  const flags = new Set<string>();
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
function commandContractKey(command?: string, subcommand?: string): string | undefined {
  if (!command) {
    return undefined;
  }
  if (command === 'attest' || command === 'witness' || command === 'mutations' || command === 'index') {
    return subcommand ? `${command} ${subcommand}` : command;
  }
  return command;
}
function commandLabel(command?: string, subcommand?: string): string {
  if (!command) {
    return 'ts-quality';
  }
  return (command === 'attest' || command === 'witness' || command === 'mutations' || command === 'index') && subcommand ? `${command} ${subcommand}` : command;
}
export function validateParsedArgs(parsed: ParsedArgs): void {
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
export function takeOption(parsed: ParsedArgs, name: string): string | undefined {
  return parsed.values.get(name);
}
export function hasFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.has(name);
}
export function commaList(parsed: ParsedArgs, name: string): string[] | undefined {
  const value = takeOption(parsed, name);
  if (value === undefined) {
    return undefined;
  }
  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) {
    throw new Error(`${name} requires at least one value`);
  }
  return items;
}
export function rootDir(parsed: ParsedArgs): string {
  return path.resolve(takeOption(parsed, '--root') ?? process.cwd());
}
export function changedFiles(parsed: ParsedArgs): string[] | undefined {
  const value = takeOption(parsed, '--changed');
  return value ? value.split(',').filter(Boolean) : undefined;
}
export function runId(parsed: ParsedArgs): string | undefined {
  return takeOption(parsed, '--run-id');
}
export function mutationTargets(parsed: ParsedArgs): string[] | undefined {
  if (!parsed.values.has('--mutation-targets')) {
    return undefined;
  }
  const targets = (takeOption(parsed, '--mutation-targets') ?? '').split(';').map((item) => item.trim()).filter(Boolean);
  if (targets.length === 0) {
    // An empty list must not silently replace configured targets and widen mutation back to the whole scope.
    throw new Error('--mutation-targets requires at least one target spec (file:, span:, symbol: or site:), separated by ;');
  }
  return targets;
}
export function configPath(parsed: ParsedArgs): string | undefined {
  return takeOption(parsed, '--config');
}
export function outDir(parsed: ParsedArgs): string | undefined {
  return takeOption(parsed, '--out-dir');
}
export function fromRun(parsed: ParsedArgs): string | undefined {
  return takeOption(parsed, '--from-run');
}
export function preset(parsed: ParsedArgs): 'default' | 'node-test' | 'node-test-ts-dist' | 'vitest' | 'jest' | undefined {
  const value = takeOption(parsed, '--preset');
  if (!value) {
    return undefined;
  }
  if (value === 'default' || value === 'node-test' || value === 'node-test-ts-dist' || value === 'vitest' || value === 'jest') {
    return value;
  }
  throw new Error(`unsupported init preset ${value}`);
}
export function csvValues(parsed: ParsedArgs, name: string): string[] | undefined {
  const value = takeOption(parsed, name);
  return value ? value.split(',').filter(Boolean) : undefined;
}
