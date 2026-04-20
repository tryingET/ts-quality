import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture, latestRunId, readRun, importDist, forgeAttestation } from './helpers.mjs';

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

test('check fails closed when changed scope has no measurable mutation pressure', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutation-missing-'));
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'src', 'id.js'), 'export const id = (value) => value;\n', 'utf8');
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  assert.equal(run.verdict.outcome, 'fail');
  assert.equal(run.verdict.findings.some((item) => item.code === 'mutation-evidence-missing'), true);
  assert.equal(run.governance.some((item) => item.evidence.some((evidence) => evidence.includes('no killed or surviving mutants were measured'))), true);
  assert.equal(run.verdict.bestNextAction, 'Add executable tests or broaden measurable mutation scope so changed code produces explicit mutation pressure.');
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


test('report --json keeps exact parity with the persisted run artifact', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const runId = latestRunId(target);
  const runPath = path.join(target, '.ts-quality', 'runs', runId, 'run.json');
  const report = spawnSync('node', [cli, 'report', '--root', target, '--json'], { encoding: 'utf8' });
  assert.equal(report.status, 0, report.stderr);
  const persistedRun = fs.readFileSync(runPath, 'utf8');
  assert.equal(report.stdout, persistedRun);
  assert.deepEqual(JSON.parse(report.stdout), JSON.parse(persistedRun));
});

test('check persists analysis context, mutation baseline receipts, and a run-bound control plane snapshot', () => {
  const target = tempCopyOfFixture('governed-app');
  const check = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const run = readRun(target);
  assert.equal(typeof run.analysis?.executionFingerprint, 'string');
  assert.equal(run.analysis?.changedFiles.includes('src/auth/token.js'), true);
  assert.equal(run.analysis?.configPath, 'ts-quality.config.ts');
  assert.equal(run.analysis?.coverageLcovPath, 'coverage/lcov.info');
  assert.deepEqual(run.analysis?.runtimeMirrorRoots, ['dist']);
  assert.equal(run.mutationBaseline?.status, 'pass');
  assert.equal(run.controlPlane?.schemaVersion, 1);
  assert.equal(run.controlPlane?.configPath, 'ts-quality.config.ts');
  assert.equal(run.controlPlane?.constitutionPath, '.ts-quality/constitution.ts');
  assert.equal(run.controlPlane?.agentsPath, '.ts-quality/agents.ts');
  assert.equal(run.controlPlane?.approvalsPath, '.ts-quality/approvals.json');
  assert.equal(run.controlPlane?.policy.minMergeConfidence, 65);
  assert.equal(Array.isArray(run.controlPlane?.constitution), true);
  assert.equal(Array.isArray(run.controlPlane?.agents), true);
});

test('plan, govern, and authorize reject unsupported control-plane snapshot schemas', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-mismatch-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-mismatch-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  run.controlPlane.schemaVersion = 999;
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });

  assert.equal(plan.status, 1);
  assert.equal(govern.status, 1);
  assert.equal(authorize.status, 1);
  assert.match(plan.stderr, /unsupported control-plane snapshot schema 999/);
  assert.match(govern.stderr, /Re-run ts-quality check/);
  assert.match(authorize.stderr, /Expected 1/);
});

test('plan, govern, and authorize reject malformed control-plane snapshots instead of falling back', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-malformed-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-malformed-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  delete run.controlPlane.constitution;
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });

  assert.equal(plan.status, 1);
  assert.equal(govern.status, 1);
  assert.equal(authorize.status, 1);
  assert.match(plan.stderr, /malformed control-plane snapshot schema 1/);
  assert.match(govern.stderr, /field constitution must be an array/);
  assert.match(authorize.stderr, /Re-run ts-quality check/);
});

test('plan, govern, and authorize reject malformed control-plane schemaVersion types', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-type-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-type-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  run.controlPlane.schemaVersion = '1';
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  assert.equal(plan.status, 1);
  assert.match(plan.stderr, /field schemaVersion must be integer 1/);
});

test('plan, govern, and authorize reject malformed control-plane array elements', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-array-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-array-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  run.controlPlane.constitution = [null];
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  assert.equal(govern.status, 1);
  assert.match(govern.stderr, /field constitution\[0\] must be an object/);
});

test('plan, govern, and authorize reject out-of-range control-plane policy values', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-policy-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-policy-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  run.controlPlane.policy.minMutationScore = 1.5;
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(authorize.status, 1);
  assert.match(authorize.stderr, /field minMutationScore must be <= 1/);
});

test('plan, govern, and authorize fall back to live context for legacy runs without controlPlane', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'legacy-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'legacy-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  delete run.controlPlane;
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });

  assert.equal(plan.status, 0, plan.stderr);
  assert.equal(govern.status, 0, govern.stderr);
  assert.equal(authorize.status, 0, authorize.stderr);
  assert.match(plan.stdout, /Invariant evidence at risk:/);
  assert.match(govern.stdout, /Invariant evidence at risk:/);
  assert.equal(typeof JSON.parse(authorize.stdout).outcome, 'string');
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

test('materialized config keeps authorize output parity with source config', () => {
  const sourceTarget = tempCopyOfFixture('governed-app');
  const materializedTarget = tempCopyOfFixture('governed-app');
  const runId = 'materialized-authorize-parity-run';
  const overrideRecord = [
    {
      kind: 'override',
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'Parity override after human review.',
      createdAt: '2026-01-01T00:10:00.000Z',
      targetId: `${runId}:release-bot:merge`
    }
  ];
  for (const target of [sourceTarget, materializedTarget]) {
    fs.writeFileSync(path.join(target, '.ts-quality', 'overrides.json'), `${JSON.stringify(overrideRecord, null, 2)}\n`, 'utf8');
  }

  let result = spawnSync('node', [cli, 'materialize', '--root', materializedTarget], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  result = spawnSync('node', [cli, 'check', '--root', sourceTarget, '--run-id', runId], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', materializedTarget, '--config', '.ts-quality/materialized/ts-quality.config.json', '--run-id', runId], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  for (const target of [sourceTarget, materializedTarget]) {
    result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', `.ts-quality/runs/${runId}/verdict.json`, '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/ci.tests.passed.json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }

  const sourceAuthorize = spawnSync('node', [cli, 'authorize', '--root', sourceTarget, '--agent', 'release-bot'], { encoding: 'utf8' });
  const materializedAuthorize = spawnSync('node', [cli, 'authorize', '--root', materializedTarget, '--config', '.ts-quality/materialized/ts-quality.config.json', '--agent', 'release-bot'], { encoding: 'utf8' });
  assert.equal(sourceAuthorize.status, 0, sourceAuthorize.stderr);
  assert.equal(materializedAuthorize.status, 0, materializedAuthorize.stderr);

  const sourceDecision = JSON.parse(sourceAuthorize.stdout);
  const materializedDecision = JSON.parse(materializedAuthorize.stdout);
  assert.equal(sourceDecision.outcome, 'approve');
  assert.equal(sourceDecision.overrideUsed, 'maintainer');
  assert.deepEqual(materializedDecision, sourceDecision);
});

test('materialized config keeps amend output parity with source config', () => {
  const sourceTarget = tempCopyOfFixture('governed-app');
  const materializedTarget = tempCopyOfFixture('governed-app');
  const proposal = {
    id: 'materialized-amend-parity',
    title: 'Clarify payment approval wording',
    rationale: 'Non-sensitive wording update.',
    evidence: ['docs updated'],
    changes: [{
      action: 'replace',
      ruleId: 'payments-maintainer-approval',
      rule: {
        kind: 'approval',
        id: 'payments-maintainer-approval',
        paths: ['src/payments/**'],
        message: 'Payment changes require explicit maintainer review.',
        minApprovals: 1,
        roles: ['maintainer']
      }
    }],
    approvals: [
      { by: 'maintainer', role: 'maintainer', rationale: 'wording ok', createdAt: '2026-01-01T00:15:00.000Z', targetId: 'materialized-amend-parity' }
    ]
  };
  for (const target of [sourceTarget, materializedTarget]) {
    fs.writeFileSync(path.join(target, 'proposal.json'), `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  }

  let result = spawnSync('node', [cli, 'materialize', '--root', materializedTarget], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const sourceAmend = spawnSync('node', [cli, 'amend', '--root', sourceTarget, '--proposal', 'proposal.json'], { encoding: 'utf8' });
  const materializedAmend = spawnSync('node', [cli, 'amend', '--root', materializedTarget, '--config', '.ts-quality/materialized/ts-quality.config.json', '--proposal', 'proposal.json'], { encoding: 'utf8' });
  assert.equal(sourceAmend.status, 0, sourceAmend.stderr);
  assert.equal(materializedAmend.status, 0, materializedAmend.stderr);

  const sourceDecision = JSON.parse(sourceAmend.stdout);
  const materializedDecision = JSON.parse(materializedAmend.stdout);
  assert.equal(sourceDecision.outcome, 'approved');
  assert.deepEqual(materializedDecision, sourceDecision);
  assert.equal(
    fs.readFileSync(path.join(materializedTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.json'), 'utf8'),
    fs.readFileSync(path.join(sourceTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.json'), 'utf8')
  );
  assert.equal(
    fs.readFileSync(path.join(materializedTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.txt'), 'utf8'),
    fs.readFileSync(path.join(sourceTarget, '.ts-quality', 'amendments', 'materialized-amend-parity.result.txt'), 'utf8')
  );
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

test('check rejects changeSet files that escape the repository root', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['../outside.js'] },
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

  const result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /changeSet file must stay inside repository root/);
});

test('check rejects coverage paths that escape the repository root', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: '../external/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { files: ['src/auth/token.js'] },
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

  const result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /coverage lcovPath must stay inside repository root/);
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

test('govern reprojects latest run governance with exact run-bound approvals', () => {
  const target = tempCopyOfFixture('governed-app');
  const configPath = path.join(target, 'ts-quality.config.ts');
  fs.writeFileSync(configPath, fs.readFileSync(configPath, 'utf8').replace("files: ['src/auth/token.js']", "files: ['src/payments/ledger.js']"), 'utf8');

  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'payments-run-1'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  assert.equal(run.governance.some((finding) => finding.ruleId === 'payments-maintainer-approval'), true);

  fs.writeFileSync(path.join(target, '.ts-quality', 'approvals.json'), JSON.stringify([
    {
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'post-check exact run approval',
      createdAt: new Date().toISOString(),
      targetId: 'payments-run-1:payments-maintainer-approval'
    }
  ], null, 2));

  result = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /payments-maintainer-approval/);
});

test('plan and govern surface run drift after check', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.appendFileSync(path.join(target, 'src', 'auth', 'token.js'), '\n// drift after check\n', 'utf8');

  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  assert.equal(plan.status, 0, plan.stderr);
  assert.equal(govern.status, 0, govern.stderr);
  assert.match(plan.stdout, /Run drift detected for/);
  assert.match(govern.stdout, /Run drift detected for/);
});

test('plan and govern surface control-plane drift after check', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'control-plane-plan-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.appendFileSync(path.join(target, '.ts-quality', 'constitution.ts'), '\n// control-plane drift after check\n', 'utf8');

  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  assert.equal(plan.status, 0, plan.stderr);
  assert.equal(govern.status, 0, govern.stderr);
  assert.match(plan.stdout, /Run drift detected for/);
  assert.match(govern.stdout, /control plane constitution/);
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

test('check rejects changed file overrides that escape the repository root', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'check', '--root', target, '--changed', '../outside.js'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /changed file override must stay inside repository root/);
});


test('check --help renders usage instead of executing analysis', () => {
  const result = spawnSync('node', [cli, 'check', '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: ts-quality check/);
  assert.equal(result.stderr, '');
});

test('check rejects missing values for value options instead of silently continuing', () => {
  const target = tempCopyOfFixture('governed-app');
  const result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', '--changed', 'src/auth/token.js'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^--run-id requires a value\n$/);
});

test('attest keygen creates a usable key pair and reports exact output paths', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'generated-key-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const generatedDir = path.join(target, '.ts-quality', 'generated-keys');
  const privateKeyPath = path.join(generatedDir, 'generated.pem');
  const publicKeyPath = path.join(generatedDir, 'generated.pub.pem');
  result = spawnSync('node', [cli, 'attest', 'keygen', '--root', target, '--out-dir', '.ts-quality/generated-keys', '--key-id', 'generated'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${privateKeyPath}\n${publicKeyPath}\n`);
  assert.equal(fs.existsSync(privateKeyPath), true);
  assert.equal(fs.existsSync(publicKeyPath), true);

  result = spawnSync('node', [cli, 'attest', 'sign', '--root', target, '--issuer', 'ci.generated', '--key-id', 'generated', '--private-key', '.ts-quality/generated-keys/generated.pem', '--subject', '.ts-quality/runs/generated-key-run/verdict.json', '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/generated.json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'attest', 'verify', '--root', target, '--attestation', '.ts-quality/attestations/generated.json', '--trusted-keys', '.ts-quality/generated-keys'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ci\.generated: verified \(verified\)$/m);
  assert.match(result.stdout, /^Subject: \.ts-quality\/runs\/generated-key-run\/verdict\.json$/m);
  assert.match(result.stdout, /^Run: generated-key-run$/m);
  assert.match(result.stdout, /^Artifact: verdict\.json$/m);
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
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'attestation-parity-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'attestation-parity-run', 'attestation-verify.txt'), 'utf8');
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
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'unsafe-source-check-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const verifyText = fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'unsafe-source-check-run', 'attestation-verify.txt'), 'utf8');
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
