import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'node:test';
import assert from 'assert/strict';
import { fixturePath, importDist } from './helpers.mjs';

const governance = await importDist('packages', 'governance', 'src', 'index.js');
const config = await importDist('packages', 'ts-quality', 'src', 'config.js');

test('evaluateGovernance catches extensionless forbidden imports', () => {
  const rootDir = fixturePath('mini-monorepo');
  const constitution = config.loadConstitution(rootDir, '.ts-quality/constitution.ts');
  const findings = governance.evaluateGovernance({
    rootDir,
    constitution,
    changedFiles: ['packages/api/src/consumer.js'],
    changedRegions: []
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /identity\/src\/store\.js/);
});

test('evaluateGovernance catches forbidden imports resolved through tsconfig path aliases', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-alias-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'app'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'payments'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@payments/*': ['src/payments/*']
      }
    }
  }, null, 2));
  fs.writeFileSync(path.join(rootDir, 'src', 'app', 'entry.ts'), "import { charge } from '@payments/charge';\nexport const value = charge();\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'payments', 'charge.ts'), 'export const charge = () => 1;\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'app-no-payments',
      from: ['src/app/**'],
      to: ['src/payments/**'],
      mode: 'forbid',
      message: 'App layer must not import payments directly.'
    }],
    changedFiles: ['src/app/entry.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /@payments\/charge -> src\/payments\/charge\.ts/);
});

test('evaluateGovernance resolves aliases from the nearest package tsconfig in nested repos', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-nested-alias-'));
  fs.mkdirSync(path.join(rootDir, 'packages', 'app', 'src'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages', 'payments', 'src'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }, null, 2));
  fs.writeFileSync(path.join(rootDir, 'packages', 'app', 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@payments/*': ['../payments/src/*']
      }
    }
  }, null, 2));
  fs.writeFileSync(path.join(rootDir, 'packages', 'app', 'src', 'entry.ts'), "import { charge } from '@payments/charge';\nexport const value = charge();\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'packages', 'payments', 'src', 'charge.ts'), 'export const charge = () => 1;\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'app-no-payments',
      from: ['packages/app/**'],
      to: ['packages/payments/**'],
      mode: 'forbid',
      message: 'App package must not import payments package directly.'
    }],
    changedFiles: ['packages/app/src/entry.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /@payments\/charge -> packages\/payments\/src\/charge\.ts/);
});

test('evaluateGovernance catches forbidden re-export declarations', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-reexport-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export { currentUser } from '../identity/store';\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not re-export identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden export-all declarations', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-export-all-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export * from '../identity/store';\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not export identity state wholesale.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden import-equals declarations', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-import-equals-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "import identityStore = require('../identity/store');\nexport const currentUser = identityStore.currentUser();\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not import identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden dynamic imports', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-dynamic-import-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export async function readIdentity() { return import('../identity/store'); }\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not dynamically import identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden dynamic imports expressed as no-substitution template literals', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-template-import-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export async function readIdentity() { return import(`../identity/store`); }\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not dynamically import identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require calls that flow through local aliases', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-alias-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  let load;\n  load = require;\n  return load('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require aliases introduced in loop scope', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-loop-scope-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  for (let load = require; load; load = null) {\n    return load('../identity/store');\n  }\n  return null;\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require calls that flow through chained assignments', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-chain-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  let primary;\n  let fallback;\n  fallback = primary = require;\n  return fallback('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require aliases inside class methods', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-class-method-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export class Reader {\n  readIdentity() {\n    const load = require;\n    return load('../identity/store');\n  }\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require aliases introduced through conditional assignment expressions', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-conditional-assignment-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  let load;\n  if ((load = require)) {\n    return load('../identity/store');\n  }\n  return null;\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require calls that flow through logical fallback aliases', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-logical-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "function safeLoad() { return null; }\nexport function readIdentity() {\n  const loadFromOr = require || safeLoad;\n  const loadFromNullish = null ?? require;\n  loadFromOr('../identity/store');\n  return loadFromNullish('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 2);
  for (const finding of findings) {
    assert.match(finding.evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
  }
});

test('evaluateGovernance catches forbidden require aliases introduced through sequence expressions', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-sequence-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "function safeLoad() { return null; }\nexport function readIdentity() {\n  const loadFromSequence = (0, require);\n  const ignoredRequire = (require, safeLoad);\n  loadFromSequence('../identity/store');\n  return ignoredRequire('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require aliases introduced through statically truthy conditionals', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-conditional-true-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "function safeLoad() { return null; }\nexport function readIdentity() {\n  const load = true ? require : safeLoad;\n  return load('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance ignores statically falsy conditional branches that only mention require', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-conditional-false-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "function safeLoad() { return null; }\nexport function readIdentity() {\n  const load = false ? require : safeLoad;\n  return load('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 0);
});

test('evaluateGovernance does not treat logical expressions that resolve away from require as active imports', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-logical-negative-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "function safeLoad() { return null; }\nexport function readIdentity() {\n  const load = require && safeLoad;\n  return load('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 0);
});

test('evaluateGovernance catches forbidden require calls that flow through destructuring', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-destructure-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  const [loadFromArray] = [require];\n  const { loadFromObject } = { loadFromObject: require };\n  const { require: renamedRequire } = { require };\n  let loadFromArrayAssignment;\n  [loadFromArrayAssignment] = [require];\n  let loadFromObjectAssignment;\n  ({ loadFromObjectAssignment } = { loadFromObjectAssignment: require });\n  loadFromArray('../identity/store');\n  loadFromObject('../identity/store');\n  renamedRequire('../identity/store');\n  loadFromArrayAssignment('../identity/store');\n  return loadFromObjectAssignment('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 5);
  for (const finding of findings) {
    assert.match(finding.evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
  }
});

test('evaluateGovernance catches forbidden require calls that flow through aliased destructuring containers', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-destructure-alias-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  const loaderArray = [require];\n  const loaderObject = { loadFromObject: require, loadFromObjectAssignment: require };\n  const [loadFromArray] = loaderArray;\n  const { loadFromObject } = loaderObject;\n  let loadFromArrayAssignment;\n  [loadFromArrayAssignment] = loaderArray;\n  let loadFromObjectAssignment;\n  ({ loadFromObjectAssignment } = loaderObject);\n  loadFromArray('../identity/store');\n  loadFromObject('../identity/store');\n  loadFromArrayAssignment('../identity/store');\n  return loadFromObjectAssignment('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 4);
  for (const finding of findings) {
    assert.match(finding.evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
  }
});

test('evaluateGovernance catches forbidden require calls that flow through destructured parameter defaults', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-param-default-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity({ load } = { load: require }) {\n  return load('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
});

test('evaluateGovernance catches forbidden require calls that flow through property and element access on tracked containers', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-property-access-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  const loaderObject = { load: require, loadByKey: require };\n  const loaderArray = [require];\n  const loadFromProperty = loaderObject.load;\n  const loadFromElement = loaderObject['loadByKey'];\n  const loadFromIndex = loaderArray[0];\n  const loadFromStringIndex = loaderArray['0'];\n  loadFromProperty('../identity/store');\n  loadFromElement('../identity/store');\n  loadFromIndex('../identity/store');\n  return loadFromStringIndex('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 4);
  for (const finding of findings) {
    assert.match(finding.evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
  }
});

test('evaluateGovernance catches forbidden require calls that flow through rest bindings on tracked containers', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-rest-bindings-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity() {\n  const [...arrayRest] = [require];\n  const { safe, ...objectRest } = { safe: null, load: require };\n  const loadFromArrayRest = arrayRest[0];\n  const loadFromObjectRest = objectRest.load;\n  loadFromArrayRest('../identity/store');\n  return loadFromObjectRest('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 2);
  for (const finding of findings) {
    assert.match(finding.evidence[0], /\.\.\/identity\/store -> src\/identity\/store\.ts/);
  }
});

test('evaluateGovernance does not treat unreachable conditional require aliases as active imports', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-require-conditional-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'src', 'identity'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "function safeLoad() {\n  return null;\n}\nexport function readIdentity() {\n  const load = false ? require : safeLoad;\n  return load('../identity/store');\n}\n", 'utf8');
  fs.writeFileSync(path.join(rootDir, 'src', 'identity', 'store.ts'), 'export const currentUser = () => ({ id: 1 });\n', 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 0);
});

test('evaluateGovernance does not mistake shadowed require parameters for the global loader', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-shadowed-require-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export function readIdentity(require) {\n  return require('../identity/store');\n}\n", 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not require identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 0);
});

test('evaluateGovernance fails closed on non-literal dynamic imports in boundary-scoped files', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-quality-governance-opaque-import-'));
  fs.mkdirSync(path.join(rootDir, 'src', 'shared'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'src', 'shared', 'audit.ts'), "export async function readIdentity(segment) { return import(`../${segment}/store`); }\n", 'utf8');

  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'boundary',
      id: 'shared-no-identity',
      from: ['src/shared/**'],
      to: ['src/identity/**'],
      mode: 'forbid',
      message: 'Shared code must not dynamically import identity state.'
    }],
    changedFiles: ['src/shared/audit.ts'],
    changedRegions: []
  });

  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /non-literal specifier/);
  assert.match(findings[0].evidence[0], /`\.\.\/\$\{segment\}\/store`/);
});

test('approval rules count only unique targeted approvals', () => {
  const rootDir = fixturePath('governed-app');
  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'approval',
      id: 'payments-maintainer-approval',
      paths: ['src/payments/**'],
      message: 'Payments require explicit approval.',
      minApprovals: 2,
      roles: ['maintainer']
    }],
    changedFiles: ['src/payments/ledger.js'],
    changedRegions: [],
    approvals: [
      { by: 'maintainer-a', role: 'maintainer', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'payments-maintainer-approval' },
      { by: 'maintainer-a', role: 'maintainer', rationale: 'duplicate', createdAt: new Date().toISOString(), targetId: 'payments-maintainer-approval' },
      { by: 'maintainer-b', role: 'maintainer', rationale: 'wrong target', createdAt: new Date().toISOString(), targetId: 'other-target' }
    ]
  });
  assert.equal(findings.length, 1);
  assert.match(findings[0].evidence[0], /Approvals present 1\/2/);
});


test('approval rules accept exact run-targeted approvals when runId is provided', () => {
  const rootDir = fixturePath('governed-app');
  const findings = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'approval',
      id: 'payments-maintainer-approval',
      paths: ['src/payments/**'],
      message: 'Payments require explicit approval.',
      minApprovals: 1,
      roles: ['maintainer']
    }],
    changedFiles: ['src/payments/ledger.js'],
    changedRegions: [],
    runId: 'run-123',
    approvals: [
      { by: 'maintainer-a', role: 'maintainer', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'run-123:payments-maintainer-approval' }
    ]
  });
  assert.equal(findings.length, 0);
});


test('ownership rules require owner approval or an allowed agent approval', () => {
  const rootDir = fixturePath('governed-app');
  const withoutApproval = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'ownership',
      id: 'auth-owned',
      owner: 'security',
      paths: ['src/auth/**'],
      message: 'Auth code is reserved for security review.',
      allowedAgents: ['security-lead']
    }],
    changedFiles: ['src/auth/token.js'],
    changedRegions: [],
    approvals: []
  });
  const withAllowedAgent = governance.evaluateGovernance({
    rootDir,
    constitution: [{
      kind: 'ownership',
      id: 'auth-owned',
      owner: 'security',
      paths: ['src/auth/**'],
      message: 'Auth code is reserved for security review.',
      allowedAgents: ['security-lead']
    }],
    changedFiles: ['src/auth/token.js'],
    changedRegions: [],
    approvals: [
      { by: 'security-lead', role: 'security', rationale: 'ok', createdAt: new Date().toISOString(), targetId: 'auth-owned' }
    ]
  });

  assert.equal(withoutApproval.length, 1);
  assert.match(withoutApproval[0].evidence[0], /No ownership approval recorded/);
  assert.equal(withAllowedAgent.length, 0);
});
