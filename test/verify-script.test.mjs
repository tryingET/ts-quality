import test from 'node:test';
import assert from 'assert/strict';
import { verificationArtifactMarkdownLines, verificationCommands, verificationMarkdownLines } from '../scripts/verify.mjs';

test('verification plan gates staged packaging smoke after repo smoke', () => {
  const commands = verificationCommands(true).map((step) => `${step.command} ${step.args.join(' ')}`);
  const smokeIndex = commands.indexOf('npm run smoke --silent');
  const packagingSmokeIndex = commands.indexOf('npm run smoke:packaging --silent');

  assert.notEqual(smokeIndex, -1);
  assert.notEqual(packagingSmokeIndex, -1);
  assert.ok(packagingSmokeIndex > smokeIndex);

  const markdownLines = verificationMarkdownLines(true);
  assert.equal(markdownLines.includes('- `npm run smoke:packaging --silent`'), true);
});

test('verification plan only includes npm ci when install is not skipped', () => {
  const withInstall = verificationCommands(false).map((step) => `${step.command} ${step.args.join(' ')}`);
  const withoutInstall = verificationCommands(true).map((step) => `${step.command} ${step.args.join(' ')}`);

  assert.equal(withInstall[0], 'npm ci --ignore-scripts --no-audit --no-fund');
  assert.equal(withoutInstall.includes('npm ci --ignore-scripts --no-audit --no-fund'), false);
});

test('verification artifacts keep the canonical npm ci step even when execution skips install', () => {
  const artifactLines = verificationArtifactMarkdownLines();
  const executionLines = verificationMarkdownLines(true);

  assert.equal(artifactLines[0], '- `npm ci --ignore-scripts --no-audit --no-fund`');
  assert.equal(executionLines.includes('- `npm ci --ignore-scripts --no-audit --no-fund`'), false);
});
