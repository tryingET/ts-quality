import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
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
