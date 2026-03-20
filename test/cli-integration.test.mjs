import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture, latestRunId, readRun } from './helpers.mjs';

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

test('init creates starter files in an empty repo', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.rmSync(path.join(target, 'ts-quality.config.ts'), { force: true });
  fs.rmSync(path.join(target, '.ts-quality'), { recursive: true, force: true });
  const result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(path.join(target, 'ts-quality.config.ts')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'invariants.ts')), true);
});

test('check treats empty init changeSet.files as all discovered source files', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.rmSync(path.join(target, 'ts-quality.config.ts'), { force: true });
  fs.rmSync(path.join(target, '.ts-quality'), { recursive: true, force: true });
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  assert.equal(run.changedFiles.includes('src/auth/token.js'), true);
  assert.equal(run.behaviorClaims.some((claim) => claim.invariantId === 'auth.refresh.validity'), true);
});

test('check, report, explain, plan, and govern produce aligned artifacts', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0);
  const runId = latestRunId(target);
  const reportPath = path.join(target, '.ts-quality', 'runs', runId, 'report.md');
  const prSummaryPath = path.join(target, '.ts-quality', 'runs', runId, 'pr-summary.md');
  const checkSummaryPath = path.join(target, '.ts-quality', 'runs', runId, 'check-summary.txt');
  const planPath = path.join(target, '.ts-quality', 'runs', runId, 'plan.txt');
  const governPath = path.join(target, '.ts-quality', 'runs', runId, 'govern.txt');
  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(fs.existsSync(checkSummaryPath), true);
  assert.equal(fs.existsSync(planPath), true);
  assert.equal(fs.existsSync(governPath), true);
  const report = spawnSync('node', [cli, 'report', '--root', target], { encoding: 'utf8' });
  const explain = spawnSync('node', [cli, 'explain', '--root', target], { encoding: 'utf8' });
  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  const prSummary = fs.readFileSync(prSummaryPath, 'utf8');
  const checkSummary = fs.readFileSync(checkSummaryPath, 'utf8');
  const planText = fs.readFileSync(planPath, 'utf8');
  const governText = fs.readFileSync(governPath, 'utf8');
  assert.match(fs.readFileSync(reportPath, 'utf8'), /^---\nsummary:/);
  assert.match(prSummary, /^---\nsummary:/);
  assert.match(prSummary, /Evidence provenance: explicit 3, inferred 1, missing 1/);
  assert.match(prSummary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.match(checkSummary, /Merge confidence: [0-9]+\/100/);
  assert.match(checkSummary, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(checkSummary, /Evidence provenance: explicit 3, inferred 1, missing 1/);
  assert.match(checkSummary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.doesNotMatch(checkSummary, /^Obligation:/m);
  assert.match(report.stdout, /Merge confidence/);
  assert.match(report.stdout, /mutation scope: [0-9]+ site\(s\), [0-9]+ killed, [0-9]+ survived/);
  assert.match(report.stdout, /focused-test-alignment \[clear; mode=inferred\]: 1 focused test file aligned to invariant scope/);
  assert.match(report.stdout, /mutation-pressure \[warning; mode=explicit\]: [0-9]+ surviving mutants? across [0-9]+ mutation sites?/);
  assert.match(explain.stdout, /Reasons:/);
  assert.match(explain.stdout, /focused tests: test\/token.test.js/);
  assert.match(explain.stdout, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.match(plan.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(plan.stdout, /Evidence provenance: explicit 3, inferred 1, missing 1/);
  assert.match(planText, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(planText, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.match(govern.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(govern.stdout, /mutation-pressure \[warning; mode=explicit\]: [0-9]+ surviving mutants across [0-9]+ mutation sites/);
  assert.match(governText, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(governText, /Evidence provenance: explicit 3, inferred 1, missing 1/);
});

test('check persists analysis context and mutation baseline receipts', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const run = readRun(target);
  assert.equal(typeof run.analysis?.executionFingerprint, 'string');
  assert.equal(run.analysis?.changedFiles.includes('src/auth/token.js'), true);
  assert.equal(run.mutationBaseline?.status, 'pass');
});

test('trend keeps deltas visible while surfacing the latest risky invariant provenance', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const trend = spawnSync('node', [cli, 'trend', '--root', target], { encoding: 'utf8' });
  assert.equal(trend.status, 0, trend.stderr);
  assert.match(trend.stdout, /Current run: /);
  assert.match(trend.stdout, /Previous run: /);
  assert.match(trend.stdout, /Merge confidence delta: -?\d+/);
  assert.match(trend.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(trend.stdout, /Evidence provenance: explicit 3, inferred 1, missing 1/);
  assert.match(trend.stdout, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic support/);
  assert.doesNotMatch(trend.stdout, /^Obligation:/m);
});

test('trend orders runs by createdAt rather than lexical run id sort', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'run-2'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'run-10'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const trend = spawnSync('node', [cli, 'trend', '--root', target], { encoding: 'utf8' });
  assert.equal(trend.status, 0, trend.stderr);
  assert.match(trend.stdout, /Current run: run-10/);
  assert.match(trend.stdout, /Previous run: run-2/);
});

test('check, plan, govern, and authorize accept --config for a nonstandard config file name', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.renameSync(path.join(target, 'ts-quality.config.ts'), path.join(target, 'custom-config.ts'));
  let result = spawnSync('node', [cli, 'check', '--root', target, '--config', 'custom-config.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'plan', '--root', target, '--config', 'custom-config.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'govern', '--root', target, '--config', 'custom-config.ts'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'authorize', '--root', target, '--config', 'custom-config.ts', '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const decision = JSON.parse(result.stdout);
  assert.equal(typeof decision.outcome, 'string');
});

test('materialize exports runtime JSON artifacts and check can run from them with matching verdicts', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'materialize', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Materialized runtime config: \.ts-quality\/materialized\/ts-quality\.config\.json/);
  for (const relativePath of [
    '.ts-quality/materialized/ts-quality.config.json',
    '.ts-quality/materialized/invariants.json',
    '.ts-quality/materialized/constitution.json',
    '.ts-quality/materialized/agents.json',
    '.ts-quality/materialized/approvals.json',
    '.ts-quality/materialized/waivers.json',
    '.ts-quality/materialized/overrides.json'
  ]) {
    assert.equal(fs.existsSync(path.join(target, relativePath)), true, relativePath);
  }

  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'source-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const sourceRun = readRun(target);

  result = spawnSync('node', [cli, 'check', '--root', target, '--config', '.ts-quality/materialized/ts-quality.config.json', '--run-id', 'materialized-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const materializedRun = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'materialized-run', 'run.json'), 'utf8'));

  assert.equal(materializedRun.verdict.mergeConfidence, sourceRun.verdict.mergeConfidence);
  assert.equal(materializedRun.verdict.outcome, sourceRun.verdict.outcome);
  assert.deepEqual(materializedRun.changedFiles, sourceRun.changedFiles);
  assert.deepEqual(materializedRun.behaviorClaims.map((claim) => claim.invariantId), sourceRun.behaviorClaims.map((claim) => claim.invariantId));
  assert.equal(materializedRun.governance.length, sourceRun.governance.length);
});

test('materialize keeps copied diff inputs in a reserved subdirectory so they cannot overwrite canonical artifacts', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.mkdirSync(path.join(target, 'diffs'), { recursive: true });
  fs.writeFileSync(path.join(target, 'diffs', 'agents.json'), '@@ -1 +1 @@\n-bad\n+good\n', 'utf8');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['src/auth/token.js'], diffFile: 'diffs/agents.json' },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
`, 'utf8');

  const result = spawnSync('node', [cli, 'materialize', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'materialized', 'agents.json')), true);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'materialized', 'inputs', 'diffs', 'agents.json')), true);
  assert.doesNotMatch(fs.readFileSync(path.join(target, '.ts-quality', 'materialized', 'agents.json'), 'utf8'), /^@@/);
  const check = spawnSync('node', [cli, 'check', '--root', target, '--config', '.ts-quality/materialized/ts-quality.config.json'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
});

test('check rejects trust directories that escape the repository root', () => {
  const fixture = tempCopyOfFixture('governed-app');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-external-trust-'));
  const target = path.join(workspace, 'repo');
  fs.cpSync(fixture, target, { recursive: true });
  fs.mkdirSync(path.join(workspace, 'outside', 'attestations'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'outside', 'keys'), { recursive: true });
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['src/auth/token.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '../outside/attestations',
  trustedKeysDir: '../outside/keys'
};
`, 'utf8');

  const result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /attestations dir must stay inside repository root|trusted keys dir must stay inside repository root/);
});

test('check accepts a caller-supplied run id for exact approval binding', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['src/payments/ledger.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
`, 'utf8');
  fs.writeFileSync(path.join(target, '.ts-quality', 'approvals.json'), JSON.stringify([
    {
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'pre-bound exact run approval',
      createdAt: new Date().toISOString(),
      targetId: 'exact-run-1:payments-maintainer-approval'
    }
  ], null, 2));

  const check = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'exact-run-1'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const run = readRun(target);
  assert.equal(run.runId, 'exact-run-1');
  assert.equal(run.governance.some((finding) => finding.ruleId === 'payments-maintainer-approval'), false);
});


test('check assigns nested package files to the deepest matching package', () => {
  const target = tempCopyOfFixture('mini-monorepo');
  fs.writeFileSync(path.join(target, 'packages', 'api', 'package.json'), JSON.stringify({ name: 'api-pkg', private: true }, null, 2));
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const run = readRun(target);
  const apiFile = run.files.find((file) => file.filePath === 'packages/api/src/consumer.js');
  assert.equal(apiFile?.packageName, 'api-pkg');
});


test('check rejects unsafe run ids', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', '../../escape'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /runId must use only letters, numbers, dot, underscore, and hyphen/);
});


test('check --help renders usage instead of executing analysis', () => {
  const result = spawnSync('node', [cli, 'check', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ts-quality check/);
  assert.equal(result.stderr, '');
});

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

test('attest verify fails when the signed subject file changes', () => {
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
  assert.match(result.stdout, /failed \(subject digest mismatch\)/);
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
