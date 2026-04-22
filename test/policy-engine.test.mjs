import test from 'node:test';
import assert from 'assert/strict';
import { importDist } from './helpers.mjs';

const policy = await importDist('packages', 'policy-engine', 'src', 'index.js');

test('evaluatePolicy reduces confidence for survivors and low mutation score', () => {
  const result = policy.evaluatePolicy({
    nowIso: new Date().toISOString(),
    policy: { maxChangedCrap: 10, minMutationScore: 0.8, minMergeConfidence: 70 },
    changedComplexity: [{ crap: 12, changed: true, filePath: 'src/auth/token.js', symbol: 'function:x', span: { startLine: 1, endLine: 2 }, complexity: 3, coveragePct: 50, kind: 'complexity' }],
    mutations: [{ kind: 'mutation-result', siteId: '1', filePath: 'src/auth/token.js', status: 'survived', durationMs: 10 }],
    behaviorClaims: [],
    governance: [],
    waivers: []
  });
  assert.equal(result.verdict.mergeConfidence < 70, true);
  assert.equal(result.verdict.blockedBy.length > 0, true);
});

test('evaluatePolicy blocks when mutation pressure is missing instead of scoring it as perfect', () => {
  const result = policy.evaluatePolicy({
    nowIso: new Date().toISOString(),
    policy: { maxChangedCrap: 10, minMutationScore: 0.8, minMergeConfidence: 70 },
    changedComplexity: [{ crap: 5, changed: true, filePath: 'src/auth/token.js', symbol: 'function:x', span: { startLine: 1, endLine: 2 }, complexity: 3, coveragePct: 100, kind: 'complexity' }],
    mutations: [],
    behaviorClaims: [],
    governance: [],
    waivers: []
  });
  assert.equal(result.verdict.findings.some((item) => item.code === 'mutation-evidence-missing'), true);
  assert.equal(result.verdict.blockedBy.some((item) => item.includes('Mutation pressure is missing for the evaluated scope')), true);
  assert.equal(result.verdict.bestNextAction, 'Add executable tests or broaden measurable mutation scope so changed code produces explicit mutation pressure.');
});

test('evaluatePolicy applies active waivers', () => {
  const now = new Date().toISOString();
  const result = policy.evaluatePolicy({
    nowIso: now,
    policy: { maxChangedCrap: 10, minMutationScore: 0.8, minMergeConfidence: 70 },
    changedComplexity: [{ crap: 20, changed: true, filePath: 'src/auth/token.js', symbol: 'function:x', span: { startLine: 1, endLine: 2 }, complexity: 3, coveragePct: 50, kind: 'complexity' }],
    mutations: [],
    behaviorClaims: [],
    governance: [],
    waivers: [{ id: 'w1', ruleId: 'changed-crap-budget', scope: ['src/auth/token.js'], owner: 'maintainer', reason: 'temporary', createdAt: now }]
  });
  assert.equal(result.verdict.warnings.some((item) => item.includes('Applied waiver')), true);
});


test('evaluatePolicy blocks when the mutation baseline is not green', () => {
  const result = policy.evaluatePolicy({
    nowIso: new Date().toISOString(),
    policy: { maxChangedCrap: 10, minMutationScore: 0.8, minMergeConfidence: 70 },
    changedComplexity: [{ crap: 5, changed: true, filePath: 'src/auth/token.js', symbol: 'function:x', span: { startLine: 1, endLine: 2 }, complexity: 3, coveragePct: 100, kind: 'complexity' }],
    mutations: [{ kind: 'mutation-result', siteId: '1', filePath: 'src/auth/token.js', status: 'error', durationMs: 10, details: 'baseline failed' }],
    mutationBaseline: { status: 'fail', exitCode: 1, durationMs: 10, details: 'test suite failed' },
    behaviorClaims: [],
    governance: [],
    waivers: []
  });
  assert.equal(result.verdict.blockedBy.some((item) => item.includes('Mutation baseline test command did not pass')), true);
  assert.equal(result.verdict.bestNextAction, 'Fix the baseline test command so it passes before trusting mutation evidence.');
});

test('evaluatePolicy warns when invariant support is only lexical', () => {
  const result = policy.evaluatePolicy({
    nowIso: new Date().toISOString(),
    policy: { maxChangedCrap: 10, minMutationScore: 0.8, minMergeConfidence: 70 },
    changedComplexity: [{ crap: 5, changed: true, filePath: 'src/auth/token.js', symbol: 'function:x', span: { startLine: 1, endLine: 2 }, complexity: 3, coveragePct: 100, kind: 'complexity' }],
    mutations: [
      { kind: 'mutation-result', siteId: '1', filePath: 'src/auth/token.js', status: 'killed', durationMs: 10 }
    ],
    behaviorClaims: [{
      id: 'auth.refresh.validity:claim',
      invariantId: 'auth.refresh.validity',
      description: 'Refresh token validity applies to src/auth/token.js',
      status: 'lexically-supported',
      evidence: ['Focused tests with deterministic lexical alignment: test/token.test.js'],
      obligations: [],
      evidenceSummary: {
        invariantId: 'auth.refresh.validity',
        evidenceSemantics: 'deterministic-lexical',
        evidenceSemanticsSummary: 'deterministic lexical alignment over focused tests; not execution-backed behavioral proof',
        impactedFiles: ['src/auth/token.js'],
        focusedTests: ['test/token.test.js'],
        changedFunctions: [],
        changedFunctionsUnder80Coverage: 0,
        maxChangedCrap: 3,
        mutationSitesInScope: 1,
        killedMutantsInScope: 1,
        survivingMutantsInScope: 0,
        scenarioResults: [{
          scenarioId: 'expired-boundary',
          description: 'exact expiry boundary denies access',
          expected: 'deny',
          keywordsMatched: true,
          failurePathKeywordsMatched: true,
          supported: true
        }],
        subSignals: [{
          signalId: 'scenario-support',
          label: 'Scenario lexical support',
          level: 'clear',
          mode: 'inferred',
          modeReason: 'deterministic lexical scenario support came from heuristically aligned focused tests',
          summary: '1/1 scenario(s) have deterministic lexical support',
          facts: []
        }]
      }
    }],
    governance: [],
    waivers: []
  });
  assert.equal(result.verdict.outcome, 'warn');
  assert.equal(result.verdict.findings.some((item) => item.code === 'invariant-lexical-support'), true);
  assert.equal(result.verdict.blockedBy.length, 0);
  assert.match(result.verdict.bestNextAction ?? '', /execution-backed invariant witnesses/);
});

test('renderPrSummary projects concise invariant evidence provenance for the risky claim', () => {
  const summary = policy.renderPrSummary({
    changedFiles: ['src/auth/token.js'],
    complexity: [{ crap: 3, changed: true, filePath: 'src/auth/token.js', symbol: 'function:canUseRefreshToken', span: { startLine: 1, endLine: 2 }, complexity: 2, coveragePct: 100, kind: 'complexity' }],
    mutations: [
      { kind: 'mutation-result', siteId: '1', filePath: 'src/auth/token.js', status: 'survived', durationMs: 10 },
      { kind: 'mutation-result', siteId: '2', filePath: 'src/auth/token.js', status: 'killed', durationMs: 10 }
    ],
    behaviorClaims: [
      {
        id: 'auth.refresh.validity:claim',
        invariantId: 'auth.refresh.validity',
        description: 'Refresh token validity applies to src/auth/token.js',
        status: 'at-risk',
        evidence: ['3 surviving mutants in impacted invariant scope'],
        obligations: [],
        evidenceSummary: {
          invariantId: 'auth.refresh.validity',
          evidenceSemantics: 'deterministic-lexical',
          evidenceSemanticsSummary: 'deterministic lexical alignment over focused tests; not execution-backed behavioral proof',
          impactedFiles: ['src/auth/token.js'],
          focusedTests: ['test/token.test.js'],
          changedFunctions: [],
          changedFunctionsUnder80Coverage: 0,
          maxChangedCrap: 3,
          mutationSitesInScope: 4,
          killedMutantsInScope: 1,
          survivingMutantsInScope: 3,
          scenarioResults: [],
          subSignals: [
            {
              signalId: 'focused-test-alignment',
              label: 'Focused test alignment',
              level: 'clear',
              mode: 'inferred',
              modeReason: 'matched focused tests via deterministic path/import/selector hints',
              summary: '1 focused test file aligned to invariant scope',
              facts: []
            },
            {
              signalId: 'scenario-support',
              label: 'Scenario lexical support',
              level: 'missing',
              mode: 'missing',
              modeReason: 'no focused tests were available for deterministic lexical scenario evaluation',
              summary: '0/1 scenario(s) have deterministic lexical support',
              facts: []
            },
            {
              signalId: 'mutation-pressure',
              label: 'Mutation pressure',
              level: 'warning',
              mode: 'explicit',
              modeReason: 'mutation evidence came from selected mutation sites in invariant scope',
              summary: '3 surviving mutants across 4 mutation sites',
              facts: []
            }
          ]
        }
      }
    ],
    verdict: {
      mergeConfidence: 42,
      outcome: 'warn',
      reasons: [],
      warnings: [],
      blockedBy: [],
      findings: [],
      bestNextAction: 'Add or tighten an assertion covering src/auth/token.js around the surviving mutant.'
    }
  });

  assert.match(summary, /Evidence semantics: deterministic lexical alignment over focused tests; not execution-backed behavioral proof/);
  assert.match(summary, /Evidence provenance: explicit 1, inferred 1, missing 1/);
  assert.match(summary, /focused-test-alignment \[clear; mode=inferred\]: 1 focused test file aligned to invariant scope/);
  assert.match(summary, /scenario-support \[missing; mode=missing\]: 0\/1 scenario\(s\) have deterministic lexical support/);
  assert.match(summary, /mutation-pressure \[warning; mode=explicit\]: 3 surviving mutants across 4 mutation sites/);
});
