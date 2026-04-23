// @ts-check

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cli = path.join(root, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');
const cacheRoot = process.env['XDG_CACHE_HOME'] ?? path.join(os.homedir(), '.cache');
const smokeTempRoot = path.join(cacheRoot, 'ts-quality', 'smoke');

fs.mkdirSync(smokeTempRoot, { recursive: true });

/**
 * @param {string} name
 * @returns {string}
 */
function tempCopy(name) {
  const source = path.join(root, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(smokeTempRoot, `tsq-smoke-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function run(args, cwd) {
  const result = spawnSync('node', [cli, ...args, '--root', cwd], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

const governed = tempCopy('governed-app');
run(['check'], governed);
run(['check'], governed);
run(['report'], governed);
run(['explain'], governed);
run(['trend'], governed);
run(['plan'], governed);
run(['govern'], governed);
const runId = JSON.parse(fs.readFileSync(path.join(governed, '.ts-quality', 'latest.json'), 'utf8')).latestRunId;
run(['attest', 'sign', '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', `.ts-quality/runs/${runId}/verdict.json`, '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/ci.tests.passed.json'], governed);
run(['attest', 'verify', '--attestation', '.ts-quality/attestations/ci.tests.passed.json', '--trusted-keys', '.ts-quality/keys'], governed);
run(['authorize', '--agent', 'release-bot'], governed);
const mini = tempCopy('mini-monorepo');
run(['check'], mini);
run(['govern'], mini);
console.log('smoke: ok');
