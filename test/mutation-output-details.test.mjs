import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { importDist } from './helpers.mjs';

const mutate = await importDist('packages', 'ts-mutate', 'src', 'index.js');

// A test command that prints a long log and names the failing test only on its last line, like node --test does.
function fixture(t, { failInWorkspace }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-mutation-details-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"mutation-details","private":true}\n');
  fs.writeFileSync(path.join(root, 'src', 'flag.js'), 'exports.on = (v) => v > 1;\n');
  fs.writeFileSync(path.join(root, 'check.js'), [
    "const { on } = require('./src/flag.js');",
    "const inWorkspace = process.cwd().includes('tmp-mutants');",
    "for (let i = 0; i < 200; i += 1) console.log(`ok ${i} - a passing check with a long enough description`);",
    `if (${failInWorkspace ? 'inWorkspace' : 'false'} || on(5) !== true || on(1) !== false) {`,
    "  console.log('FAILING TEST: the-last-line-names-it');",
    '  process.exit(1);',
    '}',
    ''
  ].join('\n'));
  return root;
}

function run(root) {
  return mutate.runMutations({
    repoRoot: root,
    sourceFiles: ['src/flag.js'],
    changedFiles: ['src/flag.js'],
    testCommand: ['node', 'check.js'],
    coveredOnly: false,
    manifestPath: path.join(root, '.ts-quality', 'mutation-manifest.json'),
    maxSites: 2,
    timeoutMs: 10_000
  });
}

test('Scenario: a workspace baseline failure keeps both its explanation and the end of the output, where the failing test is named', (t) => {
  const result = run(fixture(t, { failInWorkspace: true }));
  const details = result.baseline.details;
  assert.equal(result.baseline.status, 'fail');
  assert.match(details, /^mutation workspace baseline: the unmutated test command fails inside the mutation workspace/);
  assert.match(details, /FAILING TEST: the-last-line-names-it$/);
  assert.match(details, / … /, 'the omitted middle is marked');
  assert.ok(details.length <= 900, `details stay bounded (${details.length})`);
});

test('Scenario: killed mutants keep the end of the output too, and short output is kept whole', (t) => {
  const result = run(fixture(t, { failInWorkspace: false }));
  assert.equal(result.baseline.status, 'pass');
  const killed = result.results.filter((item) => item.status === 'killed');
  assert.ok(killed.length > 0);
  for (const item of killed) {
    assert.match(item.details, /FAILING TEST: the-last-line-names-it$/);
    assert.ok(item.details.length <= 900);
  }
});
