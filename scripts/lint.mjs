// @ts-check

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');
const banned = [
  new RegExp(['TO', 'DO'].join(''), 'i'),
  new RegExp(['FIX', 'ME'].join(''), 'i'),
  new RegExp(['place', 'holderfunction'].join(''), 'i'),
  new RegExp(['place', 'holder', '\\b'].join(''), 'i'),
  new RegExp(['Not ', 'implemented'].join(''), 'i'),
  new RegExp(['N', 'YI'].join(''), 'i'),
  new RegExp(['fake ', 'success'].join(''), 'i')
];
const includeExt = /\.(ts|js|mjs|md|json)$/;
const excludeDirNames = new Set(['dist', 'node_modules', 'verification']);
const excludeDirPaths = ['examples/artifacts'];

/**
 * @param {string} relativePath
 * @param {string} parentPath
 */
function isWithin(relativePath, parentPath) {
  return relativePath === parentPath || relativePath.startsWith(`${parentPath}/`);
}

/**
 * @param {string} relativePath
 * @param {string} entryName
 */
function shouldSkipDirectory(relativePath, entryName) {
  if (entryName.startsWith('.')) {
    return true;
  }
  if (excludeDirNames.has(entryName) || excludeDirNames.has(relativePath)) {
    return true;
  }
  return excludeDirPaths.some((excludedPath) => isWithin(relativePath, excludedPath));
}

/**
 * @param {string} [scanRoot=root]
 * @returns {string[]}
 */
export function collectLintIssues(scanRoot = root) {
  /** @type {string[]} */
  const issues = [];

  /** @param {string} currentDir */
  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolute = path.join(currentDir, entry.name);
      const relative = path.relative(scanRoot, absolute).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(relative, entry.name)) {
          continue;
        }
        visit(absolute);
        continue;
      }
      if (relative === 'scripts/lint.mjs') {
        continue;
      }
      if (!includeExt.test(relative)) {
        continue;
      }
      const text = fs.readFileSync(absolute, 'utf8');
      for (const pattern of banned) {
        if (pattern.test(text)) {
          issues.push(`${relative}: matched ${pattern}`);
        }
      }
    }
  }

  visit(scanRoot);
  return issues;
}

/** @param {string} [scanRoot=root] */
export function runLint(scanRoot = root) {
  const issues = collectLintIssues(scanRoot);
  if (issues.length > 0) {
    console.error(issues.join('\n'));
    process.exit(1);
  }
  console.log('lint: ok');
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  runLint();
}
