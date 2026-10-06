import test from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { importDist } from './helpers.mjs';

const mutate = await importDist('packages', 'ts-mutate', 'src', 'index.js');
const crap = await importDist('packages', 'crap4ts', 'src', 'index.js');

const SOURCE = [
  'function outer(a, b) {',            // 1
  '  const inner = (x) => x > 0;',     // 2
  '  if (a === b) {',                  // 3
  '    return inner(a);',              // 4
  '  }',                               // 5
  '  return a < b;',                   // 6
  '}',                                 // 7
  'function sibling(c) {',             // 8
  '  return c === 2;',                 // 9
  '}',                                 // 10
  ''
].join('\n');

function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tsq-native-selection-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

function select(root, options = {}) {
  const sourceFiles = options.sourceFiles ?? ['src/a.js'];
  const functions = sourceFiles.flatMap((file) => crap.analyzeSource(file, fs.readFileSync(path.join(root, file), 'utf8'), [], new Set(), []));
  return mutate.selectMutationSites({ repoRoot: root, sourceFiles, changedFiles: ['src/a.js'], functions, ...options });
}

const lines = (selection) => selection.sites.map((site) => `${site.span.startLine}:${site.original}`);

test('Scenario: without targets, selection equals the discovered changed-scope sites and the ledger accounts for every one', () => {
  const root = repo({ 'src/a.js': SOURCE });
  const selection = select(root);
  assert.deepEqual(selection.sites.map((site) => site.id), mutate.discoverMutationSites(SOURCE, 'src/a.js', [], ['src/a.js']).map((site) => site.id));
  const { counts } = selection.ledger;
  assert.equal(counts.discovered, selection.sites.length);
  assert.equal(counts.eligible, counts.discovered);
  assert.equal(counts.selected, counts.eligible);
  assert.equal(counts.excluded, 0);
  assert.equal(selection.ledger.version, '1');
});

test('Scenario: a symbol target mutates only that function, never its nested function or a sibling', () => {
  const root = repo({ 'src/a.js': SOURCE });
  const selection = select(root, { targets: [mutate.parseMutationTarget('symbol:src/a.js#function:outer')] });
  assert.deepEqual(lines(selection), ['3:a === b', '3:===', '6:<']);
  const reasons = Object.fromEntries(selection.ledger.excluded.map((item) => [`${item.line}:${item.reason}`, true]));
  assert.equal(reasons['2:nested-function'], true);
  assert.equal(reasons['9:not-targeted'], true);
  assert.deepEqual(selection.ledger.targets.map((item) => [item.status, item.matchedSites]), [['resolved', 3]]);
});

test('Scenario: missing, ambiguous and stale symbol targets are unresolved instead of guessed', () => {
  const duplicated = `${SOURCE}const handler = () => 1;\nfunction wrap() { const handler = () => 2; return handler; }\n`;
  const root = repo({ 'src/a.js': duplicated });
  const statuses = (spec) => select(root, { targets: [mutate.parseMutationTarget(spec)] }).ledger.targets[0];
  assert.deepEqual(statuses('symbol:src/a.js#function:renamed'), { target: mutate.parseMutationTarget('symbol:src/a.js#function:renamed'), status: 'unresolved', reason: 'not-found', matchedSites: 0, selectedSites: 0 });
  assert.equal(statuses('symbol:src/a.js#arrow:handler').reason, 'ambiguous');
  assert.equal(statuses('symbol:src/a.js#arrow:handler@11-11').status, 'resolved');
  assert.equal(statuses('symbol:src/a.js#function:outer@1-6').reason, 'stale-span');
});

test('Scenario: site targets bind to the current source; an edited site id is stale', () => {
  const root = repo({ 'src/a.js': SOURCE });
  const [first] = select(root).sites;
  const current = select(root, { targets: [{ kind: 'site', siteId: first.id }] });
  assert.deepEqual(current.sites.map((site) => site.id), [first.id]);
  fs.writeFileSync(path.join(root, 'src/a.js'), `// moved\n${SOURCE}`);
  const stale = select(root, { targets: [{ kind: 'site', siteId: first.id }] });
  assert.deepEqual(stale.sites, []);
  assert.equal(stale.ledger.targets[0].reason, 'stale-site');
});

test('Scenario: span and file targets select by lines and by file; targets outside the changed scope do not widen it', () => {
  const root = repo({ 'src/a.js': SOURCE, 'src/b.js': 'function b(x) { return x === 1; }\n' });
  assert.deepEqual(lines(select(root, { targets: [mutate.parseMutationTarget('span:src/a.js:8-10')] })), ['9:===']);
  assert.equal(select(root, { targets: [mutate.parseMutationTarget('file:src/a.js')] }).sites.length, select(root).sites.length);
  const outside = select(root, { sourceFiles: ['src/a.js', 'src/b.js'], targets: [mutate.parseMutationTarget('file:src/b.js')] });
  assert.deepEqual(outside.sites, []);
  assert.equal(outside.ledger.targets[0].reason, 'outside-changed-scope');
});

test('Scenario: the site budget truncates deterministically and records every cut site', () => {
  const root = repo({ 'src/a.js': SOURCE });
  const all = select(root).sites;
  const limited = select(root, { maxSites: 2 });
  assert.deepEqual(limited.sites.map((site) => site.id), all.slice(0, 2).map((site) => site.id));
  assert.equal(limited.ledger.excluded.filter((item) => item.reason === 'budget-sites').length, all.length - 2);
  assert.equal(limited.ledger.counts.selected, 2);
});

test('Scenario: coverage-only selection names uncovered sites as excluded rather than dropping them silently', () => {
  const root = repo({ 'src/a.js': SOURCE });
  const coverage = crap.parseLcov('SF:src/a.js\nDA:9,1\nend_of_record\n');
  const selection = select(root, { coverage, coveredOnly: true });
  assert.deepEqual(lines(selection), ['9:===']);
  assert.equal(selection.ledger.excluded.every((item) => item.reason === 'uncovered'), true);
  assert.equal(selection.ledger.counts.eligible, 1);
});

test('Scenario: target specs parse strictly', () => {
  assert.deepEqual(mutate.parseMutationTarget('span:src/a b.ts:3-7'), { kind: 'span', filePath: 'src/a b.ts', startLine: 3, endLine: 7 });
  assert.deepEqual(mutate.parseMutationTarget('symbol:src/a.ts#method:run@4-9'), { kind: 'symbol', filePath: 'src/a.ts', symbol: 'method:run', startLine: 4, endLine: 9 });
  for (const bad of ['', 'span:src/a.ts:7-3', 'span:src/a.ts', 'symbol:src/a.ts', 'site:', 'line:src/a.ts:3', 'file:']) {
    assert.throws(() => mutate.parseMutationTarget(bad), /mutation target/, bad);
  }
});

test('Scenario: a symbol target never owns a sibling that starts on its last line or an inline callback on its own line', () => {
  const chained = 'const out = items.map(function mapper(item) {\n  return item + 1;\n}).filter((v) => v > 0 &&\n  v < 10);\n';
  const root = repo({ 'src/a.js': chained });
  const mapper = select(root, { targets: [mutate.parseMutationTarget('symbol:src/a.js#function-expression:mapper')] });
  assert.deepEqual(lines(mapper), ['2:+', '2:1']);
  const oneLine = repo({ 'src/a.js': 'function A(xs, k) { return xs.some((x) => x === k) && k > 0; }\n' });
  const owner = select(oneLine, { targets: [mutate.parseMutationTarget('symbol:src/a.js#function:A')] });
  assert.deepEqual(lines(owner).sort(), ['1:&&', '1:0', '1:>'].sort());
  assert.deepEqual(owner.ledger.excluded.map((item) => item.reason), ['nested-function']);
});

test('Scenario: anonymous and @-containing symbols parse without a span suffix', () => {
  assert.deepEqual(mutate.parseMutationTarget('symbol:src/a.js#arrow:<anonymous@6>'), { kind: 'symbol', filePath: 'src/a.js', symbol: 'arrow:<anonymous@6>' });
  assert.deepEqual(mutate.parseMutationTarget("symbol:src/a.js#method:['a@b']"), { kind: 'symbol', filePath: 'src/a.js', symbol: "method:['a@b']" });
  assert.deepEqual(mutate.parseMutationTarget('symbol:src/a.js#arrow:<anonymous@6>@6-6'), { kind: 'symbol', filePath: 'src/a.js', symbol: 'arrow:<anonymous@6>', startLine: 6, endLine: 6 });
});

test('Scenario: a target whose identity resolves but selects no eligible site is unresolved, and budget cuts are reported per target', () => {
  const root = repo({ 'src/a.js': SOURCE });
  const regions = [{ filePath: 'src/a.js', hunkId: 'h1', span: { startLine: 1, endLine: 7 } }];
  const outsideHunk = select(root, { changedRegions: regions, targets: [mutate.parseMutationTarget('symbol:src/a.js#function:sibling'), mutate.parseMutationTarget('symbol:src/a.js#function:outer')] });
  assert.deepEqual(outsideHunk.ledger.targets.map((item) => [item.status, item.reason ?? null, item.matchedSites, item.selectedSites]), [['unresolved', 'no-eligible-sites', 0, 0], ['resolved', null, 3, 3]]);
  const budgeted = select(root, { maxSites: 1, targets: [mutate.parseMutationTarget('symbol:src/a.js#function:outer')] });
  assert.deepEqual(budgeted.ledger.targets.map((item) => [item.matchedSites, item.selectedSites]), [[3, 1]]);
});

test('Scenario: a site target in an unchanged source file is outside the changed scope, not stale', () => {
  const root = repo({ 'src/a.js': SOURCE, 'src/b.js': 'function b(x) { return x === 1; }\n' });
  const [bSite] = mutate.discoverMutationSites('function b(x) { return x === 1; }\n', 'src/b.js');
  const selection = select(root, { sourceFiles: ['src/a.js', 'src/b.js'], targets: [{ kind: 'site', siteId: bSite.id }] });
  assert.equal(selection.ledger.targets[0].reason, 'outside-changed-scope');
  const testFile = select(root, { targets: [mutate.parseMutationTarget('file:test/a.test.js')] });
  assert.equal(testFile.ledger.targets[0].reason, 'not-a-source-file');
});
