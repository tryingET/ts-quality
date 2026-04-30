// @ts-check

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicCliContractSchemaVersion = 1;
export const doctorMachineHeader = 'TSQ_DOCTOR_MACHINE_V1';
export const doctorMachineProtocol = {
  version: 1,
  header: doctorMachineHeader,
  lineDelimiter: 'LF',
  fieldDelimiter: 'TAB',
  keyValueSeparator: '=',
  valueEncoding: 'V1 values are token-light safe text: producers replace TAB/CR/LF with spaces and trim; consumers split key/value fields on the first equals sign.',
  commandEncoding: 'Commands use repeated command_arg=<argv-item> fields in order; consumers must not split command recommendations on commas.'
};
export const manualWitnessContractRunId = 'public-manual-witness-contract';
export const manualWitnessContractPath = '.ts-quality/witnesses/auth-refresh-expired-boundary.json';

/**
 * @typedef {{ kind: string, fields: string[], keyValues: Map<string, string[]> }} DoctorMachineRecord
 * @typedef {{ header: string, records: DoctorMachineRecord[] }} DoctorMachineDocument
 * @typedef {{ id: string, args: string[], summary: string, validate: (stdout: string) => Record<string, string> }} PublicCliContractCase
 * @typedef {{ id: string, args: string[], summary: string, stdout: string, details: Record<string, string> }} PublicCliContractCheck
 */

/**
 * @param {string} field
 * @returns {[string, string] | undefined}
 */
function splitMachineKeyValue(field) {
  const equalsIndex = field.indexOf('=');
  if (equalsIndex <= 0) {
    return undefined;
  }
  return [field.slice(0, equalsIndex), field.slice(equalsIndex + 1)];
}

/**
 * @param {string} stdout
 * @returns {DoctorMachineDocument}
 */
export function parseDoctorMachineProtocol(stdout) {
  if (!stdout.startsWith(`${doctorMachineHeader}\n`)) {
    throw new Error(`ts-quality doctor --machine did not start with ${doctorMachineHeader}.`);
  }
  if (/^[{[]/u.test(stdout)) {
    throw new Error('ts-quality doctor --machine emitted JSON-looking output instead of the compact line protocol.');
  }
  const lines = stdout.replace(/\n$/u, '').split('\n');
  const [header, ...body] = lines;
  const records = body.map((line, index) => {
    if (line.length === 0) {
      throw new Error(`ts-quality doctor --machine emitted a blank protocol line at body line ${index + 1}.`);
    }
    if (line.includes('\r')) {
      throw new Error(`ts-quality doctor --machine emitted CR in body line ${index + 1}.`);
    }
    const [kind = '', ...fields] = line.split('\t');
    if (!/^[a-z][a-z0-9_-]*$/u.test(kind)) {
      throw new Error(`ts-quality doctor --machine emitted invalid record kind '${kind}'.`);
    }
    /** @type {Map<string, string[]>} */
    const keyValues = new Map();
    for (const field of fields) {
      if (field.includes('\n') || field.includes('\r') || field.includes('\t')) {
        throw new Error(`ts-quality doctor --machine emitted an unescaped control character in ${kind}.`);
      }
      const pair = splitMachineKeyValue(field);
      if (!pair) {
        continue;
      }
      const [key, value] = pair;
      if (!/^[A-Za-z][A-Za-z0-9_]*$/u.test(key)) {
        continue;
      }
      keyValues.set(key, [...(keyValues.get(key) ?? []), value]);
    }
    return { kind, fields, keyValues };
  });
  return { header: header ?? '', records };
}

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
      const parsed = parseDoctorMachineProtocol(stdout);
      const recordKinds = parsed.records.map((record) => record.kind);
      for (const requiredKind of ['root', 'config', 'changed', 'files', 'scripts', 'coverage', 'mutation', 'recommend']) {
        if (!recordKinds.includes(requiredKind)) {
          throw new Error(`ts-quality doctor --machine omitted required ${requiredKind} record.`);
        }
      }
      const commandArgRecords = parsed.records.filter((record) => (record.keyValues.get('command_arg') ?? []).length > 0);
      if (commandArgRecords.length === 0) {
        throw new Error('ts-quality doctor --machine did not emit any exact command_arg fields.');
      }
      if (commandArgRecords.some((record) => record.fields.some((field) => field.startsWith('command=')))) {
        throw new Error('ts-quality doctor --machine emitted a command= field; v1 requires repeated command_arg= fields.');
      }
      return {
        header: parsed.header,
        commandField: 'command_arg',
        commandEncoding: 'repeated-field',
        recordKinds: [...new Set(recordKinds)].join(',')
      };
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
 * @param {string} rootDir
 */
export function writeManualWitnessContractProject(rootDir) {
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.ts-quality'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'package.json'), `${JSON.stringify({ name: 'ts-quality-manual-witness-contract', private: true, type: 'module' }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'token.js'), `export function isExpired(expiresAt, now = 10) {\n  return now >= expiresAt;\n}\n`, 'utf8');
  fs.writeFileSync(path.join(rootDir, 'test', 'token.test.js'), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { isExpired } from '../src/token.js';",
    "test('exact boundary denies access', () => { assert.equal(isExpired(10, 10), true); });",
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'invariants.ts'), `export default [{\n  id: 'auth.refresh.validity',\n  title: 'Refresh token validity',\n  description: 'Expired refresh tokens must never authorize access.',\n  severity: 'high',\n  selectors: ['path:src/token.js', 'symbol:isExpired'],\n  scenarios: [{\n    id: 'expired-boundary',\n    description: 'exact expiry boundary denies access',\n    keywords: ['exact boundary'],\n    failurePathKeywords: ['denies access'],\n    expected: 'deny'\n  }]\n}];\n`, 'utf8');
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'constitution.ts'), 'export default [];\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'agents.ts'), 'export default [];\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.ts'), `export default {\n  sourcePatterns: ['src/**/*.js'],\n  testPatterns: ['test/**/*.js'],\n  coverage: { lcovPath: 'coverage/lcov.info' },\n  mutations: { testCommand: ['node', '--test', 'test/token.test.js'], coveredOnly: false, timeoutMs: 10000, maxSites: 2 },\n  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },\n  changeSet: { files: ['src/token.js'] },\n  invariantsPath: '.ts-quality/invariants.ts',\n  constitutionPath: '.ts-quality/constitution.ts',\n  agentsPath: '.ts-quality/agents.ts'\n};\n`, 'utf8');
}

/**
 * @param {(args: string[], cwd: string) => string} runCli
 * @param {{ baseDir: string }} options
 */
export function verifyManualWitnessContract(runCli, options) {
  const projectRoot = fs.mkdtempSync(path.join(options.baseDir, 'tsq-manual-witness-contract-'));
  try {
    writeManualWitnessContractProject(projectRoot);
    const doctorMachine = runCli(['doctor', '--root', projectRoot, '--machine', '--changed', 'src/token.js'], projectRoot);
    const parsedDoctorMachine = parseDoctorMachineProtocol(doctorMachine);
    const doctorRecordKinds = [...new Set(parsedDoctorMachine.records.map((record) => record.kind))];
    const doctorCommandArgRecordCount = parsedDoctorMachine.records.filter((record) => (record.keyValues.get('command_arg') ?? []).length > 0).length;
    if (!doctorRecordKinds.includes('recommend') || doctorCommandArgRecordCount === 0) {
      throw new Error(`Minimum adoption contract doctor output did not include command recommendations:\n${doctorMachine}`);
    }
    runCli([
      'witness',
      'test',
      '--root', projectRoot,
      '--invariant', 'auth.refresh.validity',
      '--scenario', 'expired-boundary',
      '--source-files', 'src/token.js',
      '--test-files', 'test/token.test.js',
      '--out', manualWitnessContractPath,
      '--',
      'node', '--test', 'test/token.test.js'
    ], projectRoot);
    runCli(['check', '--root', projectRoot, '--run-id', manualWitnessContractRunId], projectRoot);
    const reportText = runCli(['report', '--root', projectRoot, '--run-id', manualWitnessContractRunId], projectRoot);
    const explainText = runCli(['explain', '--root', projectRoot, '--run-id', manualWitnessContractRunId], projectRoot);
    if (!reportText.includes('# ts-quality report')) {
      throw new Error(`Minimum adoption contract report did not render the selected run:\n${reportText}`);
    }
    if (!explainText.includes('Reasons:')) {
      throw new Error(`Minimum adoption contract explain did not render reasons for the selected run:\n${explainText}`);
    }
    const run = JSON.parse(fs.readFileSync(path.join(projectRoot, '.ts-quality', 'runs', manualWitnessContractRunId, 'run.json'), 'utf8'));
    const claim = /** @type {any[] | undefined} */ (run.behaviorClaims)?.find((item) => item.invariantId === 'auth.refresh.validity');
    const scenario = /** @type {any[] | undefined} */ (claim?.evidenceSummary?.scenarioResults)?.find((item) => item.scenarioId === 'expired-boundary');
    const witnessFiles = claim?.evidenceSummary?.executionWitnessFiles ?? [];
    if (claim?.evidenceSummary?.evidenceSemantics !== 'execution-backed') {
      throw new Error(`Manual witness contract did not produce execution-backed evidence: ${JSON.stringify(claim?.evidenceSummary, null, 2)}`);
    }
    if (scenario?.supportKind !== 'execution-witness' || scenario?.supported !== true) {
      throw new Error(`Manual witness contract did not mark the scenario as execution-witness support: ${JSON.stringify(scenario, null, 2)}`);
    }
    if (JSON.stringify(witnessFiles) !== JSON.stringify([manualWitnessContractPath])) {
      throw new Error(`Manual witness contract consumed unexpected witness files: ${JSON.stringify(witnessFiles)}`);
    }
    if (run.executionWitnesses !== undefined) {
      throw new Error(`Manual witness contract should not auto-run configured execution witnesses: ${JSON.stringify(run.executionWitnesses, null, 2)}`);
    }
    if (run.nextEvidenceAction?.evidenceBasis?.witness?.status !== 'execution-backed') {
      throw new Error(`Manual witness contract did not update next evidence witness basis: ${JSON.stringify(run.nextEvidenceAction?.evidenceBasis?.witness)}`);
    }
    return {
      fixture: 'manual-witness-contract',
      story: 'doctor-machine -> manual witness -> check -> report/explain by run id',
      runId: manualWitnessContractRunId,
      witnessPath: manualWitnessContractPath,
      doctorMachine: {
        header: parsedDoctorMachine.header,
        recordKinds: doctorRecordKinds,
        commandArgRecordCount: doctorCommandArgRecordCount
      },
      evidenceSemantics: claim.evidenceSummary.evidenceSemantics,
      scenarioSupportKind: scenario.supportKind,
      nextEvidenceWitnessStatus: run.nextEvidenceAction.evidenceBasis.witness.status,
      autoRanExecutionWitnesses: false,
      projections: {
        reportByRunId: true,
        explainByRunId: true
      }
    };
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
}

/**
 * @param {{ packageSpec: string, attempts?: number, cwd?: string, env?: Record<string, string> }} options
 */
export function verifyPublicNpxManualWitnessContract(options) {
  const attempts = options.attempts ?? 1;
  const baseDir = fs.mkdtempSync(path.join(options.cwd ?? process.cwd(), '.tsq-public-manual-witness-'));
  try {
    return verifyManualWitnessContract((args, cwd) => {
      let lastStdout = '';
      let lastStderr = '';
      let lastStatus = null;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const result = spawnSync('npx', ['-y', '-p', options.packageSpec, 'ts-quality', ...args], {
          cwd,
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
          console.error(`public manual witness contract attempt ${attempt}/${attempts} failed; retrying after ${attempt * 15}s.`);
          if (lastStdout.trim()) {
            console.error(lastStdout.trim());
          }
          if (lastStderr.trim()) {
            console.error(lastStderr.trim());
          }
          sleep(attempt * 15_000);
        }
      }
      throw new Error(`public manual witness contract failed after ${attempts} attempt(s) with status ${lastStatus}.\n${lastStdout}\n${lastStderr}`.trim());
    }, { baseDir });
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
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
    const cwd = path.resolve(path.dirname(modulePath), '..');
    const env = { NPM_CONFIG_MIN_RELEASE_AGE: '0' };
    const contract = verifyPublicNpxCliContract({
      packageSpec,
      attempts,
      cwd,
      env
    });
    const manualWitness = verifyPublicNpxManualWitnessContract({
      packageSpec,
      attempts,
      cwd,
      env
    });
    console.log(JSON.stringify({
      ...summarizePublicCliContract(contract),
      manualWitness
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
