import test from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { collectLintIssues } from '../scripts/lint.mjs';

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

const debtMarker = ['TO', 'DO'].join('');
const fixMarker = ['FIX', 'ME'].join('');
const debtPattern = `/${debtMarker}/i`;

test('lint ignores hidden and generated directories but still scans repo-authored files', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-lint-'));
  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  writeFile(path.join(tempRoot, '.pi-subagent-sessions', 'session.json'), `{"note":"${debtMarker}: local session artifact"}\n`);
  writeFile(path.join(tempRoot, '.ts-quality', 'runs', 'run-1', 'report.md'), `${debtMarker} generated run artifact\n`);
  writeFile(path.join(tempRoot, 'verification', 'verification.json'), `{"note":"${fixMarker} generated verification artifact"}\n`);
  writeFile(path.join(tempRoot, 'docs', 'guide.md'), `${debtMarker}: repo-authored debt still needs attention\n`);

  const issues = collectLintIssues(tempRoot);

  assert.equal(issues.some((issue) => issue.startsWith(`docs/guide.md: matched ${debtPattern}`)), true);
  assert.equal(issues.some((issue) => issue.includes('.pi-subagent-sessions')), false);
  assert.equal(issues.some((issue) => issue.includes('.ts-quality')), false);
  assert.equal(issues.some((issue) => issue.includes('verification/verification.json')), false);
});
