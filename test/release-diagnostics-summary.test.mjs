import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePath, repoRoot } from './helpers.mjs';
import { verificationCommands } from '../scripts/verify.mjs';

const cli = path.join(repoRoot, 'dist/packages/ts-quality/src/cli.js');
const summaryScript = path.join(repoRoot, 'scripts/release-diagnostics-summary.mjs');
const diagnosticsScript = path.join(repoRoot, 'scripts/release-diagnostics.mjs');
const smokeLog = '$ npm run build --silent\n\nexit=0\n$ npm run smoke --silent\nsmoke: ok\n\nexit=0\n';
// A log in the shape scripts/verify.mjs writes, for exactly the commands it runs (never the live, mutable log).
const fullLog = verificationCommands(false).map((step) => `$ ${step.command} ${step.args.join(' ')}\n\n\nexit=0`).join('\n') + '\n';
let base;

function node(args, cwd = repoRoot) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8', env });
}

function ok(args) {
  const result = node(args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function summary(root, args) {
  return JSON.parse(ok([summaryScript, 'summary', '--root', root, '--json', ...args]));
}

function compare(root, baseline, candidate) {
  return JSON.parse(ok([summaryScript, 'compare', '--root', root, '--baseline', baseline, '--candidate', candidate, '--json']));
}

function refused(args, fragment) {
  const result = node([summaryScript, ...args]);
  assert.equal(result.status, 2, `expected refusal: ${result.stdout}`);
  assert.match(result.stderr, fragment);
}

function copyBase(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-repo-summary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(base, root, { recursive: true });
  return root;
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-repo-summary-base-'));
  fs.cpSync(fixturePath('native-package-index'), base, { recursive: true });
  fs.cpSync(fixturePath('release-diagnostics/valid'), base, { recursive: true });
  ok([cli, 'check', '--root', base, '--changed', 'packages/api/src/limit.js', '--run-id', 'api-run']);
  ok([cli, 'check', '--root', base, '--changed', 'packages/web/src/label.js', '--run-id', 'web-run']);
  ok([cli, 'index', 'write', '--root', base, '--all', '--run-id', 'api-run,web-run']);
  ok([diagnosticsScript, 'preview', '--root', base, '--out', 'diagnostics/release.json']);
  fs.mkdirSync(path.join(base, 'verification'), { recursive: true });
  fs.writeFileSync(path.join(base, 'verification/full.log'), fullLog);
  fs.writeFileSync(path.join(base, 'verification/smoke.log'), smokeLog);
});

after(() => fs.rmSync(base, { recursive: true, force: true }));

const allSources = ['--package-index', '.ts-quality/package-index.json', '--verification-log', 'verification/full.log', '--release-report', 'diagnostics/release.json'];

test('Scenario: the summary keeps quality, verification and release facts in separate sourced sections', (t) => {
  const root = copyBase(t);
  const result = summary(root, allSources);
  assert.equal(result.kind, 'ts-quality-repo-summary');
  assert.equal(result.schemaVersion, 1);
  assert.match(result.authority, /no combined status, approval or release permission/);
  for (const key of ['status', 'ok', 'approved', 'ready', 'overall']) {
    assert.equal(key in result, false, `no combined ${key} field`);
  }
  assert.equal(result.quality.state, 'provided');
  assert.match(result.quality.source.sha256, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.quality.references, 'fresh');
  assert.deepEqual(result.quality.packages.map((entry) => [entry.path, entry.state]), [
    ['.', 'no-run-evidence'], ['packages/api', 'current'], ['packages/ts-quality', 'no-run-evidence'], ['packages/web', 'current']
  ]);
  assert.equal(result.quality.packages[1].runs[0].outcome, 'fail');
  assert.equal(result.verification.state, 'provided');
  assert.equal(result.verification.mode, 'full');
  assert.match(result.verification.recorded, /not live CI status/);
  assert.equal(result.release.state, 'provided');
  assert.equal(result.release.report, 'current');
  assert.deepEqual(result.release.failed, []);
});

test('Scenario: a log of every command verify.mjs runs is full; without the packaging smoke it is only smoke', (t) => {
  const root = copyBase(t);
  const result = summary(root, ['--verification-log', 'verification/full.log']);
  assert.equal(result.verification.mode, 'full');
  assert.equal(result.quality.state, 'not-provided');
  assert.equal(result.release.state, 'not-provided');
  fs.writeFileSync(path.join(root, 'verification/no-packaging.log'), fullLog.replace('$ npm run smoke:packaging --silent\n\n\nexit=0\n', ''));
  assert.equal(summary(root, ['--verification-log', 'verification/no-packaging.log']).verification.mode, 'smoke');
});

test('Scenario: smoke, failed and partial verification logs keep their own mode', (t) => {
  const root = copyBase(t);
  assert.equal(summary(root, ['--verification-log', 'verification/smoke.log']).verification.mode, 'smoke');
  fs.writeFileSync(path.join(root, 'verification/failed.log'), smokeLog.replace(/exit=0\n$/, 'exit=1\n'));
  assert.equal(summary(root, ['--verification-log', 'verification/failed.log']).verification.mode, 'failed');
  fs.writeFileSync(path.join(root, 'verification/partial.log'), '$ npm run lint --silent\n\nexit=0\n');
  assert.equal(summary(root, ['--verification-log', 'verification/partial.log']).verification.mode, 'partial');
  fs.writeFileSync(path.join(root, 'verification/empty.log'), 'nothing here\n');
  refused(['summary', '--root', root, '--verification-log', 'verification/empty.log'], /records no command/);
});

test('Scenario: a package filter bounds the quality section and is recorded', (t) => {
  const root = copyBase(t);
  const result = summary(root, ['--package-index', '.ts-quality/package-index.json', '--package', 'packages/api']);
  assert.deepEqual(result.filter, ['packages/api']);
  assert.deepEqual(result.quality.packages.map((entry) => entry.path), ['packages/api']);
});

test('Scenario: compare reports differences per section without inferring improvement', (t) => {
  const root = copyBase(t);
  fs.writeFileSync(path.join(root, 'before.json'), JSON.stringify(summary(root, allSources)));
  fs.appendFileSync(path.join(root, 'packages/api/src/limit.js'), '// edited\n');
  fs.writeFileSync(path.join(root, 'after.json'), JSON.stringify(summary(root, [...allSources.slice(0, 2), '--verification-log', 'verification/full.log', '--release-report', 'diagnostics/release.json'])));
  const result = compare(root, 'before.json', 'after.json');
  assert.equal(result.kind, 'ts-quality-repo-summary-comparison');
  assert.match(result.claims, /no improvement, approval or release permission is inferred/);
  assert.equal(result.quality.comparable, true);
  const api = result.quality.packages.find((entry) => entry.path === 'packages/api');
  assert.deepEqual([api.baseline.state, api.candidate.state, api.changed], ['current', 'stale', true]);
  assert.equal(result.verification.comparable, true);
  assert.equal(result.verification.commands.every((entry) => entry.changed === false), true);
  assert.equal(result.release.comparable, true);
  assert.doesNotMatch(JSON.stringify(result), /improv(ed|ement)"|better|worse/);
});

test('Scenario: smoke and full verification, or different package filters, are not comparable', (t) => {
  const root = copyBase(t);
  fs.writeFileSync(path.join(root, 'full.json'), JSON.stringify(summary(root, allSources)));
  fs.writeFileSync(path.join(root, 'smoke.json'), JSON.stringify(summary(root, ['--package-index', '.ts-quality/package-index.json', '--package', 'packages/api', '--verification-log', 'verification/smoke.log'])));
  const result = compare(root, 'full.json', 'smoke.json');
  assert.deepEqual([result.verification.comparable, result.verification.reason], [false, 'verification mode full vs smoke']);
  assert.deepEqual([result.quality.comparable, result.quality.reason], [false, 'package filter or package set differs']);
  assert.deepEqual([result.release.comparable, result.release.reason], [false, 'release facts not provided in both summaries']);
  assert.equal('commands' in result.verification, false);
});

test('Scenario: summary and compare refuse inputs outside the root, symbolic links and unknown schemas', (t) => {
  const root = copyBase(t);
  refused(['summary', '--root', root, '--verification-log', '../outside.log'], /inside the root/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-repo-summary-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'full.log'), smokeLog);
  fs.symlinkSync(path.join(outside, 'full.log'), path.join(root, 'verification/linked.log'));
  refused(['summary', '--root', root, '--verification-log', 'verification/linked.log'], /symbolic link/);
  refused(['summary', '--root', root], /name at least one source/);
  fs.writeFileSync(path.join(root, 'wrong.json'), JSON.stringify({ kind: 'repo-validation-summary', version: 1 }));
  fs.writeFileSync(path.join(root, 'right.json'), JSON.stringify(summary(root, allSources)));
  refused(['compare', '--root', root, '--baseline', 'wrong.json', '--candidate', 'right.json'], /not a ts-quality-repo-summary/);
  fs.writeFileSync(path.join(root, 'future.json'), JSON.stringify({ ...summary(root, allSources), schemaVersion: 2 }));
  refused(['compare', '--root', root, '--baseline', 'future.json', '--candidate', 'right.json'], /unsupported repo summary schema version 2/);
  refused(['summary', '--root', root, '--package-index', '.ts-quality/package-index.json', '--package', 'packages/nope'], /not in the index/);
});

test('Scenario: a killed, unspawned or unterminated verification command makes the log failed', (t) => {
  const root = copyBase(t);
  const killed = fullLog.replace('$ npm run smoke:packaging --silent\n\n\nexit=0\n', '$ npm run smoke:packaging --silent\n\n\nexit=null\n');
  fs.writeFileSync(path.join(root, 'verification/killed.log'), killed);
  assert.equal(summary(root, ['--verification-log', 'verification/killed.log']).verification.mode, 'failed');
  fs.writeFileSync(path.join(root, 'verification/cut.log'), `${fullLog}$ npm run extra --silent\npartial output\n`);
  const cut = summary(root, ['--verification-log', 'verification/cut.log']).verification;
  assert.equal(cut.mode, 'failed');
  assert.deepEqual(cut.commands.at(-1), { command: 'npm run extra --silent', exit: null });
});

test('Scenario: compare reports unrecorded release checks as not-recorded and refuses malformed sections with exit 2', (t) => {
  const root = copyBase(t);
  const full = summary(root, allSources);
  fs.writeFileSync(path.join(root, 'a.json'), JSON.stringify(full));
  fs.writeFileSync(path.join(root, 'b.json'), JSON.stringify({ ...full, release: { ...full.release, checks: {} } }));
  const result = compare(root, 'a.json', 'b.json');
  assert.equal(result.release.checks.every((entry) => entry.baseline === 'pass' && entry.candidate === 'not-recorded' && entry.changed), true);
  assert.deepEqual(result.release.reports, { baseline: 'current', candidate: 'current' });
  fs.writeFileSync(path.join(root, 'broken.json'), JSON.stringify({ ...full, quality: { state: 'provided' } }));
  refused(['compare', '--root', root, '--baseline', 'broken.json', '--candidate', 'a.json'], /malformed quality section/);
  refused(['summary', '--root', path.join(root, 'nope'), '--verification-log', 'x.log'], /does not exist/);
});

test('Scenario: equivalent package filter spellings stay comparable', (t) => {
  const root = copyBase(t);
  fs.writeFileSync(path.join(root, 'dot.json'), JSON.stringify(summary(root, ['--package-index', '.ts-quality/package-index.json', '--package', './packages/api/'])));
  fs.writeFileSync(path.join(root, 'plain.json'), JSON.stringify(summary(root, ['--package-index', '.ts-quality/package-index.json', '--package', 'packages/api'])));
  const result = compare(root, 'dot.json', 'plain.json');
  assert.equal(result.quality.comparable, true);
  assert.deepEqual(result.quality.references, { baseline: 'fresh', candidate: 'fresh' });
});
