import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { spawnSync } from 'child_process';

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
    'public operator docs point at GitHub Release as the release intent, the staged-package artifact path, Trusted Publishing/OIDC npm publication, and the legitimacy outputs the repo actually proves'
  ], 'docs/npm-publishing-checklist.md');
  assert.equal(checklist.includes('not a second legitimacy authority'), true);

  for (const relativePath of sampleLegitimacyAnchors) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), true, `missing reviewed sample anchor: ${relativePath}`);
  }
});

test('publish workflow makes GitHub Release the single npm publication intent', () => {
  assert.equal(fs.existsSync(path.join(repoRoot, '.github/workflows/release.yml')), false, 'Trusted Publisher filename must be publish.yml, not release.yml');
  const workflow = readRepoFile('.github/workflows/publish.yml');

  expectContainsAll(workflow, [
    'release:',
    'types: [published]',
    'id-token: write',
    'environment:',
    'name: npm-publish',
    "node-version: '24'",
    'Use npm CLI with Trusted Publishing support',
    'npm install -g npm@latest',
    'Verify Trusted Publishing runtime prerequisites',
    'npm Trusted Publishing requires Node >=22.14.0',
    'npm Trusted Publishing requires npm >=11.5.1',
    "workflowFilename: 'publish.yml'",
    "environmentName: 'npm-publish'",
    'Validate GitHub Release intent',
    'npm run release:intent:check --silent',
    'npm run verify:ci --silent',
    'Upload proven npm tarball as workflow artifact',
    'Attach proven tarball to GitHub Release',
    'gh release upload "$RELEASE_TAG" .ts-quality/npm/ts-quality/tarballs/*.tgz --clobber',
    'working-directory: .ts-quality/npm/ts-quality/package',
    'npm publish --provenance --access public --tag "$NPM_DIST_TAG"',
    'Verify public npm package',
    'npx -p "ts-quality@${VERSION}" ts-quality --help'
  ], '.github/workflows/publish.yml');

  assert.equal(workflow.includes('workflow_dispatch:'), false, 'release workflow must not expose a second manual publish intent');
  assert.equal(workflow.includes('registry-url:'), false, 'release workflow must not configure registry auth-token mode when using Trusted Publishing/OIDC');
  assert.equal(workflow.includes('NODE_AUTH_TOKEN'), false, 'Trusted Publishing/OIDC must not be modeled as a checked-in token path');
  assert.equal(workflow.includes('NPM_TOKEN'), false, 'Trusted Publishing/OIDC must not depend on a checked-in npm token secret path');
});

test('local release orchestration scripts expose plan/prepare/github/verify surfaces', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'));
  const releaseOrchestrator = readRepoFile('scripts/release-orchestrator.mjs');
  assert.equal(packageJson.scripts['release:plan'], 'node scripts/release-orchestrator.mjs plan');
  assert.equal(packageJson.scripts['release:prepare'], 'node scripts/release-orchestrator.mjs prepare');
  assert.equal(packageJson.scripts['release:github'], 'node scripts/release-orchestrator.mjs github');
  assert.equal(packageJson.scripts['release:verify-public'], 'node scripts/release-orchestrator.mjs verify-public');

  expectContainsAll(releaseOrchestrator, [
    'function releaseTitleFromNotes',
    'function releaseBodyFromNotes',
    '^## Release body\\s+([\\s\\S]*)$',
    "const releaseTitle = releaseTitleFromNotes(version, notesPath);",
    "'--title', releaseTitle",
    'title: releaseTitle'
  ], 'scripts/release-orchestrator.mjs');
  assert.equal(releaseOrchestrator.includes('`ts-quality v${version} — deterministic trust for TypeScript changes`, \'--notes-file\''), false, 'release create title must come from release notes instead of a hard-coded generic title');

  const workflowDoc = readRepoFile('docs/releases/release-workflow.md');
  expectContainsAll(workflowDoc, [
    'GitHub Release as the single public release intent',
    'Do **not** run local `npm publish` for normal releases.',
    'npm run release:plan -- --version <next-version>',
    'npm run release:prepare -- --version <next-version> --apply',
    'npm run release:github -- --version <next-version> --apply',
    'npm run release:verify-public -- --version <released-version>',
    'Prerelease GitHub Releases publish to npm dist-tag `next`; normal releases publish to `latest`.',
    'avoids configuring `actions/setup-node` with `registry-url`',
    'workflow filename: `publish.yml`',
    'environment name: `npm-publish`'
  ], 'docs/releases/release-workflow.md');
});

test('release intent validation binds the release tag to the public package version', () => {
  const script = path.join(repoRoot, 'scripts', 'validate-release-intent.mjs');
  const publicPackage = JSON.parse(readRepoFile('packages/ts-quality/package.json'));
  const expectedTag = `v${publicPackage.version}`;

  const success = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, RELEASE_TAG: expectedTag, GITHUB_REF_TYPE: 'tag' }
  });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(success.stdout.includes('"releaseAuthority": "github-release"'), true);
  assert.equal(success.stdout.includes('"npmPublishing": "trusted-publishing-oidc"'), true);
  assert.equal(success.stdout.includes('"workspaceVersion"'), true);

  const wrongTag = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, RELEASE_TAG: 'v9.9.9', GITHUB_REF_TYPE: 'tag' }
  });
  assert.notEqual(wrongTag.status, 0);
  assert.equal(wrongTag.stderr.includes(`must exactly match package version tag (${expectedTag})`), true);

  const branchRef = spawnSync(process.execPath, [script], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, RELEASE_TAG: expectedTag, GITHUB_REF_TYPE: 'branch' }
  });
  assert.notEqual(branchRef.status, 0);
  assert.equal(branchRef.stderr.includes('Release intent must come from a Git tag ref'), true);
});

test('release orchestrator dry-run prepare reports release artifacts without mutating', () => {
  const script = path.join(repoRoot, 'scripts', 'release-orchestrator.mjs');
  const result = spawnSync(process.execPath, [script, 'prepare', '--version', '9.9.8'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env }
  });
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.action, 'prepare');
  assert.equal(parsed.applied, false);
  assert.equal(parsed.version, '9.9.8');
  assert.equal(parsed.changedFiles.includes('package.json'), true);
  assert.equal(parsed.changedFiles.includes('packages/ts-quality/package.json'), true);
  assert.equal(parsed.changedFiles.includes('CHANGELOG.md'), true);
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
