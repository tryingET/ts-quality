import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

const script = path.join(repoRoot, 'scripts/native-package-index-ci.mjs');

function run(args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env });
}

test('Scenario: the CI producer stages exactly the upload paths and the reader proves the downloaded copy', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-package-index-ci-test-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const artifact = path.join(scratch, 'upload');
  const produced = run(['produce', '--out-dir', artifact]);
  assert.equal(produced.status, 0, produced.stderr);
  assert.match(produced.stdout, /produced \d+ upload file\(s\) for ci-api-run, ci-web-run/);
  assert.ok(fs.existsSync(path.join(artifact, '.ts-quality/package-index.json')));
  assert.equal(fs.existsSync(path.join(artifact, 'packages/api/src/limit.js')), false, 'sources are not part of the upload');

  // The download is a separate copy: inspecting it must not depend on the producer's project directory.
  const downloaded = path.join(scratch, 'download');
  fs.cpSync(artifact, downloaded, { recursive: true });
  const readBack = run(['read', '--artifact-dir', downloaded]);
  assert.equal(readBack.status, 0, readBack.stderr);
  assert.match(readBack.stdout, /references fresh/);
  assert.match(readBack.stdout, /packages\/api: source-unavailable/);

  fs.appendFileSync(path.join(downloaded, '.ts-quality/runs/ci-api-run/report.md'), 'tampered\n');
  fs.writeFileSync(path.join(downloaded, 'extra.txt'), 'not listed\n');
  const tampered = run(['read', '--artifact-dir', downloaded]);
  assert.equal(tampered.status, 1);
  assert.match(tampered.stderr, /files outside upload\.paths: extra\.txt/);
  assert.match(tampered.stderr, /references are stale \(changed 1, missing 0\)/);

  const reused = run(['produce', '--out-dir', artifact]);
  assert.equal(reused.status, 2);
  assert.match(reused.stderr, /must be empty or absent/);
});
