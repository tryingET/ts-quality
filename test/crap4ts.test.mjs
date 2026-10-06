import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { fixturePath, importDist } from './helpers.mjs';

const crap = await importDist('packages', 'crap4ts', 'src', 'index.js');

test('parseLcov reads coverage entries', () => {
  const lcov = fs.readFileSync(path.join(fixturePath('governed-app'), 'coverage', 'lcov.info'), 'utf8');
  const coverage = crap.parseLcov(lcov);
  assert.equal(coverage[0].filePath, 'src/auth/token.js');
  assert.equal(coverage[0].coveredLines > 0, true);
});

test('crapScore increases with lower coverage', () => {
  assert.ok(crap.crapScore(5, 50) > crap.crapScore(5, 100));
});

test('analyzeCrap marks changed functions', () => {
  const lcov = fs.readFileSync(path.join(fixturePath('governed-app'), 'coverage', 'lcov.info'), 'utf8');
  const report = crap.analyzeCrap({
    rootDir: fixturePath('governed-app'),
    sourceFiles: ['src/auth/token.js'],
    coverage: crap.parseLcov(lcov),
    changedFiles: ['src/auth/token.js']
  });
  assert.equal(report.hotspots.length >= 2, true);
  assert.equal(report.hotspots.some((item) => item.changed), true);
});


test('analyzeSource narrows changed functions to diff hunks within a changed file', () => {
  const source = [
    'function first(a, b) {',
    '  return a === b;',
    '}',
    '',
    'function second(a, b) {',
    '  return a > b;',
    '}',
    ''
  ].join('\n');
  const functions = crap.analyzeSource('src/sample.js', source, [], new Set(['src/sample.js']), [{ filePath: 'src/sample.js', hunkId: 'h1', span: { startLine: 5, endLine: 6 } }]);
  assert.equal(functions.find((item) => item.symbol === 'function:first')?.changed, false);
  assert.equal(functions.find((item) => item.symbol === 'function:second')?.changed, true);
});


test('analyzeSource prefers exact LCOV matches over suffix collisions', () => {
  const coverage = crap.parseLcov([
    'SF:packages/a/src/index.js',
    'DA:1,0',
    'end_of_record',
    'SF:src/index.js',
    'DA:1,1',
    'end_of_record',
    ''
  ].join('\n'));
  const [result] = crap.analyzeSource('src/index.js', 'function root() { return true; }\n', coverage, new Set(['src/index.js']), []);
  assert.equal(result.coveragePct, 100);
});

function symbolsOf(filePath, source, coverage = []) {
  return crap.analyzeSource(filePath, source, coverage, new Set(), []);
}

test('Scenario: constructors, accessors and methods are separate executable functions with their own spans', () => {
  const source = [
    'class Box {',
    '  constructor(x) { this.x = x; }',
    '  get value() { return this.x; }',
    '  set value(next) { this.x = next; }',
    '  method() { return this.x; }',
    '}',
    ''
  ].join('\n');
  const functions = symbolsOf('src/box.js', source);
  assert.deepEqual(functions.map((item) => [item.symbol, item.span.startLine, item.span.endLine]), [
    ['constructor:Box', 2, 2],
    ['get:value', 3, 3],
    ['set:value', 4, 4],
    ['method:method', 5, 5]
  ]);
});

test('Scenario: assigned functions get readable identities while callbacks stay anonymous', () => {
  const source = [
    'const handler = () => 1;',
    'const api = { run: function () { return 2; }, go: () => 3 };',
    'class View { onClick = () => 4; }',
    'module.exports.save = function () { return 5; };',
    'const named = function inner() { return 6; };',
    '[1].map((item) => item);',
    'export default () => 7;',
    ''
  ].join('\n');
  assert.deepEqual(symbolsOf('src/assigned.ts', source).map((item) => item.symbol), [
    'arrow:handler',
    'function-expression:run',
    'arrow:go',
    'arrow:onClick',
    'function-expression:module.exports.save',
    'function-expression:inner',
    'arrow:<anonymous@6>',
    'arrow:default'
  ]);
});

test('Scenario: ambient, abstract and overload-only declarations are not executable functions', () => {
  const source = [
    'declare function absent(x: number): number;',
    'declare class Shape { area(): number; }',
    'abstract class Base { abstract run(): void; }',
    'function pick(value: string): string;',
    'function pick(value: number): number;',
    'function pick(value: unknown) { return value; }',
    ''
  ].join('\n');
  assert.deepEqual(symbolsOf('src/ambient.ts', source).map((item) => [item.symbol, item.span.startLine]), [['function:pick', 6]]);
});

test('Scenario: nested function bodies are not charged to the enclosing function', () => {
  const source = 'function outer(x) { function inner(y) { if (y) return y; return null; } const pick = () => (x ? 1 : 2); return inner(x) ?? pick(); }\n';
  const complexity = Object.fromEntries(symbolsOf('src/nested.js', source).map((item) => [item.symbol, item.complexity]));
  assert.deepEqual(complexity, { 'function:outer': 2, 'function:inner': 2, 'arrow:pick': 2 });
});

test('Scenario: TSX components are analyzed with readable identities', () => {
  const source = 'export const View = ({ on }: { on: boolean }) => <div>{on ? 1 : 2}</div>;\n';
  const [view] = symbolsOf('src/View.tsx', source);
  assert.equal(view.symbol, 'arrow:View');
  assert.equal(view.complexity, 2);
});

test('Scenario: function coverage counts only LCOV-instrumented lines', () => {
  const source = 'function f(x) {\n  // comment, not instrumented\n  return x;\n}\n';
  const coverage = crap.parseLcov('SF:src/f.js\nDA:3,1\nend_of_record\n');
  const [fn] = symbolsOf('src/f.js', source, coverage);
  assert.equal(fn.coveragePct, 100);
  assert.equal(fn.coverageStatus, 'measured');
  assert.equal(fn.crap, 1);
  assert.equal(crap.lineCoverage({ 3: 1 }, { startLine: 1, endLine: 4 }), 100);
});

test('Scenario: repeated LCOV records for one file merge into one evidence entry', () => {
  const coverage = crap.parseLcov('SF:src/f.js\nDA:1,1\nDA:2,0\nend_of_record\nSF:src/f.js\nDA:2,3\nDA:3,0\nend_of_record\n');
  assert.equal(coverage.length, 1);
  assert.deepEqual(coverage[0].lines, { 1: 1, 2: 3, 3: 0 });
  assert.equal(coverage[0].coveredLines, 2);
  assert.equal(coverage[0].totalLines, 3);
  assert.equal(coverage[0].malformedLines, undefined);
});

test('Scenario: unusable coverage evidence is explicit unknown and is scored as uncovered, never as covered', () => {
  const source = 'function f(x) {\n  return x;\n}\n';
  const cases = [
    ['missing', []],
    ['ambiguous', crap.parseLcov('SF:a/src/f.js\nDA:2,1\nend_of_record\nSF:b/src/f.js\nDA:2,1\nend_of_record\n')],
    ['malformed', crap.parseLcov('SF:src/f.js\nDA:2,1\nDA:x,1\nDA:3,abc\nend_of_record\n')],
    ['mismatched', crap.parseLcov('SF:src/f.js\nDA:2,1\nDA:40,1\nend_of_record\n')],
    ['not-instrumented', crap.parseLcov('SF:src/f.js\nend_of_record\n')]
  ];
  for (const [status, coverage] of cases) {
    const [fn] = symbolsOf('src/f.js', source, coverage);
    assert.equal(fn.coverageStatus, status, status);
    assert.equal(fn.coveragePct, 0, status);
    assert.equal(fn.crap, 2, status);
  }
  assert.equal(crap.parseLcov('SF:src/f.js\nDA:2,1\nDA:x,1\nDA:3,abc\nend_of_record\n')[0].malformedLines, 2);
});

test('Scenario: CRAP uses percent coverage units with two-decimal rounding', () => {
  assert.equal(crap.crapScore(1, 100), 1);
  assert.equal(crap.crapScore(2, 0), 6);
  assert.equal(crap.crapScore(2, 50), 2.5);
  assert.equal(crap.crapScore(3, 33.33), 5.67);
  assert.equal(crap.crapScore(2, 150), 2);
  assert.equal(crap.crapScore(2, -5), 6);
});

test('Scenario: equal-CRAP hotspots are ordered by file and line, not input order', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'crap-ties-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'b.js'), 'function b() { return 1; }\n');
  fs.writeFileSync(path.join(root, 'src', 'a.js'), 'function a2() { return 1; }\nfunction a1() { return 1; }\n');
  const report = crap.analyzeCrap({ rootDir: root, sourceFiles: ['src/b.js', 'src/a.js'] });
  assert.deepEqual(report.hotspots.map((item) => item.symbol), ['function:a2', 'function:a1', 'function:b']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('Scenario: the CRAP text report labels unknown coverage instead of printing a measured 0%', () => {
  const report = crap.analyzeCrap({ rootDir: fixturePath('governed-app'), sourceFiles: ['src/auth/token.js'] });
  const text = crap.formatCrapText(report);
  assert.match(text, /coverage=unknown \(missing\)/);
  assert.doesNotMatch(text, /coverage=0%/);
});

test('Scenario: names survive type wrappers and class expressions name their constructors', () => {
  const source = [
    'const wrapped = (() => 1) as unknown as () => number;',
    'const checked = ((x: number) => x) satisfies (x: number) => number;',
    'holder.callback = (() => 2)!;',
    'const Klass = class { constructor() { this.ready = true; } };',
    'const list = [class { constructor() { this.ready = false; } }];',
    ''
  ].join('\n');
  assert.deepEqual(symbolsOf('src/wrapped.ts', source).map((item) => item.symbol), [
    'arrow:wrapped',
    'arrow:checked',
    'arrow:holder.callback',
    'constructor:Klass',
    'constructor:<anonymous@5>'
  ]);
});

test('Scenario: identities keep meaningful spaces on one line and cover more binding forms', () => {
  const source = [
    'obj["a b"] = () => 1;',
    'const table = { [',
    '  key()',
    ']: () => 2 };',
    'cache.loader ||= () => 3;',
    'const asserted = <() => number>(() => 4);',
    'export default function () { return 5; }',
    'function withDefault(cb = () => 6, { pick = () => 7 } = {}) { return cb() + pick(); }',
    ''
  ].join('\n');
  assert.deepEqual(symbolsOf('src/forms.ts', source).map((item) => item.symbol), [
    'arrow:obj["a b"]',
    'arrow:[ key() ]',
    'arrow:cache.loader',
    'arrow:asserted',
    'function:default',
    'function:withDefault',
    'arrow:cb',
    'arrow:pick'
  ]);
});

test('Scenario: function bodies inside ambient namespaces are not inventoried', () => {
  assert.deepEqual(symbolsOf('src/ambient.ts', 'declare namespace Lib { function inner() { return 1; } }\nfunction real() { return 2; }\n').map((item) => item.symbol), ['function:real']);
});

test('Scenario: istanbul function-hit records measure an empty-bodied function instead of calling it not instrumented', () => {
  const source = 'class Service {\n  constructor(\n    private readonly store: Store,\n  ) {}\n  read() { return this.store; }\n}\n';
  const covered = crap.parseLcov('SF:src/service.ts\nFN:2,(anonymous_0)\nFN:5,(anonymous_1)\nFNDA:3,(anonymous_0)\nFNDA:0,(anonymous_1)\nDA:5,0\nend_of_record\n');
  const [ctor, read] = symbolsOf('src/service.ts', source, covered);
  assert.deepEqual([ctor.symbol, ctor.coverageStatus, ctor.coveragePct], ['constructor:Service', 'measured', 100]);
  assert.deepEqual([read.coverageStatus, read.coveragePct], ['measured', 0]);
  const unhit = crap.parseLcov('SF:src/service.ts\nFN:2,(anonymous_0)\nFNDA:0,(anonymous_0)\nend_of_record\n');
  assert.deepEqual([symbolsOf('src/service.ts', source, unhit)[0].coverageStatus, symbolsOf('src/service.ts', source, unhit)[0].coveragePct], ['measured', 0]);
});

test('Scenario: the mismatched check counts real source lines, not the empty piece after a final newline', () => {
  const source = 'function f(x) {\n  return x;\n}\n';
  const [fn] = symbolsOf('src/f.js', source, crap.parseLcov('SF:src/f.js\nDA:2,1\nDA:4,1\nend_of_record\n'));
  assert.equal(fn.coverageStatus, 'mismatched');
});

test('Scenario: a file with malformed LCOV records reports 0% file coverage instead of a readable-lines-only figure', () => {
  const [entry] = crap.parseLcov('SF:src/f.js\nDA:1,1\nDA:2,x\nend_of_record\n');
  assert.deepEqual([entry.malformedLines, entry.pct], [1, 0]);
});
