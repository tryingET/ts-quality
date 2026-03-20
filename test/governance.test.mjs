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
