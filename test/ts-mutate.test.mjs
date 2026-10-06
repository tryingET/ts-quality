import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
import { fixturePath, importDist, tempCopyOfFixture } from './helpers.mjs';

const mutate = await importDist('packages', 'ts-mutate', 'src', 'index.js');
const crap = await importDist('packages', 'crap4ts', 'src', 'index.js');

test('discoverMutationSites finds boolean and operator mutations', () => {
  const filePath = path.join(fixturePath('governed-app'), 'src', 'auth', 'token.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const coverage = crap.parseLcov(fs.readFileSync(path.join(fixturePath('governed-app'), 'coverage', 'lcov.info'), 'utf8'));
  const sites = mutate.discoverMutationSites(source, 'src/auth/token.js', coverage, ['src/auth/token.js'], [], true);
  assert.equal(sites.length > 0, true);
  assert.equal(sites.some((site) => site.original === '>=' || site.replacement === '>='), true);
});

test('applyMutation replaces exact span instead of first matching line fragment', () => {
  const source = 'const value = left >= right;\n';
  const site = {
    id: 'x',
    filePath: 'sample.js',
    span: { startLine: 1, endLine: 1 },
    startOffset: 19,
    endOffset: 21,
    operator: '>=',
    original: '>=',
    replacement: '>',
    description: 'tighten'
  };
  assert.equal(mutate.applyMutation(source, site), 'const value = left > right;\n');
});

test('runMutations writes manifest and reuses cached results', () => {
  const rootDir = tempCopyOfFixture('governed-app');
  const manifestPath = path.join(rootDir, '.ts-quality', 'mutation-manifest.json');
  const coverage = crap.parseLcov(fs.readFileSync(path.join(rootDir, 'coverage', 'lcov.info'), 'utf8'));
  const first = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/auth/token.js'],
    changedFiles: ['src/auth/token.js'],
    coverage,
    testCommand: ['node', '--test'],
    coveredOnly: true,
    manifestPath,
    maxSites: 3,
    timeoutMs: 10_000
  });
  const second = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/auth/token.js'],
    changedFiles: ['src/auth/token.js'],
    coverage,
    testCommand: ['node', '--test'],
    coveredOnly: true,
    manifestPath,
    maxSites: 3,
    timeoutMs: 10_000
  });
  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(second.results.length, first.results.length);
  assert.equal(second.executionFingerprint, first.executionFingerprint);
});


test('discoverMutationSites honors diff hunks within changed files', () => {
  const source = [
    'function first(a, b) {',
    '  return a === b;',
    '}',
    '',
    'function second(a, b) {',
    '  return a > b;',
    '}',
    ''
  ].join('\n');
  const sites = mutate.discoverMutationSites(source, 'src/sample.js', [], ['src/sample.js'], [{ filePath: 'src/sample.js', hunkId: 'h1', span: { startLine: 5, endLine: 6 } }], false);
  assert.deepEqual(sites.map((site) => site.span.startLine), [6]);
});

test('discoverMutationSites skips lines without coverage evidence when coveredOnly is true', () => {
  const source = 'function isOne(value) { return value === 1; }\n';
  const sites = mutate.discoverMutationSites(source, 'src/sample.js', [], ['src/sample.js'], [], true);
  assert.deepEqual(sites, []);
});


test('runMutations requires a passing baseline before trusting mutation results', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-baseline-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'check.js'), 'process.exit(1);\n', 'utf8');

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(run.baseline.status, 'fail');
  assert.equal(run.score, 0);
  assert.equal(run.results.every((result) => result.status === 'error'), true);
});


test('runMutations resolves workspace-package node_modules inside the mutant workspace', () => {
  // pnpm-style workspace: the dependency lives only in the package's own node_modules, not the root one.
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-nested-modules-'));
  const write = (relativePath, contents) => {
    fs.mkdirSync(path.dirname(path.join(rootDir, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(rootDir, relativePath), contents, 'utf8');
  };
  write('package.json', JSON.stringify({ name: 'ws-root', private: true }));
  write('packages/a/package.json', JSON.stringify({ name: '@ws/a', dependencies: { 'local-dep': '1.0.0' } }));
  write('packages/a/node_modules/local-dep/package.json', JSON.stringify({ name: 'local-dep', main: 'index.js' }));
  write('packages/a/node_modules/local-dep/index.js', "module.exports = { tag: 'ok' };\n");
  write('packages/a/src/label.js', "const { tag } = require('local-dep');\nfunction label(count) { return count > 0 ? tag : 'none'; }\nfunction verbose() { return true; }\nmodule.exports = { label, verbose };\n");
  write('check.js', "const assert = require('node:assert/strict');\nconst { label } = require('./packages/a/src/label.js');\nassert.equal(label(5), 'ok');\n");

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['packages/a/src/label.js'],
    changedFiles: ['packages/a/src/label.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    maxSites: 10,
    timeoutMs: 10_000
  });

  assert.equal(run.baseline.status, 'pass');
  assert.equal(run.results.some((result) => /Cannot find module 'local-dep'/.test(result.details ?? '')), false, 'mutants must not die from module resolution');
  const verboseFlip = run.results.find((result) => result.original === 'true');
  assert.ok(verboseFlip);
  assert.equal(verboseFlip.status, 'survived', 'an unasserted mutation must survive rather than be killed by a broken workspace');
  assert.equal(fs.existsSync(path.join(rootDir, 'packages/a/node_modules/local-dep/index.js')), true, 'workspace disposal must not delete linked real node_modules');
});

for (const layout of ['pnpm package link', 'npm workspaces root link']) {
  test(`runMutations keeps workspace-package links inside the mutant workspace (${layout})`, () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-workspace-links-'));
    const write = (relativePath, contents) => {
      fs.mkdirSync(path.dirname(path.join(rootDir, relativePath)), { recursive: true });
      fs.writeFileSync(path.join(rootDir, relativePath), contents, 'utf8');
    };
    write('package.json', JSON.stringify({ name: 'ws-root', private: true }));
    write('packages/a/package.json', JSON.stringify({ name: '@ws/a', main: 'src/index.js' }));
    write('packages/a/src/index.js', 'function isPositive(value) { return value > 0; }\nmodule.exports = { isPositive };\n');
    write('packages/b/package.json', JSON.stringify({ name: '@ws/b', dependencies: { '@ws/a': 'workspace:*' } }));
    write('packages/b/src/use.js', "const { isPositive } = require('@ws/a');\nmodule.exports = { check: (value) => isPositive(value) };\n");
    // Workspace managers link sibling packages with relative symlinks that must resolve to the mutated copy.
    if (layout === 'pnpm package link') {
      fs.mkdirSync(path.join(rootDir, 'packages/b/node_modules/@ws'), { recursive: true });
      fs.symlinkSync('../../../a', path.join(rootDir, 'packages/b/node_modules/@ws/a'), 'dir');
    } else {
      fs.mkdirSync(path.join(rootDir, 'node_modules/@ws'), { recursive: true });
      fs.symlinkSync('../../packages/a', path.join(rootDir, 'node_modules/@ws/a'), 'dir');
    }
    write('check.js', "const assert = require('node:assert/strict');\nconst { check } = require('./packages/b/src/use.js');\nassert.equal(check(1), true);\nassert.equal(check(0), false);\n");

    const run = mutate.runMutations({
      repoRoot: rootDir,
      sourceFiles: ['packages/a/src/index.js'],
      changedFiles: ['packages/a/src/index.js'],
      testCommand: ['node', 'check.js'],
      coveredOnly: false,
      maxSites: 10,
      timeoutMs: 10_000
    });

    assert.equal(run.baseline.status, 'pass');
    const boundary = run.results.find((result) => result.original === '>');
    assert.ok(boundary);
    assert.equal(boundary.status, 'killed', 'a mutant reached only through a workspace link must run the mutated copy');
    assert.equal(fs.readFileSync(path.join(rootDir, 'packages/a/src/index.js'), 'utf8').includes('value > 0'), true, 'the real source stays unmutated');
  });
}

// Feature: a mutant kill is evidence only when the unmutated code passes in the same mutant workspace

test('Scenario: a test command that cannot run inside the mutant workspace yields no kills', () => {
  // Given a test command that passes in the repository but depends on state the mutant workspace does not carry
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-workspace-baseline-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.ts-quality'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'runtime-state'), 'ready\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'check.js'), "require('fs').readFileSync('.ts-quality/runtime-state');\n", 'utf8');

  // When mutations run
  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    maxSites: 5,
    timeoutMs: 5_000
  });

  // Then no mutant counts as killed, the run fails closed, and the baseline names the workspace
  assert.ok(run.results.length > 0);
  assert.equal(run.results.some((result) => result.status === 'killed'), false);
  assert.equal(run.results.every((result) => result.status === 'error'), true);
  assert.equal(run.score, 0);
  assert.equal(run.baseline.status, 'fail');
  assert.match(run.baseline.details ?? '', /mutation workspace/i);
});

test('Scenario: a symlinked node_modules resolves inside the mutant workspace', () => {
  // Given a repository whose node_modules is a symlink to an install directory outside the repository
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-symlinked-modules-'));
  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-external-install-'));
  fs.mkdirSync(path.join(installDir, 'node_modules', 'external-dep'), { recursive: true });
  fs.writeFileSync(path.join(installDir, 'node_modules', 'external-dep', 'index.js'), "module.exports = { tag: 'ok' };\n", 'utf8');
  fs.symlinkSync(path.join(installDir, 'node_modules'), path.join(rootDir, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'label.js'), "const { tag } = require('external-dep');\nfunction label() { return tag; }\nfunction verbose() { return true; }\nmodule.exports = { label, verbose };\n", 'utf8');
  // Package managers look for install state at the project root (for example yarn's node_modules/.yarn-state.yml),
  // not by walking up parent directories the way Node's resolver does.
  fs.writeFileSync(path.join(rootDir, 'check.js'), "const assert = require('node:assert/strict');\nrequire('fs').statSync('node_modules/external-dep/index.js');\nassert.equal(require('./src/label.js').label(), 'ok');\n", 'utf8');

  // When mutations run
  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/label.js'],
    changedFiles: ['src/label.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    maxSites: 5,
    timeoutMs: 5_000
  });

  // Then the dependency resolves, so the unasserted mutant survives instead of dying on module resolution
  assert.equal(run.baseline.status, 'pass');
  const verboseFlip = run.results.find((result) => result.original === 'true');
  assert.ok(verboseFlip);
  assert.equal(verboseFlip.status, 'survived');
});

test('runMutations invalidates manifest entries when the test corpus changes', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-manifest-'));
  const manifestPath = path.join(rootDir, '.ts-quality', 'mutation-manifest.json');
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'state.json'), JSON.stringify({ ok: true }), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'check.js'), "const fs = require('fs'); const state = JSON.parse(fs.readFileSync('state.json', 'utf8')); process.exit(state.ok ? 0 : 1);\n", 'utf8');

  const first = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    manifestPath,
    maxSites: 5,
    timeoutMs: 5_000
  });
  fs.writeFileSync(path.join(rootDir, 'state.json'), JSON.stringify({ ok: false }), 'utf8');
  const second = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    manifestPath,
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(first.baseline.status, 'pass');
  assert.equal(second.baseline.status, 'fail');
  assert.equal(second.executionFingerprint === first.executionFingerprint, false);
  assert.equal(second.results.every((result) => result.status === 'error'), true);
});

test('runMutations resets reusable workspace state between mutant executions', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-workspace-reset-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), [
    'function flag(value) {',
    '  return value === 1 && true;',
    '}',
    'module.exports = { flag };',
    ''
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'check.js'), [
    "const fs = require('fs');",
    "const path = require('path');",
    "const { flag } = require('./src/flag.js');",
    "const inMutationWorkspace = process.cwd().includes(`${path.sep}.ts-quality${path.sep}tmp-mutants${path.sep}`);",
    "if (inMutationWorkspace) {",
    "  const contaminationPath = 'side-effect.txt';",
    "  const existed = fs.existsSync(contaminationPath);",
    "  fs.writeFileSync(contaminationPath, 'x');",
    "  if (existed) { console.error('workspace contamination detected'); process.exit(1); }",
    "}",
    "process.exit(flag(1) === true && flag(2) === false ? 0 : 1);",
    ''
  ].join('\n'), 'utf8');

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    maxSites: 3,
    timeoutMs: 5_000
  });

  assert.equal(run.baseline.status, 'pass');
  assert.equal(run.results.length >= 2, true);
  assert.equal(run.results.some((result) => (result.details ?? '').includes('workspace contamination detected')), false, JSON.stringify(run.results, null, 2));
  assert.equal(fs.existsSync(path.join(rootDir, 'side-effect.txt')), false);
});

test('runMutations mutates mirrored dist runtime files so dist-backed tests observe the mutant', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-dist-mirror-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'dist', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'test', 'flag.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { flag } = require('../dist/flag.js'); test('flag', () => assert.equal(flag(), true));\n", 'utf8');

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', '--test'],
    coveredOnly: false,
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(run.baseline.status, 'pass');
  assert.equal(run.results.some((result) => result.status === 'killed'), true, JSON.stringify(run.results, null, 2));
  assert.equal(run.results.some((result) => result.status === 'survived'), false, JSON.stringify(run.results, null, 2));
});

test('runMutations transpiles mutated ts sources into mirrored runtime roots for dist-backed tests', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-ts-dist-mirror-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'commonjs', target: 'es2020' } }, null, 2), 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.ts'), 'export function flag(): boolean { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'dist', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'test', 'flag.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { flag } = require('../dist/flag.js'); test('flag', () => assert.equal(flag(), true));\n", 'utf8');

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.ts'],
    changedFiles: ['src/flag.ts'],
    testCommand: ['node', '--test'],
    coveredOnly: false,
    runtimeMirrorRoots: ['dist'],
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(run.baseline.status, 'pass');
  assert.equal(run.results.some((result) => result.status === 'killed'), true, JSON.stringify(run.results, null, 2));
  assert.equal(run.results.some((result) => result.status === 'survived'), false, JSON.stringify(run.results, null, 2));
});

test('runMutations supports custom runtime mirror roots for built output outside dist', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-lib-mirror-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'lib', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'test', 'flag.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { flag } = require('../lib/flag.js'); test('flag', () => assert.equal(flag(), true));\n", 'utf8');

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', '--test'],
    coveredOnly: false,
    runtimeMirrorRoots: ['lib'],
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(run.baseline.status, 'pass');
  assert.equal(run.results.some((result) => result.status === 'killed'), true, JSON.stringify(run.results, null, 2));
});

test('runMutations canonicalizes duplicate runtime mirror roots before fingerprinting', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-runtime-mirror-fingerprint-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'dist', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'test', 'flag.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { flag } = require('../dist/flag.js'); test('flag', () => assert.equal(flag(), true));\n", 'utf8');

  const canonical = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', '--test'],
    coveredOnly: false,
    runtimeMirrorRoots: ['dist'],
    maxSites: 5,
    timeoutMs: 5_000
  });
  const duplicated = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', '--test'],
    coveredOnly: false,
    runtimeMirrorRoots: ['dist', './dist', 'dist/'],
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(canonical.baseline.status, 'pass');
  assert.equal(duplicated.baseline.status, 'pass');
  assert.equal(duplicated.executionFingerprint, canonical.executionFingerprint);
  assert.deepEqual(duplicated.results.map((result) => result.status), canonical.results.map((result) => result.status));
});

test('runMutations mirrors root-level sources into configured built runtime roots', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-root-mirror-'));
  fs.mkdirSync(path.join(rootDir, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'index.js'), 'function isOne(value) { return value === 1; }\nmodule.exports = { isOne };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'dist', 'index.js'), 'function isOne(value) { return value === 1; }\nmodule.exports = { isOne };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'test', 'index.test.js'), "const test = require('node:test'); const assert = require('node:assert/strict'); const { isOne } = require('../dist/index.js'); test('isOne', () => { assert.equal(isOne(1), true); assert.equal(isOne(2), false); });\n", 'utf8');

  const run = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['index.js'],
    changedFiles: ['index.js'],
    testCommand: ['node', '--test'],
    coveredOnly: false,
    runtimeMirrorRoots: ['dist'],
    maxSites: 5,
    timeoutMs: 5_000
  });

  assert.equal(run.baseline.status, 'pass');
  assert.equal(run.results.some((result) => result.status === 'killed'), true, JSON.stringify(run.results, null, 2));
  assert.equal(run.results.some((result) => result.status === 'survived'), false, JSON.stringify(run.results, null, 2));
});


test('runMutations ignores inherited NODE_TEST_CONTEXT and keeps mutation outcomes deterministic', () => {
  const cleanRoot = tempCopyOfFixture('governed-app');
  const contaminatedRoot = tempCopyOfFixture('governed-app');
  const cleanCoverage = crap.parseLcov(fs.readFileSync(path.join(cleanRoot, 'coverage', 'lcov.info'), 'utf8'));
  const contaminatedCoverage = crap.parseLcov(fs.readFileSync(path.join(contaminatedRoot, 'coverage', 'lcov.info'), 'utf8'));

  const clean = mutate.runMutations({
    repoRoot: cleanRoot,
    sourceFiles: ['src/auth/token.js'],
    changedFiles: ['src/auth/token.js'],
    coverage: cleanCoverage,
    testCommand: ['node', '--test'],
    coveredOnly: true,
    manifestPath: path.join(cleanRoot, '.ts-quality', 'mutation-manifest.json'),
    maxSites: 4,
    timeoutMs: 10_000
  });

  const previous = process.env.NODE_TEST_CONTEXT;
  process.env.NODE_TEST_CONTEXT = 'child-v8';
  try {
    const contaminated = mutate.runMutations({
      repoRoot: contaminatedRoot,
      sourceFiles: ['src/auth/token.js'],
      changedFiles: ['src/auth/token.js'],
      coverage: contaminatedCoverage,
      testCommand: ['node', '--test'],
      coveredOnly: true,
      manifestPath: path.join(contaminatedRoot, '.ts-quality', 'mutation-manifest.json'),
      maxSites: 4,
      timeoutMs: 10_000
    });

    assert.equal(clean.executionFingerprint, contaminated.executionFingerprint);
    assert.deepEqual(
      contaminated.results.map((result) => result.status),
      clean.results.map((result) => result.status)
    );
    assert.equal(contaminated.survived, clean.survived);
    assert.equal(contaminated.killed, clean.killed);
    assert.equal(contaminated.results.some((result) => (result.details ?? '').includes('run() is being called recursively')), false);
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TEST_CONTEXT;
    } else {
      process.env.NODE_TEST_CONTEXT = previous;
    }
  }
});

test('runMutations invalidates cached results when arbitrary execution environment changes', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutant-env-fingerprint-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'flag.js'), 'function flag() { return true; }\nmodule.exports = { flag };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'check.js'), "const { flag } = require('./src/flag.js'); if (process.env.CUSTOM_MUTATION_FLAG === 'ignore') process.exit(0); process.exit(flag() === true ? 0 : 1);\n", 'utf8');

  const manifestPath = path.join(rootDir, '.ts-quality', 'mutation-manifest.json');
  const previous = process.env.CUSTOM_MUTATION_FLAG;
  delete process.env.CUSTOM_MUTATION_FLAG;
  try {
    const first = mutate.runMutations({
      repoRoot: rootDir,
      sourceFiles: ['src/flag.js'],
      changedFiles: ['src/flag.js'],
      testCommand: ['node', 'check.js'],
      manifestPath,
      coveredOnly: false,
      maxSites: 5,
      timeoutMs: 10_000
    });

    process.env.CUSTOM_MUTATION_FLAG = 'ignore';
    const second = mutate.runMutations({
      repoRoot: rootDir,
      sourceFiles: ['src/flag.js'],
      changedFiles: ['src/flag.js'],
      testCommand: ['node', 'check.js'],
      manifestPath,
      coveredOnly: false,
      maxSites: 5,
      timeoutMs: 10_000
    });

    assert.notEqual(first.executionFingerprint, second.executionFingerprint);
    assert.deepEqual(first.results.map((result) => result.status), ['killed']);
    assert.deepEqual(second.results.map((result) => result.status), ['survived']);
  } finally {
    if (previous === undefined) {
      delete process.env.CUSTOM_MUTATION_FLAG;
    } else {
      process.env.CUSTOM_MUTATION_FLAG = previous;
    }
  }
});

function sitesOf(source, filePath = 'src/sample.ts') {
  return mutate.discoverMutationSites(source, filePath, [], [], [], false);
}

function runFunction(source, args) {
  // Fixture sources are tiny pure functions named `f`; evaluate original and mutant in an isolated context.
  const transpiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = vm.createContext({ exports: {} });
  vm.runInContext(transpiled, context);
  return vm.runInContext('f', context)(...args);
}

const runtimeProbes = [
  { name: 'multiplication', source: 'function f(a, b) { return a * b; }', original: '*', replacement: '/', args: [6, 3] },
  { name: 'loose equality', source: 'function f(a, b) { return a == b; }', original: '==', replacement: '!=', args: [1, '1'] },
  { name: 'loose inequality', source: 'function f(a, b) { return a != b; }', original: '!=', replacement: '==', args: [1, '1'] },
  { name: 'postfix increment', source: 'function f(a) { let b = a; b++; return b; }', original: '++', replacement: '--', args: [1] },
  { name: 'prefix decrement', source: 'function f(a) { let b = a; --b; return b; }', original: '--', replacement: '++', args: [1] },
  { name: 'numeric zero', source: 'function f() { return 0; }', original: '0', replacement: '1', args: [] },
  { name: 'numeric one', source: 'function f(a) { return a + 1; }', original: '1', replacement: '0', args: [1] },
  { name: 'if condition', source: 'function f(a) { if (a) return a; return null; }', original: 'a', replacement: '!(a)', args: [5] },
  { name: 'negated condition', source: 'function f(a) { if (!a) return null; return a; }', original: '!a', replacement: 'a', args: [5] },
  { name: 'ternary condition', source: 'function f(a) { return a > 2 ? "big" : "small"; }', original: 'a > 2', replacement: '!(a > 2)', args: [5] },
  { name: 'while condition', source: 'function f(a) { let n = 0; while (n < a) n += 2; return n; }', original: 'n < a', replacement: '!(n < a)', args: [3] },
  { name: 'do-while condition', source: 'function f(a) { let n = 0; do { n += 2; } while (n < a); return n; }', original: 'n < a', replacement: '!(n < a)', args: [5] },
  { name: 'for condition', source: 'function f(a) { let n = 0; for (let i = 3; i < a; i += 3) n += i; return n; }', original: 'i < a', replacement: '!(i < a)', args: [9] }
];

for (const probe of runtimeProbes) {
  test(`Scenario: ${probe.name} produces a valid splice that changes runtime behavior`, () => {
    const site = sitesOf(probe.source).find((item) => item.original === probe.original && item.replacement === probe.replacement);
    assert.ok(site, `expected ${probe.original} -> ${probe.replacement}`);
    assert.equal(probe.source.slice(site.startOffset, site.endOffset), probe.original);
    const mutated = mutate.applyMutation(probe.source, site);
    const diagnostics = ts.transpileModule(mutated, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022 } }).diagnostics ?? [];
    assert.deepEqual(diagnostics.map((item) => item.messageText), []);
    assert.notDeepEqual(runFunction(mutated, probe.args), runFunction(probe.source, probe.args));
  });
}

test('Scenario: type-only and ambient syntax never emits mutation sites', () => {
  const source = [
    'type Enabled = true;',
    'type Count = 0 | 1;',
    'interface Options { strict: true; retries: 1; check(value: number): boolean; }',
    'type Pick<T extends 1 = 1> = T extends 0 ? false : true;',
    "let lazy: import('./x').Y;",
    "import type { Z } from './z';",
    'declare const flag: true;',
    'declare function h(a: number): 0;',
    'declare enum Mode { A = 1 }',
    "declare module 'm' { const z = 1 + 1; }",
    'declare global { interface Window { ready: true } }',
    'function g(value: 1): value is 1;',
    'abstract class Base { abstract run(flag: true): 0; }',
    'const narrowed = lazy as unknown as 0 | 1;',
    ''
  ].join('\n');
  assert.deepEqual(sitesOf(source).map((site) => `${site.original}->${site.replacement}`), []);
  assert.deepEqual(sitesOf('export declare const ready: true;\nexport declare function n(): 1;\n', 'src/types.d.ts'), []);
});

test('Scenario: runtime code beside type syntax keeps exactly its runtime sites', () => {
  const source = [
    'function keep<T extends 1 = 1>(value: T): value is T { return value === 1; }',
    'enum Level { Low = 0 }',
    "const table = { 0: 'zero', 1: 'one' };",
    'const first = table[0];',
    ''
  ].join('\n');
  assert.deepEqual(sitesOf(source).map((site) => `${site.span.startLine}:${site.original}->${site.replacement}`), [
    '1:===->!==',
    '1:1->0',
    '2:0->1',
    '4:0->1'
  ]);
});

test('Scenario: TSX components expose loose-equality, condition and numeric probes', () => {
  const source = 'export const View = ({ a, b }: { a: number; b: number }) => <p>{a == b ? 1 : 0}</p>;\n';
  assert.deepEqual(sitesOf(source, 'src/View.tsx').map((site) => `${site.original}->${site.replacement}`), [
    'a == b->!(a == b)',
    '==->!=',
    '1->0',
    '0->1'
  ]);
});

test('Scenario: a multi-line condition stays in scope when only a later line of it changed', () => {
  const source = 'function f(a, b) {\n  if (\n    a &&\n    b\n  ) return 1;\n  return 2;\n}\n';
  const sites = mutate.discoverMutationSites(source, 'src/sample.js', [], ['src/sample.js'], [{ filePath: 'src/sample.js', hunkId: 'h1', span: { startLine: 4, endLine: 4 } }], false);
  assert.deepEqual(sites.map((site) => `${site.original.replace(/\s+/g, ' ')}->${site.replacement.replace(/\s+/g, ' ')}`), ['a && b->!(a && b)']);
});

test('Scenario: class extends expressions run at runtime and keep their mutation sites', () => {
  assert.deepEqual(sitesOf('class A extends mixin(Base, x === 2) {}\n').map((site) => `${site.original}->${site.replacement}`), ['===->!==']);
});

test('Scenario: numeric destructuring keys are property names and are not mutated', () => {
  assert.deepEqual(sitesOf('const { 0: first } = list;\nfunction g({ 1: one }) { return one; }\n'), []);
});

test('Scenario: a replacement that would merge with a neighboring token is skipped, not run as a different mutant', () => {
  assert.deepEqual(sitesOf('const q = a */* c */ b;\n').map((site) => site.original), []);
  assert.deepEqual(sitesOf('const r = a-++b;\n').map((site) => site.original), []);
});

function runnerRepo(files) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-runner-truth-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(rootDir, file)), { recursive: true });
    fs.writeFileSync(path.join(rootDir, file), text, 'utf8');
  }
  return rootDir;
}

test('Scenario: a test process killed by a signal is an execution error, not an assertion kill', () => {
  // Given a test command that kills itself when it observes the mutant, without failing an assertion
  const rootDir = runnerRepo({
    'src/flag.js': 'function flag() { return true; }\nmodule.exports = { flag };\n',
    'check.js': "if (require('./src/flag.js').flag() === false) process.kill(process.pid, 'SIGKILL');\n"
  });
  const run = mutate.runMutations({ repoRoot: rootDir, sourceFiles: ['src/flag.js'], changedFiles: ['src/flag.js'], testCommand: ['node', 'check.js'], maxSites: 5, timeoutMs: 10_000 });
  const flip = run.results.find((result) => result.original === 'true');
  assert.equal(flip.status, 'error');
  assert.equal(flip.errorKind, 'signal');
  assert.equal(run.killed, 0);
});

test('Scenario: a timed-out mutant is a timeout error that is never cached, so a larger budget re-executes it', () => {
  const rootDir = runnerRepo({
    'src/flag.js': 'function flag() { return true; }\nmodule.exports = { flag };\n',
    'check.js': "if (require('./src/flag.js').flag() === false) { const end = Date.now() + 1500; while (Date.now() < end) {} process.exit(1); }\n"
  });
  const manifestPath = path.join(rootDir, '.ts-quality', 'mutation-manifest.json');
  const options = { repoRoot: rootDir, sourceFiles: ['src/flag.js'], changedFiles: ['src/flag.js'], testCommand: ['node', 'check.js'], maxSites: 5, manifestPath };
  const short = mutate.runMutations({ ...options, timeoutMs: 700 });
  const flipShort = short.results.find((result) => result.original === 'true');
  assert.deepEqual([flipShort.status, flipShort.errorKind, flipShort.origin], ['error', 'timeout', 'executed']);
  // An executed site without an assertion verdict leaves the evidence incomplete.
  assert.equal(short.selection.complete, false);
  const long = mutate.runMutations({ ...options, timeoutMs: 10_000 });
  const flipLong = long.results.find((result) => result.original === 'true');
  assert.deepEqual([flipLong.status, flipLong.origin], ['killed', 'executed']);
  const again = mutate.runMutations({ ...options, timeoutMs: 10_000 });
  assert.equal(again.results.find((result) => result.original === 'true').origin, 'cached');
  assert.equal(again.selection.counts.cached, again.results.filter((result) => result.origin === 'cached').length);
});

test('Scenario: a missing test executable fails the baseline closed and labels every site', () => {
  const rootDir = runnerRepo({ 'src/flag.js': 'function flag() { return true; }\nmodule.exports = { flag };\n' });
  const run = mutate.runMutations({ repoRoot: rootDir, sourceFiles: ['src/flag.js'], changedFiles: ['src/flag.js'], testCommand: ['definitely-not-a-real-test-runner-7f3a'], maxSites: 5, timeoutMs: 5_000 });
  assert.equal(run.baseline.status, 'error');
  assert.equal(run.results.every((result) => result.status === 'error' && result.errorKind === 'baseline'), true);
  assert.equal(run.selection.complete, false);
});

test('Scenario: an exhausted time budget leaves later sites unobserved errors, never clean, and never cached', () => {
  const rootDir = runnerRepo({
    'src/flag.js': 'function flag(a, b) { return a === b && true; }\nmodule.exports = { flag };\n',
    'check.js': "const end = Date.now() + 300; while (Date.now() < end) {}\nrequire('./src/flag.js');\n"
  });
  const manifestPath = path.join(rootDir, '.ts-quality', 'mutation-manifest.json');
  const run = mutate.runMutations({ repoRoot: rootDir, sourceFiles: ['src/flag.js'], changedFiles: ['src/flag.js'], testCommand: ['node', 'check.js'], maxSites: 10, timeoutMs: 10_000, maxDurationMs: 1, manifestPath });
  const executed = run.results.filter((result) => result.origin === 'executed');
  const unobserved = run.results.filter((result) => result.errorKind === 'budget');
  assert.equal(executed.length, 1);
  assert.equal(unobserved.length, run.sites.length - 1);
  assert.equal(unobserved.every((result) => result.status === 'error' && result.origin === 'not-executed'), true);
  assert.equal(run.selection.counts.unobserved, unobserved.length);
  assert.equal(run.selection.complete, false);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(Object.keys(manifest.entries).length, 1);
});
