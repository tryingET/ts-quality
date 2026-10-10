import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture, latestRunId, readRun, importDist, forgeAttestation } from './helpers.mjs';

// CLI integration: attestation signing, verification and quarantine of unusable attestation files.

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

test('attest sign accepts cwd-relative paths even when --root is also set', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0);
  const runId = latestRunId(target);
  const cwd = path.dirname(target);
  const rootedSubject = path.join(path.basename(target), '.ts-quality', 'runs', runId, 'verdict.json');
  const rootedOutput = path.join(path.basename(target), '.ts-quality', 'attestations', 'edge.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', rootedSubject, '--claims', 'ci.tests.passed', '--out', rootedOutput], { encoding: 'utf8', cwd });
  assert.equal(sign.status, 0, sign.stderr);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'attestations', 'edge.json')), true);
});

test('attest sign rejects blank issuer metadata before signing', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'blank-issuer.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', '   ', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 1);
  assert.match(sign.stderr, /^attestation issuer missing\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign routes an explicit empty issuer through metadata validation', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'empty-issuer.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', '', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 1);
  assert.match(sign.stderr, /^attestation issuer missing\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign rejects zero-width issuer spoofing before signing', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'zero-width-issuer.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify\u200Bshadow', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 1);
  assert.match(sign.stderr, /^attestation issuer contains unsupported control characters\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign rejects missing values for required options before another known flag', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'missing-issuer.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 1);
  assert.match(sign.stderr, /^--issuer requires a value\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign accepts issuer values that begin with dashes via --option=value syntax', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'dash-issuer.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer=--bot', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 0, sign.stderr);
  const saved = JSON.parse(fs.readFileSync(path.join(target, output), 'utf8'));
  assert.equal(saved.issuer, '--bot');
});

test('attest sign rejects unknown flags instead of swallowing them as option values', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'unknown-flag.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', '--bogus', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(sign.status, 1);
  assert.match(sign.stderr, /^unknown option --bogus\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign rejects verify-only flags instead of silently ignoring them', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'unexpected-json.json');
  const sign = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output, '--json'], { encoding: 'utf8' });
  assert.equal(sign.status, 1);
  assert.match(sign.stderr, /^unexpected option --json for attest sign\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign rejects unexpected positional arguments', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'attest', 'sign', 'extra-positional', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^unexpected positional arguments for attest sign\n$/);
});

test('attest sign escapes unsafe subject paths in operator-facing errors', () => {
  const target = tempCopyOfFixture('governed-app');
  const foreignRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-foreign-subject-'));
  const foreignSubject = path.join(foreignRoot, 'bad\nSubject: injected.json');
  fs.writeFileSync(foreignSubject, '{"foreign":true}\n', 'utf8');
  const output = path.join('.ts-quality', 'attestations', 'foreign.json');
  const result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', foreignSubject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^attestation subject must be inside --root: .*bad\\u000aSubject: injected\.json\n$/);
  assert.doesNotMatch(result.stderr, /^Subject: injected\.json$/m);
});

test('attest sign rejects symlinked subjects that resolve outside --root', () => {
  const target = tempCopyOfFixture('governed-app');
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-outside-subject-'));
  const outsideSubject = path.join(outsideRoot, 'outside.txt');
  fs.writeFileSync(outsideSubject, 'outside\n', 'utf8');
  fs.symlinkSync(outsideSubject, path.join(target, 'link.txt'));
  const output = path.join('.ts-quality', 'attestations', 'symlink-outside.json');
  const result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', 'link.txt', '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^attestation subject must be inside --root: link\.txt\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest sign reports missing repo-local subjects as missing input', () => {
  const target = tempCopyOfFixture('governed-app');
  const output = path.join('.ts-quality', 'attestations', 'missing-subject.json');
  const result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', 'missing.txt', '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^attestation subject not found: missing\.txt\n$/);
  assert.equal(fs.existsSync(path.join(target, output)), false);
});

test('attest verify detects byte-level subject drift for non-utf8 files', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-binary-attestation-'));
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'payload.bin'), Buffer.from([0x80]));
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', 'payload.bin', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/payload.bin.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'payload.bin'), Buffer.from([0x81]));
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/payload.bin.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(subject digest mismatch\)$/m);
  assert.match(result.stdout, /^Subject: payload\.bin$/m);
});

test('attest verify keeps signed subject context visible when verification fails', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  const runId = latestRunId(target);
  const subject = path.join('.ts-quality', 'runs', runId, 'verdict.json');
  const output = path.join('.ts-quality', 'attestations', 'tamper-check.json');
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', subject, '--claims', 'ci.tests.passed', '--out', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.appendFileSync(path.join(target, subject), '\n', 'utf8');
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', output, '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^ci\.verify: failed \(subject digest mismatch\)$/m);
  assert.match(result.stdout, new RegExp(`^Subject: \\.ts-quality/runs/${runId}/verdict\\.json$`, 'm'));
  assert.match(result.stdout, new RegExp(`^Run: ${runId}$`, 'm'));
  assert.match(result.stdout, /^Artifact: verdict\.json$/m);
});

test('attest verify rejects symlinked signed subjects that resolve outside --root', async () => {
  const target = tempCopyOfFixture('governed-app');
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-verify-symlink-'));
  const outsideSubject = path.join(outsideRoot, 'outside.txt');
  fs.writeFileSync(outsideSubject, 'outside\n', 'utf8');
  fs.symlinkSync(outsideSubject, path.join(target, 'link.txt'));
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'file',
    subjectDigest: evidenceModel.fileDigest(path.join(target, 'link.txt')),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: 'link.txt'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'symlink-outside.json'), attestation);
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/symlink-outside.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(subject file escapes repository root\)$/m);
  assert.match(result.stdout, /^Subject: link\.txt$/m);
});

test('attest verify prioritizes subject escapes before missing trusted keys', async () => {
  const target = tempCopyOfFixture('governed-app');
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-verify-priority-'));
  const outsideSubject = path.join(outsideRoot, 'outside.txt');
  fs.writeFileSync(outsideSubject, 'outside\n', 'utf8');
  fs.symlinkSync(outsideSubject, path.join(target, 'link.txt'));
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'file',
    subjectDigest: evidenceModel.fileDigest(path.join(target, 'link.txt')),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: 'link.txt'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'missing-key',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'symlink-priority.json'), attestation);
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/symlink-priority.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(subject file escapes repository root\)$/m);
  assert.doesNotMatch(result.stdout, /^ci\.verify: failed \(Missing trusted public key/m);
});

test('check writes the same attestation verification framing used by the CLI verify path', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'attestation-parity-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', '.ts-quality/runs/attestation-parity-run/verdict.json', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/ci.tests.passed.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const verify = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/ci.tests.passed.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'attestation-parity-follow-up'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'attestation-parity-follow-up', 'attestation-verify.txt'), 'utf8');
  assert.equal(readRun(target).attestations.length, 0, 'earlier-run verification framing must not confer standing on the new run');
  assert.equal(verifyText, verify.stdout);
});

test('attest verify rejects signed artifactName drift instead of masking it with the subject path', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'artifact-name-mismatch-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'artifact-name-mismatch-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/artifact-name-mismatch-run/verdict.json',
      runId: 'artifact-name-mismatch-run',
      artifactName: 'fake.json'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'mismatch.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/mismatch.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(attestation payload artifactName does not match subject path\)$/m);
  assert.match(result.stdout, /^Artifact: verdict\.json$/m);
});

test('attest verify keeps run-scoped context for nested artifacts under a run directory', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'nested-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const nestedSubject = path.join(target, '.ts-quality', 'runs', 'nested-run', 'receipts', 'ci.json');
  fs.mkdirSync(path.dirname(nestedSubject), { recursive: true });
  fs.writeFileSync(nestedSubject, '{"ok":true}\n', 'utf8');
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', '.ts-quality/runs/nested-run/receipts/ci.json', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/nested.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/nested.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Run: nested-run$/m);
  assert.match(result.stdout, /^Artifact: receipts\/ci\.json$/m);
});

test('attest verify supports machine-readable json output', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'json-verify-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', '.ts-quality/runs/json-verify-run/verdict.json', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/json.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/json.json', '--trusted-keys', '.ts-quality/keys', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed, {
    artifactName: 'verdict.json',
    issuer: 'ci.verify',
    ok: true,
    reason: 'verified',
    runId: 'json-verify-run',
    source: 'json.json',
    subjectFile: '.ts-quality/runs/json-verify-run/verdict.json',
    version: '1'
  });
});

test('attest verify reports malformed input through the canonical record instead of a raw syntax error', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.mkdirSync(path.join(target, '.ts-quality', 'attestations'), { recursive: true });
  fs.writeFileSync(path.join(target, '.ts-quality', 'attestations', 'broken.json'), '{not json\n', 'utf8');
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/broken.json', '--trusted-keys', '.ts-quality/keys', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.source, 'broken.json');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.version, '1');
  assert.match(parsed.reason, /^invalid JSON:/);
});

test('attest verify fails fast when the requested attestation file is unreadable', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/missing.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^unable to read attestation file \.ts-quality\/attestations\/missing\.json\n$/);
  assert.equal(result.stdout, '');
});

test('attest verify escapes unsafe unreadable attestation paths in operator-facing errors', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/missing\nSubject: injected.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^unable to read attestation file \.ts-quality\/attestations\/missing\\u000aSubject: injected\.json\n$/);
  assert.doesNotMatch(result.stderr, /^Subject: injected\.json$/m);
  assert.equal(result.stdout, '');
});

test('attest verify rejects run metadata on non-run-scoped subjects', async () => {
  const target = tempCopyOfFixture('governed-app');
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  fs.writeFileSync(path.join(target, 'subject.txt'), 'hello\n', 'utf8');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'file',
    subjectDigest: evidenceModel.fileDigest(path.join(target, 'subject.txt')),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: 'subject.txt',
      runId: 'fake-run'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'non-run-metadata.json'), attestation);
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/non-run-metadata.json', '--trusted-keys', '.ts-quality/keys', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, 'attestation payload runId requires a run-scoped subject path');
  assert.equal(parsed.subjectFile, 'subject.txt');
  assert.equal(parsed.version, '1');
  assert.equal(parsed.runId, undefined);
  assert.equal(parsed.artifactName, undefined);
});

test('attest verify rejects control characters in signed subject metadata instead of rendering forged lines', async () => {
  const target = tempCopyOfFixture('governed-app');
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'file',
    subjectDigest: 'sha256:forged',
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: 'subject.txt\nRun: injected\nArtifact: forged'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'control-char.json'), attestation);
  const result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/control-char.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(attestation payload subjectFile contains unsupported control characters\)$/m);
  assert.doesNotMatch(result.stdout, /^Run: injected$/m);
  assert.doesNotMatch(result.stdout, /^Artifact: forged$/m);
  assert.doesNotMatch(result.stdout, /^Subject:/m);
});

test('attest verify prioritizes attestation contract failures before missing trusted keys', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'issuer-priority-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'issuer-priority-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify\u200Bshadow',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/issuer-priority-run/verdict.json'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'missing-key',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'issuer-priority.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/issuer-priority.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^issuer-priority\.json: failed \(attestation issuer contains unsupported control characters\)$/m);
  assert.doesNotMatch(result.stdout, /^issuer-priority\.json: failed \(Missing trusted public key/m);
});

test('attest verify rejects control characters in signed issuer metadata instead of rendering forged lines', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'issuer-control-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'issuer-control-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify\nSubject: injected\nRun: forged',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/issuer-control-run/verdict.json'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'issuer-control-char.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/issuer-control-char.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^issuer-control-char\.json: failed \(attestation issuer contains unsupported control characters\)$/m);
  assert.match(result.stdout, /^Subject: \.ts-quality\/runs\/issuer-control-run\/verdict\.json$/m);
  assert.match(result.stdout, /^Run: issuer-control-run$/m);
  assert.match(result.stdout, /^Artifact: verdict\.json$/m);
  assert.doesNotMatch(result.stdout, /^Subject: injected$/m);
  assert.doesNotMatch(result.stdout, /^Run: forged$/m);
});

test('attest verify rejects empty signed issuer metadata instead of rendering an anonymous label', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'issuer-empty-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'issuer-empty-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: '',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/issuer-empty-run/verdict.json'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'issuer-empty.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/issuer-empty.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^issuer-empty\.json: failed \(attestation issuer missing\)$/m);
  assert.match(result.stdout, /^Subject: \.ts-quality\/runs\/issuer-empty-run\/verdict\.json$/m);
  assert.match(result.stdout, /^Run: issuer-empty-run$/m);
  assert.match(result.stdout, /^Artifact: verdict\.json$/m);
  assert.doesNotMatch(result.stdout, /^: failed/m);
});

test('attest verify rejects Unicode line separators in signed metadata instead of rendering forged lines', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unicode-separator-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'unicode-separator-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/unicode-separator-run/verdict.json\u2028Subject: injected'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'unicode-separator.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/unicode-separator.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(attestation payload subjectFile contains unsupported control characters\)$/m);
  assert.doesNotMatch(result.stdout, /^Subject: injected$/m);
});

test('attest verify rejects Unicode next-line separators in signed metadata instead of rendering forged lines', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unicode-nel-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'unicode-nel-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/unicode-nel-run/verdict.json\u0085Subject: injected'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'unicode-nel.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/unicode-nel.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(attestation payload subjectFile contains unsupported control characters\)$/m);
  assert.doesNotMatch(result.stdout, /^Subject:/m);
});

test('attest verify rejects bidi override characters in signed metadata instead of rendering spoofed paths', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unicode-bidi-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'unicode-bidi-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/unicode-bidi-run/verdict.json\u202Etxt.tcidrev'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'unicode-bidi.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/unicode-bidi.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.verify: failed \(attestation payload subjectFile contains unsupported control characters\)$/m);
  assert.doesNotMatch(result.stdout, /^Subject:/m);
});

test('attest verify rejects zero-width spoofing characters in signed metadata', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unicode-zero-width-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'unicode-zero-width-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: 'ci.verify\u200Bshadow',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/unicode-zero-width-run/verdict.json\uFEFFshadow'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'unicode-zero-width.json'), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/unicode-zero-width.json', '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^unicode-zero-width\.json: failed \(attestation issuer contains unsupported control characters\)$/m);
  assert.doesNotMatch(result.stdout, /^Subject:/m);
});

test('attest verify escapes unsafe attestation source filenames before rendering fallback labels', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unsafe-source-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'unsafe-source-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: '',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/unsafe-source-run/verdict.json'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  const rel = '.ts-quality/attestations/evil\nSubject: injected.json';
  legitimacy.saveAttestation(path.join(target, rel), attestation);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', rel, '--trusted-keys', '.ts-quality/keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^evil\\u000aSubject: injected\.json: failed \(attestation issuer missing\)$/m);
  assert.doesNotMatch(result.stdout, /^Subject: injected\.json: failed/m);
  assert.match(result.stdout, /^Subject: \.ts-quality\/runs\/unsafe-source-run\/verdict\.json$/m);
});

test('check escapes unsafe attestation source filenames in persisted verification artifacts', async () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unsafe-source-check-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const legitimacy = await importDist('packages', 'legitimacy', 'src', 'index.js');
  const evidenceModel = await importDist('packages', 'evidence-model', 'src', 'index.js');
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const verdictPath = path.join(target, '.ts-quality', 'runs', 'unsafe-source-check-run', 'verdict.json');
  const attestation = forgeAttestation({
    version: '1',
    kind: 'attestation',
    issuer: '',
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(verdictPath),
    claims: ['ci.tests.passed'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    payload: {
      subjectFile: '.ts-quality/runs/unsafe-source-check-run/verdict.json'
    },
    signature: {
      algorithm: 'ed25519',
      keyId: 'sample',
      value: ''
    }
  }, privateKeyPem);
  legitimacy.saveAttestation(path.join(target, '.ts-quality', 'attestations', 'evil\nSubject: injected.json'), attestation);
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unsafe-source-check-follow-up'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'unsafe-source-check-follow-up', 'attestation-verify.txt'), 'utf8');
  assert.match(verifyText, /^evil\\u000aSubject: injected\.json: failed \(attestation issuer missing\)$/m);
  assert.doesNotMatch(verifyText, /^Subject: injected\.json: failed/m);
  assert.match(verifyText, /^Subject: \.ts-quality\/runs\/unsafe-source-check-run\/verdict\.json$/m);
});

test('check quarantines malformed attestation files instead of crashing', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.mkdirSync(path.join(target, '.ts-quality', 'attestations'), { recursive: true });
  fs.writeFileSync(path.join(target, '.ts-quality', 'attestations', 'broken.json'), '{not json\n', 'utf8');
  const result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runId = latestRunId(target);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', runId, 'attestation-verify.txt'), 'utf8');
  assert.match(verifyText, /broken\.json: failed \(invalid JSON:/);
});

test('check quarantines unreadable attestation files instead of crashing', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.mkdirSync(path.join(target, '.ts-quality', 'attestations'), { recursive: true });
  fs.symlinkSync('missing-target.json', path.join(target, '.ts-quality', 'attestations', 'unreadable.json'));
  const result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runId = latestRunId(target);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', runId, 'attestation-verify.txt'), 'utf8');
  assert.match(verifyText, /unreadable\.json: failed \(unreadable attestation file\)/);
});

test('check quarantines schema-invalid attestation files instead of crashing', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.mkdirSync(path.join(target, '.ts-quality', 'attestations'), { recursive: true });
  fs.writeFileSync(path.join(target, '.ts-quality', 'attestations', 'broken-shape.json'), '{"issuer":"broken"}\n', 'utf8');
  const result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const runId = latestRunId(target);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', runId, 'attestation-verify.txt'), 'utf8');
  assert.match(verifyText, /broken-shape\.json: failed \(invalid attestation shape:/);
});
