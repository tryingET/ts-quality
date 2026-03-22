import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cli = path.join(root, 'dist', 'packages', 'ts-quality', 'src', 'cli.js');
const evidenceModel = await import(pathToFileURL(path.join(root, 'dist', 'packages', 'evidence-model', 'src', 'index.js')).href);
const legitimacy = await import(pathToFileURL(path.join(root, 'dist', 'packages', 'legitimacy', 'src', 'index.js')).href);
const policyEngine = await import(pathToFileURL(path.join(root, 'dist', 'packages', 'policy-engine', 'src', 'index.js')).href);
const tsQuality = await import(pathToFileURL(path.join(root, 'dist', 'packages', 'ts-quality', 'src', 'index.js')).href);

const SAMPLE_FIXTURE = 'governed-app';
const SAMPLE_RUN_ID = 'sample-governed-app-run';
const SAMPLE_CREATED_AT = '2026-01-01T00:00:00.000Z';
const SAMPLE_ATTESTED_AT = '2026-01-01T00:05:00.000Z';
const SAMPLE_OVERRIDE_AT = '2026-01-01T00:10:00.000Z';
const SAMPLE_APPROVAL_AT = '2026-01-01T00:15:00.000Z';
const SAMPLE_EXECUTION_FINGERPRINT = 'sha256:sample-governed-app';
const SAMPLE_REPO_ROOT = 'tmp/tsq-samples-governed-app';
const SAMPLE_REPO_DIR = path.join(root, '.ts-quality', 'tmp-samples', SAMPLE_FIXTURE);

function prepareSampleRoot(name) {
  const source = path.join(root, 'fixtures', name);
  fs.rmSync(SAMPLE_REPO_DIR, { recursive: true, force: true });
  fs.cpSync(source, SAMPLE_REPO_DIR, { recursive: true });
  return SAMPLE_REPO_DIR;
}

function run(args, cwd) {
  const result = spawnSync('node', [cli, ...args, '--root', cwd], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function normalizeTimingText(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return text;
  }
  const normalized = text
    .replace(/\(\d+(?:\.\d+)?ms\)/g, '(0ms)')
    .replace(/duration_ms \d+(?:\.\d+)?/g, 'duration_ms 0');
  if (normalized.includes('\n\n✖ failing tests:')) {
    const [head] = normalized.split('\n\n✖ failing tests:');
    return `${head}\n\n✖ failing tests:\n\n<truncated failure output>`;
  }
  return normalized.slice(0, 280);
}

function normalizeRunArtifact(run, target) {
  return {
    ...run,
    runId: SAMPLE_RUN_ID,
    createdAt: SAMPLE_CREATED_AT,
    analysis: run.analysis
      ? {
          ...run.analysis,
          runId: SAMPLE_RUN_ID,
          createdAt: SAMPLE_CREATED_AT,
          executionFingerprint: SAMPLE_EXECUTION_FINGERPRINT
        }
      : run.analysis,
    repo: {
      ...run.repo,
      name: path.basename(target),
      rootDir: SAMPLE_REPO_ROOT
    },
    mutationBaseline: run.mutationBaseline
      ? {
          ...run.mutationBaseline,
          durationMs: 0,
          details: normalizeTimingText(run.mutationBaseline.details)
        }
      : run.mutationBaseline,
    mutations: run.mutations.map((result) => ({
      ...result,
      durationMs: 0,
      details: normalizeTimingText(result.details)
    })),
    verdict: {
      ...run.verdict,
      findings: run.verdict.findings.map((finding) => ({
        ...finding,
        evidence: finding.evidence.map((entry) => normalizeTimingText(entry))
      }))
    }
  };
}

function writeNormalizedRunArtifacts(runDir, run) {
  evidenceModel.writeJson(path.join(runDir, 'run.json'), run);
  evidenceModel.writeJson(path.join(runDir, 'report.json'), run);
  evidenceModel.writeJson(path.join(runDir, 'verdict.json'), run.verdict);
  fs.writeFileSync(path.join(runDir, 'report.md'), `${policyEngine.renderMarkdownReport(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(runDir, 'pr-summary.md'), `${policyEngine.renderPrSummary(run)}\n`, 'utf8');
  fs.writeFileSync(path.join(runDir, 'explain.txt'), `${policyEngine.renderExplainText(run)}\n`, 'utf8');
}

function writeStableAttestation(target, runDir) {
  const privateKeyPem = fs.readFileSync(path.join(target, '.ts-quality', 'keys', 'sample.pem'), 'utf8');
  const attestation = legitimacy.signAttestation({
    issuer: 'ci.verify',
    keyId: 'sample',
    privateKeyPem,
    subjectType: 'json-artifact',
    subjectDigest: evidenceModel.fileDigest(path.join(runDir, 'verdict.json')),
    claims: ['ci.tests.passed'],
    payload: {
      subjectFile: `.ts-quality/runs/${SAMPLE_RUN_ID}/verdict.json`,
      runId: SAMPLE_RUN_ID,
      artifactName: 'verdict.json'
    },
    issuedAt: SAMPLE_ATTESTED_AT
  });
  const attestationPath = path.join(target, '.ts-quality', 'attestations', 'ci.tests.passed.json');
  legitimacy.saveAttestation(attestationPath, attestation);
  const verifyText = tsQuality.attestVerify(target, '.ts-quality/attestations/ci.tests.passed.json', '.ts-quality/keys');
  fs.writeFileSync(path.join(runDir, 'attestation.verify.txt'), verifyText, 'utf8');
}

const target = prepareSampleRoot(SAMPLE_FIXTURE);
run(['check', '--run-id', SAMPLE_RUN_ID], target);
const runDir = path.join(target, '.ts-quality', 'runs', SAMPLE_RUN_ID);
const normalizedRun = normalizeRunArtifact(JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8')), target);
writeNormalizedRunArtifacts(runDir, normalizedRun);

run(['authorize', '--agent', 'release-bot'], target);
const maintainerInitial = run(['authorize', '--agent', 'maintainer'], target);
writeStableAttestation(target, runDir);

const overridesPath = path.join(target, '.ts-quality', 'overrides.json');
fs.writeFileSync(overridesPath, JSON.stringify([
  {
    kind: 'override',
    by: 'maintainer',
    role: 'maintainer',
    rationale: 'Sample override after human review.',
    createdAt: SAMPLE_OVERRIDE_AT,
    targetId: `${SAMPLE_RUN_ID}:maintainer:merge`
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
    { by: 'maintainer', role: 'maintainer', rationale: 'approve', createdAt: SAMPLE_APPROVAL_AT, targetId: 'sample-amendment' },
    { by: 'maintainer', role: 'maintainer', rationale: 'second recorded approval', createdAt: SAMPLE_APPROVAL_AT, targetId: 'sample-amendment' }
  ]
}, null, 2));
const amendOut = run(['amend', '--proposal', 'proposal.json'], target);

const outDir = path.join(root, 'examples', 'artifacts', SAMPLE_FIXTURE);
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
fs.rmSync(SAMPLE_REPO_DIR, { recursive: true, force: true });
console.log(`sample-artifacts: ok -> ${outDir}`);
