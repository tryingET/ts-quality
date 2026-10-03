import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

const script = path.join(repoRoot, 'scripts/handoff-sync.mjs');

test('routine handoff sync only checks and exports native AK state; never imports', (t) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-handoff-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const calls = path.join(scratch, 'calls');
  fs.writeFileSync(path.join(scratch, 'ak'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HANDOFF_CALLS"\nexit "${HANDOFF_EXIT:-0}"\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${scratch}${path.delimiter}${process.env.PATH}`, HANDOFF_CALLS: calls };
  let result = spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'direction check\ndirection export\n');
  fs.writeFileSync(calls, '');
  result = spawnSync(process.execPath, [script, '--check'], { env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'direction check\n');
  fs.writeFileSync(calls, '');
  result = spawnSync(process.execPath, [script], { env: { ...env, HANDOFF_EXIT: '1' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(fs.readFileSync(calls, 'utf8'), 'direction check\n', 'failed reconciliation must not export or mutate');
});
