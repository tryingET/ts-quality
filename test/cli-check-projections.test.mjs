import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import test from 'node:test';
import assert from 'assert/strict';
import { repoRoot, tempCopyOfFixture, latestRunId, readRun } from './helpers.mjs';

// CLI integration: check, report/explain/plan/govern, trend, control-plane snapshots and repository containment.

const cli = path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

function stripDecisionContext(reportJson) {
  const { decisionContext: _decisionContext, ...runJsonFields } = reportJson;
  return runJsonFields;
}

test('check fails closed when init-generated config has no changed scope', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.rmSync(path.join(target, 'ts-quality.config.ts'), { force: true });
  fs.rmSync(path.join(target, '.ts-quality'), { recursive: true, force: true });
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /^Changed scope is required\./);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'latest.json')), false);
});

test('check auto-generates configured LCOV when missing before analysis', () => {
  const target = tempCopyOfFixture('governed-app');
  const lcovText = fs.readFileSync(path.join(target, 'coverage', 'lcov.info'), 'utf8');
  fs.rmSync(path.join(target, 'coverage'), { recursive: true, force: true });
  fs.mkdirSync(path.join(target, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(target, 'scripts', 'write-lcov.mjs'), `import fs from 'node:fs';\nfs.writeFileSync('coverage/lcov.info', ${JSON.stringify(lcovText)}, 'utf8');\n`, 'utf8');
  const configPath = path.join(target, 'ts-quality.config.ts');
  fs.writeFileSync(configPath, fs.readFileSync(configPath, 'utf8').replace(
    "coverage: { lcovPath: 'coverage/lcov.info' },",
    "coverage: { lcovPath: 'coverage/lcov.info', generateCommand: ['node', 'scripts/write-lcov.mjs'], generateTimeoutMs: 5000 },"
  ), 'utf8');

  const result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'generated-lcov'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Coverage generation: pass -> coverage\/lcov\.info/);
  assert.equal(fs.existsSync(path.join(target, 'coverage', 'lcov.info')), true);
  const run = readRun(target);
  assert.equal(run.coverageGeneration?.lcovPath, 'coverage/lcov.info');
  assert.deepEqual(run.coverageGeneration?.command, ['node', 'scripts/write-lcov.mjs']);
  assert.equal(run.coverageGeneration?.receipt.status, 'pass');
  assert.equal(run.coverage.some((item) => item.filePath === 'src/auth/token.js'), true);
  const runDir = path.join(target, '.ts-quality', 'runs', 'generated-lcov');
  const checkSummary = fs.readFileSync(path.join(runDir, 'check-summary.txt'), 'utf8');
  assert.match(checkSummary, /Coverage generation: pass -> coverage\/lcov\.info/);
  assert.equal(fs.existsSync(path.join(runDir, 'coverage-generation.json')), true);
  assert.match(fs.readFileSync(path.join(runDir, 'coverage-generation.txt'), 'utf8'), /command: node scripts\/write-lcov\.mjs/);
});

test('check warns when LCOV covers built output but not changed TypeScript source', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-built-lcov-'));
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  fs.mkdirSync(path.join(target, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(target, 'coverage'), { recursive: true });
  let result = spawnSync('node', [cli, 'init', '--root', target, '--preset', 'node-test-ts-dist'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'src', 'value.ts'), 'export function value(flag: boolean): number { return flag ? 1 : 0; }\n', 'utf8');
  fs.writeFileSync(path.join(target, 'dist', 'value.js'), 'exports.value = function value(flag) { return flag ? 1 : 0; };\n', 'utf8');
  fs.writeFileSync(path.join(target, 'coverage', 'lcov.info'), 'TN:\nSF:dist/value.js\nDA:1,1\nend_of_record\n', 'utf8');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.ts'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '-e', 'process.exit(0)'], coveredOnly: false, timeoutMs: 5000, maxSites: 1, runtimeMirrorRoots: ['dist'] },
  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },
  changeSet: { files: ['src/value.ts'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts'
};
`, 'utf8');

  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'built-lcov'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  assert.equal(run.analysisWarnings?.[0]?.code, 'coverage-built-output-without-source-map');
  assert.match(run.analysisWarnings?.[0]?.hint ?? '', /NODE_OPTIONS=--enable-source-maps/);
  const explain = spawnSync('node', [cli, 'explain', '--root', target, '--run-id', 'built-lcov'], { encoding: 'utf8' });
  assert.match(explain.stdout, /Coverage exists for built output but not changed source/);
  assert.match(fs.readFileSync(path.join(target, '.ts-quality', 'runs', 'built-lcov', 'check-summary.txt'), 'utf8'), /NODE_OPTIONS=--enable-source-maps/);
});

test('check fails closed when configured LCOV generation fails', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.rmSync(path.join(target, 'coverage'), { recursive: true, force: true });
  const configPath = path.join(target, 'ts-quality.config.ts');
  fs.writeFileSync(configPath, fs.readFileSync(configPath, 'utf8').replace(
    "coverage: { lcovPath: 'coverage/lcov.info' },",
    "coverage: { lcovPath: 'coverage/lcov.info', generateCommand: ['node', '-e', 'console.error([\"first line\", \"second line\"].join(String.fromCharCode(10))); process.exit(2)'], generateTimeoutMs: 5000 },"
  ), 'utf8');

  const result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'failed-lcov'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /coverage generation command fail; expected LCOV at coverage\/lcov\.info/);
  // The CLI error boundary escapes control characters exactly once; the message must not be pre-escaped.
  assert.match(result.stderr, /first line\\u000asecond line/);
  assert.doesNotMatch(result.stderr, /\\\\u000a/);
  assert.equal(result.stderr.trimEnd().includes('\n'), false);
  assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'runs', 'failed-lcov')), false);
});

test('check accepts diff-only scope and derives changed files from diff hunks', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, 'changes.diff'), ['+++ b/src/auth/token.js', '@@ -1,1 +1,1 @@'].join('\n'), 'utf8');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 4 },
  policy: { maxChangedCrap: 30, minMutationScore: 0.5, minMergeConfidence: 50 },
  changeSet: { diffFile: 'changes.diff' },
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
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  assert.deepEqual(run.changedFiles, ['src/auth/token.js']);
  assert.equal(run.changedRegions.some((item) => item.filePath === 'src/auth/token.js'), true);
  assert.equal(run.behaviorClaims.some((claim) => claim.invariantId === 'auth.refresh.validity'), true);
});

test('check fails closed when changed scope has no measurable mutation pressure', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-mutation-missing-'));
  fs.mkdirSync(path.join(target, 'src'), { recursive: true });
  let result = spawnSync('node', [cli, 'init', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(target, 'src', 'id.js'), 'export const id = (value) => value;\n', 'utf8');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ['dist'] },
  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },
  changeSet: { files: ['src/id.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts'
};
`, 'utf8');
  result = spawnSync('node', [cli, 'check', '--root', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const run = readRun(target);
  assert.equal(run.verdict.outcome, 'fail');
  assert.equal(run.verdict.findings.some((item) => item.code === 'mutation-evidence-missing'), true);
  assert.equal(run.governance.some((item) => item.evidence.some((evidence) => evidence.includes('no killed or surviving mutants were measured'))), true);
  assert.equal(run.verdict.bestNextAction, 'Add executable tests or broaden measurable mutation scope so changed code produces explicit mutation pressure.');
});

test('check ignores symlinked excluded directories during mutation fingerprinting', () => {
  const target = tempCopyOfFixture('governed-app');
  const externalModules = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-external-node-modules-'));
  fs.writeFileSync(path.join(externalModules, 'package-marker.txt'), 'outside dependency cache\n', 'utf8');
  fs.symlinkSync(externalModules, path.join(target, 'node_modules'), 'dir');

  const result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'symlinked-excluded-dir'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /EISDIR/);
  assert.match(result.stdout, /Mutation basis:/);
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
  const run = readRun(target);
  const runDir = path.join(target, '.ts-quality', 'runs', runId);
  assert.equal(run.version, '0.2.0');
  assert.equal(run.verdict.confidenceBreakdown.base, 100);
  assert.equal(typeof run.verdict.confidenceBreakdown.final, 'number');
  assert.equal(fs.existsSync(path.join(runDir, 'next-evidence-action.txt')), true);
  assert.equal(fs.existsSync(path.join(runDir, 'next-evidence-action.prompt.md')), true);
  assert.equal(fs.existsSync(path.join(runDir, 'next-evidence-action.ak-task.json')), true);
  assert.equal(typeof run.nextEvidenceAction.primaryAction.title, 'string');
  assert.equal(run.nextEvidenceAction.primaryAction.completionCriteria.length > 0, true);
  assert.equal(run.nextEvidenceAction.primaryAction.suggestedEditFiles.includes('test/token.test.js'), true);
  assert.equal(run.nextEvidenceAction.primaryAction.groups.length > 0, true);
  assert.equal(run.nextEvidenceAction.primaryAction.sidecarSufficiency.level, 'actionable');
  assert.equal(run.nextEvidenceAction.primaryAction.sidecarSufficiency.reasons.some((item) => item.toLowerCase().includes('focused test edit files')), true);
  assert.deepEqual(run.nextEvidenceAction.primaryAction.taskManifest.sidecarSufficiency, run.nextEvidenceAction.primaryAction.sidecarSufficiency);
  assert.equal(run.nextEvidenceAction.primaryAction.steps.some((step) => step.observableBehavior && step.assertionStrategy && step.maskingRisk), true);
  assert.equal(run.nextEvidenceAction.primaryAction.taskManifest.guidance.some((item) => item.includes('observable')), true);
  assert.equal(typeof run.nextEvidenceAction.primaryAction.expectedConfidenceLift, 'number');
  assert.equal(run.nextEvidenceAction.primaryAction.taskManifest.requiredPaths.includes('test/token.test.js'), true);
  assert.equal(typeof run.nextEvidenceAction.evidenceBasis.confidence.final, 'number');
  assert.equal(typeof run.nextEvidenceAction.evidenceBasis.mutation.survived, 'number');
  assert.equal(run.nextEvidenceAction.evidenceBasis.nonBlockingSignals.some((item) => item.includes('coverage is present')), true);
  const nextEvidenceText = fs.readFileSync(path.join(runDir, 'next-evidence-action.txt'), 'utf8');
  assert.match(nextEvidenceText, /primaryActionTitle:/);
  assert.match(nextEvidenceText, /sidecarSufficiency: actionable/);
  assert.match(nextEvidenceText, /sidecarSufficiencyReason: Each survivor group includes observable-behavior, assertion-strategy, and masking-risk guidance\./);
  assert.match(nextEvidenceText, /suggestedEditFiles:/);
  assert.match(nextEvidenceText, /mutationBasis: status=\S+ killed=[0-9]+ sites=[0-9]+ survived=[0-9]+ errors=[0-9]+/);
  const nextEvidencePrompt = fs.readFileSync(path.join(runDir, 'next-evidence-action.prompt.md'), 'utf8');
  assert.match(nextEvidencePrompt, /# Next Evidence Closure/);
  assert.match(nextEvidencePrompt, /Sidecar sufficiency: actionable/);
  assert.match(nextEvidencePrompt, /sufficiency reason: Each survivor group includes observable-behavior, assertion-strategy, and masking-risk guidance\./);
  assert.match(nextEvidencePrompt, /observable behavior delta:/);
  assert.match(nextEvidencePrompt, /masking \/ observability note:/);
  assert.match(check.stdout, /Evidence closure:/);
  assert.match(check.stdout, /Coverage basis:/);
  assert.match(check.stdout, /Mutation basis:/);
  if (run.mutationRemediation) {
    assert.equal(fs.existsSync(path.join(runDir, 'mutation-remediation.json')), true);
    assert.equal(run.mutationRemediation.survivors.every((item) => item.filePath && item.siteId && item.assertionHint), true);
    assert.equal(run.mutationRemediation.survivors.every((item) => item.observableBehavior && item.assertionStrategy && item.maskingRisk), true);
  }
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
  assert.match(prSummary, /Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof/);
  assert.match(prSummary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic lexical support/);
  assert.match(checkSummary, /Merge confidence: [0-9]+\/100/);
  assert.match(checkSummary, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(checkSummary, /Evidence provenance: explicit 3, inferred 1, missing 1/);
  assert.match(checkSummary, /Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof/);
  assert.match(checkSummary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic lexical support/);
  assert.doesNotMatch(checkSummary, /^Obligation:/m);
  assert.match(report.stdout, /Merge confidence/);
  assert.match(report.stdout, /mutation scope: [0-9]+ site\(s\), [0-9]+ killed, [0-9]+ survived/);
  assert.match(report.stdout, /focused-test-alignment \[clear; mode=inferred\]: 1 focused test file aligned to invariant scope/);
  assert.match(report.stdout, /mutation-pressure \[warning; mode=explicit\]: [0-9]+ surviving mutants? across [0-9]+ mutation sites?/);
  assert.match(explain.stdout, /Confidence breakdown: base 100/);
  assert.match(explain.stdout, /Evidence closure:/);
  assert.match(explain.stdout, /Reasons:/);
  assert.match(explain.stdout, /focused tests: test\/token.test.js/);
  assert.match(explain.stdout, /evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof/);
  assert.match(explain.stdout, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic lexical support/);
  assert.match(plan.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(plan.stdout, /Evidence provenance: explicit 3, inferred 1, missing 1/);
  assert.match(planText, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(planText, /Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof/);
  assert.match(planText, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic lexical support/);
  assert.match(govern.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(govern.stdout, /mutation-pressure \[warning; mode=explicit\]: [0-9]+ surviving mutants across [0-9]+ mutation sites/);
  assert.match(governText, /Invariant evidence at risk: auth\.refresh\.validity/);
  assert.match(governText, /Evidence provenance: explicit 3, inferred 1, missing 1/);
});

test('masked survivor fixture covers behavior-delta and masking guidance across mutation categories', () => {
  const target = tempCopyOfFixture('masked-survivors');
  const check = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'masked-survivors-run'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const run = readRun(target);
  const steps = run.nextEvidenceAction.primaryAction.steps;
  const survivors = run.mutationRemediation.survivors;

  assert.equal(run.nextEvidenceAction.primaryAction.kind, 'mutation-survivors');
  assert.equal(run.nextEvidenceAction.primaryAction.sidecarSufficiency.level, 'actionable');
  assert.equal(survivors.length >= 4, true);
  assert.equal(survivors.every((item) => item.observableBehavior && item.assertionStrategy && item.maskingRisk), true);
  // primaryAction steps stop at 8 survivor groups; the remediation sidecar keeps every survivor's guidance.
  assert.equal(steps.length <= 8, true);
  assert.equal(survivors.some((item) => item.observableBehavior.includes('Boundary behavior changed')), true);
  assert.equal(survivors.some((item) => item.observableBehavior.includes('Equality behavior changed')), true);
  assert.equal(survivors.some((item) => item.observableBehavior.includes('Combined-condition behavior changed')), true);
  assert.equal(survivors.some((item) => item.observableBehavior.includes('Boolean behavior changed') && item.span.startLine === 27), true);
  assert.equal(steps.every((step) => step.maskingRisk.includes('Prefer a call path where the mutated value changes')), true);
  assert.equal(steps.some((step) => step.enclosingSymbol === 'function:asOptionalString'), true);
  assert.equal(steps.some((step) => step.enclosingSymbol === 'function:statusGate'), true);
  assert.equal(run.nextEvidenceAction.primaryAction.suggestedEditFiles.includes('test/masked.test.js'), true);
});

test('report and explain project the current decision context for the selected run', () => {
  const target = tempCopyOfFixture('governed-app');
  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 8 },
  policy: { maxChangedCrap: 15, minMutationScore: 0.75, minMergeConfidence: 65 },
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

  const check = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'payments-run'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'payments-run', 'run.json');
  const reportPath = path.join(target, '.ts-quality', 'runs', 'payments-run', 'report.json');
  const persistedRun = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  const persistedReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(persistedRun.governance.some((item) => item.ruleId === 'payments-maintainer-approval'), true);
  assert.equal(persistedReport.decisionContext.projection, 'persisted');
  assert.deepEqual(persistedReport.decisionContext.drift, []);
  assert.deepEqual(stripDecisionContext(persistedReport), persistedRun);

  const reportBeforeDecisionChange = spawnSync('node', [cli, 'report', '--root', target, '--json', '--run-id', 'payments-run'], { encoding: 'utf8' });
  assert.equal(reportBeforeDecisionChange.status, 0, reportBeforeDecisionChange.stderr);
  const projectedReportBeforeDecisionChange = JSON.parse(reportBeforeDecisionChange.stdout);
  assert.equal(projectedReportBeforeDecisionChange.decisionContext.projection, 'projected');
  assert.deepEqual(projectedReportBeforeDecisionChange.decisionContext.drift, []);
  assert.deepEqual(stripDecisionContext(projectedReportBeforeDecisionChange), persistedRun);

  fs.writeFileSync(path.join(target, '.ts-quality', 'approvals.json'), `${JSON.stringify([
    {
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'reviewed payments run',
      createdAt: '2026-01-01T00:15:00.000Z',
      targetId: 'payments-run'
    }
  ], null, 2)}\n`, 'utf8');

  const report = spawnSync('node', [cli, 'report', '--root', target, '--json', '--run-id', 'payments-run'], { encoding: 'utf8' });
  assert.equal(report.status, 0, report.stderr);
  const projectedReport = JSON.parse(report.stdout);
  assert.equal(projectedReport.runId, 'payments-run');
  assert.equal(projectedReport.decisionContext.projection, 'projected');
  assert.deepEqual(projectedReport.decisionContext.drift, []);
  assert.equal(projectedReport.governance.some((item) => item.ruleId === 'payments-maintainer-approval'), false);
  assert.equal(projectedReport.verdict.mergeConfidence > persistedRun.verdict.mergeConfidence, true);

  const explain = spawnSync('node', [cli, 'explain', '--root', target, '--run-id', 'payments-run'], { encoding: 'utf8' });
  assert.equal(explain.status, 0, explain.stderr);
  assert.doesNotMatch(explain.stdout, /Payment domain changes require a maintainer approval\./);
  assert.match(explain.stdout, /Mutation pressure is missing for the evaluated scope/);
});

test('downstream commands accept --run-id so operators can target a non-latest run explicitly', () => {
  const target = tempCopyOfFixture('governed-app');

  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'older-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  fs.appendFileSync(path.join(target, 'src', 'auth', 'token.js'), '\n// explicit run selection anchor\n', 'utf8');
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'newer-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(latestRunId(target), 'newer-run');

  fs.writeFileSync(path.join(target, '.ts-quality', 'overrides.json'), `${JSON.stringify([
    {
      kind: 'override',
      by: 'maintainer',
      role: 'maintainer',
      rationale: 'newer run override only',
      createdAt: '2026-01-01T00:10:00.000Z',
      targetId: 'newer-run:maintainer:merge'
    }
  ], null, 2)}\n`, 'utf8');

  const latestReport = spawnSync('node', [cli, 'report', '--root', target, '--json'], { encoding: 'utf8' });
  const olderReport = spawnSync('node', [cli, 'report', '--root', target, '--json', '--run-id', 'older-run'], { encoding: 'utf8' });
  assert.equal(latestReport.status, 0, latestReport.stderr);
  assert.equal(olderReport.status, 0, olderReport.stderr);
  const latestReportJson = JSON.parse(latestReport.stdout);
  const olderReportJson = JSON.parse(olderReport.stdout);
  assert.equal(latestReportJson.runId, 'newer-run');
  assert.equal(latestReportJson.decisionContext.projection, 'projected');
  assert.deepEqual(latestReportJson.decisionContext.drift, []);
  assert.equal(olderReportJson.runId, 'older-run');
  assert.equal(olderReportJson.decisionContext.projection, 'projected');
  assert.equal(olderReportJson.decisionContext.drift.some((item) => item.subject === 'changed file src/auth/token.js'), true);

  const olderExplain = spawnSync('node', [cli, 'explain', '--root', target, '--run-id', 'older-run'], { encoding: 'utf8' });
  assert.equal(olderExplain.status, 0, olderExplain.stderr);
  assert.match(olderExplain.stdout, /Run drift detected for older-run\./);
  assert.match(olderExplain.stdout, /Run older-run/);

  const latestPlan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const olderPlan = spawnSync('node', [cli, 'plan', '--root', target, '--run-id', 'older-run'], { encoding: 'utf8' });
  assert.equal(latestPlan.status, 0, latestPlan.stderr);
  assert.equal(olderPlan.status, 0, olderPlan.stderr);
  assert.doesNotMatch(latestPlan.stdout, /Run drift detected for older-run\./);
  assert.match(olderPlan.stdout, /Run drift detected for older-run\./);

  const olderGovern = spawnSync('node', [cli, 'govern', '--root', target, '--run-id', 'older-run'], { encoding: 'utf8' });
  assert.equal(olderGovern.status, 0, olderGovern.stderr);
  assert.match(olderGovern.stdout, /Run drift detected for older-run\./);

  const latestAuthorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'maintainer'], { encoding: 'utf8' });
  const olderAuthorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'maintainer', '--run-id', 'older-run'], { encoding: 'utf8' });
  assert.equal(latestAuthorize.status, 0, latestAuthorize.stderr);
  assert.equal(olderAuthorize.status, 0, olderAuthorize.stderr);

  const latestDecision = JSON.parse(latestAuthorize.stdout);
  const olderDecision = JSON.parse(olderAuthorize.stdout);
  assert.equal(latestDecision.outcome, 'approve');
  assert.equal(latestDecision.overrideUsed, 'maintainer');
  assert.equal(latestDecision.evidenceContext?.runId, 'newer-run');
  assert.equal(olderDecision.outcome, 'deny');
  assert.equal(olderDecision.evidenceContext?.runId, 'older-run');
  assert.match((olderDecision.reasons ?? []).join('\n'), /Repository changed since run older-run/);
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

test('explain, report, plan, govern, and authorize reject unsupported control-plane snapshot schemas', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-mismatch-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-mismatch-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  run.controlPlane.schemaVersion = 999;
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const explain = spawnSync('node', [cli, 'explain', '--root', target], { encoding: 'utf8' });
  const report = spawnSync('node', [cli, 'report', '--root', target, '--json'], { encoding: 'utf8' });
  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });

  assert.equal(explain.status, 1);
  assert.equal(report.status, 1);
  assert.equal(plan.status, 1);
  assert.equal(govern.status, 1);
  assert.equal(authorize.status, 1);
  assert.match(explain.stderr, /unsupported control-plane snapshot schema 999/);
  assert.match(report.stderr, /Re-run ts-quality check/);
  assert.match(plan.stderr, /unsupported control-plane snapshot schema 999/);
  assert.match(govern.stderr, /Re-run ts-quality check/);
  assert.match(authorize.stderr, /Expected 1/);
});

test('explain, report, plan, govern, and authorize reject malformed control-plane snapshots instead of falling back', () => {
  const target = tempCopyOfFixture('governed-app');
  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'schema-malformed-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const runPath = path.join(target, '.ts-quality', 'runs', 'schema-malformed-run', 'run.json');
  const run = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  delete run.controlPlane.constitution;
  fs.writeFileSync(runPath, JSON.stringify(run, null, 2));

  const explain = spawnSync('node', [cli, 'explain', '--root', target], { encoding: 'utf8' });
  const report = spawnSync('node', [cli, 'report', '--root', target, '--json'], { encoding: 'utf8' });
  const plan = spawnSync('node', [cli, 'plan', '--root', target], { encoding: 'utf8' });
  const govern = spawnSync('node', [cli, 'govern', '--root', target], { encoding: 'utf8' });
  const authorize = spawnSync('node', [cli, 'authorize', '--root', target, '--agent', 'release-bot'], { encoding: 'utf8' });

  assert.equal(explain.status, 1);
  assert.equal(report.status, 1);
  assert.equal(plan.status, 1);
  assert.equal(govern.status, 1);
  assert.equal(authorize.status, 1);
  assert.match(explain.stderr, /malformed control-plane snapshot schema 1/);
  assert.match(report.stderr, /field constitution must be an array/);
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
  assert.match(trend.stdout, /Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof/);
  assert.match(trend.stdout, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic lexical support/);
  assert.doesNotMatch(trend.stdout, /^Obligation:/m);
});

test('trend skips unrelated runs and uses the nearest comparable prior run', () => {
  const target = tempCopyOfFixture('governed-app');
  const defaultConfig = fs.readFileSync(path.join(target, 'ts-quality.config.ts'), 'utf8');

  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'auth-run-1'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 8 },
  policy: { maxChangedCrap: 15, minMutationScore: 0.75, minMergeConfidence: 65 },
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
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'payments-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), defaultConfig, 'utf8');
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'auth-run-2'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const latestRun = readRun(target);
  assert.equal(latestRun.runId, 'auth-run-2');
  assert.equal(latestRun.trend?.previousRunId, 'auth-run-1');

  const trend = spawnSync('node', [cli, 'trend', '--root', target], { encoding: 'utf8' });
  assert.equal(trend.status, 0, trend.stderr);
  assert.match(trend.stdout, /Current run: auth-run-2/);
  assert.match(trend.stdout, /Previous run: auth-run-1/);
  assert.doesNotMatch(trend.stdout, /Previous run: payments-run/);
});

test('trend fails closed when no comparable prior run exists', () => {
  const target = tempCopyOfFixture('governed-app');

  let result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'auth-run-1'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  fs.writeFileSync(path.join(target, 'ts-quality.config.ts'), `export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test'], coveredOnly: true, timeoutMs: 10000, maxSites: 8 },
  policy: { maxChangedCrap: 15, minMutationScore: 0.75, minMergeConfidence: 65 },
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
  result = spawnSync('node', [cli, 'check', '--root', target, '--run-id', 'payments-run'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);

  const latestRun = readRun(target);
  assert.equal(latestRun.runId, 'payments-run');
  assert.equal(latestRun.trend, undefined);

  const trend = spawnSync('node', [cli, 'trend', '--root', target], { encoding: 'utf8' });
  assert.equal(trend.status, 0, trend.stderr);
  assert.match(trend.stdout, /Current run: payments-run/);
  assert.match(trend.stdout, /No comparable prior run for trend analysis\./);
  assert.match(trend.stdout, /Nearest earlier run: auth-run-1/);
  assert.match(trend.stdout, /- changed file scope differs/);
  assert.doesNotMatch(trend.stdout, /Merge confidence delta:/);
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
