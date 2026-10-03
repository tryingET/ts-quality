import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { importDist, repoRoot } from './helpers.mjs';

const api = await importDist('packages', 'ts-quality', 'src', 'index.js');
const evidence = await importDist('packages', 'evidence-model', 'src', 'index.js');
const cli = path.join(repoRoot, 'dist/packages/ts-quality/src/cli.js');

function write(root, file, text) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}
function json(root, file, value) { write(root, file, JSON.stringify(value)); }
function fixture(t, changed = ['src/flag.js'], rules = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-run-trust-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  json(root, 'package.json', { name: 'run-trust', private: true });
  write(root, 'src/flag.js', 'exports.isOne = (v) => v === 1;\n');
  write(root, 'test/flag.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {isOne} = require('../src/flag.js'); test('one', () => { assert.equal(isOne(1), true); assert.equal(isOne(2), false); });\n");
  json(root, 'ts-quality.config.json', {
    sourcePatterns: ['src/**/*.js'], testPatterns: ['test/**/*.js'],
    mutations: { testCommand: ['node', '--test', 'test/flag.test.js'], coveredOnly: false, timeoutMs: 5000, maxSites: 1 },
    policy: { minMutationScore: 0, minMergeConfidence: 0 },
    changeSet: { files: changed }, invariantsPath: '.ts-quality/invariants.json',
    constitutionPath: '.ts-quality/constitution.json', agentsPath: '.ts-quality/agents.json'
  });
  json(root, '.ts-quality/invariants.json', []);
  json(root, '.ts-quality/constitution.json', rules);
  json(root, '.ts-quality/agents.json', [{ id: 'maintainer', kind: 'human', roles: ['maintainer'], grants: [{ id: 'merge', actions: ['merge'], paths: ['**'], minMergeConfidence: 0 }] }]);
  return root;
}
function report(root, runId) { return JSON.parse(api.renderLatestReport(root, 'json', { runId })); }
function authorize(root, runId) { return JSON.parse(api.runAuthorize(root, 'maintainer', 'merge', { runId }).output); }

test('occupied run ids cannot replace evidence behind existing approvals or execute commands', (t) => {
  const root = fixture(t, ['src/flag.js'], [{ kind: 'approval', id: 'review', paths: ['src/**'], message: 'review required', minApprovals: 1, roles: ['maintainer'] }]);
  api.runCheck(root, { runId: 'immutable' });
  json(root, '.ts-quality/approvals.json', [{ by: 'maintainer', role: 'maintainer', targetId: 'immutable', rationale: 'Reviewed original only', createdAt: '2026-01-01T00:00:00.000Z' }]);
  assert.equal(authorize(root, 'immutable').outcome, 'approve');
  const packet = fs.readFileSync(path.join(root, '.ts-quality/runs/immutable/run.json'));
  const decision = fs.readFileSync(path.join(root, '.ts-quality/runs/immutable/authorize.maintainer.merge.json'));
  const latest = fs.readFileSync(path.join(root, '.ts-quality/latest.json'));
  write(root, 'src/flag.js', 'exports.isOne = (v) => v === 2;\n');
  write(root, 'test/flag.test.js', "require('node:fs').writeFileSync('executed-marker', 'unsafe rerun');\n");
  assert.throws(() => api.runCheck(root, { runId: 'immutable' }), /already exists|reserved/);
  assert.equal(fs.existsSync(path.join(root, 'executed-marker')), false);
  assert.deepEqual(fs.readFileSync(path.join(root, '.ts-quality/runs/immutable/run.json')), packet);
  assert.deepEqual(fs.readFileSync(path.join(root, '.ts-quality/runs/immutable/authorize.maintainer.merge.json')), decision);
  assert.deepEqual(fs.readFileSync(path.join(root, '.ts-quality/latest.json')), latest);
  assert.equal(authorize(root, 'immutable').outcome, 'deny');
});

test('storage API cannot overwrite a persisted run independently of check', (t) => {
  const root = fixture(t);
  const { run } = api.runCheck(root, { runId: 'stored' });
  const packet = fs.readFileSync(path.join(root, '.ts-quality/runs/stored/run.json'));
  assert.throws(() => evidence.writeRunArtifact(root, { ...run, changedFiles: ['test/flag.test.js'] }), /EEXIST|already exists/);
  assert.deepEqual(fs.readFileSync(path.join(root, '.ts-quality/runs/stored/run.json')), packet);
});

test('failed and interrupted reservations are not silently recycled', (t) => {
  const root = fixture(t);
  const config = fs.readFileSync(path.join(root, 'ts-quality.config.json'));
  write(root, 'ts-quality.config.json', '{invalid json');
  assert.throws(() => api.runCheck(root, { runId: 'failed' }));
  assert.equal(fs.existsSync(path.join(root, '.ts-quality/latest.json')), false);
  assert.equal(fs.existsSync(path.join(root, '.ts-quality/runs/failed')), false);
  fs.writeFileSync(path.join(root, 'ts-quality.config.json'), config);
  assert.throws(() => api.runCheck(root, { runId: 'failed' }), /already exists|reserved/);
  evidence.reserveRunId(root, 'interrupted');
  assert.throws(() => api.runCheck(root, { runId: 'interrupted' }), /already exists|reserved/);
  assert.equal(api.runCheck(root, { runId: 'fresh-retry' }).run.runId, 'fresh-retry');
});

test('deletion of a declared changed file is drift even outside source inventory', (t) => {
  const root = fixture(t, ['src/flag.js', 'config/settings.json']);
  json(root, 'config/settings.json', { allow: false });
  api.runCheck(root, { runId: 'deletion' });
  fs.unlinkSync(path.join(root, 'config/settings.json'));
  assert.equal(report(root, 'deletion').decisionContext.drift.some((entry) => entry.actual === 'sha256:missing'), true);
  assert.equal(authorize(root, 'deletion').outcome, 'deny');
});

test('concurrent checks for the same run id admit only one producer', async (t) => {
  const root = fixture(t);
  const launch = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, 'check', '--root', root, '--run-id', 'concurrent']);
    let stderr = '';
    child.stdout.resume();
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stderr }));
  });
  const results = await Promise.all([launch(), launch()]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 1]);
  assert.match(results.find((result) => result.status === 1).stderr, /already exists|reserved/);
  assert.equal(report(root, 'concurrent').runId, 'concurrent');
});

for (const changedPath of ['config/settings.json', 'test/flag.test.js', 'src/excluded.txt']) {
  test(`drift in explicitly changed ${changedPath} denies authorization outside source inventory`, (t) => {
    const root = fixture(t, ['src/flag.js', changedPath]);
    if (changedPath !== 'test/flag.test.js') write(root, changedPath, '{"allow":false}\n');
    const { run } = api.runCheck(root, { runId: 'non-source' });
    assert.equal(run.files.some((file) => file.filePath === changedPath), false);
    assert.match(run.changedFileDigests[changedPath], /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(report(root, 'non-source').decisionContext.drift, []);
    assert.equal(authorize(root, 'non-source').outcome, 'approve');
    fs.appendFileSync(path.join(root, changedPath), '\n// changed after review\n');
    assert.equal(report(root, 'non-source').decisionContext.drift.some((entry) => entry.subject === `changed file ${changedPath}`), true);
    assert.equal(authorize(root, 'non-source').outcome, 'deny');
  });
}

test('missing changed files are snapshotted and creation is drift', (t) => {
  const root = fixture(t, ['src/flag.js', 'config/new.json']);
  const { run } = api.runCheck(root, { runId: 'missing' });
  assert.equal(run.changedFileDigests['config/new.json'], 'sha256:missing');
  assert.deepEqual(report(root, 'missing').decisionContext.drift, []);
  json(root, 'config/new.json', { allow: true });
  assert.equal(report(root, 'missing').decisionContext.drift.some((entry) => entry.subject === 'changed file config/new.json'), true);
  assert.equal(authorize(root, 'missing').outcome, 'deny');
});

test('legacy runs missing a changed-file digest fail closed instead of skipping it', (t) => {
  const root = fixture(t, ['src/flag.js', 'config/settings.json']);
  json(root, 'config/settings.json', { allow: false });
  const { run } = api.runCheck(root, { runId: 'legacy' });
  delete run.changedFileDigests;
  json(root, '.ts-quality/runs/legacy/run.json', run);
  assert.equal(report(root, 'legacy').decisionContext.drift.some((entry) => entry.subject === 'changed file config/settings.json' && entry.expected === 'sha256:unrecorded'), true);
  assert.equal(authorize(root, 'legacy').outcome, 'deny');
});

test('malformed changed-file snapshots cannot fall back to source-only digests', (t) => {
  const root = fixture(t);
  const { run } = api.runCheck(root, { runId: 'malformed' });
  for (const snapshot of [null, [], {}, { 'src/flag.js': 123 }, { 'src/flag.js': 'not-a-digest' }]) {
    json(root, '.ts-quality/runs/malformed/run.json', { ...run, changedFileDigests: snapshot });
    assert.throws(() => report(root, 'malformed'), /changed-file digest snapshot/);
    assert.throws(() => authorize(root, 'malformed'), /changed-file digest snapshot/);
  }
});
