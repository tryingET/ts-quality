import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { distModule, repoRoot, tempCopyOfFixture } from './helpers.mjs';

const fixtureRoot = path.join(repoRoot, 'fixtures', 'artifact-compatibility');
const historicalGovernedAppRunId = '2026-03-17T12-36-47-952Z';
const historicalGovernedAppRunPath = path.join(repoRoot, 'fixtures', 'governed-app', '.ts-quality', 'runs', historicalGovernedAppRunId, 'run.json');
const manifest = readFixtureJson('manifest.json');
const cli = distModule('packages', 'ts-quality', 'src', 'cli.js');

function readFixtureJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8'));
}

function hasPathSegments(value, segments) {
  if (segments.length === 0) {
    return true;
  }
  const [segment, ...remaining] = segments;
  if (!segment) {
    return false;
  }
  if (segment.endsWith('[]')) {
    const key = segment.slice(0, -2);
    if (value == null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key) || !Array.isArray(value[key])) {
      return false;
    }
    return value[key].some((item) => hasPathSegments(item, remaining));
  }
  if (value == null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, segment)) {
    return false;
  }
  return hasPathSegments(value[segment], remaining);
}

function hasPath(value, dottedPath) {
  return hasPathSegments(value, dottedPath.split('.'));
}

function missingFields(value, fields) {
  return fields.filter((field) => !hasPath(value, field));
}

function consumerProfile(run) {
  assert.equal(run && typeof run, 'object');
  assert.equal(typeof run.runId, 'string');
  assert.equal(typeof run.version, 'string');
  assert.ok(Array.isArray(run.changedFiles));
  assert.ok(Array.isArray(run.behaviorClaims));
  assert.equal(typeof run.verdict?.outcome, 'string');

  const profile = {
    runId: run.runId,
    version: run.version,
    missingOptionalRunFields: missingFields(run, manifest.expectedOptionalRunFields),
    unknownFutureFieldsIgnored: Object.keys(run).filter((key) => key.startsWith('futureOptional')).sort(),
    nextEvidence: undefined,
    decisionStatus: 'usable',
    failClosedReason: undefined
  };

  if (run.nextEvidenceAction) {
    assert.equal(typeof run.nextEvidenceAction.primaryAction?.kind, 'string');
    assert.equal(typeof run.nextEvidenceAction.primaryAction?.title, 'string');
    profile.nextEvidence = {
      kind: run.nextEvidenceAction.primaryAction.kind,
      title: run.nextEvidenceAction.primaryAction.title,
      missingOptionalFields: missingFields(run, manifest.expectedOptionalNextEvidenceFields)
    };
  }

  const snapshot = run.controlPlane;
  if (!snapshot) {
    profile.decisionStatus = 'display-only';
    profile.failClosedReason = 'control-plane snapshot not provided; do not infer governance or authorization proof';
    return profile;
  }
  if (snapshot.schemaVersion !== 1) {
    profile.decisionStatus = 'fail-closed';
    profile.failClosedReason = `unsupported control-plane snapshot schema ${String(snapshot.schemaVersion)}`;
    return profile;
  }
  for (const field of ['configPath', 'configDigest', 'constitutionPath', 'constitutionDigest', 'agentsPath', 'agentsDigest']) {
    if (typeof snapshot[field] !== 'string' || snapshot[field].length === 0) {
      profile.decisionStatus = 'fail-closed';
      profile.failClosedReason = `malformed control-plane snapshot: field ${field} must be a non-empty string`;
      return profile;
    }
  }
  return profile;
}

function installRunFixture(targetRoot, fixture) {
  const run = readFixtureJson(fixture.file);
  assert.equal(run.runId, fixture.runId);
  const runDir = path.join(targetRoot, '.ts-quality', 'runs', fixture.runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(targetRoot, '.ts-quality', 'latest.json'), `${JSON.stringify({ latestRunId: fixture.runId }, null, 2)}\n`, 'utf8');
  return run;
}

function tempCopyOfArtifactCompatibilityFixture(relativePath) {
  const source = path.join(fixtureRoot, relativePath);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-artifact-compat-'));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function runCli(args, cwd = repoRoot) {
  return spawnSync('node', [cli, ...args], { cwd, encoding: 'utf8' });
}

test('run-artifact compatibility fixtures encode parser policy for legacy, additive, and fail-closed packet shapes', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.source, 'examples/artifacts/governed-app/run.json');
  assert.deepEqual(manifest.fixtures.map((fixture) => fixture.id), [
    'current020',
    'legacy010',
    'futureAdditive020',
    'nextEvidenceMinimal020',
    'unsupportedControlPlane',
    'malformedControlPlane',
    'realKineticVitestEsm020'
  ]);

  const profiles = Object.fromEntries(manifest.fixtures.map((fixture) => {
    const run = readFixtureJson(fixture.file);
    assert.equal(run.runId, fixture.runId);
    assert.equal(run.version, fixture.version);
    return [fixture.id, consumerProfile(run)];
  }));

  assert.deepEqual(profiles.current020.missingOptionalRunFields, [
    'coverageGeneration',
    'analysisWarnings',
    'executionWitnesses'
  ]);
  assert.equal(profiles.current020.decisionStatus, 'usable');
  assert.equal(profiles.current020.nextEvidence.kind, 'mutation-survivors');
  assert.deepEqual(profiles.current020.nextEvidence.missingOptionalFields, []);
  assert.deepEqual(profiles.legacy010.missingOptionalRunFields, manifest.expectedOptionalRunFields);
  assert.equal(profiles.legacy010.decisionStatus, 'display-only');
  assert.match(profiles.legacy010.failClosedReason, /control-plane snapshot not provided/);
  assert.deepEqual(profiles.futureAdditive020.unknownFutureFieldsIgnored, ['futureOptionalEvidencePacket']);
  assert.equal(profiles.futureAdditive020.decisionStatus, 'usable');
  assert.deepEqual(profiles.nextEvidenceMinimal020.nextEvidence.missingOptionalFields, manifest.expectedOptionalNextEvidenceFields);
  assert.equal(profiles.nextEvidenceMinimal020.nextEvidence.kind, 'mutation-survivors');
  assert.equal(profiles.unsupportedControlPlane.decisionStatus, 'fail-closed');
  assert.match(profiles.unsupportedControlPlane.failClosedReason, /unsupported control-plane snapshot schema 999/);
  assert.equal(profiles.malformedControlPlane.decisionStatus, 'fail-closed');
  assert.match(profiles.malformedControlPlane.failClosedReason, /field configPath must be a non-empty string/);
  assert.equal(profiles.realKineticVitestEsm020.decisionStatus, 'usable');
  assert.equal(profiles.realKineticVitestEsm020.nextEvidence.kind, 'none');
  assert.deepEqual(profiles.realKineticVitestEsm020.missingOptionalRunFields, [
    'analysisWarnings',
    'mutationRemediation',
    'executionWitnesses'
  ]);
});

test('checked-in historical governed-app run capture remains projectable through compatibility surfaces', () => {
  const target = tempCopyOfFixture('governed-app');
  const historicalRun = JSON.parse(fs.readFileSync(historicalGovernedAppRunPath, 'utf8'));
  assert.equal(historicalRun.runId, historicalGovernedAppRunId);
  assert.equal(historicalRun.version, '5.0.0');
  assert.equal(historicalRun.controlPlane, undefined);
  assert.equal(historicalRun.nextEvidenceAction, undefined);

  const report = runCli(['report', '--root', target, '--json', '--run-id', historicalGovernedAppRunId]);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).runId, historicalGovernedAppRunId);

  const explain = runCli(['explain', '--root', target, '--run-id', historicalGovernedAppRunId]);
  assert.equal(explain.status, 0, explain.stderr);
  assert.match(explain.stdout, /Reasons:/);

  const plan = runCli(['plan', '--root', target, '--run-id', historicalGovernedAppRunId]);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);

  const govern = runCli(['govern', '--root', target, '--run-id', historicalGovernedAppRunId]);
  assert.equal(govern.status, 0, govern.stderr);
  assert.match(govern.stdout, /auth-risk-budget/);

  const authorize = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', historicalGovernedAppRunId]);
  assert.equal(authorize.status, 0, authorize.stderr);
  assert.equal(JSON.parse(authorize.stdout).evidenceContext?.runId, historicalGovernedAppRunId);
});

test('real target-shape adoption capture remains projectable through compatibility surfaces', () => {
  const fixturesById = Object.fromEntries(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
  const fixture = fixturesById.realKineticVitestEsm020;
  const target = tempCopyOfArtifactCompatibilityFixture('real-kinetic-vitest-esm');
  installRunFixture(target, fixture);

  const report = runCli(['report', '--root', target, '--json', '--run-id', fixture.runId]);
  assert.equal(report.status, 0, report.stderr);
  const reportJson = JSON.parse(report.stdout);
  assert.equal(reportJson.runId, fixture.runId);
  assert.equal(reportJson.verdict.outcome, 'pass');
  assert.equal(reportJson.verdict.mergeConfidence, 90);

  const explain = runCli(['explain', '--root', target, '--run-id', fixture.runId]);
  assert.equal(explain.status, 0, explain.stderr);
  assert.match(explain.stdout, /segmentation\.readable-bursts/);
  assert.match(explain.stdout, /execution-backed witness matched/);

  const plan = runCli(['plan', '--root', target, '--run-id', fixture.runId]);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Generated 0 governance step\(s\)/);
  assert.match(plan.stdout, /Invariant evidence at risk: segmentation\.readable-bursts/);

  const govern = runCli(['govern', '--root', target, '--run-id', fixture.runId]);
  assert.equal(govern.status, 0, govern.stderr);
  assert.match(govern.stdout, /Evidence provenance: explicit 5, inferred 1, missing 0/);

  const authorize = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', fixture.runId]);
  assert.equal(authorize.status, 0, authorize.stderr);
  const authorization = JSON.parse(authorize.stdout);
  assert.equal(authorization.evidenceContext?.runId, fixture.runId);
  assert.equal(authorization.evidenceContext?.runOutcome, 'pass');
});

test('CLI projections consume compatible run-artifact fixtures and reject malformed decision snapshots', () => {
  const target = tempCopyOfFixture('governed-app');
  const fixturesById = Object.fromEntries(manifest.fixtures.map((fixture) => [fixture.id, fixture]));

  for (const id of ['current020', 'legacy010', 'futureAdditive020', 'nextEvidenceMinimal020']) {
    const fixture = fixturesById[id];
    installRunFixture(target, fixture);

    const report = runCli(['report', '--root', target, '--json', '--run-id', fixture.runId]);
    assert.equal(report.status, 0, report.stderr);
    assert.equal(JSON.parse(report.stdout).runId, fixture.runId);

    const explain = runCli(['explain', '--root', target, '--run-id', fixture.runId]);
    assert.equal(explain.status, 0, explain.stderr);
    assert.match(explain.stdout, /Reasons:/);

    const plan = runCli(['plan', '--root', target, '--run-id', fixture.runId]);
    assert.equal(plan.status, 0, plan.stderr);
    assert.match(plan.stdout, /Invariant evidence at risk: auth\.refresh\.validity/);

    const govern = runCli(['govern', '--root', target, '--run-id', fixture.runId]);
    assert.equal(govern.status, 0, govern.stderr);
    assert.match(govern.stdout, /auth-risk-budget/);

    const authorize = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', fixture.runId]);
    assert.equal(authorize.status, 0, authorize.stderr);
    assert.equal(JSON.parse(authorize.stdout).evidenceContext?.runId, fixture.runId);
  }

  installRunFixture(target, fixturesById.unsupportedControlPlane);
  const unsupported = runCli(['plan', '--root', target, '--run-id', fixturesById.unsupportedControlPlane.runId]);
  assert.equal(unsupported.status, 1);
  assert.match(unsupported.stderr, /unsupported control-plane snapshot schema 999/);
  assert.match(unsupported.stderr, /Re-run ts-quality check/);

  installRunFixture(target, fixturesById.malformedControlPlane);
  const malformed = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', fixturesById.malformedControlPlane.runId]);
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /malformed control-plane snapshot schema 1: field configPath must be a non-empty string/);
  assert.match(malformed.stderr, /Re-run ts-quality check/);
});
