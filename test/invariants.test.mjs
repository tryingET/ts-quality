import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { fixturePath, importDist } from './helpers.mjs';

const crap = await importDist('packages', 'crap4ts', 'src', 'index.js');
const mutate = await importDist('packages', 'ts-mutate', 'src', 'index.js');
const invariants = await importDist('packages', 'invariants', 'src', 'index.js');
const config = await importDist('packages', 'ts-quality', 'src', 'config.js');

test('evaluateInvariants produces obligations for missing failure-path tests', () => {
  const rootDir = fixturePath('governed-app');
  const coverage = crap.parseLcov(fs.readFileSync(path.join(rootDir, 'coverage', 'lcov.info'), 'utf8'));
  const complexity = crap.analyzeCrap({ rootDir, sourceFiles: ['src/auth/token.js'], coverage, changedFiles: ['src/auth/token.js'] }).hotspots;
  const mutationRun = mutate.runMutations({
    repoRoot: rootDir,
    sourceFiles: ['src/auth/token.js'],
    changedFiles: ['src/auth/token.js'],
    coverage,
    testCommand: ['node', '--test'],
    coveredOnly: true,
    maxSites: 3,
    timeoutMs: 10_000
  });
  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: config.loadInvariants(rootDir, '.ts-quality/invariants.ts'),
    changedFiles: ['src/auth/token.js'],
    changedRegions: [],
    complexity,
    mutationSites: mutationRun.sites,
    mutations: mutationRun.results,
    testPatterns: ['test/**/*.js']
  });
  const authClaim = claims.find((claim) => claim.invariantId === 'auth.refresh.validity');
  assert.ok(authClaim);
  assert.equal(authClaim.status, 'at-risk');
  assert.equal(authClaim.obligations.length > 0, true);
  assert.equal(authClaim.evidenceSummary.evidenceSemantics, 'deterministic-lexical');
  assert.match(authClaim.evidenceSummary.evidenceSemanticsSummary, /not execution-backed behavioral proof/);
  assert.deepEqual(authClaim.evidenceSummary.impactedFiles, ['src/auth/token.js']);
  assert.deepEqual(authClaim.evidenceSummary.focusedTests, ['test/token.test.js']);
  assert.equal(authClaim.evidenceSummary.changedFunctions.length > 0, true);
  assert.equal(authClaim.evidenceSummary.changedFunctionsUnder80Coverage, 0);
  assert.equal(authClaim.evidenceSummary.mutationSitesInScope, mutationRun.sites.length);
  assert.equal(authClaim.evidenceSummary.killedMutantsInScope, mutationRun.results.filter((item) => item.status === 'killed').length);
  assert.equal(authClaim.evidenceSummary.survivingMutantsInScope, mutationRun.results.filter((item) => item.status === 'survived').length);
  assert.equal(authClaim.evidenceSummary.scenarioResults[0].supported, false);
  assert.equal(authClaim.evidenceSummary.scenarioResults[0].failurePathKeywordsMatched, false);

  const focusedAlignment = authClaim.evidenceSummary.subSignals.find((item) => item.signalId === 'focused-test-alignment');
  assert.ok(focusedAlignment);
  assert.equal(focusedAlignment.mode, 'inferred');
  assert.match(focusedAlignment.facts.join('\n'), /mode reason: matched focused tests via deterministic path\/import\/selector hints/);

  const mutationPressure = authClaim.evidenceSummary.subSignals.find((item) => item.signalId === 'mutation-pressure');
  assert.ok(mutationPressure);
  assert.equal(mutationPressure.level, 'warning');
  assert.equal(mutationPressure.mode, 'explicit');
  assert.match(mutationPressure.summary, /surviving mutant/);

  const scenarioSupport = authClaim.evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.level, 'missing');
  assert.equal(scenarioSupport.mode, 'missing');
  assert.match(scenarioSupport.facts.join('\n'), /expired-boundary: missing failure-path evidence/);
});

test('evaluateInvariants ignores unrelated mjs tests even if they contain the right keywords', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-unrelated-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'other-behavior.test.mjs'), "test('other', () => { const cwd = 'x'; const sessionCtx = {}; const value = undefined; });\n", 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{ id: 'context-has-cwd', description: 'context includes session cwd', keywords: ['cwd', 'sessionCtx'], failurePathKeywords: ['undefined'], expected: 'defined' }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'unsupported');
  assert.match(claims[0].evidence.join('\n'), /No focused test files matched invariant scope/);
  assert.deepEqual(claims[0].evidenceSummary.focusedTests, []);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supported, false);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].keywordsMatched, false);

  const focusedAlignment = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'focused-test-alignment');
  assert.ok(focusedAlignment);
  assert.equal(focusedAlignment.level, 'missing');
  assert.equal(focusedAlignment.mode, 'missing');
  assert.match(focusedAlignment.summary, /No focused test files aligned/);

  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.mode, 'missing');
});

test('evaluateInvariants accepts focused mjs tests aligned to the impacted file', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-focused-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'trigger-editor.test.mjs'), [
    "import assert from 'node:assert/strict';",
    "test('TriggerEditor context', () => { const cwd = 'x'; const sessionCtx = { cwd }; const value = undefined; assert.equal(sessionCtx.cwd, cwd); assert.equal(value, undefined); });",
    ''
  ].join('\n'), 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{ id: 'context-has-cwd', description: 'context includes session cwd', keywords: ['cwd', 'sessionCtx'], failurePathKeywords: ['undefined'], expected: 'defined' }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'lexically-supported');
  assert.match(claims[0].evidence.join('\n'), /Focused tests with deterministic lexical alignment: tests\/trigger-editor.test.mjs/);
  assert.equal(claims[0].evidenceSummary.evidenceSemantics, 'deterministic-lexical');
  assert.match(claims[0].evidenceSummary.evidenceSemanticsSummary, /not execution-backed behavioral proof/);
  assert.deepEqual(claims[0].evidenceSummary.focusedTests, ['tests/trigger-editor.test.mjs']);
  assert.equal(claims[0].evidenceSummary.changedFunctions.length, 1);
  assert.equal(claims[0].evidenceSummary.maxChangedCrap, 1);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supported, true);

  const focusedAlignment = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'focused-test-alignment');
  assert.ok(focusedAlignment);
  assert.equal(focusedAlignment.level, 'clear');
  assert.equal(focusedAlignment.mode, 'inferred');

  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.level, 'clear');
  assert.equal(scenarioSupport.mode, 'inferred');
});

test('evaluateInvariants requires assertion-bearing focused tests for lexical support', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-assertion-aware-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'trigger-editor.test.mjs'), "test('TriggerEditor context', () => { const cwd = 'x'; const sessionCtx = { cwd }; const value = undefined; });\n", 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{ id: 'context-has-cwd', description: 'context includes session cwd', keywords: ['cwd', 'sessionCtx'], failurePathKeywords: ['undefined'], expected: 'defined' }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'unsupported');
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].keywordsMatched, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].failurePathKeywordsMatched, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].assertionMatched, false);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supportGap, 'missing-assertion');
  assert.match(claims[0].evidence.join('\n'), /assertion-like check anchored them/);

  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.level, 'missing');
  assert.equal(scenarioSupport.mode, 'missing');
  assert.match(scenarioSupport.facts.join('\n'), /no assertion-like check anchored them/);
});

test('evaluateInvariants requires a single focused test witness for a scenario', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-split-witness-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'trigger-editor-happy.test.mjs'), "test('happy', () => { const cwd = 'x'; const sessionCtx = {}; });\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'trigger-editor-failure.test.mjs'), "test('failure', () => { const value = undefined; });\n", 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{ id: 'context-has-cwd', description: 'context includes session cwd', keywords: ['cwd', 'sessionCtx'], failurePathKeywords: ['undefined'], expected: 'defined' }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'unsupported');
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].keywordsMatched, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].failurePathKeywordsMatched, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supported, false);
  assert.match(claims[0].evidence.join('\n'), /Missing deterministic lexical test evidence/);
  assert.match(claims[0].evidence.join('\n'), /split across focused test cases/);

  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.level, 'missing');
  assert.equal(scenarioSupport.mode, 'missing');
  assert.match(scenarioSupport.facts.join('\n'), /split across focused test cases/);
});

test('evaluateInvariants does not stitch lexical support across separate test cases in one file', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-split-cases-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'trigger-editor.test.mjs'), [
    "test('happy', () => { const cwd = 'x'; const sessionCtx = {}; });",
    "test('failure', () => { const value = undefined; });",
    ''
  ].join('\n'), 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{ id: 'context-has-cwd', description: 'context includes session cwd', keywords: ['cwd', 'sessionCtx'], failurePathKeywords: ['undefined'], expected: 'defined' }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'unsupported');
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].keywordsMatched, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].failurePathKeywordsMatched, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supported, false);
  assert.match(claims[0].evidence.join('\n'), /split across focused test cases/);

  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.level, 'missing');
  assert.equal(scenarioSupport.mode, 'missing');
  assert.match(scenarioSupport.facts.join('\n'), /split across focused test cases/);
});

test('evaluateInvariants accepts execution-backed witnesses without focused tests', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-execution-witness-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.ts-quality', 'witnesses'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'witnesses', 'context-has-cwd.json'), JSON.stringify({
    version: '1',
    kind: 'execution-witness',
    invariantId: 'trigger-editor.session-context',
    scenarioId: 'context-has-cwd',
    status: 'pass',
    sourceFiles: ['src/TriggerEditor.js'],
    testFiles: ['tests/runtime-witness.test.mjs'],
    observedAt: '2026-04-21T00:00:00.000Z'
  }, null, 2), 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{
        id: 'context-has-cwd',
        description: 'context includes session cwd',
        keywords: ['cwd', 'sessionCtx'],
        failurePathKeywords: ['undefined'],
        executionWitnessPatterns: ['.ts-quality/witnesses/*.json'],
        expected: 'defined'
      }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'supported');
  assert.deepEqual(claims[0].evidence, ['Execution witness artifacts: .ts-quality/witnesses/context-has-cwd.json']);
  assert.equal(claims[0].evidenceSummary.evidenceSemantics, 'execution-backed');
  assert.match(claims[0].evidenceSummary.evidenceSemanticsSummary, /execution-backed witness artifacts/);
  assert.deepEqual(claims[0].evidenceSummary.executionWitnessFiles, ['.ts-quality/witnesses/context-has-cwd.json']);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supported, true);
  assert.equal(claims[0].evidenceSummary.scenarioResults[0].supportKind, 'execution-witness');
  const executionWitness = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'execution-witness');
  assert.ok(executionWitness);
  assert.equal(executionWitness.mode, 'explicit');
  assert.equal(executionWitness.level, 'clear');
  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.match(scenarioSupport.summary, /execution-backed support/);
});

test('evaluateInvariants rejects execution witnesses that do not cover impacted files', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-execution-witness-scope-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.ts-quality', 'witnesses'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, '.ts-quality', 'witnesses', 'context-has-cwd.json'), JSON.stringify({
    version: '1',
    kind: 'execution-witness',
    invariantId: 'trigger-editor.session-context',
    scenarioId: 'context-has-cwd',
    status: 'pass',
    sourceFiles: ['src/OtherFile.js']
  }, null, 2), 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      scenarios: [{
        id: 'context-has-cwd',
        description: 'context includes session cwd',
        keywords: ['cwd', 'sessionCtx'],
        executionWitnessPatterns: ['.ts-quality/witnesses/*.json'],
        expected: 'defined'
      }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'unsupported');
  assert.match(claims[0].evidence.join('\n'), /Missing execution-backed or deterministic lexical test evidence/);
  assert.equal(claims[0].evidenceSummary.evidenceSemantics, 'deterministic-lexical');
  const executionWitness = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'execution-witness');
  assert.ok(executionWitness);
  assert.equal(executionWitness.mode, 'missing');
});

test('evaluateInvariants marks requiredTestPatterns evidence as explicit', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-invariants-explicit-'));
  fs.mkdirSync(path.join(rootDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'TriggerEditor.js'), 'export function getContext() { return true; }\n', 'utf8');
  fs.writeFileSync(path.join(rootDir, 'tests', 'behavior-proof.test.mjs'), [
    "import assert from 'node:assert/strict';",
    "test('proof', () => { const cwd = 'x'; const sessionCtx = { cwd }; const value = undefined; assert.equal(sessionCtx.cwd, cwd); assert.equal(value, undefined); });",
    ''
  ].join('\n'), 'utf8');

  const claims = invariants.evaluateInvariants({
    rootDir,
    invariants: [{
      id: 'trigger-editor.session-context',
      title: 'Session context propagation',
      description: 'TriggerEditor must propagate cwd and sessionKey to context.',
      severity: 'medium',
      selectors: ['path:src/TriggerEditor.js', 'symbol:getContext'],
      requiredTestPatterns: ['tests/behavior-proof.test.mjs'],
      scenarios: [{ id: 'context-has-cwd', description: 'context includes session cwd', keywords: ['cwd', 'sessionCtx'], failurePathKeywords: ['undefined'], expected: 'defined' }]
    }],
    changedFiles: ['src/TriggerEditor.js'],
    changedRegions: [],
    complexity: [{ kind: 'complexity', filePath: 'src/TriggerEditor.js', symbol: 'function:getContext', span: { startLine: 1, endLine: 1 }, complexity: 1, coveragePct: 100, crap: 1, changed: true }],
    mutationSites: [],
    mutations: [],
    testPatterns: ['tests/**/*.mjs']
  });

  assert.equal(claims[0].status, 'lexically-supported');
  assert.equal(claims[0].evidenceSummary.evidenceSemantics, 'deterministic-lexical');
  assert.deepEqual(claims[0].evidenceSummary.focusedTests, ['tests/behavior-proof.test.mjs']);

  const focusedAlignment = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'focused-test-alignment');
  assert.ok(focusedAlignment);
  assert.equal(focusedAlignment.mode, 'explicit');
  assert.match(focusedAlignment.facts.join('\n'), /requiredTestPatterns/);

  const scenarioSupport = claims[0].evidenceSummary.subSignals.find((item) => item.signalId === 'scenario-support');
  assert.ok(scenarioSupport);
  assert.equal(scenarioSupport.mode, 'explicit');
  assert.match(scenarioSupport.facts.join('\n'), /explicit requiredTestPatterns/);
});
