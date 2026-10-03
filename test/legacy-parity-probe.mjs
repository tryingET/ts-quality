// Standalone historical probe, deliberately not part of test/*.test.mjs.
// Requires both audited Git histories and an already installed TypeScript compiler.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const activeRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyRepo = process.env.LEGACY_TS_QUALITY_REPO ?? path.resolve(activeRepo, '../../infra/ts-quality-tools');
const pins = {
  legacy: 'c5c726e61f0783c473650dbfd25a59bced7d9c7f',
  active: '07f3529a714f63157d6e66d2866d6254c97a3259'
};
const require = createRequire(import.meta.url);
const ts = require('typescript');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { maxBuffer: 16 * 1024 * 1024 });
const source = (repo, pin, name) => git(repo, 'show', `${pin}:${name}`).toString('utf8');
const tempRoot = process.env.TMPDIR ?? path.join(os.homedir(), '.local/state/ts-quality/parity-probes');
fs.mkdirSync(tempRoot, { recursive: true });
const scratch = fs.mkdtempSync(path.join(tempRoot, 'ak6581-parity-'));
const observations = [];
const inventories = {};

function observe(id, legacy, active, equivalent) {
  observations.push({ id, legacy, active, equivalent });
}

function snapshot(label, repo) {
  const pin = pins[label];
  assert.equal(git(repo, 'rev-parse', `${pin}^{commit}`).toString().trim(), pin);
  const names = git(repo, 'ls-tree', '-r', '--name-only', pin).toString().trim().split('\n');
  const selected = names.filter((name) =>
    /^packages\/(crap4ts|ts-mutate|evidence-model)\/src\/.*\.ts$/.test(name)
    && !name.includes('/__tests__/'));
  const root = path.join(scratch, label);
  fs.mkdirSync(root, { recursive: true });
  fs.symlinkSync(path.join(activeRepo, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const exportsByFile = {};
  const sourceDigests = {};
  for (const name of selected) {
    const text = source(repo, pin, name);
    sourceDigests[name] = hash(text);
    const syntax = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    exportsByFile[name] = syntax.statements.flatMap((statement) => {
      if (ts.isExportDeclaration(statement)) {
        const from = statement.moduleSpecifier?.text;
        const names = statement.exportClause && ts.isNamedExports(statement.exportClause)
          ? statement.exportClause.elements.map((item) => item.name.text)
          : ['*'];
        return names.map((name) => ({ name, kind: from ? 're-export' : 'export-list', ...(from ? { from } : {}) }));
      }
      const exported = statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) return [];
      if (ts.isVariableStatement(statement)) {
        return statement.declarationList.declarations.map((declaration) => ({ name: declaration.name.getText(syntax), kind: 'value' }));
      }
      return statement.name ? [{ name: statement.name.getText(syntax), kind: ts.SyntaxKind[statement.kind] }] : [];
    });
    const destination = path.join(root, name.replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    // This is a behavioral harness, not a typecheck/build/release proof.
    const compiled = ts.transpileModule(text, {
      fileName: name,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    });
    fs.writeFileSync(destination, compiled.outputText);
  }
  const rootContracts = names.filter((name) =>
    (name.startsWith('scripts/') && /\.(mjs|sh|ts)$/.test(name))
    || name.startsWith('.github/workflows/') || /^\.release-please/.test(name)
    || /^justfile$/i.test(name) || /^package(-lock)?\.json$/.test(name));
  inventories[label] = {
    commit: pin,
    tree: git(repo, 'rev-parse', `${pin}^{tree}`).toString().trim(),
    exportsByFile,
    sourceDigests,
    rootScripts: JSON.parse(source(repo, pin, 'package.json')).scripts,
    rootContractDigests: Object.fromEntries(rootContracts.map((name) => [name, hash(git(repo, 'show', `${pin}:${name}`))])),
    packageManifests: Object.fromEntries(['crap4ts', 'ts-mutate', ...(label === 'active' ? ['ts-quality'] : [])].map((name) =>
      [name, JSON.parse(source(repo, pin, `packages/${name}/package.json`))]))
  };
  return root;
}

try {
  const oldRoot = snapshot('legacy', legacyRepo);
  const newRoot = snapshot('active', activeRepo);
  const oldCrap = require(path.join(oldRoot, 'packages/crap4ts/src/index.js'));
  const newCrap = require(path.join(newRoot, 'packages/crap4ts/src/index.js'));
  const oldMutate = require(path.join(oldRoot, 'packages/ts-mutate/src/index.js'));
  const newMutate = require(path.join(newRoot, 'packages/ts-mutate/src/index.js'));
  assert.equal(oldMutate.DEFAULT_TEST_COMMAND, 'npm test -- --runInBand');
  assert.equal(oldMutate.defaultOptions().testCommand, oldMutate.DEFAULT_TEST_COMMAND);
  inventories.legacy.mutationLeafDefaults = {
    testCommand: oldMutate.DEFAULT_TEST_COMMAND,
    timeoutFactor: oldMutate.defaultOptions().timeoutFactor,
    mutationWarning: oldMutate.defaultOptions().mutationWarning
  };
  inventories.legacy.runtimeExports = { crap4ts: Object.keys(oldCrap).sort(), tsMutate: Object.keys(oldMutate).sort() };
  inventories.active.runtimeExports = { crap4ts: Object.keys(newCrap).sort(), tsMutate: Object.keys(newMutate).sort() };

  for (const packageName of ['crap4ts', 'tsMutate']) {
    const missing = inventories.legacy.runtimeExports[packageName].filter((name) => !inventories.active.runtimeExports[packageName].includes(name));
    observe(`exports-${packageName}`, inventories.legacy.runtimeExports[packageName], inventories.active.runtimeExports[packageName], missing.length === 0);
    assert.ok(missing.length > 0, 'Update assessment if compatibility exports are restored');
  }

  const fixtureRoot = path.join(scratch, 'fixture');
  fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
  const fixturePath = path.join(fixtureRoot, 'src/fixture.ts');
  function analyze(text) {
    fs.writeFileSync(fixturePath, text);
    const syntax = ts.createSourceFile(fixturePath, text, ts.ScriptTarget.Latest, true);
    return {
      old: oldCrap.extractFunctionsFromSourceFile(syntax, fixtureRoot),
      active: newCrap.analyzeSource('src/fixture.ts', text, [], new Set(), [])
    };
  }
  const nested = analyze('function outer(x) { function inner(y) { if (y) return y; return null; } return inner(x); }');
  const oldOuter = nested.old.find((item) => item.name === 'outer').complexity;
  const newOuter = nested.active.find((item) => item.symbol === 'function:outer').complexity;
  assert.equal(oldOuter, 1);
  assert.equal(newOuter, 2);
  observe('nested-function-complexity', oldOuter, newOuter, false);

  const members = analyze('class Box { constructor(x) { this.x = x; } get value() { return this.x; } set value(x) { this.x = x; } method() { return this.x; } }');
  assert.equal(members.old.length, 4);
  assert.equal(members.active.length, 1);
  observe('constructor-accessor-discovery', members.old.map((item) => item.name), members.active.map((item) => item.symbol), false);

  const declaration = analyze('declare function absent(x: number): number;');
  assert.equal(declaration.old.length, 0);
  assert.equal(declaration.active.length, 1);
  observe('ambient-function-discovery', declaration.old.length, declaration.active.length, false);

  const rangeText = 'function f(x) {\n  // comment, not LCOV-instrumented\n  return x;\n}\n';
  const oldRange = oldCrap.computeRangeCoverage(new Map([[3, 1]]), 1, 4).coverage * 100;
  const newRange = newCrap.lineCoverage({ 3: 1 }, { startLine: 1, endLine: 4 }, rangeText);
  assert.equal(oldRange, 100);
  assert.equal(newRange, 33.33);
  observe('lcov-range-denominator', oldRange, newRange, false);

  const duplicateLcov = 'SF:src/fixture.ts\nDA:1,1\nend_of_record\nSF:src/fixture.ts\nDA:2,1\nend_of_record\n';
  const oldDuplicate = oldCrap.parseLcov(duplicateLcov);
  const newDuplicate = newCrap.parseLcov(duplicateLcov);
  assert.equal(oldDuplicate.size, 1);
  assert.equal(newDuplicate.length, 2);
  observe('lcov-duplicate-records', { records: oldDuplicate.size, lines: [...oldDuplicate.values()][0].size }, { records: newDuplicate.length, lines: newDuplicate.map((item) => Object.keys(item.lines).length) }, false);

  // Intentional language constructs are corpus data, not executable probe code.
  const fixtureBytes = fs.readFileSync(path.join(activeRepo, 'docs/adoption/legacy-parity/fixtures.json'));
  const operatorFixtures = JSON.parse(fixtureBytes.toString('utf8'));
  assert.equal(operatorFixtures.length, 9);
  for (const { id, source: text, equivalent: expected } of operatorFixtures) {
    assert.equal(typeof id, 'string');
    assert.equal(typeof text, 'string');
    assert.equal(typeof expected, 'boolean');
    const syntax = ts.createSourceFile(fixturePath, text, ts.ScriptTarget.Latest, true);
    const oldSites = oldMutate.discoverMutationSites(syntax, fixtureRoot).sites;
    const newSites = newMutate.discoverMutationSites(text, 'src/fixture.ts');
    const normalize = (sites, old) => sites.map((site) => [old ? site.start : site.startOffset, old ? site.end : site.endOffset, site.original, old ? site.mutant : site.replacement]);
    const left = normalize(oldSites, true);
    const right = normalize(newSites, false);
    assert.equal(JSON.stringify(left) === JSON.stringify(right), expected, id);
    observe(`operator-${id}`, left, right, expected);
    for (const site of oldSites) assert.equal(oldMutate.applyMutation(text, site), text.slice(0, site.start) + site.mutant + text.slice(site.end));
    for (const site of newSites) assert.equal(newMutate.applyMutation(text, site), text.slice(0, site.startOffset) + site.replacement + text.slice(site.endOffset));
  }

  const missingCoverageText = 'function f() { return true; }';
  fs.writeFileSync(fixturePath, missingCoverageText);
  const oldNoCoverage = oldCrap.buildEntries(oldCrap.parseArgs(['--cwd', fixtureRoot]));
  const newNoCoverage = newCrap.analyzeCrap({ rootDir: fixtureRoot, sourceFiles: ['src/fixture.ts'] });
  assert.equal(oldNoCoverage[0].crap, null);
  assert.equal(newNoCoverage.hotspots[0].crap, 2);
  observe('missing-coverage-crap', oldNoCoverage[0].crap, newNoCoverage.hotspots[0].crap, false);

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const cli = (root, args) => {
    const result = spawnSync(process.execPath, [path.join(root, 'packages/crap4ts/src/cli.js'), ...args], { cwd: fixtureRoot, encoding: 'utf8', env });
    assert.equal(result.error, undefined);
    return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
  };
  const oldUnknown = cli(oldRoot, ['--unknown']);
  const newUnknown = cli(newRoot, ['--unknown']);
  assert.equal(oldUnknown.exitCode, 1);
  assert.equal(newUnknown.exitCode, 0);
  observe('crap-cli-unknown-option', oldUnknown, newUnknown, false);
  const oldJson = cli(oldRoot, ['--json']);
  const newJson = cli(newRoot, ['--json']);
  assert.equal(oldJson.exitCode, 0);
  assert.equal(newJson.exitCode, 0);
  const leftJson = JSON.parse(oldJson.stdout);
  const rightJson = JSON.parse(newJson.stdout);
  assert.ok(Array.isArray(leftJson));
  assert.ok(Array.isArray(rightJson.files));
  observe('crap-cli-json-shape', { kind: 'flat-array', count: leftJson.length }, { kind: 'report-object', count: rightJson.summary.functionCount }, false);

  assert.ok(Object.values(inventories.legacy.rootScripts).length === 33);
  const result = {
    schemaVersion: 1,
    task: 6581,
    operatorFixtureSha256: hash(fixtureBytes),
    outcome: 'complete_parity_disproved_at_audited_pins',
    retirementAccepted: false,
    runtime: { node: process.version, typescript: ts.version, platform: process.platform, arch: process.arch },
    method: 'Pinned Git sources transpiled into private scratch with the same preinstalled TypeScript; assertions verify historical differences, not production/release/full-validation proof. No mutation subprocess runner tests.',
    inventories,
    observations,
    fixtureChecks: observations.length,
    equivalentFixtures: observations.filter((item) => item.equivalent).length,
    differingFixtures: observations.filter((item) => !item.equivalent).length
  };
  const output = JSON.stringify(result, null, 2).replaceAll(scratch, '<scratch>');
  process.stdout.write(`${output}\n`);
} finally {
  // Only this process's private, synchronous probe scratch is removed.
  fs.rmSync(scratch, { recursive: true, force: true });
}
