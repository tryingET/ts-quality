import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cli = path.join(root, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');

function tempCopy(name) {
  const source = path.join(root, 'fixtures', name);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `tsq-samples-${name}-`));
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function run(args, cwd) {
  const result = spawnSync('node', [cli, ...args, '--root', cwd], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

const target = tempCopy('governed-app');
run(['check'], target);
const runId = JSON.parse(fs.readFileSync(path.join(target, '.ts-quality', 'latest.json'), 'utf8')).latestRunId;
const runDir = path.join(target, '.ts-quality', 'runs', runId);
run(['authorize', '--agent', 'release-bot'], target);
const maintainerInitial = run(['authorize', '--agent', 'maintainer'], target);
run(['attest', 'sign', '--issuer', 'ci.verify', '--key-id', 'sample', '--private-key', '.ts-quality/keys/sample.pem', '--subject', `.ts-quality/runs/${runId}/verdict.json`, '--claims', 'ci.tests.passed', '--out', '.ts-quality/attestations/ci.tests.passed.json'], target);
const verifyText = run(['attest', 'verify', '--attestation', '.ts-quality/attestations/ci.tests.passed.json', '--trusted-keys', '.ts-quality/keys'], target);
fs.writeFileSync(path.join(runDir, 'attestation.verify.txt'), verifyText, 'utf8');
const overridesPath = path.join(target, '.ts-quality', 'overrides.json');
fs.writeFileSync(overridesPath, JSON.stringify([
  {
    kind: 'override',
    by: 'maintainer',
    role: 'maintainer',
    rationale: 'Sample override after human review.',
    createdAt: new Date().toISOString(),
    targetId: `${runId}:maintainer:merge`
  }
], null, 2));
run(['authorize', '--agent', 'maintainer'], target);
const proposalPath = path.join(target, 'proposal.json');
fs.writeFileSync(proposalPath, JSON.stringify({
  id: 'sample-amendment',
  title: 'Sample amendment',
  rationale: 'Documented migration window.',
  evidence: ['migration validated'],
  changes: [{ action: 'replace', ruleId: 'auth-risk-budget', rule: { kind: 'risk', id: 'auth-risk-budget', paths: ['src/auth/**'], message: 'Adjusted sample policy.', maxCrap: 20, minMutationScore: 0.7, minMergeConfidence: 60 } }],
  approvals: [
    { by: 'maintainer', role: 'maintainer', rationale: 'approve', createdAt: new Date().toISOString(), targetId: 'sample-amendment' },
    { by: 'maintainer', role: 'maintainer', rationale: 'second recorded approval', createdAt: new Date().toISOString(), targetId: 'sample-amendment' }
  ]
}, null, 2));
const amendOut = run(['amend', '--proposal', 'proposal.json'], target);

const outDir = path.join(root, 'examples', 'artifacts', 'governed-app');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const fileName of ['run.json', 'verdict.json', 'report.md', 'report.json', 'pr-summary.md', 'check-summary.txt', 'explain.txt', 'plan.txt', 'govern.txt']) {
  fs.copyFileSync(path.join(runDir, fileName), path.join(outDir, fileName));
}
const releaseDecisionPath = path.join(runDir, 'authorize.release-bot.merge.json');
if (fs.existsSync(releaseDecisionPath)) {
  fs.copyFileSync(releaseDecisionPath, path.join(outDir, 'authorize.release-bot.json'));
}
fs.writeFileSync(path.join(outDir, 'authorize.maintainer.json'), maintainerInitial, 'utf8');
const maintainerDecisionPath = path.join(runDir, 'authorize.maintainer.merge.json');
if (fs.existsSync(maintainerDecisionPath)) {
  fs.copyFileSync(maintainerDecisionPath, path.join(outDir, 'authorize.maintainer-approved.json'));
}
fs.copyFileSync(path.join(target, '.ts-quality', 'attestations', 'ci.tests.passed.json'), path.join(outDir, 'attestation.ci.verification.json'));
fs.copyFileSync(path.join(runDir, 'attestation.verify.txt'), path.join(outDir, 'attestation.verify.txt'));
fs.writeFileSync(path.join(outDir, 'amend.json'), amendOut, 'utf8');
console.log(`sample-artifacts: ok -> ${outDir}`);
