import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tempCopyOfFixture } from './helpers.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pilot = path.join(repoRoot, 'scripts', 'pilots', 'retention-projection-pilot.mjs');
const declaredPolicyTarget = 'pi-agent-interaction-canary';
const productionPolicyDigest = 'd7ec868f732e0e361c2c1b6290ec4f9e4d3b505050dc36c51cb40d8e2ef41e00';
const { runPilotWithInjectedTestPolicy } = await import(pathToFileURL(pilot).href);
const { buildArtifactRetentionPlan } = await import(pathToFileURL(path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'index.js')).href);

function treeDigest(rootDir) {
  const entries = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(rootDir, absolutePath).replaceAll(path.sep, '/');
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) {
        const digest = crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
        entries.push(`${relativePath}\t${digest}`);
      }
    }
  }
  visit(rootDir);
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

function runPilot(target) {
  try {
    const receipt = runPilotWithInjectedTestPolicy(target);
    return { status: 0, stdout: `${JSON.stringify(receipt, null, 2)}\n`, stderr: '' };
  } catch (error) {
    return { status: 1, stdout: '', stderr: error instanceof Error ? error.message : String(error) };
  }
}

function resolvePointer(value, pointer) {
  return pointer.split('/').slice(1).reduce((current, token) => current?.[token.replaceAll('~1', '/').replaceAll('~0', '~')], value);
}

function assertNoControlCharacters(value) {
  for (const item of value !== null && typeof value === 'object' ? Object.values(value) : [value]) {
    if (item !== null && typeof item === 'object') assertNoControlCharacters(item);
    else if (typeof item === 'string') assert.doesNotMatch(item, /[\u0000-\u0008\u000b-\u001f\u007f]/u);
  }
}

test('injected test policy binds declared target, owner schema, authorized view, and deterministic plan generation digest', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  const before = treeDigest(target);
  const first = runPilot(target);
  const second = runPilot(target);

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, first.stdout, 'an unchanged plan and owner policy must produce the same receipt');
  const receipt = JSON.parse(first.stdout);
  assert.equal(receipt.pilot.schema_version, 4);
  assert.equal(receipt.policy.id, 'ts-quality.agent-interaction.retention-projection-canary.internal-test');
  assert.equal(receipt.policy.version, 1);
  assert.match(receipt.policy.digest_sha256, /^[0-9a-f]{64}$/u);
  assert.equal(receipt.policy.declared_policy_target, declaredPolicyTarget);
  assert.equal(receipt.policy.owner_surface, 'ts-quality.artifact-retention');
  assert.equal(receipt.policy.owner_schema_version, 1);
  assert.deepEqual(receipt.policy.allowed_source_pointers, ['/surface', '/schemaVersion', '/rootDir', '/config', '/keep', '/ignore', '/warnings']);
  assert.deepEqual(receipt.policy.redactions, ['control-characters', 'authorized-root-path', 'secret-token-patterns']);
  assert.equal(receipt.policy.validity_context.config_path, 'ts-quality.config.json');
  assert.equal(receipt.policy.validity_context.declared_policy_target, declaredPolicyTarget);
  assert.equal(receipt.policy.validity_context.policy_digest_sha256, receipt.policy.digest_sha256);
  assert.equal(receipt.structured_owner_plan.surface, receipt.policy.owner_surface);
  assert.equal(receipt.structured_owner_plan.schemaVersion, receipt.policy.owner_schema_version);
  assert.equal(receipt.compact_projection.plan_generation_digest_sha256, receipt.generation.plan_generation_digest_sha256);
  assert.equal(receipt.compact_projection.policy_digest_sha256, receipt.policy.digest_sha256);
  assert.equal(receipt.effects.classification, 'G3-read-effect-observed');
  assert.equal(receipt.effects.invocation_scope, 'owner plan production and owner machine renderer');
  assert.ok(receipt.effects.reads.some((effect) => effect.operation === 'readFileSync' && effect.target.path === 'ts-quality.config.json' && effect.occurrences === 2));
  assert.ok(receipt.effects.reads.some((effect) => effect.operation === 'readdirSync' && effect.target.path === '.ts-quality/witnesses' && effect.occurrences === 2));
  assert.ok(receipt.effects.reads.every((effect) => effect.target.scope === 'authorized-root'));
  assert.equal(receipt.effects.all_observed_reads_within_policy_boundary, true);
  assert.equal(receipt.checks.authorized_view_plan_generation_digest_bound, true);
  assert.equal(receipt.generation.digest_basis, 'authorized-view-after-redaction');
  assert.equal(receipt.checks.raw_plan_digest_unemitted, true);
  assert.equal(receipt.policy.authentication, 'deferred to the enclosing registered Pi tool receipt');
  assert.equal(receipt.checks.owner_authored_policy_bound, true);
  assert.equal(receipt.checks.every_omission_recoverable_in_authorized_view, true);
  assert.deepEqual(receipt.compact_projection.omissions, ['/schemaVersion', '/surface']);
  assert.deepEqual(receipt.compact_projection.recoverable_omissions.map((entry) => entry.pointer), receipt.compact_projection.omissions);
  for (const omission of receipt.compact_projection.recoverable_omissions) {
    assert.equal(omission.recovered, true);
    assert.equal(resolvePointer(receipt, omission.expansion_pointer), resolvePointer(receipt.structured_owner_plan, omission.pointer));
  }
  assert.equal(receipt.compact_projection.expansion_pointer, '/structured_owner_plan');
  assert.ok(receipt.measurements.compact_bytes < receipt.measurements.structured_bytes);
  assert.equal(treeDigest(target), before, 'pilot execution must leave owner source unchanged');
});

test('owner-authored redaction is monotonic for secrets, absolute paths, and control characters', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  const secret = 'sk_live_DO_NOT_DISCLOSE';
  const hostileName = `${secret}\nkey.pem`;
  fs.mkdirSync(path.join(target, '.ts-quality', 'keys'), { recursive: true });
  fs.writeFileSync(path.join(target, '.ts-quality', 'keys', hostileName), 'fixture-only private material');
  const before = treeDigest(target);

  const result = runPilot(target);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(secret));
  assert.doesNotMatch(result.stdout, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.redaction.monotonic, true);
  assert.ok(receipt.redaction.replacements.secret_token_patterns > 0);
  assert.ok(receipt.redaction.replacements.authorized_root_paths > 0);
  assert.ok(receipt.redaction.replacements.control_characters > 0);
  assert.match(receipt.compact_projection.text, /<redacted-secret> key\.pem/u);
  assert.ok(receipt.structured_owner_plan.ignore.some((entry) => entry.path.includes('<redacted-secret> key.pem')));
  assertNoControlCharacters(receipt);
  assert.equal(treeDigest(target), before, 'redaction projection must not mutate the adversarial source fixture');
});

test('production CLI binds the canonical owner fixture, declared policy target, and authentication deferral', () => {
  const canonical = path.join(repoRoot, 'fixtures', 'minimal-external-adoption');
  const result = spawnSync('node', [pilot, '--root', canonical, '--policy-target', declaredPolicyTarget], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.policy.id, 'ts-quality.agent-interaction.retention-projection-canary');
  assert.equal(receipt.policy.digest_sha256, productionPolicyDigest);
  assert.equal(receipt.policy.declared_policy_target, declaredPolicyTarget);
  assert.equal(receipt.policy.authentication, 'deferred to the enclosing registered Pi tool receipt');
  assert.equal(receipt.policy.validity_context.fixture_root_coordinate, 'fixtures/minimal-external-adoption');

  const arbitraryRoot = tempCopyOfFixture('minimal-external-adoption');
  const deniedRoot = spawnSync('node', [pilot, '--root', arbitraryRoot, '--policy-target', declaredPolicyTarget], { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(deniedRoot.status, 0);
  assert.match(deniedRoot.stderr, /root is not the canonical owner fixture/u);

  const wrongTarget = spawnSync('node', [pilot, '--policy-target', 'another-agent'], { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(wrongTarget.status, 0);
  assert.match(wrongTarget.stderr, /declared policy target does not match/u);

  const legacyIdentity = spawnSync('node', [pilot, '--identity', declaredPolicyTarget], { cwd: repoRoot, encoding: 'utf8' });
  assert.notEqual(legacyIdentity.status, 0);
  assert.match(legacyIdentity.stderr, /unexpected argument --identity/u);
});

test('no pre-redaction plan digest is emitted', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  const rawPlan = buildArtifactRetentionPlan(target, { configPath: 'ts-quality.config.json' });
  const rawDigest = crypto.createHash('sha256').update(JSON.stringify(rawPlan)).digest('hex');
  const result = runPilot(target);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, new RegExp(rawDigest));
  const receipt = JSON.parse(result.stdout);
  const authorizedDigest = crypto.createHash('sha256').update(JSON.stringify(receipt.structured_owner_plan)).digest('hex');
  assert.equal(receipt.generation.plan_generation_digest_sha256, authorizedDigest);
  assert.equal(receipt.compact_projection.plan_generation_digest_sha256, authorizedDigest);
  assert.equal('authorized_view_digest_sha256' in receipt.generation, false);
});

test('observable reads outside the fixture boundary fail closed', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  const configPath = path.join(target, 'ts-quality.config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.invariantsPath = path.resolve(target, '..', 'outside-policy-invariants.ts');
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const result = runPilot(target);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /observed filesystem read escaped the owner pilot policy fixture boundary/u);
});

test('a changed owner plan gets a different plan-generation digest without claiming source freshness', () => {
  const target = tempCopyOfFixture('minimal-external-adoption');
  const beforeChange = runPilot(target);
  assert.equal(beforeChange.status, 0, beforeChange.stderr);
  fs.writeFileSync(path.join(target, '.ts-quality', 'witnesses', 'changed-generation.json'), '{}\n');
  const afterChange = runPilot(target);
  assert.equal(afterChange.status, 0, afterChange.stderr);
  const beforeReceipt = JSON.parse(beforeChange.stdout);
  const afterReceipt = JSON.parse(afterChange.stdout);
  assert.notEqual(afterReceipt.generation.plan_generation_digest_sha256, beforeReceipt.generation.plan_generation_digest_sha256);
  assert.equal(afterReceipt.compact_projection.plan_generation_digest_sha256, afterReceipt.generation.plan_generation_digest_sha256);
  assert.ok(afterReceipt.structured_owner_plan.keep.some((entry) => entry.path === '.ts-quality/witnesses/changed-generation.json'));
  assert.equal('freshness_bound_to_source_digest' in afterReceipt.checks, false);
  assert.equal('plan_generation_digest_bound' in afterReceipt.checks, false);
});
