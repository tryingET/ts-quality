import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { importDist } from './helpers.mjs';

const evidence = await importDist('packages', 'evidence-model', 'src', 'index.js');

test('normalizePath is idempotent and slash-stable', () => {
  assert.equal(evidence.normalizePath('a\\b//c/'), 'a/b/c');
  assert.equal(evidence.normalizePath(evidence.normalizePath('a/b/c')), 'a/b/c');
});

test('matchPattern supports path prefixes and globs', () => {
  assert.equal(evidence.matchPattern('src/**/*.js', 'src/auth/token.js'), true);
  assert.equal(evidence.matchPattern('src/**/*.js', 'src/main.js'), true);
  assert.equal(evidence.matchPattern('tests/**/*.mjs', 'tests/trigger-editor.test.mjs'), true);
  assert.equal(evidence.matchPattern('path:src/auth/**', 'src/auth/token.js'), true);
  assert.equal(evidence.matchPattern('src/payments/**', 'src/auth/token.js'), false);
});

test('stableStringify sorts object keys deterministically', () => {
  const value = { z: 1, a: { d: 4, b: 2 } };
  const text = evidence.stableStringify(value);
  assert.match(text, /"a":/);
  assert.ok(text.indexOf('"a"') < text.indexOf('"z"'));
});

test('attestation metadata helpers flag and render unsafe Unicode deterministically', () => {
  assert.equal(evidence.hasUnsafeAttestationMetadata('safe-value'), false);
  assert.equal(evidence.hasUnsafeAttestationMetadata('line\u0085break'), true);
  assert.equal(evidence.hasUnsafeAttestationMetadata('bidi\u202Eflip'), true);
  assert.equal(evidence.hasUnsafeAttestationMetadata('zero\u200Bwidth'), true);
  assert.equal(evidence.hasUnsafeAttestationMetadata('bom\uFEFFmark'), true);
  assert.equal(evidence.renderSafeText('safe\nvalue\u202Eflip\u0085next\u200Btrim\uFEFFbom'), 'safe\\u000avalue\\u202eflip\\u0085next\\u200btrim\\ufeffbom');
  assert.equal(evidence.renderSafeText('literal \\u202e marker'), 'literal \\\\u202e marker');
  assert.equal(evidence.renderSafeText('actual \u202e'.replace('\\u202e', '\u202e')), 'actual \\u202e');
});

test('parseUnifiedDiff returns changed regions', () => {
  const regions = evidence.parseUnifiedDiff('+++ b/src/auth/token.js\n@@ -1,2 +1,3 @@\n');
  assert.deepEqual(regions, [{ filePath: 'src/auth/token.js', hunkId: 'hunk-0', span: { startLine: 1, endLine: 3 } }]);
});

test('collectSourceFiles includes mjs and cjs inputs', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-evidence-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'main.mjs'), 'export const main = true;\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'legacy.cjs'), 'module.exports = { legacy: true };\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'types.d.ts'), 'export type X = string;\n', 'utf8');

  const files = evidence.collectSourceFiles(rootDir, ['src/**/*.mjs', 'src/**/*.cjs']);
  assert.deepEqual(files, ['src/legacy.cjs', 'src/main.mjs']);
});


test('assertSafeRunId rejects path-like values', () => {
  assert.equal(evidence.assertSafeRunId('run-123'), 'run-123');
  assert.throws(() => evidence.assertSafeRunId('../escape'));
  assert.throws(() => evidence.assertSafeRunId('nested/run'));
});

test('resolveRepoLocalPath rejects symlink escapes outside the repository root', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-evidence-root-'));
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-evidence-outside-'));
  const linkedDir = path.join(rootDir, 'linked');
  fs.symlinkSync(outsideDir, linkedDir, 'dir');

  assert.throws(
    () => evidence.resolveRepoLocalPath(rootDir, 'linked/escape.json', { allowMissing: true, kind: 'attestations dir' }),
    /attestations dir must stay inside repository root/
  );
});

test('collectSourceFiles skips hidden tool-state directories unless a pattern targets them explicitly', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-hidden-dirs-'));
  const write = (relativePath) => {
    fs.mkdirSync(path.dirname(path.join(rootDir, relativePath)), { recursive: true });
    fs.writeFileSync(path.join(rootDir, relativePath), 'export {};\n', 'utf8');
  };
  write('src/a.ts');
  write('tests/a.test.ts');
  // Generated snapshots and caches copy repo files into hidden directories.
  write('.ontology/snapshots/1234/tests/a.test.ts');
  write('.ontology/snapshots/1234/src/a.ts');
  write('.cache/build/src/b.ts');
  write('.storybook/preview.ts');

  assert.deepEqual(evidence.collectSourceFiles(rootDir, ['**/*.ts']).sort(), ['src/a.ts', 'tests/a.test.ts']);
  assert.deepEqual(evidence.collectSourceFiles(rootDir, ['**/*.test.ts']), ['tests/a.test.ts']);
  assert.deepEqual(evidence.collectSourceFiles(rootDir, ['.storybook/**/*.ts']), ['.storybook/preview.ts']);
});
