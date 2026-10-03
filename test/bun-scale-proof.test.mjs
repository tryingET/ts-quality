import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

const root = path.join(repoRoot, 'fixtures/bun-scale-proof');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

// Inspect checked-in GNU tar data without extraction, subprocesses or execution.
function archive(file, expectedDigest) {
  const compressed = fs.readFileSync(path.join(root, file));
  assert.equal(digest(compressed), expectedDigest);
  const bytes = gunzipSync(compressed, { maxOutputLength: 64 * 1024 * 1024 });
  const entries = new Map();
  let longName;
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const text = (start, size) => header.subarray(start, start + size).toString().split('\0')[0];
    const size = Number.parseInt(text(124, 12).trim(), 8);
    assert.ok(Number.isSafeInteger(size) && size >= 0);
    const bodyStart = offset + 512;
    assert.ok(bodyStart + size <= bytes.length);
    const body = bytes.subarray(bodyStart, bodyStart + size);
    const type = text(156, 1);
    const prefix = text(345, 155);
    const name = longName ?? (prefix ? `${prefix}/${text(0, 100)}` : text(0, 100));
    offset = bodyStart + Math.ceil(size / 512) * 512;
    if (type === 'L') {
      longName = body.toString().split('\0')[0];
      continue;
    }
    longName = undefined;
    assert.ok(!name.startsWith('/') && !name.split('/').includes('..'), name);
    assert.ok(['', '0', '5'].includes(type), `unsupported tar entry ${type}: ${name}`);
    if (type === '5') continue;
    assert.equal(entries.has(name), false, `duplicate ${name}`);
    entries.set(name, body);
  }
  return entries;
}

function json(entries, name) {
  assert.ok(entries.has(name), name);
  return JSON.parse(entries.get(name).toString());
}

function verifyManifest(entries, prefix) {
  const manifestPath = `${prefix}/MANIFEST.sha256`;
  const named = new Set();
  for (const line of entries.get(manifestPath).toString().trim().split('\n')) {
    const [hash, name] = line.split(/\s+/, 2);
    const key = `${prefix}/${name.replace(/^\.\//, '')}`;
    assert.ok(entries.has(key), name);
    assert.equal(digest(entries.get(key)), hash, name);
    named.add(key);
  }
  assert.deepEqual([...named].sort(), [...entries.keys()].filter(key => key !== manifestPath).sort());
}

const raw = archive(manifest.evidence.file, manifest.evidence.sha256);
const recipe = archive(manifest.recipe.file, manifest.recipe.sha256);
const runPrefix = `raw-packet/target/.ts-quality/runs/${manifest.evidence.runId}/`;
const run = json(raw, `${runPrefix}run.json`);

test('full-scope Bun evidence retains pinned source, local package and tested lean recipe identities', () => {
  assert.equal(manifest.kind, 'new-pinned-bun-scale-replay');
  assert.equal(manifest.historicalPacketRecovered, false);
  assert.equal(manifest.acceptedAdoption, false);
  assert.equal(manifest.publicPackageProof, false);
  assert.equal(manifest.source.commit, 'bbeebdfd1935afff65b8e8dcd1aa46753a229440');
  assert.equal(digest(fs.readFileSync(path.join(root, manifest.cli.file))), manifest.cli.sha256);
  const inputs = json(recipe, 'lean/inputs.json');
  assert.equal(inputs.source.archiveSha256, manifest.source.archiveSha256);
  assert.equal(inputs.source.commit, manifest.source.commit);
  assert.equal(inputs.cli.sha256, manifest.cli.sha256);
  assert.deepEqual(Object.fromEntries(['platform', 'arch'].map(key => [key, inputs.runtime[key]])), { platform: 'linux', arch: 'x64' });
  assert.equal(inputs.runtime.node.version, 'v26.9.0');
  assert.equal(inputs.runtime.bun.version, '1.3.12');
  assert.equal(inputs.locks.target, manifest.source.lockSha256);
  assert.equal(digest(raw.get(`${runPrefix}run.json`)), manifest.evidence.runSha256);
  assert.equal(digest(raw.get('raw-packet/target/bun.lock')), inputs.locks.target);
  assert.equal(digest(recipe.get('lean/tooling-bun.lock')), inputs.locks.tooling);
  verifyManifest(recipe, 'lean');
  verifyManifest(raw, 'raw-packet');
  assert.equal(manifest.recipe.testedFromEmptyCache, true);
  assert.equal(manifest.recipe.seedCacheRequired, false);
  assert.equal(manifest.recipe.originalLocksRewritten, false);
});

test('full-scope Bun proof keeps genuine fail/deny outcomes separate from successful execution', () => {
  assert.equal(run.runId, manifest.evidence.runId);
  assert.deepEqual(run.changedFiles, ['src/core/runtime-config.ts']);
  assert.equal(run.files.length, 176);
  assert.equal(run.analysis.sourceFiles.length, 176);
  assert.equal(run.coverage.length, 60);
  assert.equal(run.mutationSites.length, 25);
  assert.equal(run.mutationBaseline.status, 'pass');
  assert.equal(run.mutationBaseline.exitCode, 0);
  assert.equal(run.mutations.filter(item => item.status === 'killed').length, 16);
  assert.equal(run.mutations.filter(item => item.status === 'survived').length, 9);
  assert.equal(run.mutations.filter(item => item.status === 'error').length, 0);
  assert.equal(run.verdict.outcome, 'fail');
  assert.equal(run.verdict.mergeConfidence, 19);
  assert.equal(run.behaviorClaims[0].status, 'at-risk');
  assert.equal(run.behaviorClaims[0].evidenceSummary.scenarioResults[0].supportKind, 'execution-witness');
  assert.equal(run.governance.filter(item => item.level === 'error').length, 2);
  const authorization = json(raw, `${runPrefix}authorize.maintainer.merge.json`);
  assert.equal(authorization.outcome, 'deny');
  assert.ok(authorization.reasons.some(reason => /Governance violations/.test(reason)));
  const report = json(raw, 'raw-packet/logs/projection-report-json.stdout');
  assert.deepEqual(report.decisionContext.drift, []);
  assert.equal(report.runId, run.runId);
  const result = json(raw, 'raw-packet/receipts/cold-result.json');
  assert.ok(Object.values(result.checks).every(value => value === true));
  assert.equal(result.rawRunSha256, manifest.evidence.runSha256);
  assert.equal(result.counts.sourceFiles, 176);
  assert.deepEqual(manifest.observed, {
    focusedTestsPassed: 17,
    sourceFiles: run.files.length,
    lcovEntries: run.coverage.length,
    mutationSites: run.mutationSites.length,
    killed: run.mutations.filter(item => item.status === 'killed').length,
    survived: run.mutations.filter(item => item.status === 'survived').length,
    errors: run.mutations.filter(item => item.status === 'error').length,
    baseline: run.mutationBaseline.status,
    witness: 'current content-bound pass',
    verdict: run.verdict.outcome,
    mergeConfidence: run.verdict.mergeConfidence,
    governanceErrors: run.governance.filter(item => item.level === 'error').length,
    authorization: authorization.outcome,
    projectionDrift: report.decisionContext.drift
  });
  assert.match(raw.get('raw-packet/logs/focused-coverage.stderr').toString(), /17 pass/);
});

test('cold replay preserves lock/input/witness bindings and scope without retaining dependencies', () => {
  const start = json(raw, 'raw-packet/receipts/cold-start.json');
  assert.deepEqual(start.cacheEntries, []);
  assert.deepEqual(start.homeEntries, []);
  assert.equal(start.priorCacheCopied, false);
  assert.equal(start.priorNodeModulesCopied, false);
  const transport = json(raw, 'raw-packet/receipts/transport-projection.json');
  assert.equal(transport.targetLockRewritten, false);
  assert.equal(transport.sourceLockSha256, manifest.source.lockSha256);
  assert.ok(transport.changedEndpointCount > 0);
  assert.notEqual(transport.projectionLockSha256, transport.sourceLockSha256);
  const dependencies = json(raw, 'raw-packet/receipts/downloaded-lock-integrities.json');
  assert.equal(dependencies.uniqueLockedPackages, 217);
  assert.equal(dependencies.uniqueApplicablePackages, 205);
  assert.equal(dependencies.allRegistryRequestsOfficial, true);
  assert.ok(dependencies.packages.every(item => item.integrity.startsWith('sha512-')));
  assert.equal(json(raw, 'raw-packet/receipts/cache-package-identity-check.json').allApplicableLockedPackagesFound, true);
  const witness = json(raw, 'raw-packet/target/.ts-quality/witnesses/runtime-config-path-containment.json');
  const receipt = json(raw, 'raw-packet/target/.ts-quality/witnesses/runtime-config-path-containment.receipt.json');
  assert.equal(witness.status, 'pass');
  assert.deepEqual(receipt.binding, witness.binding);
  for (const [file, hash] of Object.entries({ ...witness.binding.sourceDigests, ...witness.binding.testDigests })) {
    assert.equal(`sha256:${digest(raw.get(`raw-packet/target/${file}`))}`, hash, file);
  }
  assert.ok(![...raw.keys()].some(name => /\/(?:node_modules|cache)\//.test(name)));
  for (const [pathField, digestField] of [['configPath', 'configDigest'], ['constitutionPath', 'constitutionDigest'], ['agentsPath', 'agentsDigest']]) {
    assert.equal(`sha256:${digest(raw.get(`raw-packet/target/${run.controlPlane[pathField]}`))}`, run.controlPlane[digestField]);
  }
  for (const name of ['capture.mjs', 'command.mjs', 'prepare-fetch.mjs', 'registry-proxy.py', 'replay.sh', 'verify-inputs.mjs']) {
    const key = `lean/${name}`;
    const captured = `raw-packet/${key}`;
    assert.ok(recipe.has(key) && raw.has(captured), name);
    assert.equal(digest(raw.get(captured)), digest(recipe.get(key)), key);
  }
  for (const name of ['child.py', 'parent.mjs', 'test.py']) {
    assert.equal(digest(raw.get(`raw-packet/verification-fixtures/test-fixtures/${name}`)), digest(recipe.get(`lean/test-fixtures/${name}`)), name);
  }
  const commandLabels = ['official-fetch-frozen-install', 'target-original-frozen-install', 'tooling-frozen-install',
    'cli-version', 'focused-coverage', 'manual-witness', 'fullscope-check', 'projection-report',
    'projection-report-json', 'projection-explain', 'projection-plan', 'projection-govern', 'projection-authorize'];
  assert.equal(commandLabels.length, 13);
  for (const label of commandLabels) {
    const receipt = json(raw, `raw-packet/receipts/${label}.json`);
    assert.equal(receipt.label, label);
    assert.match(receipt.stdoutSha256, /^[a-f0-9]{64}$/);
    assert.match(receipt.stderrSha256, /^[a-f0-9]{64}$/);
    assert.ok(raw.has(`raw-packet/logs/${label}.stdout`) && raw.has(`raw-packet/logs/${label}.stderr`));
    assert.equal(digest(raw.get(`raw-packet/logs/${label}.stdout`)), receipt.stdoutSha256, label);
    assert.equal(digest(raw.get(`raw-packet/logs/${label}.stderr`)), receipt.stderrSha256, label);
  }
  for (const label of ['focused-coverage', 'manual-witness', 'fullscope-check', 'projection-report-json', 'projection-authorize']) {
    const command = json(raw, `raw-packet/receipts/${label}.json`);
    assert.equal(command.mode, 'proof');
    assert.ok(command.sandboxCommand.includes('--unshare-net'));
    assert.equal(command.exitCode, 0);
  }
});
