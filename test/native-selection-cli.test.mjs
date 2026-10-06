import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

const cli = path.join(repoRoot, 'dist/packages/ts-quality/src/cli.js');

function write(root, file, text) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

// A repo whose test and coverage commands leave markers, so any execution by an inert command is visible.
function fixture(t, mutations = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-native-selection-cli-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'package.json', JSON.stringify({ name: 'native-selection', private: true }));
  write(root, 'src/flag.js', 'function isOne(v) { return v === 1; }\nfunction isTwo(v) { return v === 2; }\nmodule.exports = { isOne, isTwo };\n');
  write(root, 'test/flag.test.js', "require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'test-ran.marker'), 'x');\nconst {test} = require('node:test'); const assert = require('node:assert/strict'); const {isOne, isTwo} = require('../src/flag.js');\ntest('flags', () => { assert.equal(isOne(1), true); assert.equal(isOne(2), false); assert.equal(isTwo(2), true); assert.equal(isTwo(1), false); });\n");
  write(root, 'ts-quality.config.json', JSON.stringify({
    sourcePatterns: ['src/**/*.js'], testPatterns: ['test/**/*.js'],
    coverage: { lcovPath: 'coverage/lcov.info', generateCommand: ['node', '-e', "const fs = require('fs'); fs.writeFileSync('coverage-ran.marker', 'x'); fs.writeFileSync('coverage/lcov.info', 'SF:src/flag.js\\nDA:1,1\\nDA:2,1\\nend_of_record\\n');"] },
    mutations: { testCommand: ['node', '--test', 'test/flag.test.js'], coveredOnly: false, timeoutMs: 10000, maxSites: 10, ...mutations },
    policy: { minMutationScore: 0, minMergeConfidence: 0 },
    changeSet: { files: ['src/flag.js'] }, invariantsPath: '.ts-quality/invariants.json',
    constitutionPath: '.ts-quality/constitution.json', agentsPath: '.ts-quality/agents.json'
  }));
  write(root, '.ts-quality/invariants.json', '[]');
  write(root, '.ts-quality/constitution.json', '[]');
  write(root, '.ts-quality/agents.json', '[]');
  return root;
}

function run(root, args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8', env });
}

function listing(root) {
  return fs.readdirSync(root, { recursive: true }).map(String).sort();
}

test('Scenario: mutations preview is inert and reports the selection ledger', (t) => {
  const root = fixture(t);
  const before = listing(root);
  const text = run(root, ['mutations', 'preview', '--mutation-targets', 'symbol:src/flag.js#function:isOne']);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /^Mutation preview \(inert: no command ran and nothing was written\)/);
  assert.match(text.stdout, /- symbol:src\/flag\.js#function:isOne: resolved, 2 eligible, 2 selected/);
  assert.match(text.stdout, /Excluded: not-targeted 1/);
  const json = run(root, ['mutations', 'preview', '--json']);
  assert.equal(json.status, 0, json.stderr);
  const preview = JSON.parse(json.stdout);
  assert.equal(preview.executed, false);
  assert.deepEqual(preview.testCommand, { cwd: '.', argv: ['node', '--test', 'test/flag.test.js'] });
  assert.deepEqual(preview.selection.counts, { discovered: 3, eligible: 3, selected: 3, excluded: 0, executed: 0, cached: 0, unobserved: 0 });
  assert.equal(preview.sites.length, 3);
  // Then nothing ran and nothing was written: no test, no coverage generation, no manifest, no runs
  assert.deepEqual(listing(root), before);
});

test('Scenario: check refuses unresolved mutation targets before running any command', (t) => {
  const root = fixture(t);
  const result = run(root, ['check', '--run-id', 'stale-target', '--mutation-targets', 'symbol:src/flag.js#function:renamed;site:not-a-current-site']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Mutation target\(s\) unresolved: symbol:src\/flag\.js#function:renamed \(not-found\), site:not-a-current-site \(stale-site\)/);
  assert.equal(fs.existsSync(path.join(root, 'test-ran.marker')), false);
  assert.equal(fs.existsSync(path.join(root, 'coverage-ran.marker')), false);
  assert.equal(fs.existsSync(path.join(root, '.ts-quality/runs/stale-target/run.json')), false);
});

test('Scenario: check records the selection ledger and result provenance for resolved targets', (t) => {
  const root = fixture(t);
  const result = run(root, ['check', '--run-id', 'targeted', '--mutation-targets', 'symbol:src/flag.js#function:isTwo']);
  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(fs.readFileSync(path.join(root, '.ts-quality/runs/targeted/run.json'), 'utf8'));
  const ledger = packet.mutationSelection;
  assert.equal(ledger.version, '1');
  assert.deepEqual(ledger.targets.map((item) => [item.status, item.matchedSites]), [['resolved', 1]]);
  assert.equal(ledger.counts.selected, 1);
  assert.equal(ledger.counts.executed + ledger.counts.cached, 1);
  assert.equal(ledger.complete, true);
  assert.deepEqual(packet.mutations.map((item) => item.span.startLine), [2]);
  assert.equal(packet.mutations.every((item) => item.origin === 'executed'), true);
});

test('Scenario: an invalid configured mutation target fails config loading', (t) => {
  const root = fixture(t, { targets: ['line:src/flag.js:1'] });
  const result = run(root, ['mutations', 'preview']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid mutation target "line:src\/flag\.js:1"/);
});

test('Scenario: an exhausted time budget fails the verdict closed instead of passing on partial evidence', (t) => {
  const root = fixture(t, { maxDurationMs: 1 });
  const result = run(root, ['check', '--run-id', 'budget']);
  assert.equal(result.status, 0, result.stderr);
  const packet = JSON.parse(fs.readFileSync(path.join(root, '.ts-quality/runs/budget/run.json'), 'utf8'));
  assert.equal(packet.mutationSelection.complete, false);
  assert.equal(packet.mutationSelection.counts.unobserved, 2);
  assert.equal(packet.mutations.filter((item) => item.errorKind === 'budget').length, 2);
  assert.equal(packet.verdict.outcome, 'fail');
});

test('Scenario: an empty --mutation-targets value is rejected instead of silently dropping configured targets', (t) => {
  const root = fixture(t, { targets: ['symbol:src/flag.js#function:isOne'] });
  for (const value of [';', ' ', ' ; ']) {
    const result = run(root, ['mutations', 'preview', '--mutation-targets', value]);
    assert.notEqual(result.status, 0, value);
    assert.match(result.stderr, /--mutation-targets requires at least one target spec/);
  }
});

test('Scenario: refused command-line targets do not consume the run id', (t) => {
  const root = fixture(t);
  const refused = run(root, ['check', '--run-id', 'retry-me', '--mutation-targets', 'symbol:src/flag.js#function:renamed']);
  assert.notEqual(refused.status, 0);
  const retried = run(root, ['check', '--run-id', 'retry-me', '--mutation-targets', 'symbol:src/flag.js#function:isOne']);
  assert.equal(retried.status, 0, retried.stderr);
});

test('Scenario: a targeted run is not trend-comparable to a run with a different mutation selection', (t) => {
  const root = fixture(t);
  assert.equal(run(root, ['check', '--run-id', 'full']).status, 0);
  assert.equal(run(root, ['check', '--run-id', 'narrow', '--mutation-targets', 'symbol:src/flag.js#function:isTwo']).status, 0);
  const narrow = JSON.parse(fs.readFileSync(path.join(root, '.ts-quality/runs/narrow/run.json'), 'utf8'));
  assert.equal(narrow.trend, undefined);
});
