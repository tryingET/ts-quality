import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

const guide = fs.readFileSync(path.join(repoRoot, 'docs/ci-integration.md'), 'utf8');
function snippet(label) {
  const match = guide.match(new RegExp(`<<'${label}'\\n([\\s\\S]*?)\\n${label}`));
  assert.ok(match, `missing documented ${label} assertion`);
  return match[1];
}
const checkAssertion = snippet('TSQ_CHECK_ASSERT');
const authorizeAssertion = snippet('TSQ_AUTHORIZE_ASSERT');

function execute(t, source, file, record) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-ci-recipe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const artifact = path.join(root, '.ts-quality/runs/review', file);
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(artifact, JSON.stringify(record));
  return spawnSync(process.execPath, ['--input-type=module', '-', 'review'], { cwd: root, input: source, encoding: 'utf8' });
}

const cleanReport = { runId: 'review', verdict: { outcome: 'pass' }, decisionContext: { projection: 'projected', drift: [] }, governance: [] };
test('documented CI check assertion permits a matching, passing, drift-free projection', (t) => {
  const result = execute(t, checkAssertion, 'report.projected.json', cleanReport);
  assert.equal(result.status, 0, result.stderr);
});
for (const [label, change] of [
  ['failed verdict', { verdict: { outcome: 'fail' } }],
  ['warning verdict', { verdict: { outcome: 'warn' } }],
  ['wrong run', { runId: 'other' }],
  ['persisted instead of current report', { decisionContext: { projection: 'persisted', drift: [] } }],
  ['drift', { decisionContext: { projection: 'projected', drift: [{ subject: 'changed source' }] } }],
  ['missing decision context', { decisionContext: null }],
  ['blocking governance', { governance: [{ level: 'error' }] }],
  ['missing governance', { governance: null }]
]) {
  test(`documented CI check assertion refuses ${label} even when the CLI completed`, (t) => {
    assert.notEqual(execute(t, checkAssertion, 'report.projected.json', { ...cleanReport, ...change }).status, 0);
  });
}

const approved = { id: 'review:release-bot:merge', evidenceContext: { runId: 'review' }, outcome: 'approve' };
test('documented CI authorization assertion permits only exact-run approval', (t) => {
  const result = execute(t, authorizeAssertion, 'authorize.release-bot.merge.json', approved);
  assert.equal(result.status, 0, result.stderr);
});
for (const [label, change] of [
  ['denial', { outcome: 'deny' }],
  ['human approval required', { outcome: 'require-human-approver' }],
  ['more proof required', { outcome: 'request-more-proof' }],
  ['wrong run', { evidenceContext: { runId: 'other' } }],
  ['wrong actor/action', { id: 'review:maintainer:override' }],
  ['missing evidence context', { evidenceContext: null }]
]) {
  test(`documented CI authorization assertion refuses ${label}`, (t) => {
    assert.notEqual(execute(t, authorizeAssertion, 'authorize.release-bot.merge.json', { ...approved, ...change }).status, 0);
  });
}
