import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import test from 'node:test';
import assert from 'assert/strict';
import { importDist, repoRoot } from './helpers.mjs';

// The oracle is the retained AK6581 probe output: legacy behavior recorded at the pinned legacy commit.
// Rows S1 adopts must now match it; rows S1 intentionally changes or holds (G6) are asserted as such.
const crap = await importDist('packages', 'crap4ts', 'src', 'index.js');
const mutate = await importDist('packages', 'ts-mutate', 'src', 'index.js');
const parityDir = path.join(repoRoot, 'docs', 'adoption', 'legacy-parity');
const observationsDoc = JSON.parse(fs.readFileSync(path.join(parityDir, 'observations.json'), 'utf8'));
const fixtureBytes = fs.readFileSync(path.join(parityDir, 'fixtures.json'));
const legacy = Object.fromEntries(observationsDoc.observations.map((item) => [item.id, item.legacy]));

test('the legacy oracle is bound to the operator corpus it was recorded from', () => {
  assert.equal(crypto.createHash('sha256').update(fixtureBytes).digest('hex'), observationsDoc.operatorFixtureSha256);
});

for (const { id, source } of JSON.parse(fixtureBytes.toString('utf8'))) {
  test(`Scenario: operator fixture ${id} emits the legacy sites, spans and replacements`, () => {
    const sites = mutate.discoverMutationSites(source, 'src/fixture.ts');
    assert.deepEqual(sites.map((site) => [site.startOffset, site.endOffset, site.original, site.replacement]), legacy[`operator-${id}`]);
  });
}

test('Scenario: nested function bodies leave the parent complexity at the legacy value', () => {
  const functions = crap.analyzeSource('src/fixture.ts', 'function outer(x) { function inner(y) { if (y) return y; return null; } return inner(x); }', [], new Set(), []);
  assert.equal(functions.find((item) => item.symbol === 'function:outer').complexity, legacy['nested-function-complexity']);
});

test('Scenario: constructor and accessors are inventoried like legacy, under native identities', () => {
  const functions = crap.analyzeSource('src/fixture.ts', 'class Box { constructor(x) { this.x = x; } get value() { return this.x; } set value(x) { this.x = x; } method() { return this.x; } }', [], new Set(), []);
  // Legacy names (`Box.get value`) are a G6-held interface; the native symbols keep the kind:name form.
  assert.equal(functions.length, legacy['constructor-accessor-discovery'].length);
  assert.deepEqual(functions.map((item) => item.symbol), ['constructor:Box', 'get:value', 'set:value', 'method:method']);
});

test('Scenario: ambient declarations are not inventoried, as in legacy', () => {
  assert.equal(crap.analyzeSource('src/fixture.ts', 'declare function absent(x: number): number;', [], new Set(), []).length, legacy['ambient-function-discovery']);
});

test('Scenario: the coverage denominator is instrumented lines, as in legacy', () => {
  assert.equal(crap.lineCoverage({ 3: 1 }, { startLine: 1, endLine: 4 }), legacy['lcov-range-denominator']);
});

test('Scenario: repeated LCOV records merge, as in legacy', () => {
  const merged = crap.parseLcov('SF:src/fixture.ts\nDA:1,1\nend_of_record\nSF:src/fixture.ts\nDA:2,1\nend_of_record\n');
  assert.deepEqual({ records: merged.length, lines: Object.keys(merged[0].lines).length }, legacy['lcov-duplicate-records']);
});

test('Scenario: missing coverage stays an intentional difference: explicit unknown status, scored as uncovered', () => {
  // Legacy reported a null CRAP; native keeps a numeric worst-case score and names the unknown evidence.
  assert.equal(legacy['missing-coverage-crap'], null);
  const [fn] = crap.analyzeSource('src/fixture.ts', 'function f() { return true; }', [], new Set(), []);
  assert.deepEqual({ crap: fn.crap, coveragePct: fn.coveragePct, coverageStatus: fn.coverageStatus }, { crap: 2, coveragePct: 0, coverageStatus: 'missing' });
});
