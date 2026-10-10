import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePath, repoRoot } from './helpers.mjs';

const cli = path.join(repoRoot, 'dist/packages/ts-quality/src/cli.js');
let base;

function cliRun(root, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [cli, ...args, '--root', root], { encoding: 'utf8', env });
}

function ok(root, args, extraEnv) {
  const result = cliRun(root, args, extraEnv);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function refused(root, args, fragment) {
  const result = cliRun(root, args);
  assert.equal(result.status, 1, `expected refusal for ${args.join(' ')}: ${result.stdout}`);
  assert.match(result.stderr, fragment);
}

function inspect(root, extra = []) {
  return JSON.parse(ok(root, ['index', 'inspect', '--json', ...extra]));
}

function readIndex(root, file = '.ts-quality/package-index.json') {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

function copyBase(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(base, root, { recursive: true });
  return root;
}

function writeIndexFile(root, value) {
  fs.writeFileSync(path.join(root, '.ts-quality/package-index.json'), `${JSON.stringify(value, null, 2)}\n`);
}

before(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-base-'));
  fs.cpSync(fixturePath('native-package-index'), base, { recursive: true });
  ok(base, ['check', '--changed', 'packages/api/src/limit.js', '--run-id', 'api-run']);
  ok(base, ['check', '--changed', 'packages/web/src/label.js', '--run-id', 'web-run']);
});

after(() => fs.rmSync(base, { recursive: true, force: true }));

test('Scenario: writing an all-package index references every discovered package and the canonical run packet files', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const index = readIndex(root);
  assert.equal(index.kind, 'ts-quality-package-index');
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.authority, 'references-only');
  assert.deepEqual(index.scope, { mode: 'all', discovery: 'package-json', packages: ['.', 'packages/api', 'packages/web'] });
  assert.deepEqual(index.packages.map((entry) => [entry.path, entry.name, entry.status]), [
    ['.', 'native-index-demo', 'no-run-evidence'],
    ['packages/api', '@demo/api', 'evidence-present'],
    ['packages/web', '@demo/web', 'evidence-present']
  ]);
  assert.deepEqual(index.packages[1].evidence, [{ runId: 'api-run', changedFiles: ['packages/api/src/limit.js'] }]);
  // Package enumeration is not executed coverage: the root package has no evidence and the index says so.
  assert.deepEqual(index.completeness, { packageCount: 3, withEvidence: 2, withoutEvidence: ['.'], complete: false, executedCoverageClaim: 'none' });
  const apiRun = index.runs.find((run) => run.runId === 'api-run');
  assert.equal(apiRun.selection, 'explicit');
  const paths = apiRun.artifacts.map((ref) => ref.path);
  assert.ok(paths.includes('.ts-quality/runs/api-run/run.json'));
  assert.ok(paths.includes('.ts-quality/runs/api-run/publication.json'));
  assert.ok(apiRun.artifacts.every((ref) => /^sha256:[a-f0-9]{64}$/.test(ref.sha256) && ref.bytes > 0));
  assert.ok(index.upload.paths.includes('.ts-quality/package-index.json'));
  assert.ok(index.upload.paths.includes('packages/api/package.json'));
  assert.equal(JSON.stringify(index).includes('"verdict"'), false, 'the index copies no verdict');
});

test('Scenario: identical repository state and run selection give a byte-identical index', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'web-run,api-run']);
  const first = fs.readFileSync(path.join(root, '.ts-quality/package-index.json'));
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  assert.deepEqual(fs.readFileSync(path.join(root, '.ts-quality/package-index.json')), first);
});

test('Scenario: a one-package index keeps other packages\' changed files outside, and the latest pointer is labeled', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--package', 'packages/api', '--run-id', 'api-run,web-run', '--out', 'review/api-index.json']);
  const index = readIndex(root, 'review/api-index.json');
  assert.equal(index.scope.mode, 'selected');
  assert.deepEqual(index.packages.map((entry) => entry.path), ['packages/api']);
  assert.deepEqual(index.outsideIndexedPackages, [{ runId: 'web-run', changedFiles: ['packages/web/src/label.js'] }]);
  assert.equal(index.completeness.complete, true);

  ok(root, ['index', 'write', '--package', 'packages/web']);
  const latest = readIndex(root);
  assert.deepEqual(latest.runs.map((run) => [run.runId, run.selection]), [['web-run', 'latest-pointer']]);
});

test('Scenario: inspect reports fresh references, current sources and per-package findings without approval', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const inspection = inspect(root);
  assert.equal(inspection.kind, 'ts-quality-package-index-inspection');
  assert.match(inspection.authority, /not a verdict, approval, release permission or executed-coverage claim/);
  assert.equal(inspection.references.state, 'fresh');
  assert.equal(inspection.references.changed + inspection.references.missing, 0);
  assert.equal(inspection.enumeration.state, 'current');
  const api = inspection.packages.find((entry) => entry.path === 'packages/api');
  assert.equal(api.state, 'current');
  assert.equal(api.quality[0].state, 'available');
  assert.equal(api.quality[0].runOutcome, 'fail');
  assert.equal(api.quality[0].findingsInPackage.error > 0, true);
  assert.equal(api.quality[0].source.state, 'current');
  assert.equal(inspection.packages.find((entry) => entry.path === '.').state, 'no-run-evidence');
  assert.match(ok(root, ['index', 'inspect']), /References: fresh/);
});

test('Scenario: a source edit after the run makes the package stale while its references stay fresh', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  fs.appendFileSync(path.join(root, 'packages/api/src/limit.js'), '// edited\n');
  const inspection = inspect(root);
  assert.equal(inspection.references.state, 'fresh');
  const api = inspection.packages.find((entry) => entry.path === 'packages/api');
  assert.equal(api.state, 'stale');
  assert.equal(api.quality[0].source.state, 'drifted');
  assert.deepEqual(api.quality[0].source.subjects, ['changed file packages/api/src/limit.js']);
  assert.equal(inspection.packages.find((entry) => entry.path === 'packages/web').state, 'current');
});

test('Scenario: a changed or missing run artifact is reported and its quality facts are withheld', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  fs.appendFileSync(path.join(root, '.ts-quality/runs/api-run/report.md'), '\ntampered\n');
  fs.rmSync(path.join(root, '.ts-quality/runs/web-run/check-summary.txt'));
  const inspection = inspect(root);
  assert.equal(inspection.references.state, 'stale');
  assert.equal(inspection.references.changed, 1);
  assert.equal(inspection.references.missing, 1);
  const states = Object.fromEntries(inspection.runs.flatMap((run) => run.artifacts.map((ref) => [ref.path, ref.state])));
  assert.equal(states['.ts-quality/runs/api-run/report.md'], 'changed');
  assert.equal(states['.ts-quality/runs/web-run/check-summary.txt'], 'missing');
  for (const entry of inspection.packages.filter((item) => item.path !== '.')) {
    assert.equal(entry.state, 'stale');
    assert.deepEqual(entry.quality.map((item) => [item.state, item.reason]), [['unavailable', 'run packet changed or missing since indexing']]);
  }
});

test('Scenario: a package added after indexing changes the all-package enumeration', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run']);
  fs.mkdirSync(path.join(root, 'packages/cli'), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages/cli/package.json'), '{"name":"@demo/cli"}\n');
  const inspection = inspect(root);
  assert.deepEqual(inspection.enumeration, { mode: 'all', state: 'changed', added: ['packages/cli'], removed: [] });
});

test('Scenario: an uploaded copy of exactly the upload paths reloads with fresh references and unavailable sources', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const uploaded = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-upload-'));
  t.after(() => fs.rmSync(uploaded, { recursive: true, force: true }));
  for (const file of readIndex(root).upload.paths) {
    fs.mkdirSync(path.dirname(path.join(uploaded, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(uploaded, file));
  }
  const inspection = inspect(uploaded);
  assert.equal(inspection.references.state, 'fresh');
  assert.equal(inspection.enumeration.state, 'current');
  const api = inspection.packages.find((entry) => entry.path === 'packages/api');
  assert.equal(api.state, 'source-unavailable');
  assert.equal(api.quality[0].state, 'available');
  assert.equal(api.quality[0].source.state, 'unavailable');
});

test('Scenario: a filtered inspection reports only the named packages and their runs', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const inspection = inspect(root, ['--package', 'packages/web']);
  assert.deepEqual(inspection.filter, ['packages/web']);
  assert.deepEqual(inspection.packages.map((entry) => entry.path), ['packages/web']);
  assert.deepEqual(inspection.runs.map((run) => run.runId), ['web-run']);
  refused(root, ['index', 'inspect', '--package', 'packages/nope'], /--package packages\/nope is not in the index/);
});

test('Scenario: write refuses ambiguous scope, unknown packages, unsafe or missing runs and unsafe outputs', (t) => {
  const root = copyBase(t);
  refused(root, ['index', 'write', '--run-id', 'api-run'], /exactly one/);
  refused(root, ['index', 'write', '--all', '--package', 'packages/api', '--run-id', 'api-run'], /exactly one/);
  refused(root, ['index', 'write', '--package', 'packages/nope', '--run-id', 'api-run'], /not a discovered package directory/);
  refused(root, ['index', 'write', '--package', '../outside', '--run-id', 'api-run'], /not a discovered package directory/);
  refused(root, ['index', 'write', '--all', '--run-id', '../api-run'], /runId must use only/);
  refused(root, ['index', 'write', '--all', '--run-id', 'no-such-run'], /no-such-run/);
  refused(root, ['index', 'write', '--all', '--run-id', 'api-run', '--out', '.ts-quality/runs/api-run/index.json'], /run packets are immutable/);
  refused(root, ['index', 'write', '--all', '--run-id', 'api-run', '--out', '../escape.json'], /must stay inside the root/);
  refused(root, ['index', 'write', '--all', '--run-id', 'api-run', '--out', path.join(os.tmpdir(), 'tsq-escape.json')], /inside the root/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(root, 'linked'));
  refused(root, ['index', 'write', '--all', '--run-id', 'api-run', '--out', 'linked/index.json'], /symbolic link/);
  assert.deepEqual(fs.readdirSync(outside), []);
  refused(root, ['index', 'write', '--all', '--run-id', 'api-run', '--bogus', 'x'], /unknown option --bogus/);
});

test('Scenario: write refuses a run packet that is a symbolic link', (t) => {
  const root = copyBase(t);
  const runs = path.join(root, '.ts-quality/runs');
  fs.renameSync(path.join(runs, 'api-run'), path.join(root, 'moved-run'));
  fs.symlinkSync(path.join(root, 'moved-run'), path.join(runs, 'api-run'));
  const result = cliRun(root, ['index', 'write', '--all', '--run-id', 'api-run']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /symbolic link|must stay inside/);
});

test('Scenario: inspect refuses untrusted index schemas and references outside the root', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const good = readIndex(root);
  const variants = [
    [{ ...good, kind: 'quality-bundle' }, /is not a ts-quality-package-index/],
    [{ ...good, schemaVersion: 2 }, /unsupported package index schema version 2/],
    [{ ...good, runs: [{ ...good.runs[0], artifacts: [...good.runs[0].artifacts, { path: '../../etc/passwd', sha256: good.runs[0].artifacts[0].sha256, bytes: 1 }] }, good.runs[1]] }, /must stay inside the root/],
    [{ ...good, runs: [{ ...good.runs[0], artifacts: [...good.runs[0].artifacts, { path: '/etc/passwd', sha256: good.runs[0].artifacts[0].sha256, bytes: 1 }] }, good.runs[1]] }, /relative POSIX path/],
    [{ ...good, runs: [{ ...good.runs[0], artifacts: [...good.runs[0].artifacts, { path: 'packages/api/package.json', sha256: good.runs[0].artifacts[0].sha256, bytes: 1 }] }, good.runs[1]] }, /stay inside \.ts-quality\/runs\/api-run/],
    [{ ...good, completeness: { ...good.completeness, complete: true } }, /completeness disagrees/],
    [{ ...good, upload: { root: '.', paths: ['../x'] } }, /must stay inside the root/],
    [{ ...good, packages: good.packages.map((entry) => ({ ...entry, evidence: [{ runId: 'ghost-run', changedFiles: [] }] })) }, /does not list/]
  ];
  for (const [value, fragment] of variants) {
    writeIndexFile(root, value);
    refused(root, ['index', 'inspect'], fragment);
  }
  fs.writeFileSync(path.join(root, '.ts-quality/package-index.json'), '{not json');
  refused(root, ['index', 'inspect'], /is not valid JSON/);
  refused(root, ['index', 'inspect', '--index', '../outside.json'], /must stay inside the root/);
});

test('Scenario: inspect refuses symbolic links in place of the index or a referenced artifact', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const report = path.join(root, '.ts-quality/runs/api-run/report.md');
  fs.copyFileSync(report, path.join(outside, 'report.md'));
  fs.rmSync(report);
  fs.symlinkSync(path.join(outside, 'report.md'), report);
  refused(root, ['index', 'inspect'], /traverses a symbolic link/);
  fs.copyFileSync(path.join(root, '.ts-quality/package-index.json'), path.join(outside, 'index.json'));
  fs.symlinkSync(path.join(outside, 'index.json'), path.join(root, 'linked-index.json'));
  refused(root, ['index', 'inspect', '--index', 'linked-index.json'], /symbolic link/);
});

test('Scenario: package names with shell metacharacters are data, and no Git or other command is needed', (t) => {
  const root = copyBase(t);
  const evil = 'packages/evil$(touch pwned);`touch pwned2`';
  fs.mkdirSync(path.join(root, evil), { recursive: true });
  fs.writeFileSync(path.join(root, evil, 'package.json'), '{"name":"$(touch pwned3)"}\n');
  const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-nopath-'));
  t.after(() => fs.rmSync(emptyPath, { recursive: true, force: true }));
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run'], { PATH: emptyPath });
  const inspection = inspect(root, ['--package', evil]);
  assert.equal(inspection.packages[0].name, '$(touch pwned3)');
  assert.equal(ok(root, ['index', 'inspect'], { PATH: emptyPath }).includes('References: fresh'), true);
  for (const name of ['pwned', 'pwned2', 'pwned3']) {
    assert.equal(fs.existsSync(path.join(root, name)), false);
    assert.equal(fs.existsSync(path.join(process.cwd(), name)), false);
  }
});

test('Scenario: inspect refuses a symlinked control-plane file and run paths outside the root instead of reading them', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret\n');
  const config = path.join(root, 'ts-quality.config.json');
  fs.renameSync(config, path.join(outside, 'config.json'));
  fs.symlinkSync(path.join(outside, 'secret.txt'), config);
  refused(root, ['index', 'inspect'], /symbolic link/);
  fs.rmSync(config);
  fs.renameSync(path.join(outside, 'config.json'), config);

  // A run packet that records a control-plane path outside the root is refused even when its digest was indexed.
  const runFile = path.join(root, '.ts-quality/runs/api-run/run.json');
  const run = JSON.parse(fs.readFileSync(runFile, 'utf8'));
  run.controlPlane.configPath = '../outside-secret.txt';
  fs.writeFileSync(runFile, JSON.stringify(run, null, 2));
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  refused(root, ['index', 'inspect'], /inside the root/);
});

test('Scenario: forged per-package evidence is refused, not reported', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  const good = readIndex(root);
  const forged = (mutate) => {
    const value = structuredClone(good);
    mutate(value);
    return value;
  };
  const variants = [
    [forged((value) => { value.packages[2].evidence = [{ runId: 'api-run', changedFiles: ['packages/api/src/limit.js'] }, { runId: 'web-run', changedFiles: ['packages/web/src/label.js'] }]; }), /does not own it/],
    [forged((value) => { value.packages[1].evidence.push({ ...value.packages[1].evidence[0] }); }), /more than once/],
    [forged((value) => { value.packages[1].evidence = [{ runId: 'api-run', changedFiles: [] }]; }), /partition its changed files exactly/],
    [forged((value) => { value.runs[0] = null; }), /must hold objects/]
  ];
  for (const [value, fragment] of variants) {
    writeIndexFile(root, value);
    refused(root, ['index', 'inspect'], fragment);
  }
});

test('Scenario: deleting one evaluated file locally is drift, not an unavailable source', (t) => {
  const root = copyBase(t);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run,web-run']);
  fs.rmSync(path.join(root, 'packages/api/src/limit.js'));
  const api = inspect(root).packages.find((entry) => entry.path === 'packages/api');
  assert.equal(api.quality[0].source.state, 'drifted');
  assert.equal(api.state, 'stale');
});

test('Scenario: index bytes do not depend on the process locale', (t) => {
  const root = copyBase(t);
  for (const name of ['tau', 'zeta', 'Zulu', 'ångström']) {
    fs.mkdirSync(path.join(root, 'packages', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'packages', name, 'package.json'), `{"name":"${name}"}\n`);
  }
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run'], { LC_ALL: 'et_EE.UTF-8', LANG: 'et_EE.UTF-8' });
  const estonian = fs.readFileSync(path.join(root, '.ts-quality/package-index.json'));
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run'], { LC_ALL: 'C', LANG: 'C' });
  assert.deepEqual(fs.readFileSync(path.join(root, '.ts-quality/package-index.json')), estonian);
  const paths = readIndex(root).scope.packages;
  assert.deepEqual(paths, [...paths].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
});

test('Scenario: outputs resolve through a symlinked root, and the run-packet guard ignores letter case', (t) => {
  const root = copyBase(t);
  const linkedRoot = `${root}-link`;
  fs.symlinkSync(root, linkedRoot);
  t.after(() => fs.rmSync(linkedRoot, { force: true }));
  ok(linkedRoot, ['index', 'write', '--all', '--run-id', 'api-run', '--out', path.join(linkedRoot, 'review/index.json')]);
  assert.ok(fs.existsSync(path.join(root, 'review/index.json')));
  refused(root, ['index', 'write', '--all', '--run-id', 'api-run', '--out', '.ts-quality/Runs/api-run/index.json'], /run packets are immutable/);
});

test('Scenario: untrusted names are rendered inert in text output', (t) => {
  const root = copyBase(t);
  fs.mkdirSync(path.join(root, 'packages/esc'), { recursive: true });
  fs.writeFileSync(path.join(root, 'packages/esc/package.json'), JSON.stringify({ name: 'esc\u001b[31mred\u0007' }));
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run']);
  const text = ok(root, ['index', 'inspect']);
  assert.equal(/[\u001b\u0007]/.test(text), false);
});

test('Scenario: the retention guidance names the default package index as a generated artifact to keep out of commits', (t) => {
  const root = copyBase(t);
  let plan = ok(root, ['retention', '--machine']);
  assert.match(plan, /\nignore\tmissing\t\.ts-quality\/package-index\.json\treason=generated package artifact-reference index/);
  ok(root, ['index', 'write', '--all', '--run-id', 'api-run']);
  plan = ok(root, ['retention', '--machine']);
  assert.match(plan, /\nignore\tpresent\t\.ts-quality\/package-index\.json\treason=generated package artifact-reference index/);
});
