import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { repoRoot } from './helpers.mjs';

const expectedEntrypoints = {
  main: 'dist/packages/ts-quality/src/index.js',
  types: 'dist/packages/ts-quality/src/index.d.ts',
  bin: 'dist/packages/ts-quality/src/cli.js',
  exportDefault: './dist/packages/ts-quality/src/index.js',
  exportTypes: './dist/packages/ts-quality/src/index.d.ts'
};

const expectedInitFiles = [
  'ts-quality.config.ts',
  '.ts-quality/invariants.ts',
  '.ts-quality/constitution.ts',
  '.ts-quality/agents.ts',
  '.ts-quality/approvals.json',
  '.ts-quality/waivers.json',
  '.ts-quality/overrides.json',
  '.ts-quality/keys/sample.pem',
  '.ts-quality/keys/sample.pub.pem'
];

const expectedMaterializedFiles = [
  '.ts-quality/materialized/invariants.json',
  '.ts-quality/materialized/constitution.json',
  '.ts-quality/materialized/agents.json',
  '.ts-quality/materialized/approvals.json',
  '.ts-quality/materialized/waivers.json',
  '.ts-quality/materialized/overrides.json',
  '.ts-quality/materialized/ts-quality.config.json'
];

test('staged tarball smoke hardens packaged CLI and API proof points from a fresh temp project', () => {
  const result = spawnSync('npm', ['run', 'smoke:packaging', '--silent'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const summary = JSON.parse(result.stdout);
  assert.equal(summary.packageName, 'ts-quality');
  assert.equal(summary.version, '0.1.0');
  assert.equal(summary.stageDir, '.ts-quality/npm/ts-quality/package');
  assert.match(summary.tarball, /^\.ts-quality\/npm\/ts-quality\/tarballs\/ts-quality-.*\.tgz$/);
  assert.deepEqual(summary.entrypoints, expectedEntrypoints);
  assert.equal(summary.cli.helpIncludes, 'ts-quality commands:');
  assert.deepEqual(summary.cli.initCreated, expectedInitFiles);
  assert.equal(summary.cli.materializedConfig, '.ts-quality/materialized/ts-quality.config.json');
  assert.deepEqual(summary.api.exportTypes, {
    initProject: 'function',
    materializeProject: 'function'
  });
  assert.equal(summary.api.materializeConfig, '.ts-quality/materialized/ts-quality.config.json');
  assert.equal(summary.api.materializeOutDir, '.ts-quality/materialized');
  assert.deepEqual(summary.api.materializedFiles, expectedMaterializedFiles);
  assert.deepEqual(summary.typesCheck, {
    compiler: 'tsc',
    passed: true,
    importStatement: "import { initProject, materializeProject } from 'ts-quality';"
  });
});
