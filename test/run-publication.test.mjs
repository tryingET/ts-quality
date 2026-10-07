import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { importDist, repoRoot } from './helpers.mjs';

// Crash-recovery proof for run packet publication. This is about completeness after an interrupted check,
// not authenticity: manual filesystem edits are out of scope.
const evidence = await importDist('packages', 'evidence-model', 'src', 'index.js');
const cli = path.join(repoRoot, 'dist/packages/ts-quality/src/cli.js');

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-run-publication-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'package.json', JSON.stringify({ name: 'run-publication', private: true }));
  write(root, 'src/flag.js', 'exports.isOne = (v) => v === 1;\n');
  write(root, 'test/flag.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {isOne} = require('../src/flag.js'); test('one', () => { assert.equal(isOne(1), true); assert.equal(isOne(2), false); });\n");
  write(root, 'ts-quality.config.json', JSON.stringify({
    sourcePatterns: ['src/**/*.js'], testPatterns: ['test/**/*.js'],
    mutations: { testCommand: ['node', '--test', 'test/flag.test.js'], coveredOnly: false, timeoutMs: 10000, maxSites: 1 },
    policy: { minMutationScore: 0, minMergeConfidence: 0 },
    changeSet: { files: ['src/flag.js'] }, invariantsPath: '.ts-quality/invariants.json',
    constitutionPath: '.ts-quality/constitution.json', agentsPath: '.ts-quality/agents.json'
  }));
  write(root, '.ts-quality/invariants.json', '[]');
  write(root, '.ts-quality/constitution.json', '[]');
  write(root, '.ts-quality/agents.json', JSON.stringify([{ id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [{ id: 'merge', actions: ['merge'], paths: ['**'], minMergeConfidence: 0 }] }]));
  return root;
}

function cliRun(root, args, fault) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  if (fault) {
    env.TS_QUALITY_TEST_FAULT = fault;
  } else {
    delete env.TS_QUALITY_TEST_FAULT;
  }
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8', env });
}

const runsDir = (root) => path.join(root, '.ts-quality', 'runs');
const latest = (root) => fs.readFileSync(path.join(root, '.ts-quality', 'latest.json'));
const packetBytes = (root, runId) => Object.fromEntries(fs.readdirSync(path.join(runsDir(root), runId)).sort().map((file) => [file, fs.readFileSync(path.join(runsDir(root), runId, file), 'utf8')]));

for (const fault of ['after-run-json', 'before-publish']) {
  test(`Scenario: a check interrupted ${fault} publishes nothing and leaves the previous packet and latest pointer untouched`, (t) => {
    const root = fixture(t);
    assert.equal(cliRun(root, ['check', '--run-id', 'previous']).status, 0);
    const previous = packetBytes(root, 'previous');
    const pointer = latest(root);

    const crashed = cliRun(root, ['check', '--run-id', 'crashed'], fault);
    assert.notEqual(crashed.status, 0);
    assert.match(crashed.stderr, new RegExp(`injected fault at ${fault}`));

    // Then no packet is visible under the run id and readers refuse it
    assert.equal(fs.existsSync(path.join(runsDir(root), 'crashed')), false);
    assert.deepEqual(evidence.listRunIds(root), ['previous']);
    assert.notEqual(cliRun(root, ['report', '--run-id', 'crashed']).status, 0);
    // And the previous packet and the latest pointer are byte-identical
    assert.deepEqual(packetBytes(root, 'previous'), previous);
    assert.deepEqual(latest(root), pointer);
    // And the interrupted reservation is not recycled, while a new id publishes normally
    assert.match(cliRun(root, ['check', '--run-id', 'crashed']).stderr, /already exists or is reserved/);
    assert.equal(cliRun(root, ['check', '--run-id', 'retry']).status, 0);
    assert.deepEqual(evidence.listRunIds(root), ['previous', 'retry']);
  });
}

test('Scenario: a check interrupted after publication but before the latest pointer leaves a complete packet and a valid older pointer', (t) => {
  const root = fixture(t);
  assert.equal(cliRun(root, ['check', '--run-id', 'previous']).status, 0);
  const pointer = latest(root);
  const crashed = cliRun(root, ['check', '--run-id', 'published'], 'before-latest');
  assert.notEqual(crashed.status, 0);
  const publication = JSON.parse(fs.readFileSync(path.join(runsDir(root), 'published', 'publication.json'), 'utf8'));
  assert.equal(publication.kind, 'run-packet-publication');
  assert.equal(publication.runId, 'published');
  assert.equal(publication.files.every((file) => fs.existsSync(path.join(runsDir(root), 'published', file))), true);
  assert.deepEqual(publication.files.filter((file) => ['run.json', 'verdict.json', 'report.json', 'check-summary.txt'].includes(file)).sort(), ['check-summary.txt', 'report.json', 'run.json', 'verdict.json']);
  assert.deepEqual(latest(root), pointer);
  assert.equal(cliRun(root, ['report', '--run-id', 'published']).status, 0);
});

test('Scenario: readers fail closed on a published packet with missing files or a malformed publication record', (t) => {
  const root = fixture(t);
  assert.equal(cliRun(root, ['check', '--run-id', 'damaged']).status, 0);
  assert.equal(cliRun(root, ['check', '--run-id', 'malformed']).status, 0);
  fs.unlinkSync(path.join(runsDir(root), 'damaged', 'verdict.json'));
  fs.writeFileSync(path.join(runsDir(root), 'malformed', 'publication.json'), '{"version":"1","kind":"run-packet-publication","runId":"other","files":[]}\n');
  assert.throws(() => evidence.loadRun(root, 'damaged'), /incomplete: missing verdict\.json/);
  assert.throws(() => evidence.loadRun(root, 'malformed'), /publication record/);
  for (const command of [['report', '--run-id', 'damaged'], ['explain', '--run-id', 'damaged'], ['authorize', '--agent', 'maintainer', '--run-id', 'damaged']]) {
    const result = cliRun(root, command);
    assert.notEqual(result.status, 0, command.join(' '));
    assert.match(result.stderr, /incomplete/);
  }
  // And a later check is not blocked: incomplete packets are skipped as comparison candidates
  assert.equal(cliRun(root, ['check', '--run-id', 'after-damage']).status, 0);
});

test('Scenario: staging leftovers are never listed and legacy packets without a publication record stay readable', (t) => {
  const root = fixture(t);
  assert.equal(cliRun(root, ['check', '--run-id', 'current']).status, 0);
  const legacyDir = path.join(runsDir(root), 'legacy');
  fs.mkdirSync(legacyDir);
  fs.copyFileSync(path.join(runsDir(root), 'current', 'run.json'), path.join(legacyDir, 'run.json'));
  const leftover = path.join(runsDir(root), '.orphan.staging-abc123');
  fs.mkdirSync(leftover);
  fs.writeFileSync(path.join(leftover, 'run.json'), '{"runId":"orphan"');
  assert.deepEqual(evidence.listRunIds(root), ['current', 'legacy']);
  assert.equal(evidence.loadRun(root, 'legacy').runId, 'current');
  assert.equal(cliRun(root, ['trend']).status, 0);
});

test('Scenario: concurrent producers with different run ids both publish complete packets and the latest pointer stays valid', async (t) => {
  const root = fixture(t);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.TS_QUALITY_TEST_FAULT;
  const runOne = (runId) => new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'check', '--run-id', runId, '--root', root], { env, stdio: 'ignore' });
    child.on('close', resolve);
  });
  const codes = await Promise.all([runOne('left'), runOne('right')]);
  assert.deepEqual(codes, [0, 0]);
  for (const runId of ['left', 'right']) {
    const publication = JSON.parse(fs.readFileSync(path.join(runsDir(root), runId, 'publication.json'), 'utf8'));
    assert.equal(publication.files.every((file) => fs.existsSync(path.join(runsDir(root), runId, file))), true);
  }
  assert.equal(['left', 'right'].includes(JSON.parse(latest(root)).latestRunId), true);
  assert.deepEqual(fs.readdirSync(runsDir(root)).filter((name) => name.includes('.staging-')), []);
});
