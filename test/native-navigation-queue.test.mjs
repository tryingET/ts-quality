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

// strongTests kills every mutant; weak tests leave the `>` boundary survivor.
function fixture(t, { strongTests = false, rules = [], changed = 'src/big.js' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-navigation-queue-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'package.json', JSON.stringify({ name: 'navigation-queue', private: true }));
  write(root, changed, 'exports.big = (v) => v > 10;\n');
  const target = `../${changed}`;
  write(root, 'test/big.test.js', `const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require(${JSON.stringify(target)});\ntest('big', () => { assert.equal(big(20), true); assert.equal(big(1), false);${strongTests ? ' assert.equal(big(10), false);' : ''} });\n`);
  write(root, 'ts-quality.config.json', JSON.stringify({
    sourcePatterns: ['src/**/*.js'], testPatterns: ['test/**/*.js'],
    coverage: { lcovPath: 'coverage/lcov.info', generateCommand: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info', 'test/*.test.js'] },
    mutations: { testCommand: ['node', '--test', 'test/*.test.js'], coveredOnly: false, timeoutMs: 10000, maxSites: 5 },
    policy: { minMutationScore: 0, minMergeConfidence: 0, maxChangedCrap: 30 },
    changeSet: { files: [changed] }, invariantsPath: '.ts-quality/invariants.json',
    constitutionPath: '.ts-quality/constitution.json', agentsPath: '.ts-quality/agents.json'
  }));
  write(root, '.ts-quality/invariants.json', '[]');
  write(root, '.ts-quality/constitution.json', JSON.stringify(rules));
  write(root, '.ts-quality/agents.json', JSON.stringify([{ id: 'bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'merge', actions: ['merge'], paths: ['**'], minMergeConfidence: 101 }] }]));
  return root;
}

function cliRun(root, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8', env });
}

function navigate(root, runId, extra = [], extraEnv = {}) {
  const result = cliRun(root, ['navigate', '--run-id', runId, '--json', ...extra], extraEnv);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const approvalRule = [{ kind: 'approval', id: 'review', paths: ['src/**'], message: 'review required', minApprovals: 1, roles: ['maintainer'] }];

test('Scenario: a run with no blocking facts has an empty queue and an explicit no-blocker headline', (t) => {
  const root = fixture(t, { strongTests: true });
  assert.equal(cliRun(root, ['check', '--run-id', 'clean']).status, 0);
  const nav = navigate(root, 'clean');
  assert.equal(nav.version, '1');
  assert.equal(nav.kind, 'ts-quality-navigation');
  assert.deepEqual(nav.queue, []);
  assert.equal(nav.headline.class, 'none');
});

test('Scenario: governance-only, survivor-only and mixed runs order classes deterministically without changing primaryAction', (t) => {
  const governanceOnly = fixture(t, { strongTests: true, rules: approvalRule });
  const survivorOnly = fixture(t);
  const mixed = fixture(t, { rules: approvalRule });
  for (const root of [governanceOnly, survivorOnly, mixed]) {
    assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);
  }
  const classes = (root) => [...new Set(navigate(root, 'run').queue.map((item) => item.class))];
  assert.deepEqual(classes(governanceOnly), ['governance-veto']);
  assert.deepEqual(classes(survivorOnly).slice(0, 1), ['behavioral-counterexample']);
  assert.deepEqual(classes(mixed).slice(0, 2), ['governance-veto', 'behavioral-counterexample']);

  // The protected primaryAction is reported as is and its persisted projections are untouched by navigation.
  const actionPath = path.join(mixed, '.ts-quality/runs/run/next-evidence-action.json');
  const before = fs.readFileSync(actionPath);
  const nav = navigate(mixed, 'run');
  const persisted = JSON.parse(before.toString('utf8')).primaryAction;
  assert.deepEqual(nav.primaryAction, { kind: persisted.kind, title: persisted.title, source: 'run.nextEvidenceAction.primaryAction (unchanged)' });
  assert.notEqual(nav.headline.class, nav.primaryAction.kind);
  assert.deepEqual(fs.readFileSync(actionPath), before);
  // Every item explains its position: class rank, severity rank, scope and identity.
  assert.equal(nav.queue.every((item, index, all) => index === 0 || compareKeys(all[index - 1].orderKey, item.orderKey) <= 0), true);
  assert.match(nav.orderingExplanation, /class rank, then severity, then scope, then identity/);
});

function compareKeys(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

test('Scenario: freshness drift outranks a survivor, and an authorization denial is a legitimacy fact', (t) => {
  const root = fixture(t);
  assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);
  cliRun(root, ['authorize', '--agent', 'bot', '--run-id', 'run']);
  write(root, 'src/big.js', 'exports.big = (v) => v >= 11;\n');
  const nav = navigate(root, 'run');
  assert.equal(nav.queue[0].class, 'evidence-invalidity');
  assert.match(nav.queue[0].why, /changed file src\/big\.js/);
  assert.equal(nav.queue.some((item) => item.class === 'behavioral-counterexample'), true);
  const legitimacy = nav.queue.find((item) => item.class === 'legitimacy-denial');
  assert.ok(legitimacy, JSON.stringify(nav.queue.map((item) => item.class)));
  assert.match(legitimacy.identity, /authorize\.bot\.merge/);
});

test('Scenario: experiments are inert argv suggestions even for paths with shell metacharacters', (t) => {
  const odd = 'src/we;ird $(x).js';
  const root = fixture(t, { changed: odd });
  assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);
  const nav = navigate(root, 'run');
  const survivor = nav.queue.find((item) => item.class === 'behavioral-counterexample');
  assert.ok(survivor);
  assert.equal(Array.isArray(survivor.experiment.argv), true);
  assert.equal(survivor.experiment.cwd, '.');
  assert.equal(survivor.experiment.inputs.includes(odd), true);
  assert.equal(survivor.experiment.executed, false);
  assert.deepEqual(survivor.experiment.argv, ['ts-quality', 'check', '--config', 'ts-quality.config.json', '--changed', odd, '--run-id', '<new-run-id>']);
  const text = cliRun(root, ['navigate', '--run-id', 'run']);
  assert.equal(text.status, 0, text.stderr);
  assert.equal(text.stdout.includes(JSON.stringify(survivor.experiment.argv)), true);
  assert.equal(fs.existsSync(path.join(root, 'x')), false);
});

function git(root, args, extraEnv = {}) {
  const result = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@example.invalid', GIT_COMMITTER_NAME: 'A', GIT_COMMITTER_EMAIL: 'a@example.invalid', ...extraEnv } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('Scenario: Git context is opt-in, pinned to a horizon, kept apart from evidence and deterministic', (t) => {
  const root = fixture(t);
  git(root, ['init', '-q']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'base'], { GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' });
  const horizon = git(root, ['rev-parse', 'HEAD']);
  write(root, 'src/old-name.js', 'exports.x = 1;\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'add'], { GIT_AUTHOR_DATE: '2026-01-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-02T00:00:00Z' });
  write(root, 'src/big.js', 'exports.big = (v) => v > 10; // edited\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'edit'], { GIT_AUTHOR_DATE: '2026-01-03T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-03T00:00:00Z' });
  write(root, 'src/big.js', 'exports.big = (v) => v > 10; // uncommitted\n');
  assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);

  assert.equal(navigate(root, 'run').context, undefined, 'no Git command without --git-horizon');
  const first = navigate(root, 'run', ['--git-horizon', horizon]);
  const second = navigate(root, 'run', ['--git-horizon', horizon]);
  assert.deepEqual(first.context, second.context);
  const facts = first.context.git;
  assert.equal(facts.available, true);
  assert.equal(facts.horizon, horizon);
  assert.match(facts.note, /facts, not evidence/);
  const big = facts.files.find((item) => item.filePath === 'src/big.js');
  assert.deepEqual({ commits: big.commitsSinceHorizon, last: big.lastCommitAt, authors: big.authorCount, uncommitted: big.uncommittedChanges }, { commits: 1, last: '2026-01-03T00:00:00Z', authors: 1, uncommitted: true });
  assert.equal(first.queue.some((item) => item.class === 'context-suggestion'), true);
  assert.equal(first.queue.filter((item) => item.class !== 'context-suggestion').length, navigate(root, 'run').queue.length, 'Git hints never add or remove blocking facts');

  const missing = navigate(root, 'run', ['--git-horizon', '0000000000000000000000000000000000000000']).context.git;
  assert.deepEqual({ available: missing.available, reason: missing.reason }, { available: false, reason: 'horizon-not-in-history' });

  git(root, ['mv', 'src/old-name.js', 'src/new-name.js']);
  git(root, ['commit', '-q', '-m', 'rename'], { GIT_AUTHOR_DATE: '2026-01-04T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-04T00:00:00Z' });
  const renamed = spawnSync(process.execPath, [cli, 'navigate', '--run-id', 'run', '--json', '--git-horizon', horizon, '--root', root], { encoding: 'utf8' });
  assert.equal(renamed.status, 0, renamed.stderr);

  const plain = fixture(t);
  assert.equal(cliRun(plain, ['check', '--run-id', 'run']).status, 0);
  const noGit = navigate(plain, 'run', ['--git-horizon', 'HEAD'], { GIT_CEILING_DIRECTORIES: path.dirname(plain) }).context.git;
  assert.deepEqual({ available: noGit.available, reason: noGit.reason }, { available: false, reason: 'not-a-git-repository' });
});

test('Scenario: renamed files report their earlier path inside the pinned horizon', (t) => {
  const root = fixture(t, { changed: 'src/new-name.js' });
  fs.renameSync(path.join(root, 'src/new-name.js'), path.join(root, 'src/old-name.js'));
  git(root, ['init', '-q']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'base'], { GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' });
  const horizon = git(root, ['rev-parse', 'HEAD']);
  git(root, ['mv', 'src/old-name.js', 'src/new-name.js']);
  git(root, ['commit', '-q', '-m', 'rename'], { GIT_AUTHOR_DATE: '2026-01-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-02T00:00:00Z' });
  assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);
  const file = navigate(root, 'run', ['--git-horizon', horizon]).context.git.files.find((item) => item.filePath === 'src/new-name.js');
  assert.equal(file.renamedFrom, 'src/old-name.js');
});

test('Scenario: a failing verdict never gets a no-blocker headline, and waived findings are not headlined as blocking', (t) => {
  const noSites = fixture(t, { strongTests: true });
  write(noSites, 'src/big.js', 'exports.big = (v) => v;\n');
  write(noSites, 'test/big.test.js', "const {test} = require('node:test'); const assert = require('node:assert/strict'); const {big} = require('../src/big.js');\ntest('id', () => { assert.equal(big(3), 3); });\n");
  assert.equal(cliRun(noSites, ['check', '--run-id', 'run']).status, 0);
  const missing = navigate(noSites, 'run');
  assert.notEqual(missing.headline.class, 'none');
  assert.equal(missing.queue.some((item) => item.identity === 'mutation-evidence-missing' && item.severity === 'blocking'), true);

  const waived = fixture(t);
  write(waived, '.ts-quality/waivers.json', JSON.stringify([{ id: 'accept-boundary', ruleId: 'surviving-mutant', scope: ['src/**'], owner: 'qa', reason: 'known boundary', createdAt: '2026-01-01T00:00:00.000Z' }]));
  const config = JSON.parse(fs.readFileSync(path.join(waived, 'ts-quality.config.json'), 'utf8'));
  config.waiversPath = '.ts-quality/waivers.json';
  write(waived, 'ts-quality.config.json', JSON.stringify(config));
  assert.equal(cliRun(waived, ['check', '--run-id', 'run']).status, 0);
  const nav = navigate(waived, 'run');
  const survivor = nav.queue.find((item) => item.class === 'behavioral-counterexample');
  assert.equal(survivor.severity, 'warning');
  assert.match(survivor.why, /waived by accept-boundary/);
  assert.notEqual(nav.headline.class, 'behavioral-counterexample');
});

test('Scenario: authorization records for agent ids with any characters are legitimacy facts, and control-plane drift has no file scope', (t) => {
  const root = fixture(t);
  write(root, '.ts-quality/agents.json', JSON.stringify([{ id: 'ci@bot', kind: 'automation', roles: ['ci'], grants: [{ id: 'merge', actions: ['merge'], paths: ['**'], minMergeConfidence: 101 }] }]));
  assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);
  cliRun(root, ['authorize', '--agent', 'ci@bot', '--run-id', 'run']);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'ts-quality.config.json'), 'utf8'));
  config.mutations.timeoutMs = 9999;
  write(root, 'ts-quality.config.json', JSON.stringify(config));
  const nav = navigate(root, 'run');
  assert.equal(nav.queue.some((item) => item.class === 'legitimacy-denial' && item.identity === 'authorize.ci@bot.merge'), true);
  const drift = nav.queue.find((item) => item.identity === 'drift:control plane config');
  assert.deepEqual([drift.scope, drift.experiment.inputs], [[], []]);
});

test('Scenario: Git facts never write the index or run fsmonitor, read pathspecs literally, ignore user log config and refuse non-ancestor horizons', (t) => {
  const root = fixture(t, { changed: 'src/[ab].js' });
  write(root, 'src/a.js', 'exports.a = 1;\n');
  git(root, ['init', '-q']);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', 'base'], { GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' });
  const horizon = git(root, ['rev-parse', 'HEAD']);
  for (let index = 0; index < 5; index += 1) {
    write(root, 'src/a.js', `exports.a = ${index + 2};\n`);
    git(root, ['commit', '-q', '-am', `a${index}`], { GIT_AUTHOR_DATE: `2026-01-0${index + 2}T00:00:00Z`, GIT_COMMITTER_DATE: `2026-01-0${index + 2}T00:00:00Z` });
  }
  write(root, 'src/a.js', 'exports.a = 99;\n');
  assert.equal(cliRun(root, ['check', '--run-id', 'run']).status, 0);
  const marker = path.join(root, 'fsmonitor-ran');
  write(root, 'fsmonitor.sh', `#!/bin/sh\ntouch ${JSON.stringify(marker)}\n`);
  fs.chmodSync(path.join(root, 'fsmonitor.sh'), 0o755);
  git(root, ['config', 'core.fsmonitor', path.join(root, 'fsmonitor.sh')]);
  const future = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(root, 'src/[ab].js'), future, future);
  const indexBefore = fs.readFileSync(path.join(root, '.git/index'));
  const nav = navigate(root, 'run', ['--git-horizon', horizon], { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'log.follow', GIT_CONFIG_VALUE_0: 'true' });
  assert.deepEqual(fs.readFileSync(path.join(root, '.git/index')), indexBefore);
  assert.equal(fs.existsSync(marker), false);
  const literal = nav.context.git.files.find((item) => item.filePath === 'src/[ab].js');
  assert.deepEqual({ commits: literal.commitsSinceHorizon, authors: literal.authorCount, uncommitted: literal.uncommittedChanges }, { commits: 0, authors: 0, uncommitted: false });

  git(root, ['config', '--unset', 'core.fsmonitor']);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  git(root, ['checkout', '-q', '--orphan', 'elsewhere']);
  git(root, ['commit', '-q', '-m', 'orphan'], { GIT_AUTHOR_DATE: '2026-02-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-02-01T00:00:00Z' });
  const orphan = git(root, ['rev-parse', 'HEAD']);
  git(root, ['checkout', '-q', '-f', branch]);
  const unrelated = navigate(root, 'run', ['--git-horizon', orphan]).context.git;
  assert.deepEqual({ available: unrelated.available, reason: unrelated.reason }, { available: false, reason: 'horizon-not-ancestor' });
});

test('Scenario: renamedFrom is relative to --root when the repository root is above it', (t) => {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-navigation-subroot-'));
  t.after(() => fs.rmSync(top, { recursive: true, force: true }));
  const pkg = path.join(top, 'pkg');
  fs.mkdirSync(pkg);
  const root = fixture(t, { changed: 'src/new.js' });
  fs.cpSync(root, pkg, { recursive: true });
  fs.renameSync(path.join(pkg, 'src/new.js'), path.join(pkg, 'src/old.js'));
  git(top, ['init', '-q']);
  git(top, ['add', '-A']);
  git(top, ['commit', '-q', '-m', 'base'], { GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z' });
  const horizon = git(top, ['rev-parse', 'HEAD']);
  git(top, ['mv', 'pkg/src/old.js', 'pkg/src/new.js']);
  git(top, ['commit', '-q', '-m', 'rename'], { GIT_AUTHOR_DATE: '2026-01-02T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-02T00:00:00Z' });
  assert.equal(cliRun(pkg, ['check', '--run-id', 'run']).status, 0);
  const file = navigate(pkg, 'run', ['--git-horizon', horizon]).context.git.files.find((item) => item.filePath === 'src/new.js');
  assert.equal(file.renamedFrom, 'src/old.js');
});
