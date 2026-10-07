import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixturePath, repoRoot } from './helpers.mjs';

const script = path.join(repoRoot, 'scripts/release-diagnostics.mjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-release-diagnostics-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(fixturePath('release-diagnostics/valid'), root, { recursive: true });
  return root;
}

function run(root, args, extraEnv = {}) {
  return spawnSync(process.execPath, [script, ...args, '--root', root], { encoding: 'utf8', env: { ...process.env, ...extraEnv } });
}

function preview(root, args = []) {
  const result = run(root, ['preview', '--json', ...args]);
  assert.ok(result.status === 0 || result.status === 1, result.stderr);
  return { status: result.status, report: JSON.parse(result.stdout) };
}

function failedCodes(root, args) {
  return preview(root, args).report.summary.failed;
}

function edit(root, file, transform) {
  const target = path.join(root, file);
  fs.writeFileSync(target, transform(fs.readFileSync(target, 'utf8')));
}

test('Scenario: an aligned release target passes every offline check and still grants no permission', (t) => {
  const root = fixture(t);
  const { status, report } = preview(root);
  assert.equal(status, 0);
  assert.equal(report.kind, 'ts-quality-release-diagnostics');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.offline, true);
  assert.match(report.authority, /not release permission/);
  assert.deepEqual(report.target, { packageName: 'ts-quality', version: '1.2.3', tag: 'v1.2.3', tagSource: 'derived', prereleaseTag: false, npmDistTag: 'set by the GitHub Release prerelease flag (publish.yml: next when marked prerelease, else latest)' });
  assert.deepEqual(report.summary.failed, []);
  assert.equal(report.summary.ok, true);
  assert.deepEqual(report.checks.map((check) => check.code), [
    'target.manifest', 'target.package-name', 'target.version', 'target.workspace-version', 'target.bin',
    'tag.format', 'tag.matches-version',
    'workflow.present', 'workflow.release-trigger', 'workflow.oidc', 'workflow.environment', 'workflow.intent-check', 'workflow.proof', 'workflow.publish-command', 'workflow.staged-package',
    'provenance.repository', 'provenance.trusted-publisher',
    'notes.release-notes', 'notes.changelog'
  ]);
  assert.ok(report.inputs.every((input) => /^sha256:[a-f0-9]{64}$/.test(input.sha256)));
  assert.ok(report.inputs.some((input) => input.kind === 'listing' && input.path === 'docs/releases'));
});

test('Scenario: a tag that does not match the package version, or is not a version tag, fails', (t) => {
  const root = fixture(t);
  assert.deepEqual(failedCodes(root, ['--tag', 'v1.2.4']), ['tag.matches-version']);
  assert.deepEqual(failedCodes(root, ['--tag', '1.2.3']), ['tag.format', 'tag.matches-version']);
  const injected = preview(root, ['--tag', 'v1.2.3;touch pwned']);
  assert.equal(injected.status, 1);
  assert.deepEqual(injected.report.summary.failed, ['tag.format', 'tag.matches-version']);
  assert.equal(fs.existsSync(path.join(root, 'pwned')), false);
  // The dist-tag follows the GitHub Release prerelease flag, not the tag text, so the preview does not guess it.
  const prerelease = preview(root, ['--tag', 'v1.2.3-rc.1']).report;
  assert.equal(prerelease.target.prereleaseTag, true);
  assert.match(prerelease.target.npmDistTag, /GitHub Release prerelease flag/);
  assert.equal(prerelease.target.tagSource, 'argument');
});

test('Scenario: workflow drift is reported per missing release obligation', (t) => {
  const root = fixture(t);
  edit(root, '.github/workflows/publish.yml', (text) => text.replace('      id-token: write\n', '').replace('npm publish --provenance --access public', 'npm publish --access public'));
  assert.deepEqual(failedCodes(root), ['workflow.oidc', 'workflow.publish-command']);
  fs.rmSync(path.join(root, '.github/workflows/publish.yml'));
  const failed = failedCodes(root);
  assert.ok(failed.includes('workflow.present'));
  assert.ok(failed.includes('provenance.trusted-publisher'));
});

test('Scenario: a wrong target package or repository provenance fails', (t) => {
  const root = fixture(t);
  edit(root, 'packages/ts-quality/package.json', (text) => text.replace('"name": "ts-quality"', '"name": "@tryinget/ts-quality"').replace('tryingET/ts-quality.git', 'someone/fork.git'));
  assert.deepEqual(failedCodes(root), ['target.package-name', 'provenance.repository']);
  edit(root, 'package.json', (text) => text.replace('"version": "1.2.3"', '"version": "1.2.2"'));
  assert.ok(failedCodes(root).includes('target.workspace-version'));
  edit(root, '.github/workflows/publish.yml', (text) => text.replace("environmentName: 'npm-publish'", "environmentName: 'other'"));
  assert.ok(failedCodes(root).includes('provenance.trusted-publisher'));
});

test('Scenario: missing release notes and changelog section are named, not guessed', (t) => {
  const root = fixture(t);
  fs.rmSync(path.join(root, 'docs/releases/2026-10-07-v1.2.3-github-release.md'));
  edit(root, 'CHANGELOG.md', (text) => text.replace('## [1.2.3] - 2026-10-07', '## [1.2.2] - 2026-10-01'));
  assert.deepEqual(failedCodes(root), ['notes.release-notes', 'notes.changelog']);
});

test('Scenario: a symlinked or unreadable manifest is refused as an input, never followed', (t) => {
  const root = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-release-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.copyFileSync(path.join(root, 'packages/ts-quality/package.json'), path.join(outside, 'package.json'));
  fs.rmSync(path.join(root, 'packages/ts-quality/package.json'));
  fs.symlinkSync(path.join(outside, 'package.json'), path.join(root, 'packages/ts-quality/package.json'));
  const { report } = preview(root);
  const manifest = report.checks.find((check) => check.code === 'target.manifest');
  assert.equal(manifest.ok, false);
  assert.match(manifest.message, /symbolic link/);
});

test('Scenario: the report reloads; inspect detects changed inputs and refuses untrusted reports', (t) => {
  const root = fixture(t);
  const written = run(root, ['preview', '--out', 'diagnostics/release.json']);
  assert.equal(written.status, 0, written.stderr);
  let inspected = JSON.parse(run(root, ['inspect', '--report', 'diagnostics/release.json', '--json']).stdout);
  assert.equal(inspected.kind, 'ts-quality-release-diagnostics-inspection');
  assert.equal(inspected.state, 'current');
  assert.equal(inspected.summary.ok, true);
  edit(root, 'CHANGELOG.md', (text) => `${text}\n- later edit\n`);
  inspected = JSON.parse(run(root, ['inspect', '--report', 'diagnostics/release.json', '--json']).stdout);
  assert.equal(inspected.state, 'stale');
  assert.deepEqual(inspected.inputs.filter((input) => input.state !== 'fresh'), [{ path: 'CHANGELOG.md', state: 'changed' }]);

  const report = JSON.parse(fs.readFileSync(path.join(root, 'diagnostics/release.json'), 'utf8'));
  const variants = [
    [{ ...report, kind: 'release-trust-report' }, /not a ts-quality-release-diagnostics report/],
    [{ ...report, schemaVersion: 9 }, /unsupported release diagnostics schema version 9/],
    [{ ...report, summary: { ...report.summary, ok: false } }, /summary disagrees with its checks/],
    [{ ...report, inputs: [{ path: '../../etc/passwd', sha256: report.inputs[0].sha256 }] }, /inside the root/],
    [{ ...report, checks: [...report.checks, { code: 'shell.exec', ok: true, boundary: 'tag', message: 'x' }] }, /unknown check code shell\.exec/]
  ];
  for (const [value, fragment] of variants) {
    fs.writeFileSync(path.join(root, 'diagnostics/bad.json'), JSON.stringify(value));
    const refused = run(root, ['inspect', '--report', 'diagnostics/bad.json']);
    assert.equal(refused.status, 2, refused.stdout);
    assert.match(refused.stderr, fragment);
  }
  const outsideReport = run(root, ['inspect', '--report', '../outside.json']);
  assert.equal(outsideReport.status, 2);
  assert.match(outsideReport.stderr, /inside the root/);
  const escapingOut = run(root, ['preview', '--out', '../escape.json']);
  assert.equal(escapingOut.status, 2);
  assert.match(escapingOut.stderr, /inside the root/);
});

test('Scenario: diagnostics run with no Git, npm or network on PATH', (t) => {
  const root = fixture(t);
  const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-release-nopath-'));
  t.after(() => fs.rmSync(emptyPath, { recursive: true, force: true }));
  const result = run(root, ['preview', '--json'], { PATH: emptyPath });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.ok, true);
});

test('Scenario: unknown subcommands and options are refused with usage exit 2', (t) => {
  const root = fixture(t);
  for (const args of [['publish'], ['preview', '--apply'], ['inspect']]) {
    const result = run(root, args);
    assert.equal(result.status, 2, `${args.join(' ')}: ${result.stdout}`);
  }
});

test('Scenario: this repository\'s own release surfaces pass the offline diagnostics', () => {
  const result = spawnSync(process.execPath, [script, 'preview', '--json'], { cwd: repoRoot, encoding: 'utf8' });
  const report = JSON.parse(result.stdout);
  // Release notes for an unreleased next version may be absent; every structural check must hold.
  assert.deepEqual(report.summary.failed.filter((code) => !code.startsWith('notes.')), []);
});

test('Scenario: workflow checks read triggers and run steps, so extra triggers, comments, echoes and late steps fail', (t) => {
  const cases = [
    [(text) => text.replace('    types: [published]\n', '    types: [published]\n  push:\n    branches: ["**"]\n  workflow_dispatch:\n'), ['workflow.release-trigger']],
    [(text) => text.replace('types: [published]', 'types: [published, created]'), ['workflow.release-trigger']],
    [(text) => text.replace('run: npm run release:intent:check --silent', 'run: true # npm run release:intent:check --silent'), ['workflow.intent-check']],
    [(text) => text.replace('run: npm run verify:ci --silent', 'run: echo skipped # was: npm run verify:ci --silent'), ['workflow.proof']],
    [(text) => text.replace('      - name: Prove release package\n        run: npm run verify:ci --silent\n', '') + '      - name: Prove late\n        run: npm run verify:ci --silent\n', ['workflow.proof']],
    [(text) => text.replace('      name: npm-publish\n', '      name: other-environment\n'), ['workflow.environment']],
    [(text) => text.replace('working-directory: .ts-quality/npm/ts-quality/package', 'working-directory: .'), ['workflow.staged-package']]
  ];
  for (const [transform, expected] of cases) {
    const root = fixture(t);
    edit(root, '.github/workflows/publish.yml', transform);
    assert.deepEqual(failedCodes(root), expected, transform.toString());
  }
});

test('Scenario: a report missing checks is refused, and inputs that appear after the preview make it stale', (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'diagnostics'), { recursive: true });
  fs.writeFileSync(path.join(root, 'diagnostics/empty.json'), JSON.stringify({ kind: 'ts-quality-release-diagnostics', schemaVersion: 1, target: {}, inputs: [], checks: [], summary: { checkCount: 0, failed: [], ok: true } }));
  const empty = run(root, ['inspect', '--report', 'diagnostics/empty.json']);
  assert.equal(empty.status, 2);
  assert.match(empty.stderr, /must record each of the 19 checks exactly once/);

  const workflow = fs.readFileSync(path.join(root, '.github/workflows/publish.yml'));
  const notes = fs.readFileSync(path.join(root, 'docs/releases/2026-10-07-v1.2.3-github-release.md'));
  fs.rmSync(path.join(root, '.github/workflows/publish.yml'));
  fs.rmSync(path.join(root, 'docs/releases/2026-10-07-v1.2.3-github-release.md'));
  assert.equal(run(root, ['preview', '--out', 'diagnostics/before.json']).status, 1);
  fs.writeFileSync(path.join(root, '.github/workflows/publish.yml'), workflow);
  fs.writeFileSync(path.join(root, 'docs/releases/2026-10-07-v1.2.3-github-release.md'), notes);
  const inspected = JSON.parse(run(root, ['inspect', '--report', 'diagnostics/before.json', '--json']).stdout);
  assert.equal(inspected.state, 'stale');
  assert.deepEqual(inspected.inputs.filter((input) => input.state !== 'fresh').map((input) => input.path), ['.github/workflows/publish.yml', 'docs/releases']);
});

test('Scenario: a missing root or an output inside run packets is a refusal (exit 2), never a failed check', (t) => {
  const root = fixture(t);
  const missingRoot = spawnSync(process.execPath, [script, 'preview', '--root', path.join(root, 'nope')], { encoding: 'utf8' });
  assert.equal(missingRoot.status, 2);
  assert.match(missingRoot.stderr, /does not exist/);
  const intoRuns = run(root, ['preview', '--out', '.ts-quality/Runs/x/report.json']);
  assert.equal(intoRuns.status, 2);
  assert.match(intoRuns.stderr, /run packets are immutable/);
});
