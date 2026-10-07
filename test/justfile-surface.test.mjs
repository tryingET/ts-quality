import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { repoRoot } from './helpers.mjs';

// The standardized owned-lane Justfile surface stays a thin, truthful delegation to the npm validation owners.
// Parsed as text so the check runs where `just` is not installed (CI runners).
function recipes() {
  const text = fs.readFileSync(path.join(repoRoot, 'Justfile'), 'utf8');
  const map = new Map();
  let current;
  for (const line of text.split('\n')) {
    const header = /^([a-z][a-z0-9-]*)(?:\s+[^:]*)?:\s*$/.exec(line);
    if (header) {
      current = header[1];
      map.set(current, []);
      continue;
    }
    if (current && /^\s{4}\S/.test(line)) {
      map.get(current).push(line.trim());
    } else if (line.trim() !== '' && !line.startsWith('#')) {
      current = undefined;
    }
  }
  return map;
}

test('Scenario: the standard targets delegate to the existing npm owners', () => {
  const surface = recipes();
  assert.deepEqual(surface.get('help'), ['@just --list']);
  assert.deepEqual(surface.get('test'), ['npm test --silent']);
  assert.deepEqual(surface.get('build'), ['npm run build --silent']);
  assert.deepEqual(surface.get('lint'), ['npm run lint --silent']);
  assert.deepEqual(surface.get('check'), ['npm run typecheck:scripts --silent', 'npm run lint --silent', 'npm test --silent']);
  // The full gate is the one root verify contract, not a re-composition of the targets above.
  assert.deepEqual(surface.get('ci'), ['npm run verify --silent']);
  assert.deepEqual(surface.get('doctor'), ['npm run loop-doctor --silent']);
  assert.deepEqual(surface.get('run'), ['node dist/packages/ts-quality/src/cli.js {{args}}']);
});

test('Scenario: no fake formatter or dev target is invented', () => {
  const surface = recipes();
  assert.equal(surface.has('fmt'), false);
  assert.equal(surface.has('dev'), false);
  const text = fs.readFileSync(path.join(repoRoot, 'Justfile'), 'utf8');
  assert.match(text, /no formatter is configured/);
});

test('Scenario: repo-loop-validation-v1 phases are thin wrappers over the npm loop scripts', () => {
  const surface = recipes();
  for (const phase of ['doctor', 'verify-fast', 'impact-plan', 'impact-run', 'impact-wide', 'landing-check']) {
    assert.deepEqual(surface.get(`loop-${phase}`), [`npm run loop-${phase} --silent`], phase);
  }
});
