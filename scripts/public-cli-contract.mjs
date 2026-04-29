// @ts-check

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicCliContractSchemaVersion = 1;
export const doctorMachineHeader = 'TSQ_DOCTOR_MACHINE_V1';

/**
 * @typedef {{ id: string, args: string[], summary: string, validate: (stdout: string) => Record<string, string> }} PublicCliContractCase
 * @typedef {{ id: string, args: string[], summary: string, stdout: string, details: Record<string, string> }} PublicCliContractCheck
 */

/** @type {PublicCliContractCase[]} */
export const publicCliContractCases = [
  {
    id: 'help',
    args: ['--help'],
    summary: 'top-level help exposes command list',
    validate(stdout) {
      if (!stdout.startsWith('ts-quality commands:\n')) {
        throw new Error('ts-quality --help did not start with "ts-quality commands:".');
      }
      if (/^[{[]/u.test(stdout)) {
        throw new Error('ts-quality --help emitted JSON-looking output instead of human-readable command help.');
      }
      return { header: stdout.split('\n')[0] ?? '' };
    }
  },
  {
    id: 'doctor-help',
    args: ['doctor', '--help'],
    summary: 'doctor help exposes compact machine flag',
    validate(stdout) {
      if (!stdout.startsWith('Usage: ts-quality doctor ')) {
        throw new Error('ts-quality doctor --help did not start with doctor usage.');
      }
      if (!stdout.includes('--machine')) {
        throw new Error('ts-quality doctor --help did not list --machine.');
      }
      return { flag: '--machine' };
    }
  },
  {
    id: 'doctor-machine',
    args: ['doctor', '--machine', '--changed', 'src/index.ts'],
    summary: 'compact doctor line protocol starts with its exact header and exact command fields',
    validate(stdout) {
      if (!stdout.startsWith(`${doctorMachineHeader}\n`)) {
        throw new Error(`ts-quality doctor --machine did not start with ${doctorMachineHeader}.`);
      }
      if (/^[{[]/u.test(stdout)) {
        throw new Error('ts-quality doctor --machine emitted JSON-looking output instead of the compact line protocol.');
      }
      if (!stdout.includes('\tcommand_arg=')) {
        throw new Error('ts-quality doctor --machine did not emit any exact command_arg fields.');
      }
      return { header: stdout.split('\n')[0] ?? '', commandField: 'command_arg' };
    }
  }
];

/**
 * @param {(contractCase: PublicCliContractCase) => string} runCase
 * @returns {{ schemaVersion: number, checks: PublicCliContractCheck[] }}
 */
export function verifyPublicCliContract(runCase) {
  const checks = publicCliContractCases.map((contractCase) => {
    const stdout = runCase(contractCase);
    const details = contractCase.validate(stdout);
    return {
      id: contractCase.id,
      args: contractCase.args,
      summary: contractCase.summary,
      stdout,
      details
    };
  });
  return { schemaVersion: publicCliContractSchemaVersion, checks };
}

/** @param {{ schemaVersion: number, checks: PublicCliContractCheck[] }} contract */
export function summarizePublicCliContract(contract) {
  return {
    schemaVersion: contract.schemaVersion,
    checks: contract.checks.map((check) => ({
      id: check.id,
      args: check.args,
      summary: check.summary,
      details: check.details
    }))
  };
}

/**
 * @param {string} packageSpec
 * @param {PublicCliContractCase} contractCase
 */
export function npxArgsForPublicCliContractCase(packageSpec, contractCase) {
  return ['-y', '-p', packageSpec, 'ts-quality', ...contractCase.args];
}

/** @param {number} milliseconds */
function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * @param {string[]} argv
 * @returns {{ command: string | undefined, options: Record<string, string | boolean> }}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const options = {};
  let command;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (!arg.startsWith('--') && !command) {
      command = arg;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return { command, options };
}

/** @param {unknown} value */
function stringOption(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** @param {unknown} value */
function positiveIntegerOption(value, /** @type {number} */ fallback) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${value}`);
  }
  return parsed;
}

/**
 * @param {{ packageSpec: string, attempts?: number, cwd?: string, env?: Record<string, string> }} options
 */
export function verifyPublicNpxCliContract(options) {
  const attempts = options.attempts ?? 1;
  return verifyPublicCliContract((contractCase) => {
    let lastStdout = '';
    let lastStderr = '';
    let lastStatus = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const result = spawnSync('npx', npxArgsForPublicCliContractCase(options.packageSpec, contractCase), {
        cwd: options.cwd,
        encoding: 'utf8',
        env: { ...process.env, ...(options.env ?? {}) }
      });
      lastStdout = result.stdout ?? '';
      lastStderr = result.stderr ?? '';
      lastStatus = result.status;
      if (result.status === 0) {
        return lastStdout;
      }
      if (attempt < attempts) {
        console.error(`public CLI contract ${contractCase.id} attempt ${attempt}/${attempts} failed; retrying after ${attempt * 15}s.`);
        if (lastStdout.trim()) {
          console.error(lastStdout.trim());
        }
        if (lastStderr.trim()) {
          console.error(lastStderr.trim());
        }
        sleep(attempt * 15_000);
      }
    }
    throw new Error(`public CLI contract ${contractCase.id} failed after ${attempts} attempt(s) with status ${lastStatus}.\n${lastStdout}\n${lastStderr}`.trim());
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  try {
    const { command, options } = parseArgs(process.argv.slice(2));
    if (command !== 'public') {
      throw new Error('Usage: node scripts/public-cli-contract.mjs public --package <name@version> [--attempts <n>]');
    }
    const packageSpec = stringOption(options['package']);
    if (!packageSpec) {
      throw new Error('Missing required --package <name@version>.');
    }
    const attempts = positiveIntegerOption(options['attempts'], 1);
    const contract = verifyPublicNpxCliContract({
      packageSpec,
      attempts,
      cwd: path.resolve(path.dirname(modulePath), '..'),
      env: { NPM_CONFIG_MIN_RELEASE_AGE: '0' }
    });
    console.log(JSON.stringify(summarizePublicCliContract(contract), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
