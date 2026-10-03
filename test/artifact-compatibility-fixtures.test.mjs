import fs from 'fs';
import os from 'os';
import path from 'path';
import test, { after } from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';
import { distModule, repoRoot, tempCopyOfFixture } from './helpers.mjs';

const fixtureRoot = path.join(repoRoot, 'fixtures', 'artifact-compatibility');
const historicalGovernedAppRunId = '2026-03-17T12-36-47-952Z';
const historicalGovernedAppRunPath = path.join(repoRoot, 'fixtures', 'governed-app', '.ts-quality', 'runs', historicalGovernedAppRunId, 'run.json');
const manifest = readFixtureJson('manifest.json');
// Only roots created by this invocation are registered. All child processes are
// synchronous, so module teardown runs after their use, including test failures.
const ownedFixtureRoots = new Set();
after(() => {
  for (const target of ownedFixtureRoots) {
    fs.rmSync(target, { recursive: true, force: true });
    assert.equal(fs.existsSync(target), false, 'owned fixture root must be removed');
  }
});
// Packaging smoke supplies the fresh tarball's installed CLI; ordinary tests use repo dist.
const cli = process.env.TS_QUALITY_COMPAT_CLI ?? distModule('packages', 'ts-quality', 'src', 'cli.js');
if (process.env.TS_QUALITY_COMPAT_CLI) {
  assert.ok(fs.realpathSync(cli).endsWith(path.join('node_modules', 'ts-quality', 'dist', 'packages', 'ts-quality', 'src', 'cli.js')));
}

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
  // Preserve captured bytes: projections must consume the real packet, not a fresh check.
  fs.copyFileSync(path.join(fixtureRoot, fixture.file), path.join(runDir, 'run.json'));
  fs.writeFileSync(path.join(targetRoot, '.ts-quality', 'latest.json'), `${JSON.stringify({ latestRunId: fixture.runId }, null, 2)}\n`, 'utf8');
  return run;
}

function tempCopyOfArtifactCompatibilityFixture(relativePath) {
  const source = path.join(fixtureRoot, relativePath);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-artifact-compat-'));
  ownedFixtureRoots.add(target);
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function runCli(args, cwd = repoRoot) {
  const root = args[args.indexOf('--root') + 1];
  const runId = args[args.indexOf('--run-id') + 1];
  const packet = path.join(root, '.ts-quality', 'runs', runId, 'run.json');
  const before = fs.readFileSync(packet);
  const result = spawnSync('node', [cli, ...args], { cwd, encoding: 'utf8' });
  assert.deepEqual(fs.readFileSync(packet), before, 'projections must not rewrite captured run.json');
  return result;
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
    'realKineticVitestEsm020',
    'realTsxPnpmVitest020',
    'realJestYarn4020',
    'realBunEsm020'
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
  assert.equal(profiles.realTsxPnpmVitest020.decisionStatus, 'usable');
  assert.equal(profiles.realTsxPnpmVitest020.nextEvidence.kind, 'mutation-survivors');
  assert.deepEqual(profiles.realTsxPnpmVitest020.missingOptionalRunFields, [
    'analysisWarnings',
    'executionWitnesses'
  ]);  assert.equal(profiles.realJestYarn4020.decisionStatus, 'usable');
  assert.equal(profiles.realJestYarn4020.nextEvidence.kind, 'mutation-survivors');
  assert.deepEqual(profiles.realJestYarn4020.missingOptionalRunFields, ['analysisWarnings', 'executionWitnesses']);  assert.equal(profiles.realBunEsm020.decisionStatus, 'usable');
  assert.equal(profiles.realBunEsm020.nextEvidence.kind, 'mutation-survivors');
});

test('checked-in historical governed-app run capture remains projectable through compatibility surfaces', () => {
  const target = tempCopyOfFixture('governed-app');
  ownedFixtureRoots.add(target);
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
  assert.equal(authorization.outcome, fixture.authorizationOutcome);
  assert.match(authorization.reasons.join('\n'), new RegExp(fixture.authorizationReason));
  assert.equal(authorization.evidenceContext?.runId, fixture.runId);
  assert.equal(authorization.evidenceContext?.runOutcome, 'pass');
});

test('CLI projections consume compatible run-artifact fixtures and reject malformed decision snapshots', () => {
  const target = tempCopyOfFixture('governed-app');
  ownedFixtureRoots.add(target);
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

  for (const [id, reason] of [
    ['unsupportedControlPlane', 'unsupported control-plane snapshot schema 999'],
    ['malformedControlPlane', 'malformed control-plane snapshot schema 1: field configPath must be a non-empty string']
  ]) {
    const fixture = fixturesById[id];
    installRunFixture(target, fixture);
    for (const command of ['report', 'explain', 'plan', 'govern', 'authorize']) {
      const args = [command, '--root', target, '--run-id', fixture.runId];
      if (command === 'report') args.push('--json');
      if (command === 'authorize') args.push('--agent', 'release-bot');
      const rejected = runCli(args);
      assert.equal(rejected.status, 1, rejected.stdout);
      assert.ok(rejected.stderr.includes(reason), rejected.stderr);
      assert.match(rejected.stderr, /Re-run ts-quality check/);
      assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'runs', fixture.runId, 'authorize.release-bot.merge.json')), false);
    }
  }
});

test('real TSX/pnpm/Vitest adoption capture remains projectable through compatibility surfaces', () => {
  const fixturesById = Object.fromEntries(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
  const fixture = fixturesById.realTsxPnpmVitest020;
  const target = tempCopyOfArtifactCompatibilityFixture('real-tsx-pnpm-vitest');
  const run = installRunFixture(target, fixture);

  assert.deepEqual(run.changedFiles, ['packages/react/src/index.tsx']);
  assert.ok(run.mutations.length > 0);
  assert.ok(run.mutations.every((result) => result.filePath === 'packages/react/src/index.tsx'));
  assert.equal(run.coverageGeneration.receipt.status, 'pass');

  const report = runCli(['report', '--root', target, '--json', '--run-id', fixture.runId]);
  assert.equal(report.status, 0, report.stderr);
  const reportJson = JSON.parse(report.stdout);
  assert.equal(reportJson.runId, fixture.runId);
  assert.equal(reportJson.verdict.outcome, 'fail');
  assert.equal(reportJson.verdict.mergeConfidence, 62);

  const explain = runCli(['explain', '--root', target, '--run-id', fixture.runId]);
  assert.equal(explain.status, 0, explain.stderr);
  assert.match(explain.stdout, /react\.missing-view-fallback: at-risk/);
  assert.match(explain.stdout, /execution-backed witness artifacts matched the invariant scenario scope/);
  assert.doesNotMatch(explain.stdout, /drift/i);

  const plan = runCli(['plan', '--root', target, '--run-id', fixture.runId]);
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Generated 1 governance step\(s\) from 0 finding\(s\) and 12 mutation result\(s\)/);
  assert.match(plan.stdout, /focused-test-alignment \[clear; mode=inferred\]: 1 focused test file aligned to invariant scope/);

  const govern = runCli(['govern', '--root', target, '--run-id', fixture.runId]);
  assert.equal(govern.status, 0, govern.stderr);
  assert.match(govern.stdout, /Evidence provenance: explicit 5, inferred 1, missing 0/);

  const authorize = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', fixture.runId]);
  assert.equal(authorize.status, 0, authorize.stderr);
  const authorization = JSON.parse(authorize.stdout);
  assert.equal(authorization.outcome, fixture.authorizationOutcome);
  assert.ok(authorization.reasons.includes(fixture.authorizationReason));
  assert.equal(authorization.evidenceContext?.runId, fixture.runId);
  assert.equal(authorization.evidenceContext?.runOutcome, 'fail');
});

test('real Jest/Yarn 4 capture without vendored source projects and fails closed on drift', () => {
  // The third-party source (appmap-node src/config.ts) is deliberately not vendored, so the captured file digest
  // cannot match: decision surfaces must flag run drift instead of trusting the packet.
  const fixturesById = Object.fromEntries(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
  const fixture = fixturesById.realJestYarn4020;
  const target = tempCopyOfArtifactCompatibilityFixture('real-jest-yarn4');
  const run = installRunFixture(target, fixture);

  assert.deepEqual(run.files.map((item) => item.filePath), ['src/config.ts']);
  assert.equal(fs.existsSync(path.join(target, 'src', 'config.ts')), false);
  assert.equal(run.coverageGeneration.receipt.status, 'pass');
  assert.equal(run.mutations.filter((item) => item.status === 'survived').length, 8);

  const report = runCli(['report', '--root', target, '--json', '--run-id', fixture.runId]);
  assert.equal(report.status, 0, report.stderr);
  const projected = JSON.parse(report.stdout);
  assert.equal(projected.verdict.mergeConfidence, 15);
  assert.equal(projected.decisionContext.projection, 'projected');
  assert.ok(projected.decisionContext.drift.some((item) => item.subject.includes('src/config.ts')));

  for (const command of ['explain', 'plan', 'govern']) {
    const projection = runCli([command, '--root', target, '--run-id', fixture.runId]);
    assert.equal(projection.status, 0, projection.stderr);
    assert.match(projection.stdout, /Run drift detected for jest-yarn4-adoption/);
  }

  const authorize = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', fixture.runId]);
  assert.equal(authorize.status, 0, authorize.stderr);
  const authorization = JSON.parse(authorize.stdout);
  assert.equal(authorization.outcome, fixture.authorizationOutcome);
  assert.ok(authorization.reasons.includes(fixture.authorizationReason));
});

test('real Bun/ESM adoption capture remains projectable through compatibility surfaces', () => {
  const fixturesById = Object.fromEntries(manifest.fixtures.map((fixture) => [fixture.id, fixture]));
  const fixture = fixturesById.realBunEsm020;
  const target = tempCopyOfArtifactCompatibilityFixture('real-bun-esm');
  const run = installRunFixture(target, fixture);

  assert.deepEqual(run.files.map((item) => item.filePath), ['src/core/runtime-config.ts']);
  assert.equal(run.files.length, 1, 'compatibility capture is not the ~170-source scale run');
  assert.equal(run.mutations.filter((item) => item.status === 'killed').length, 16);
  assert.equal(run.mutations.filter((item) => item.status === 'survived').length, 9);
  assert.match(run.mutationBaseline.details, /bun test v1\.3\.12 \(700fc117\)/);
  assert.deepEqual(run.coverageGeneration.command.slice(0, 2), ['bun', 'test']);
  assert.equal(run.nextEvidenceAction.evidenceBasis.coverage.fileCount, 1);
  assert.deepEqual(run.nextEvidenceAction.primaryAction.suggestedEditFiles, ['tests/runtime-config.test.ts']);

  const report = runCli(['report', '--root', target, '--json', '--run-id', fixture.runId]);
  assert.equal(report.status, 0, report.stderr);
  assert.equal(JSON.parse(report.stdout).verdict.mergeConfidence, 19);

  for (const command of ['explain', 'plan', 'govern']) {
    const projection = runCli([command, '--root', target, '--run-id', fixture.runId]);
    assert.equal(projection.status, 0, projection.stderr);
    assert.doesNotMatch(projection.stdout, /drift/i);
  }
  const plan = runCli(['plan', '--root', target, '--run-id', fixture.runId]);
  assert.match(plan.stdout, /Evidence provenance: explicit 5, inferred 1, missing 0/);

  const authorize = runCli(['authorize', '--root', target, '--agent', 'release-bot', '--run-id', fixture.runId]);
  assert.equal(authorize.status, 0, authorize.stderr);
  const authorization = JSON.parse(authorize.stdout);
  assert.equal(authorization.outcome, fixture.authorizationOutcome);
  assert.ok(authorization.reasons.includes(fixture.authorizationReason));
});


test('real Bun packet variants tolerate optional fields and reject invalid snapshots across every installed projection', () => {
  const fixture = manifest.fixtures.find((item) => item.id === 'realBunEsm020');
  for (const variant of ['absent-optional', 'future-optional', 'unsupported-snapshot', 'malformed-snapshot']) {
    const target = tempCopyOfArtifactCompatibilityFixture('real-bun-esm');
    const captured = installRunFixture(target, fixture);
    const packet = structuredClone(captured);
    // Deliberate derived negative/additive cases, not claims of additional captured runs.
    if (variant === 'absent-optional') {
      for (const key of ['coverageGeneration', 'analysisWarnings', 'mutationRemediation', 'nextEvidenceAction', 'executionWitnesses']) delete packet[key];
      delete packet.verdict.confidenceBreakdown;
    } else if (variant === 'future-optional') {
      packet.futureOptionalEvidencePacket = { schemaVersion: 999, ignored: true };
      packet.verdict.futureOptionalSignal = 'ignored';
    } else if (variant === 'unsupported-snapshot') {
      packet.controlPlane.schemaVersion = 999;
    } else {
      packet.controlPlane.configPath = '';
    }
    fs.writeFileSync(path.join(target, '.ts-quality', 'runs', fixture.runId, 'run.json'), JSON.stringify(packet));
    for (const command of ['report', 'explain', 'plan', 'govern', 'authorize']) {
      const args = [command, '--root', target, '--run-id', fixture.runId];
      if (command === 'report') args.push('--json');
      if (command === 'authorize') args.push('--agent', 'release-bot');
      const result = runCli(args);
      if (variant.endsWith('snapshot')) {
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stderr, /(?:unsupported|malformed) control-plane snapshot/);
        assert.match(result.stderr, /Re-run ts-quality check/);
        assert.equal(fs.existsSync(path.join(target, '.ts-quality', 'runs', fixture.runId, 'authorize.release-bot.merge.json')), false);
      } else {
        assert.equal(result.status, 0, result.stderr);
        if (command === 'report') {
          const projected = JSON.parse(result.stdout);
          assert.equal(projected.runId, captured.runId);
          assert.equal(projected.version, captured.version);
          assert.equal(projected.verdict.mergeConfidence, captured.verdict.mergeConfidence);
          assert.equal(projected.verdict.outcome, captured.verdict.outcome);
          assert.deepEqual(projected.decisionContext.drift, []);
          if (variant === 'absent-optional') assert.equal(projected.coverageGeneration, undefined);
          if (variant === 'future-optional') assert.deepEqual(projected.futureOptionalEvidencePacket, packet.futureOptionalEvidencePacket);
        } else if (command === 'authorize') {
          const decision = JSON.parse(result.stdout);
          assert.equal(decision.outcome, fixture.authorizationOutcome);
          assert.ok(decision.reasons.includes(fixture.authorizationReason));
          assert.equal(decision.evidenceContext.runId, captured.runId);
        } else {
          assert.doesNotMatch(result.stdout, /Run drift detected/);
        }
      }
    }
  }
});
