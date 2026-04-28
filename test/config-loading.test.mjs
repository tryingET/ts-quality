import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { importDist } from './helpers.mjs';

const config = await importDist('packages', 'ts-quality', 'src', 'config.js');

test('loadContext accepts ts-quality.config.mjs', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.mjs'), `export default {
  sourcePatterns: ['src/**/*.mjs'],
  testPatterns: ['tests/**/*.mjs'],
  mutations: { testCommand: ['node', '--test'] }
};
`, 'utf8');

  const loaded = config.loadContext(rootDir);
  assert.equal(path.basename(loaded.configPath), 'ts-quality.config.mjs');
  assert.deepEqual(Array.from(loaded.config.sourcePatterns), ['src/**/*.mjs']);
  assert.deepEqual(Array.from(loaded.config.testPatterns), ['tests/**/*.mjs']);
});

test('loadContext applies expanded default test discovery patterns', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-defaults-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    mutations: { testCommand: ['node', '--test'] }
  }, null, 2));

  const loaded = config.loadContext(rootDir);
  assert.equal(loaded.config.testPatterns.includes('**/*.test.ts'), true);
  assert.equal(loaded.config.testPatterns.includes('tests/**/*.ts'), true);
  assert.equal(loaded.config.testPatterns.includes('**/*.spec.js'), true);
  assert.deepEqual(Array.from(loaded.config.mutations.runtimeMirrorRoots), ['dist']);
});

test('loadContext accepts custom mutation runtime mirror roots', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-runtime-mirrors-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    mutations: {
      testCommand: ['node', '--test'],
      runtimeMirrorRoots: ['lib', 'build/output']
    }
  }, null, 2));

  const loaded = config.loadContext(rootDir);
  assert.deepEqual(Array.from(loaded.config.mutations.runtimeMirrorRoots), ['lib', 'build/output']);
});

test('loadContext canonicalizes duplicate mutation runtime mirror roots', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-runtime-mirrors-dedupe-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    mutations: {
      testCommand: ['node', '--test'],
      runtimeMirrorRoots: ['dist', './dist', 'lib/', 'lib']
    }
  }, null, 2));

  const loaded = config.loadContext(rootDir);
  assert.deepEqual(Array.from(loaded.config.mutations.runtimeMirrorRoots), ['dist', 'lib']);
});

test('loadContext reads data-only cjs config without executing it', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-cjs-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.cjs'), `const mirrors = ['lib'];
module.exports = {
  sourcePatterns: ['src/**/*.js'],
  mutations: { testCommand: ['node', '--test'], runtimeMirrorRoots: mirrors }
};
`, 'utf8');

  const loaded = config.loadContext(rootDir);
  assert.deepEqual(Array.from(loaded.config.sourcePatterns), ['src/**/*.js']);
  assert.deepEqual(Array.from(loaded.config.mutations.runtimeMirrorRoots), ['lib']);
});

test('loadContext accepts computed property names backed by top-level const bindings', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-computed-key-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.ts'), `const mutationKey = 'mutations';
export default {
  [mutationKey]: { testCommand: ['node', '--test'], runtimeMirrorRoots: ['dist'] }
};
`, 'utf8');

  const loaded = config.loadContext(rootDir);
  assert.deepEqual(Array.from(loaded.config.mutations.testCommand), ['node', '--test']);
  assert.deepEqual(Array.from(loaded.config.mutations.runtimeMirrorRoots), ['dist']);
});

test('loadContext rejects executable ts config expressions', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-exec-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  mutations: { testCommand: ['node', '--test'] },
  version: process.env.TSQ_VERSION
};
`, 'utf8');

  assert.throws(() => config.loadContext(rootDir), /Unsupported expression in data-only module|Unknown identifier in data-only module/);
});

test('loadInvariants rejects executable module bodies', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-exec-'));
  fs.mkdirSync(path.join(rootDir, '.ts-quality'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'invariants.ts'), `const dynamicScenario = () => ({ id: 's', description: 'x', keywords: ['a'], expected: 'a' });
export default [{
  id: 'demo',
  title: 'demo',
  description: 'demo',
  severity: 'low',
  selectors: ['path:src/**'],
  scenarios: [dynamicScenario()]
}];
`, 'utf8');

  assert.throws(() => config.loadInvariants(rootDir, '.ts-quality/invariants.ts'), /Unsupported expression in data-only module|Unsupported statement in data-only module/);
});

test('loadInvariants canonicalizes execution witness fields and defaults patterns from output', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-witness-config-'));
  fs.mkdirSync(path.join(rootDir, '.ts-quality'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'test'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'invariants.ts'), `export default [{
  id: 'demo',
  title: 'demo',
  description: 'demo',
  severity: 'low',
  selectors: ['path:src/**'],
  scenarios: [{
    id: 's',
    description: 'x',
    keywords: ['a'],
    executionWitnessCommand: ['node', '--test', 'test/demo.test.js'],
    executionWitnessOutput: './.ts-quality/witnesses/demo.json',
    executionWitnessTestFiles: ['./test/demo.test.js'],
    executionWitnessTimeoutMs: 2500,
    expected: 'a'
  }]
}];
`, 'utf8');

  const invariants = config.loadInvariants(rootDir, '.ts-quality/invariants.ts');
  assert.deepEqual(invariants[0]?.scenarios[0]?.executionWitnessPatterns, ['.ts-quality/witnesses/demo.json']);
  assert.deepEqual(invariants[0]?.scenarios[0]?.executionWitnessCommand, ['node', '--test', 'test/demo.test.js']);
  assert.equal(invariants[0]?.scenarios[0]?.executionWitnessOutput, '.ts-quality/witnesses/demo.json');
  assert.deepEqual(invariants[0]?.scenarios[0]?.executionWitnessTestFiles, ['test/demo.test.js']);
  assert.equal(invariants[0]?.scenarios[0]?.executionWitnessTimeoutMs, 2500);
});

test('loadInvariants rejects execution witness outputs that escape the repository root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-witness-escape-'));
  fs.mkdirSync(path.join(rootDir, '.ts-quality'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'invariants.ts'), `export default [{
  id: 'demo',
  title: 'demo',
  description: 'demo',
  severity: 'low',
  selectors: ['path:src/**'],
  scenarios: [{
    id: 's',
    description: 'x',
    keywords: ['a'],
    executionWitnessCommand: ['node', '--test'],
    executionWitnessOutput: '../outside/demo.json',
    expected: 'a'
  }]
}];
`, 'utf8');

  assert.throws(() => config.loadInvariants(rootDir, '.ts-quality/invariants.ts'), /executionWitnessOutput must stay inside repository root/);
});

test('loadContext accepts coverage generation options', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-coverage-generation-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    coverage: {
      lcovPath: './coverage/lcov.info',
      generateCommand: ['npm', 'run', 'coverage:lcov', '--silent'],
      generateWhenMissing: false,
      generateTimeoutMs: 1234
    },
    mutations: { testCommand: ['node', '--test'] }
  }, null, 2));

  const loaded = config.loadContext(rootDir);
  assert.equal(loaded.config.coverage.lcovPath, 'coverage/lcov.info');
  assert.deepEqual(loaded.config.coverage.generateCommand, ['npm', 'run', 'coverage:lcov', '--silent']);
  assert.equal(loaded.config.coverage.generateWhenMissing, false);
  assert.equal(loaded.config.coverage.generateTimeoutMs, 1234);
});

test('loadContext rejects invalid coverage generation options', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-coverage-generation-invalid-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    coverage: { generateCommand: 'npm test', generateWhenMissing: 'yes', generateTimeoutMs: -1 },
    mutations: { testCommand: ['node', '--test'] }
  }, null, 2));

  assert.throws(() => config.loadContext(rootDir), /coverage\.generateCommand must be an array of strings/);
});

test('loadContext rejects coverage paths that escape the repository root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-coverage-escape-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    coverage: { lcovPath: '../outside/lcov.info' },
    mutations: { testCommand: ['node', '--test'] }
  }, null, 2));

  assert.throws(() => config.loadContext(rootDir), /coverage lcovPath must stay inside repository root/);
});

test('loadContext rejects changeSet files that escape the repository root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-changeset-escape-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    changeSet: { files: ['../outside.js'] },
    mutations: { testCommand: ['node', '--test'] }
  }, null, 2));

  assert.throws(() => config.loadContext(rootDir), /changeSet file must stay inside repository root/);
});

test('loadContext rejects runtime mirror roots that escape the repository root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-mirror-escape-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    mutations: { testCommand: ['node', '--test'], runtimeMirrorRoots: ['../dist'] }
  }, null, 2));

  assert.throws(() => config.loadContext(rootDir), /mutation runtime mirror root must stay inside repository root/);
});

test('loadContext rejects an empty mutation test command', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-empty-command-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    mutations: { testCommand: [] }
  }, null, 2));

  assert.throws(() => config.loadContext(rootDir), /mutations\.testCommand must contain at least one executable argument/);
});

test('loadContext rejects out-of-range policy values', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-config-policy-range-'));
  fs.writeFileSync(path.join(rootDir, 'ts-quality.config.json'), JSON.stringify({
    mutations: { testCommand: ['node', '--test'] },
    policy: { maxChangedCrap: -1, minMutationScore: 1.2, minMergeConfidence: 101 }
  }, null, 2));

  assert.throws(() => config.loadContext(rootDir), /policy\.maxChangedCrap must be >= 0/);
});
