// @ts-check

// Repo-local implementation of the engineering-core repo-loop-validation-v1 phases.
// Contract: docs/engineering.local.md#repo-loop-validation.

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

/** @typedef {'bounded' | 'expanded' | 'wide'} Impact */
/** @typedef {'passed' | 'failed' | 'blocked' | 'diagnostic' | 'not-run'} LoopResult */
/** @typedef {{ command: string, args: string[] }} Check */
/** @typedef {{ impact: Impact, next: string, reason: string, checks: Check[], changedFiles: string[] }} ImpactPlan */
/** @typedef {(check: Check) => number} Exec */
/** @typedef {{ changedFiles?: string[] | null, env?: NodeJS.ProcessEnv, exec?: Exec, log?: (line: string) => void, root?: string }} PhaseOptions */

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..');

export const LOOP_PHASES = ['doctor', 'verify-fast', 'impact-plan', 'impact-run', 'impact-wide', 'landing-check'];
export const EXIT_BLOCKED = 2;

const AUTHORITY_BOUNDARY =
  'loop evidence only; AK task/evidence/decision, CI, release approval, package publication, merge approval, and production activation stay outside this command';

/** @param {string} script */
function npmRun(script) {
  return { command: 'npm', args: ['run', script, '--silent'] };
}

/** @param {Check} check */
export function formatCheck(check) {
  return [check.command, ...check.args].join(' ');
}

const TYPECHECK = npmRun('typecheck');
const LINT = npmRun('lint');
const TEST = npmRun('test');
const VERIFY = { command: 'npm', args: ['run', 'verify'] };

/** Surfaces that feed build output, generated sample artifacts, or packaging; only the root verify gate covers them. */
const WIDE_PATTERNS = [
  /^package(-lock)?\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^scripts\//,
  /^packages\//,
  /^fixtures\//,
  /^examples\//
];

/** Prose-only surfaces; the repo lint scans them for banned markers. */
const BOUNDED_PATTERNS = [/^docs\//, /^diary\//, /\.md$/];

/** @param {string} file @returns {Impact} */
export function classifyFile(file) {
  if (WIDE_PATTERNS.some((pattern) => pattern.test(file))) {
    return 'wide';
  }
  if (BOUNDED_PATTERNS.some((pattern) => pattern.test(file))) {
    return 'bounded';
  }
  // Tests, policy, and anything unrecognised: fail toward the typecheck/lint/test tier.
  return 'expanded';
}

/** @type {Record<Impact, number>} */
const IMPACT_RANK = { bounded: 0, expanded: 1, wide: 2 };

/**
 * @param {string[]} changedFiles
 * @returns {ImpactPlan}
 */
export function planImpact(changedFiles) {
  /** @type {Impact} */
  let impact = 'bounded';
  for (const file of changedFiles) {
    const fileImpact = classifyFile(file);
    if (IMPACT_RANK[fileImpact] > IMPACT_RANK[impact]) {
      impact = fileImpact;
    }
  }
  if (impact === 'wide') {
    return {
      impact,
      changedFiles,
      next: 'LOOP_WIDE_REASON="<why>" npm run loop-impact-wide',
      reason: 'build, script, package source, fixture, or artifact surface changed; only the root verify gate covers it',
      checks: [VERIFY]
    };
  }
  if (impact === 'expanded') {
    return {
      impact,
      changedFiles,
      next: 'npm run loop-impact-run',
      reason: 'test, policy, or unclassified non-prose surface changed',
      checks: [TYPECHECK, LINT, TEST]
    };
  }
  return {
    impact,
    changedFiles,
    next: 'npm run loop-impact-run',
    reason: changedFiles.length === 0 ? 'no changed files' : 'prose-only surface changed',
    checks: [LINT]
  };
}

/**
 * Parses `git status --porcelain=v1 -z --untracked-files=all` output; renames contribute both paths.
 * @param {string} output
 * @returns {string[]}
 */
export function parsePorcelain(output) {
  const entries = output.split('\0');
  /** @type {Set<string>} */
  const files = new Set();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? '';
    if (entry.length < 4) {
      continue;
    }
    const status = entry.slice(0, 2);
    files.add(entry.slice(3));
    if (status.includes('R') || status.includes('C')) {
      index += 1;
      const source = entries[index];
      if (source) {
        files.add(source);
      }
    }
  }
  return [...files].sort();
}

/** @param {string} root @returns {string[] | null} */
function gitChangedFiles(root) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    return null;
  }
  return parsePorcelain(result.stdout);
}

/** @param {string} root @returns {Exec} */
function defaultExec(root) {
  return (check) => {
    const result = spawnSync(check.command, check.args, { cwd: root, stdio: 'inherit' });
    return result.status ?? 1;
  };
}

/**
 * @param {(line: string) => void} log
 * @param {Record<string, string>} fields
 */
function emit(log, fields) {
  for (const [key, value] of Object.entries(fields)) {
    log(`${key}=${value}`);
  }
}

/**
 * @param {Check[]} checks
 * @param {Exec} exec
 * @param {(line: string) => void} log
 * @returns {{ result: LoopResult, failed: string | null }}
 */
function runChecks(checks, exec, log) {
  for (const check of checks) {
    log(`run=${formatCheck(check)}`);
    if (exec(check) !== 0) {
      return { result: 'failed', failed: formatCheck(check) };
    }
  }
  return { result: 'passed', failed: null };
}

/** @param {LoopResult} result */
function exitCodeFor(result) {
  if (result === 'passed' || result === 'diagnostic') {
    return 0;
  }
  return result === 'blocked' ? EXIT_BLOCKED : 1;
}

/**
 * @param {string} phase
 * @param {PhaseOptions} [options]
 * @returns {number} process exit code
 */
export function runPhase(phase, options = {}) {
  const root = options.root ?? defaultRoot;
  const env = options.env ?? process.env;
  const exec = options.exec ?? defaultExec(root);
  const log = options.log ?? ((line) => console.log(line));
  const command = `loop-${phase}`;

  if (!LOOP_PHASES.includes(phase)) {
    log(`loop-phase: unknown phase "${phase}"; expected one of ${LOOP_PHASES.join(', ')}`);
    return EXIT_BLOCKED;
  }

  // `null` means git status is unavailable; omit the option to read it from git.
  const changedFiles = options.changedFiles !== undefined ? options.changedFiles : gitChangedFiles(root);
  log(`${command}: ts-quality repo-loop-validation-v1`);
  emit(log, { phase: command });

  if (phase === 'doctor') {
    /** @type {string[]} */
    const blockers = [];
    if (!fs.existsSync(path.join(root, 'node_modules'))) {
      blockers.push('node_modules missing; run npm ci');
    }
    if (changedFiles === null) {
      blockers.push('git status unavailable');
    }
    emit(log, {
      node: process.version,
      scope: `repo; ${changedFiles === null ? 'unknown' : changedFiles.length} changed file(s)`,
      dirty: changedFiles === null ? 'unknown' : changedFiles.length === 0 ? '(clean)' : changedFiles.join(', '),
      blockers: blockers.length === 0 ? 'none' : blockers.join('; '),
      result: 'diagnostic',
      note: 'diagnostic only; not a validation pass',
      authority: AUTHORITY_BOUNDARY
    });
    return 0;
  }

  if (phase === 'verify-fast') {
    emit(log, { scope: 'full node:test suite (test/*.test.mjs via scripts/run-tests.mjs, builds first)' });
    const outcome = runChecks([TEST], exec, log);
    emit(log, { result: outcome.result, ...(outcome.failed ? { failed: outcome.failed } : {}), authority: AUTHORITY_BOUNDARY });
    return exitCodeFor(outcome.result);
  }

  if (changedFiles === null && phase !== 'landing-check' && phase !== 'impact-wide') {
    emit(log, { result: 'blocked', reason: 'git status unavailable; cannot classify changed files', authority: AUTHORITY_BOUNDARY });
    return EXIT_BLOCKED;
  }

  if (phase === 'impact-plan' || phase === 'impact-run') {
    const plan = planImpact(changedFiles ?? []);
    emit(log, {
      scope: plan.changedFiles.length === 0 ? '(no changed files)' : plan.changedFiles.join(', '),
      impact: plan.impact,
      checks: plan.checks.map(formatCheck).join(', '),
      reason: plan.reason
    });
    if (phase === 'impact-plan') {
      emit(log, { next: plan.next, result: 'diagnostic', authority: AUTHORITY_BOUNDARY });
      return 0;
    }
    if (plan.impact === 'wide') {
      emit(log, {
        result: 'blocked',
        refused: 'wide plan; loop-impact-run only runs bounded or expanded checks',
        escalation: plan.next,
        authority: AUTHORITY_BOUNDARY
      });
      return EXIT_BLOCKED;
    }
    const outcome = runChecks(plan.checks, exec, log);
    emit(log, { result: outcome.result, ...(outcome.failed ? { failed: outcome.failed } : {}), authority: AUTHORITY_BOUNDARY });
    return exitCodeFor(outcome.result);
  }

  if (phase === 'impact-wide') {
    const reason = (env['LOOP_WIDE_REASON'] ?? '').trim();
    emit(log, { scope: 'repo; root verify gate', checks: formatCheck(VERIFY) });
    if (reason === '') {
      emit(log, {
        result: 'blocked',
        refused: 'wide validation needs an explicit acceptance reason',
        escalation: 'LOOP_WIDE_REASON="<why>" npm run loop-impact-wide',
        authority: AUTHORITY_BOUNDARY
      });
      return EXIT_BLOCKED;
    }
    emit(log, { accepted: reason });
    const outcome = runChecks([VERIFY], exec, log);
    emit(log, { result: outcome.result, ...(outcome.failed ? { failed: outcome.failed } : {}), authority: AUTHORITY_BOUNDARY });
    return exitCodeFor(outcome.result);
  }

  // landing-check
  emit(log, {
    scope: 'repo; repo-declared landing gate',
    gate: formatCheck(VERIFY),
    dirty: changedFiles === null ? 'unknown' : changedFiles.length === 0 ? '(clean)' : changedFiles.join(', ')
  });
  const outcome = runChecks([VERIFY], exec, log);
  emit(log, {
    result: outcome.result,
    ...(outcome.failed ? { failed: outcome.failed } : {}),
    artifacts: 'VERIFICATION.md, verification/verification.log (written by scripts/verify.mjs)',
    handoff: 'record this evidence on the AK task; CI (npm run verify:ci), merge approval, and release approval remain outside this gate',
    authority: AUTHORITY_BOUNDARY
  });
  return exitCodeFor(outcome.result);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = runPhase(process.argv[2] ?? '');
}
