import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

// Intervention lineage: "observed survivor before; observed kill after a declared test edit" is reported only with
// a defensible site identity, fresh green execution and an otherwise fixed context. Everything else stays unknown or
// labeled with the context that changed. It never claims the test edit caused the kill.
const cli = path.join(repoRoot, 'dist/packages/ts-quality/src/cli.js');

const SOURCE = 'exports.big = (v) => v > 10;\n';
const WEAK_TEST = "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require('../src/big.js');\ntest('big', () => { assert.equal(big(20), true); assert.equal(big(1), false); });\n";
const STRONG_TEST = "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require('../src/big.js');\ntest('big', () => { assert.equal(big(20), true); assert.equal(big(1), false); assert.equal(big(10), false); });\n";

// Hangs only when the boundary mutant makes big(10) true, so that mutant ends in a timeout without a verdict.
const HANGING_TEST = "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require('../src/big.js');\ntest('big', () => { if (big(10)) { const end = Date.now() + 6000; while (Date.now() < end) {} } assert.equal(big(20), true); });\n";

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

function config(root, overrides = {}) {
  write(root, 'ts-quality.config.json', JSON.stringify({
    sourcePatterns: ['src/**/*.js'], testPatterns: ['test/**/*.js'],
    mutations: { testCommand: ['node', '--test', 'test/'], coveredOnly: false, timeoutMs: 10000, maxSites: 5, ...overrides.mutations },
    policy: { minMutationScore: 0, minMergeConfidence: 0, ...overrides.policy },
    changeSet: { files: ['src/big.js'] }, invariantsPath: '.ts-quality/invariants.json',
    constitutionPath: '.ts-quality/constitution.json', agentsPath: '.ts-quality/agents.json'
  }));
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-navigation-lineage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'package.json', JSON.stringify({ name: 'navigation-lineage', private: true }));
  write(root, 'src/big.js', SOURCE);
  write(root, 'test/big.test.js', WEAK_TEST);
  config(root);
  write(root, '.ts-quality/invariants.json', '[]');
  write(root, '.ts-quality/constitution.json', '[]');
  write(root, '.ts-quality/agents.json', '[]');
  return root;
}

function cliRun(root, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8', env });
}

function check(root, runId, extraEnv) {
  const result = cliRun(root, ['check', '--run-id', runId], extraEnv);
  assert.equal(result.status, 0, result.stderr);
}

function lineage(root, extra = []) {
  const result = cliRun(root, ['navigate', '--run-id', 'after', '--intervention-from', 'before', '--intervention-tests', 'test/big.test.js', '--json', ...extra]);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout).lineage;
}

// The boundary mutant `>` -> `>=` survives the weak test and is killed by the added big(10) assertion.
const boundary = (entries) => entries.find((entry) => entry.original === '>' && entry.replacement === '>=');

test('Scenario: an assertion added to the declared test kills the observed survivor under a fixed context', (t) => {
  const root = fixture(t);
  check(root, 'before');
  write(root, 'test/big.test.js', STRONG_TEST);
  check(root, 'after');
  const result = lineage(root);
  assert.equal(result.comparison, 'intervention-lineage');
  assert.deepEqual(result.declaredTests, ['test/big.test.js']);
  const entry = boundary(result.sites);
  assert.equal(entry.status, 'observed-kill-after-declared-intervention');
  assert.deepEqual(entry.contextChanges, []);
  assert.match(entry.statement, /observed survivor before; observed kill after declared test edit/);
  assert.doesNotMatch(JSON.stringify(result), /caused/);
  assert.equal(result.clearsBroaderInvariants, false);
});

const contextCases = [
  { name: 'a deleted declared test', change: (root) => { fs.unlinkSync(path.join(root, 'test/big.test.js')); write(root, 'test/other.test.js', STRONG_TEST); }, label: 'test-deleted' },
  { name: 'an undeclared test edit', change: (root) => write(root, 'test/extra.test.js', STRONG_TEST), label: 'undeclared-test-change' },
  { name: 'a source edit elsewhere in the file', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); write(root, 'src/big.js', `${SOURCE}// unrelated\n`); }, label: 'source-changed' },
  { name: 'a changed test command', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); config(root, { mutations: { testCommand: ['node', '--test', 'test/big.test.js'] } }); }, label: 'command-changed' },
  { name: 'a changed timeout', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); config(root, { mutations: { timeoutMs: 9000 } }); }, label: 'timeout-changed' },
  { name: 'a changed policy', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); config(root, { policy: { minMergeConfidence: 1 } }); }, label: 'policy-changed' },
  { name: 'a changed dependency lockfile', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); write(root, 'package-lock.json', '{"lockfileVersion":3}\n'); }, label: 'dependency-changed' }
];

for (const item of contextCases) {
  test(`Scenario: a kill after ${item.name} is labeled ${item.label}, not attributed to the intervention`, (t) => {
    const root = fixture(t);
    check(root, 'before');
    item.change(root);
    check(root, 'after');
    const entry = boundary(lineage(root).sites);
    assert.notEqual(entry.status, 'observed-kill-after-declared-intervention');
    assert.equal(entry.contextChanges.includes(item.label), true, JSON.stringify(entry));
  });
}

test('Scenario: an environment-only change is labeled environment-changed', (t) => {
  const root = fixture(t);
  check(root, 'before');
  write(root, 'test/big.test.js', STRONG_TEST);
  check(root, 'after', { TSQ_NAVIGATION_FIXTURE_ENV: 'changed' });
  assert.equal(boundary(lineage(root).sites).contextChanges.includes('environment-changed'), true);
});

test('Scenario: a recorded runtime difference is labeled runtime-changed', (t) => {
  const root = fixture(t);
  check(root, 'before');
  write(root, 'test/big.test.js', STRONG_TEST);
  check(root, 'after');
  // Simulate a before-run on another Node version by rewriting this scratch packet's recorded runtime.
  const beforePath = path.join(root, '.ts-quality/runs/before/run.json');
  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
  before.mutationContext.runtime.node = 'v0.0.0-other';
  fs.writeFileSync(beforePath, JSON.stringify(before));
  assert.equal(boundary(lineage(root).sites).contextChanges.includes('runtime-changed'), true);
});

test('Scenario: unselected, unobserved, cached and moved sites stay unknown and never clear the obligation', (t) => {
  const cases = [
    { name: 'not selected after (site budget 0)', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); config(root, { mutations: { maxSites: 0 } }); }, reason: 'not-selected-after' },
    { name: 'no verdict after (mutant times out)', change: (root) => { write(root, 'test/big.test.js', HANGING_TEST); config(root, { mutations: { timeoutMs: 2000 } }); }, reason: 'no-verdict-after' },
    { name: 'cached after (nothing changed)', change: () => {}, reason: 'cached-after' },
    { name: 'moved site (identity changed)', change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); write(root, 'src/big.js', `// moved\n${SOURCE}`); }, reason: 'site-identity-missing' }
  ];
  for (const item of cases) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-navigation-unknown-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    write(root, 'package.json', JSON.stringify({ name: 'navigation-unknown', private: true }));
    write(root, 'src/big.js', SOURCE);
    write(root, 'test/big.test.js', WEAK_TEST);
    config(root);
    write(root, '.ts-quality/invariants.json', '[]');
    write(root, '.ts-quality/constitution.json', '[]');
    write(root, '.ts-quality/agents.json', '[]');
    check(root, 'before');
    item.change(root);
    check(root, 'after');
    const entry = boundary(lineage(root).sites);
    assert.equal(entry.status, 'unknown', `${item.name}: ${JSON.stringify(entry)}`);
    if (item.reason) {
      assert.equal(entry.reason, item.reason, item.name);
    }
    assert.equal(entry.clearsObligation, false, item.name);
  }
});

test('Scenario: lineage refuses unsafe or unsupported inputs', (t) => {
  const root = fixture(t);
  check(root, 'before');
  check(root, 'after');
  const refuse = (args, pattern) => {
    const result = cliRun(root, ['navigate', '--run-id', 'after', ...args, '--json']);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.match(result.stderr, pattern, args.join(' '));
  };
  refuse(['--intervention-from', '../escape', '--intervention-tests', 'test/big.test.js'], /runId must use only/);
  refuse(['--intervention-from', 'before', '--intervention-tests', '../outside.test.js'], /must stay inside repository root/);
  refuse(['--intervention-from', 'before', '--intervention-tests', 'src/big.js'], /not a test file/);
  refuse(['--intervention-from', 'before'], /--intervention-tests/);
  refuse(['--intervention-from', 'after', '--intervention-tests', 'test/big.test.js'], /different earlier run/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-navigation-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.cpSync(path.join(root, '.ts-quality/runs/before'), outside, { recursive: true });
  fs.symlinkSync(outside, path.join(root, '.ts-quality/runs/linked'), 'dir');
  refuse(['--intervention-from', 'linked', '--intervention-tests', 'test/big.test.js'], /must stay inside repository root/);
  const unsupported = JSON.parse(fs.readFileSync(path.join(root, '.ts-quality/runs/before/run.json'), 'utf8'));
  unsupported.version = '9.9.9';
  fs.mkdirSync(path.join(root, '.ts-quality/runs/future'));
  fs.writeFileSync(path.join(root, '.ts-quality/runs/future/run.json'), JSON.stringify(unsupported));
  refuse(['--intervention-from', 'future', '--intervention-tests', 'test/big.test.js'], /unsupported run version/);
});

test('Scenario: a kill driven by another source file, a support file, config or the tool version is never attributed to the declared test', (t) => {
  const cases = [
    { name: 'other source file', label: 'source-changed', setup: (root) => { write(root, 'src/helper.js', "const {big} = require('./big.js');\nexports.check = () => big(20) && !big(1);\n"); write(root, 'test/big.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {check} = require('../src/helper.js');\ntest('check', () => { assert.equal(check(), true); });\n"); }, change: (root) => { write(root, 'src/helper.js', "const {big} = require('./big.js');\nexports.check = () => big(20) && !big(1) && !big(10);\n"); write(root, 'test/big.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {check} = require('../src/helper.js');\n// touched\ntest('check', () => { assert.equal(check(), true); });\n"); } },
    { name: 'support fixture outside testPatterns', label: 'support-file-changed', setup: (root) => { write(root, 'fixtures/limit.json', '{"limit":20}\n'); write(root, 'test/big.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require('../src/big.js'); const {limit} = require('../fixtures/limit.json');\ntest('big', () => { assert.equal(big(limit), limit !== 10); });\n"); }, change: (root) => { write(root, 'fixtures/limit.json', '{"limit":10}\n'); write(root, 'test/big.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require('../src/big.js'); const {limit} = require('../fixtures/limit.json');\n// touched\ntest('big', () => { assert.equal(big(limit), limit !== 10); });\n"); } },
    { name: 'non-policy config', label: 'config-changed', setup: () => {}, change: (root) => { write(root, 'test/big.test.js', STRONG_TEST); config(root, { mutations: { runtimeMirrorRoots: ['build'] } }); } }
  ];
  for (const item of cases) {
    const root = fixture(t);
    item.setup(root);
    check(root, 'before');
    item.change(root);
    check(root, 'after');
    const entry = boundary(lineage(root).sites);
    assert.notEqual(entry.status, 'observed-kill-after-declared-intervention', item.name);
    assert.equal(entry.contextChanges.includes(item.label), true, `${item.name}: ${JSON.stringify(entry)}`);
  }
});

test('Scenario: a recorded tool version difference is labeled tool-changed', (t) => {
  const root = fixture(t);
  check(root, 'before');
  write(root, 'test/big.test.js', STRONG_TEST);
  check(root, 'after');
  const beforePath = path.join(root, '.ts-quality/runs/before/run.json');
  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
  before.mutationContext.tool.tsQuality = '0.0.0-other';
  fs.writeFileSync(beforePath, JSON.stringify(before));
  assert.equal(boundary(lineage(root).sites).contextChanges.includes('tool-changed'), true);
});

test('Scenario: lineage between runs without recorded context reports no-execution-context instead of failing', (t) => {
  const root = fixture(t);
  check(root, 'before');
  write(root, 'test/big.test.js', STRONG_TEST);
  check(root, 'after');
  for (const runId of ['before', 'after']) {
    const file = path.join(root, `.ts-quality/runs/${runId}/run.json`);
    const packet = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete packet.mutationContext;
    fs.writeFileSync(file, JSON.stringify(packet));
  }
  const entry = boundary(lineage(root).sites);
  assert.deepEqual([entry.status, entry.reason, entry.clearsObligation], ['unknown', 'no-execution-context', false]);
});

test('Scenario: a survivor outside the after-run changed scope is reported as such, not as a moved site', (t) => {
  const root = fixture(t);
  check(root, 'before');
  write(root, 'src/other.js', 'exports.other = (v) => v === 1;\n');
  write(root, 'test/big.test.js', STRONG_TEST);
  const result = cliRun(root, ['check', '--run-id', 'after', '--changed', 'src/other.js']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(boundary(lineage(root).sites).reason, 'outside-after-scope');
});

test('Scenario: run files symlinked outside the repository, future after-runs and tests without a before-run are refused', (t) => {
  const root = fixture(t);
  check(root, 'before');
  check(root, 'after');
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-navigation-outside-file-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.copyFileSync(path.join(root, '.ts-quality/runs/before/run.json'), path.join(outside, 'run.json'));
  fs.mkdirSync(path.join(root, '.ts-quality/runs/escfile'));
  fs.symlinkSync(path.join(outside, 'run.json'), path.join(root, '.ts-quality/runs/escfile/run.json'));
  const escaped = cliRun(root, ['navigate', '--run-id', 'after', '--intervention-from', 'escfile', '--intervention-tests', 'test/big.test.js', '--json']);
  assert.notEqual(escaped.status, 0);
  assert.match(escaped.stderr, /must stay inside repository root/);
  const future = JSON.parse(fs.readFileSync(path.join(root, '.ts-quality/runs/after/run.json'), 'utf8'));
  future.version = '9.9.9';
  fs.mkdirSync(path.join(root, '.ts-quality/runs/future'));
  fs.writeFileSync(path.join(root, '.ts-quality/runs/future/run.json'), JSON.stringify(future));
  const navigated = cliRun(root, ['navigate', '--run-id', 'future', '--json']);
  assert.notEqual(navigated.status, 0);
  assert.match(navigated.stderr, /unsupported run version/);
  const orphan = cliRun(root, ['navigate', '--run-id', 'after', '--intervention-tests', 'test/big.test.js']);
  assert.notEqual(orphan.status, 0);
  assert.match(orphan.stderr, /--intervention-tests requires --intervention-from/);
});
