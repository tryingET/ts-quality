// @ts-check

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');

/** @param {string} filePath */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * @param {string | undefined} value
 * @param {string} name
 */
function requireEnv(value, name) {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required release intent environment variable: ${name}`);
  }
  return value.trim();
}

const workspacePackage = readJson(path.join(root, 'package.json'));
const publicPackage = readJson(path.join(root, 'packages', 'ts-quality', 'package.json'));
const workspaceVersion = String(workspacePackage.version ?? '').trim();
const packageVersion = String(publicPackage.version ?? '').trim();
if (!packageVersion) {
  throw new Error('packages/ts-quality/package.json must carry a non-empty version before release.');
}
if (workspaceVersion !== packageVersion) {
  throw new Error(`Workspace package version (${workspaceVersion}) must match public package version (${packageVersion}).`);
}

const releaseTag = requireEnv(process.env['RELEASE_TAG'] ?? process.env['GITHUB_REF_NAME'], 'RELEASE_TAG or GITHUB_REF_NAME');
const refType = process.env['GITHUB_REF_TYPE'];
if (refType && refType !== 'tag') {
  throw new Error(`Release intent must come from a Git tag ref, got GITHUB_REF_TYPE=${refType}.`);
}

const expectedTag = `v${packageVersion}`;
if (releaseTag !== expectedTag) {
  throw new Error(`GitHub Release tag (${releaseTag}) must exactly match package version tag (${expectedTag}).`);
}

const npmPackageName = String(publicPackage.name ?? '').trim();
if (npmPackageName !== 'ts-quality') {
  throw new Error(`Unexpected npm package name: ${npmPackageName}. Expected ts-quality.`);
}

console.log(JSON.stringify({
  releaseAuthority: 'github-release',
  npmPublishing: 'trusted-publishing-oidc',
  packageName: npmPackageName,
  version: packageVersion,
  workspaceVersion,
  releaseTag,
  expectedTag
}, null, 2));
