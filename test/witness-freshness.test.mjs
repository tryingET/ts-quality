import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { importDist } from './helpers.mjs';

const api = await importDist('packages', 'ts-quality', 'src', 'index.js');
const engine = await importDist('packages', 'invariants', 'src', 'index.js');
const bindingApi = await importDist('packages', 'evidence-model', 'src', 'witness.js');

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-witness-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  write('package.json', '{"private":true}');
  write('src/flag.cjs', 'exports.isOne = v => v === 1;\n');
  write('test/flag.cjs', "const assert = require('node:assert/strict'); const {isOne} = require('../src/flag.cjs'); assert.equal(isOne(1), true); assert.equal(isOne(2), false);\n");
  const witness = (name, extra = {}) => api.runExecutionWitnessCommand(root, {
    invariantId: 'flag.correct', scenarioId: 'one', sourceFiles: ['src/flag.cjs'],
    testFiles: ['test/flag.cjs'], command: [process.execPath, 'test/flag.cjs'],
    outputPath: `.ts-quality/witnesses/${name}.json`, ...extra
  });
  const claim = (scenario = {}, changedFiles = ['src/flag.cjs']) => engine.evaluateInvariants({
    rootDir: root, invariants: [{ id: 'flag.correct', title: 'Flag validity', description: 'Only one',
      severity: 'high', selectors: ['path:src/**'], scenarios: [{ id: 'one', description: 'One accepted',
        keywords: ['one accepted'], expected: 'true', ...scenario }] }],
    changedFiles, changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/flag.cjs', symbol: 'function:isOne',
      span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [], mutations: [], testPatterns: ['test/**/*.test.js']
  })[0];
  return { root, write, witness, claim };
}

function unsupported(claim) {
  assert.notEqual(claim.status, 'supported');
  assert.notEqual(claim.evidenceSummary.evidenceSemantics, 'execution-backed');
  assert.deepEqual(claim.evidenceSummary.executionWitnessFiles ?? [], []);
}

test('real old pass cannot survive regressed source and a current failing witness', t => {
  const p = project(t);
  assert.equal(p.witness('old-pass', { observedAt: '2099-01-01' }).witness.status, 'pass');
  assert.equal(p.claim().status, 'supported');
  p.write('src/flag.cjs', 'exports.isOne = () => false;\n');
  assert.equal(p.witness('current-fail', { observedAt: '1900-01-01' }).witness.status, 'fail');
  unsupported(p.claim());
});

test('current failure vetoes a current pass regardless of command or observation timestamp', t => {
  const p = project(t);
  p.witness('pass', { observedAt: '2099-01-01' });
  p.witness('fail', { command: [process.execPath, '-e', 'process.exit(1)'], observedAt: '1900-01-01' });
  unsupported(p.claim());
});

test('source, test, execution environment and project context drift remove support', t => {
  const p = project(t);
  p.witness('pass');
  p.write('test/flag.cjs', 'process.exit(0);\n');
  unsupported(p.claim());
  p.witness('pass');
  p.write('package.json', '{"private":true,"type":"module"}');
  unsupported(p.claim());
  p.witness('pass');
  const before = process.env.NODE_OPTIONS;
  try {
    process.env.NODE_OPTIONS = '--no-warnings';
    unsupported(p.claim());
  } finally {
    if (before === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = before;
  }
});

test('legacy records are explicitly downgraded with rerun guidance', t => {
  const p = project(t);
  p.write('.ts-quality/witnesses/legacy.json', JSON.stringify({ version: '1', kind: 'execution-witness',
    invariantId: 'flag.correct', scenarioId: 'one', status: 'pass', sourceFiles: ['src/flag.cjs'] }));
  const claim = p.claim();
  unsupported(claim);
  assert.match(JSON.stringify(claim), /legacy unbound.*rerun/);
});

test('malformed bindings, missing content, scope and configured command mismatches fail closed', t => {
  const p = project(t);
  p.witness('pass');
  unsupported(p.claim({ executionWitnessCommand: [process.execPath, '-e', 'process.exit(0)'] }));
  const file = path.join(p.root, '.ts-quality/witnesses/pass.json');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  value.binding.sourceDigests = {};
  fs.writeFileSync(file, JSON.stringify(value));
  unsupported(p.claim());
  p.witness('pass');
  fs.unlinkSync(path.join(p.root, 'test/flag.cjs'));
  unsupported(p.claim());
});

test('a command changing bound content cannot mint passing evidence', t => {
  const p = project(t);
  const result = p.witness('changed', { command: [process.execPath, '-e', "require('fs').appendFileSync('src/flag.cjs', '// changed\\n')"] });
  assert.notEqual(result.witness.status, 'pass');
  unsupported(p.claim());
});

test('rewrite-and-restore cannot mint passing support for broken source', t => {
  const p = project(t);
  p.write('src/flag.cjs', 'exports.isOne = () => false;\n');
  const result = p.witness('restored', { command: [process.execPath, '-e', [
    "const fs = require('fs'); const file = 'src/flag.cjs'; const old = fs.readFileSync(file);",
    "try { fs.writeFileSync(file, 'exports.isOne = v => v === 1;'); require('./test/flag.cjs'); }",
    "finally { fs.writeFileSync(file, old); }"
  ].join('\n')] });
  assert.equal(result.receipt.status, 'error');
  assert.match(result.receipt.details, /metadata changed/);
  unsupported(p.claim());
});

test('malformed observation metadata cannot suppress a current failure', t => {
  const p = project(t);
  p.witness('pass');
  const fail = p.witness('fail', { command: [process.execPath, '-e', 'process.exit(1)'] });
  const record = JSON.parse(fs.readFileSync(fail.outputPath, 'utf8'));
  record.observedAt = 123;
  fs.writeFileSync(fail.outputPath, JSON.stringify(record));
  unsupported(p.claim());
  unsupported(p.claim({ executionWitnessPatterns: ['.ts-quality/witnesses/*.json'] }));
});

test('subset failure vetoes broader passing scope but a disjoint failure does not', t => {
  const p = project(t);
  p.write('src/second.cjs', 'exports.other = true;');
  p.write('other/disjoint.cjs', 'exports.other = true;');
  p.witness('broad-pass', { sourceFiles: ['src/flag.cjs', 'src/second.cjs'] });
  p.witness('disjoint-fail', { sourceFiles: ['other/disjoint.cjs'], command: [process.execPath, '-e', 'process.exit(1)'] });
  assert.equal(p.claim({}, ['src/flag.cjs', 'src/second.cjs']).status, 'supported');
  p.witness('subset-fail', { command: [process.execPath, '-e', 'process.exit(1)'] });
  unsupported(p.claim({}, ['src/flag.cjs', 'src/second.cjs']));
});

test('producer rejects input aliases and command-retargeted output symlinks', t => {
  const p = project(t);
  assert.throws(() => p.witness('alias', { outputPath: 'src/flag.cjs' }), /overwrite bound inputs/);
  const outside = path.join(p.root, '..', `${path.basename(p.root)}-outside`);
  fs.writeFileSync(outside, 'preserved');
  t.after(() => fs.rmSync(outside, { force: true }));
  assert.throws(() => p.witness('symlink', { command: [process.execPath, '-e',
    `require('fs').symlinkSync(${JSON.stringify(outside)}, '.ts-quality/witnesses/symlink.json')`] }), /inside|containment|symlinks/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'preserved');
});

test('producer rejects retargeted pre-existing symlinks and hardlink outputs', t => {
  const p = project(t);
  p.write('.ts-quality/witnesses/real.json', '{}');
  const link = path.join(p.root, '.ts-quality/witnesses/preexisting.json');
  fs.symlinkSync('real.json', link);
  const outside = path.join(p.root, '..', `${path.basename(p.root)}-protected`);
  fs.writeFileSync(outside, 'protected');
  t.after(() => fs.rmSync(outside, { force: true }));
  assert.throws(() => p.witness('preexisting', { command: [process.execPath, '-e',
    `const fs = require('fs'); fs.unlinkSync('.ts-quality/witnesses/preexisting.json'); fs.symlinkSync(${JSON.stringify(outside)}, '.ts-quality/witnesses/preexisting.json')`] }), /inside|containment|symlinks/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'protected');
  const source = path.join(p.root, 'src/flag.cjs');
  const before = fs.readFileSync(source, 'utf8');
  fs.linkSync(source, path.join(p.root, '.ts-quality/witnesses/hardlink.json'));
  assert.throws(() => p.witness('hardlink'), /hardlink aliases/);
  assert.equal(fs.readFileSync(source, 'utf8'), before);
});

test('dangling witness and receipt symlinks are rejected before and after commands', t => {
  const p = project(t);
  p.write('.ts-quality/witnesses/directory-marker', '');
  for (const kind of ['json', 'receipt.json']) {
    for (const when of ['before', 'command']) {
      const name = `dangling-${kind}-${when}`;
      const target = `.ts-quality/witnesses/${name}.${kind}`;
      const outside = path.join(p.root, '..', `${path.basename(p.root)}-${name}`);
      t.after(() => fs.rmSync(outside, { force: true }));
      if (when === 'before') fs.symlinkSync(outside, path.join(p.root, target));
      const command = when === 'command'
        ? [process.execPath, '-e', `require('fs').symlinkSync(${JSON.stringify(outside)}, ${JSON.stringify(target)})`]
        : [process.execPath, 'test/flag.cjs'];
      assert.throws(() => p.witness(name, { command }), /symlinks/);
      assert.equal(fs.existsSync(outside), false);
    }
  }
});

test('unrelated context-directory churn is conservatively rejected without altering binding', t => {
  const p = project(t);
  const result = p.witness('directory-churn', { command: [process.execPath, '-e', "require('fs').writeFileSync('unrelated.log', 'log')"] });
  assert.equal(bindingApi.executionWitnessBindingIssue(p.root, result.witness), undefined);
  assert.equal(result.receipt.status, 'error');
  assert.match(result.receipt.details, /metadata changed/);
});

test('special files fail promptly before hashing or command execution', { skip: process.platform === 'win32' }, t => {
  const p = project(t);
  const fifo = path.join(p.root, 'src/input-fifo');
  const made = spawnSync('mkfifo', [fifo]);
  assert.equal(made.status, 0);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const api = await import(${JSON.stringify(new URL('../dist/packages/ts-quality/src/index.js', import.meta.url).href)});
    api.runExecutionWitnessCommand(${JSON.stringify(p.root)}, {
      invariantId: 'flag.correct', scenarioId: 'one', sourceFiles: ['src/input-fifo'],
      command: [process.execPath, '-e', 'process.exit(0)'], outputPath: '.ts-quality/witnesses/fifo.json'
    });
  `], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 1, 'must reject, not hang on the FIFO');
  assert.match(result.stderr, /regular file/);
});
