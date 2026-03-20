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
