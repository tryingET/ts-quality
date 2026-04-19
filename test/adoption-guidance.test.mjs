import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function expectContainsAll(content, expected, label) {
  for (const item of expected) {
    assert.equal(content.includes(item), true, `${label} missing expected text: ${item}`);
  }
}

const runtimeLegitimacyOutputs = [
  '.ts-quality/runs/<run-id>/authorize.<agent>.<action>.json',
  '.ts-quality/runs/<run-id>/bundle.<agent>.<action>.json',
  '.ts-quality/runs/<run-id>/attestation-verify.txt',
  '.ts-quality/amendments/<proposal-id>.result.json',
  '.ts-quality/amendments/<proposal-id>.result.txt'
];

const sampleLegitimacyAnchors = [
  'examples/artifacts/governed-app/authorize.release-bot.json',
  'examples/artifacts/governed-app/authorize.maintainer-approved.json',
  'examples/artifacts/governed-app/attestation.verify.txt',
  'examples/artifacts/governed-app/amend.txt'
];

test('README and release draft keep SG6 legitimacy outputs aligned', () => {
  const readme = readRepoFile('README.md');
  const releaseDraft = readRepoFile('docs/releases/2026-03-20-v0.1.0-github-release-draft.md');

  expectContainsAll(readme, runtimeLegitimacyOutputs, 'README.md');
  expectContainsAll(releaseDraft, runtimeLegitimacyOutputs, 'docs/releases/2026-03-20-v0.1.0-github-release-draft.md');
  expectContainsAll(readme, sampleLegitimacyAnchors, 'README.md');
  expectContainsAll(releaseDraft, sampleLegitimacyAnchors, 'docs/releases/2026-03-20-v0.1.0-github-release-draft.md');

  assert.equal(readme.includes('without inventing a second legitimacy authority'), true);
  assert.equal(releaseDraft.includes('not a second legitimacy authority'), true);
  assert.equal(releaseDraft.includes('This release makes the legitimacy layer concrete instead of leaving it as generic policy language.'), true);
});

test('publishing checklist keeps legitimacy sample anchors and authority guidance aligned', () => {
  const checklist = readRepoFile('docs/npm-publishing-checklist.md');

  expectContainsAll(checklist, sampleLegitimacyAnchors, 'docs/npm-publishing-checklist.md');
  expectContainsAll(checklist, [
    'These are the current sample anchors for the shipped SG6 legitimacy surface',
    'README/operator docs point at the same legitimacy outputs the repo actually ships',
    'how run-bound authorization evidence, attestation verification, and amendment outputs stay downstream of exact run/proposal truth',
    'public operator docs point at the same staged-package path and legitimacy outputs the repo actually proves'
  ], 'docs/npm-publishing-checklist.md');
  assert.equal(checklist.includes('not a second legitimacy authority'), true);

  for (const relativePath of sampleLegitimacyAnchors) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `missing reviewed sample anchor: ${relativePath}`);
  }
});

test('first-release decision keeps SG6 adoption surfaces explicit without changing authority', () => {
  const decision = readRepoFile('docs/releases/2026-04-19-first-release-decision.md');

  expectContainsAll(decision, runtimeLegitimacyOutputs, 'docs/releases/2026-04-19-first-release-decision.md');
  expectContainsAll(decision, [
    'public release surfaces can now point at exact SG6 legitimacy artifacts instead of relying on generic legitimacy wording',
    '## Post-decision release-copy alignment',
    'reviewed sample anchors under `examples/artifacts/governed-app/`',
    'Those additions do not change release authority.',
    '`run.json`, the authorization decision + bundle artifacts, and amendment JSON remain authoritative'
  ], 'docs/releases/2026-04-19-first-release-decision.md');
});
