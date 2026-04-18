import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { repoRoot } from './helpers.mjs';

test('staged tarball smoke stages, installs, and loads public entrypoints from a fresh temp project', () => {
  const result = spawnSync('npm', ['run', 'smoke:packaging', '--silent'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const summary = JSON.parse(result.stdout);
  assert.equal(summary.stageDir, '.ts-quality/npm/ts-quality/package');
  assert.match(summary.tarball, /^\.ts-quality\/npm\/ts-quality\/tarballs\/ts-quality-.*\.tgz$/);
  assert.equal(summary.cliHelpIncludes, 'ts-quality commands:');
  assert.deepEqual(summary.moduleExport, {
    name: 'materializeProject',
    type: 'function'
  });
});
