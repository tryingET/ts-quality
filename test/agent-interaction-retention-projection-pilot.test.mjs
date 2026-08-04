import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempCopyOfFixture } from './helpers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilot = path.join(repoRoot, 'scripts', 'pilots', 'retention-projection-pilot.mjs');

function treeDigest(rootDir) {
  const entries = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replaceAll(path.sep, '/');
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        const digest = crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
        entries.push(`${relativePath}\t${digest}`);
      }
    }
  }
  visit(rootDir);
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

test('retention projection pilot derives structured and compact views from one read-only owner plan', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  const before = treeDigest(target);
  const result = spawnSync('node', [pilot, '--root', target, '--config', 'ts-quality.config.json'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.pilot.experimental, true);
  assert.equal(receipt.pilot.read_only, true);
  assert.equal(receipt.pilot.compatibility_promise, false);
  assert.equal(receipt.structured_owner_plan.surface, 'ts-quality.artifact-retention');
  assert.equal(receipt.structured_owner_plan.schemaVersion, 1);
  assert.match(receipt.compact_projection.text, /^TSQ_RETENTION_PLAN_V1\n/);
  assert.equal(receipt.checks.same_owner_plan_generation, true);
  assert.equal(receipt.checks.compact_claims_subset_of_source_plan, true);
  assert.equal(receipt.checks.omissions_explicit, true);
  assert.equal(receipt.checks.derivations_explicit, true);
  assert.equal(receipt.checks.expansion_available, true);
  assert.equal(receipt.checks.owner_machine_renderer_match, true);
  assert.deepEqual(receipt.compact_projection.omissions, ['/schemaVersion', '/surface']);
  assert.deepEqual(receipt.compact_projection.derivations, []);
  assert.equal(receipt.compact_projection.expansion_pointer, '/structured_owner_plan');
  assert.ok(receipt.measurements.compact_bytes < receipt.measurements.structured_bytes);
  assert.equal(treeDigest(target), before, 'pilot must not mutate the inspected target tree');
});
