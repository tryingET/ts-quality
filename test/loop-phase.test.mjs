import test from 'node:test';
import assert from 'assert/strict';
import { EXIT_BLOCKED, classifyFile, parsePorcelain, planImpact, runPhase } from '../scripts/loop-phase.mjs';

/**
 * @param {string} phase
 * @param {{ changedFiles?: string[] | null, env?: NodeJS.ProcessEnv, exitCodes?: Record<string, number> }} [options]
 */
function drive(phase, options = {}) {
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const executed = [];
  const exitCode = runPhase(phase, {
    changedFiles: options.changedFiles === undefined ? [] : options.changedFiles,
    env: options.env ?? {},
    log: (line) => lines.push(line),
    exec: (check) => {
      const rendered = [check.command, ...check.args].join(' ');
      executed.push(rendered);
      return options.exitCodes?.[rendered] ?? 0;
    }
  });
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of lines) {
    const separator = line.indexOf('=');
    if (separator > 0 && !line.startsWith('run=')) {
      fields[line.slice(0, separator)] = line.slice(separator + 1);
    }
  }
  return { exitCode, lines, executed, fields };
}

test('impact classification uses bounded, expanded, and wide tiers', () => {
  assert.equal(classifyFile('docs/engineering.local.md'), 'bounded');
  assert.equal(classifyFile('README.md'), 'bounded');
  assert.equal(classifyFile('test/loop-phase.test.mjs'), 'expanded');
  assert.equal(classifyFile('policy/engineering-lane.json'), 'expanded');
  assert.equal(classifyFile('.ontology/ontology.db'), 'expanded');
  assert.equal(classifyFile('package.json'), 'wide');
  assert.equal(classifyFile('tsconfig.scripts-check.json'), 'wide');
  assert.equal(classifyFile('scripts/loop-phase.mjs'), 'wide');
  assert.equal(classifyFile('packages/ts-quality/src/cli.ts'), 'wide');
  assert.equal(classifyFile('examples/artifacts/governed-app/run.json'), 'wide');
});

test('impact plan escalates to the highest tier and names checks and next command', () => {
  const bounded = planImpact(['docs/a.md']);
  assert.equal(bounded.impact, 'bounded');
  assert.equal(bounded.next, 'npm run loop-impact-run');

  const expanded = planImpact(['docs/a.md', 'test/x.test.mjs']);
  assert.equal(expanded.impact, 'expanded');
  assert.deepEqual(expanded.checks.map((check) => check.args[1]), ['typecheck', 'lint', 'test']);

  const wide = planImpact(['docs/a.md', 'scripts/verify.mjs']);
  assert.equal(wide.impact, 'wide');
  assert.match(wide.next, /LOOP_WIDE_REASON=.* npm run loop-impact-wide/);

  assert.equal(planImpact([]).reason, 'no changed files');
});

test('porcelain parsing keeps both sides of renames and untracked files', () => {
  const output = ['R  docs/new.md', 'docs/old.md', ' M AGENTS.md', '?? .ontology/ontology.db', ''].join('\0');
  assert.deepEqual(parsePorcelain(output), ['.ontology/ontology.db', 'AGENTS.md', 'docs/new.md', 'docs/old.md']);
});

test('loop-doctor is diagnostic and never runs checks', () => {
  const run = drive('doctor', { changedFiles: ['AGENTS.md'] });
  assert.equal(run.exitCode, 0);
  assert.equal(run.fields['result'], 'diagnostic');
  assert.equal(run.fields['dirty'], 'AGENTS.md');
  assert.deepEqual(run.executed, []);
});

test('loop-verify-fast names its slice and reports failures', () => {
  const passed = drive('verify-fast');
  assert.match(passed.fields['scope'] ?? '', /node:test suite/);
  assert.equal(passed.fields['result'], 'passed');

  const failed = drive('verify-fast', { exitCodes: { 'npm run test --silent': 1 } });
  assert.equal(failed.exitCode, 1);
  assert.equal(failed.fields['result'], 'failed');
  assert.equal(failed.fields['failed'], 'npm run test --silent');
});

test('loop-impact-plan reports impact without executing checks', () => {
  const run = drive('impact-plan', { changedFiles: ['package.json'] });
  assert.equal(run.exitCode, 0);
  assert.equal(run.fields['impact'], 'wide');
  assert.equal(run.fields['checks'], 'npm run verify');
  assert.deepEqual(run.executed, []);
});

test('loop-impact-run refuses wide plans and runs selected bounded/expanded checks', () => {
  const refused = drive('impact-run', { changedFiles: ['scripts/verify.mjs'] });
  assert.equal(refused.exitCode, EXIT_BLOCKED);
  assert.equal(refused.fields['result'], 'blocked');
  assert.deepEqual(refused.executed, []);

  const bounded = drive('impact-run', { changedFiles: ['docs/a.md'] });
  assert.equal(bounded.fields['result'], 'passed');
  assert.deepEqual(bounded.executed, ['npm run lint --silent']);

  const expanded = drive('impact-run', { changedFiles: ['test/x.test.mjs'], exitCodes: { 'npm run lint --silent': 1 } });
  assert.equal(expanded.exitCode, 1);
  assert.deepEqual(expanded.executed, ['npm run typecheck --silent', 'npm run lint --silent']);
});

test('loop-impact-plan and loop-impact-run block when changed files cannot be determined', () => {
  for (const phase of ['impact-plan', 'impact-run']) {
    const run = drive(phase, { changedFiles: null });
    assert.equal(run.exitCode, EXIT_BLOCKED);
    assert.equal(run.fields['result'], 'blocked');
    assert.deepEqual(run.executed, []);
  }
  const doctor = drive('doctor', { changedFiles: null });
  assert.equal(doctor.exitCode, 0);
  assert.match(doctor.fields['blockers'] ?? '', /git status unavailable/);
});

test('loop-impact-wide requires an acceptance reason before running verify', () => {
  const refused = drive('impact-wide', { env: { LOOP_WIDE_REASON: '  ' } });
  assert.equal(refused.exitCode, EXIT_BLOCKED);
  assert.equal(refused.fields['result'], 'blocked');
  assert.deepEqual(refused.executed, []);

  const accepted = drive('impact-wide', { env: { LOOP_WIDE_REASON: 'scripts changed' } });
  assert.equal(accepted.exitCode, 0);
  assert.equal(accepted.fields['accepted'], 'scripts changed');
  assert.deepEqual(accepted.executed, ['npm run verify']);
});

test('loop-landing-check names its gate and the remaining handoff', () => {
  const run = drive('landing-check');
  assert.equal(run.exitCode, 0);
  assert.equal(run.fields['gate'], 'npm run verify');
  assert.match(run.fields['handoff'] ?? '', /AK task/);
  assert.match(run.fields['handoff'] ?? '', /release approval/);
  assert.deepEqual(run.executed, ['npm run verify']);
});

test('unknown phases are refused', () => {
  const run = drive('ship-it');
  assert.equal(run.exitCode, EXIT_BLOCKED);
  assert.deepEqual(run.executed, []);
});
