---
summary: "Recommended CI sequence for building evidence and running ts-quality checks."
read_when:
  - "When wiring ts-quality into CI"
  - "When checking prerequisites for meaningful automated runs"
type: "how-to"
---

# CI integration

This guide is for **target repositories** using the published `ts-quality` package. If you are developing `ts-quality` itself, use the source-tree fixture commands in the final section instead.

CI should keep three habits explicit:

1. changed scope is supplied by one `--changed <a,b,c>` value or a configured diff file,
2. every reviewed run has a stable `--run-id`, and
3. downstream projections read that same run id instead of ambient `.ts-quality/latest.json`.

## Agent/CI command consumption matrix

| Need | Command shape | Machine-readable surface | Scope/run binding |
|---|---|---|---|
| First-contact setup diagnostics | `ts-quality doctor --machine --changed "$CHANGED_SCOPE"` | compact AX line protocol (`TSQ_DOCTOR_MACHINE_V1`) | changed scope is one comma-separated value |
| Artifact retention planning | `ts-quality retention --machine` | compact AX line protocol (`TSQ_RETENTION_PLAN_V1`) | read-only projection; no run id |
| Evidence-producing review run | `ts-quality check --changed "$CHANGED_SCOPE" --run-id "$RUN_ID"` | durable run artifacts under `.ts-quality/runs/<run-id>/` | one changed-scope value plus explicit run id |
| Structured report projection | `ts-quality report --run-id "$RUN_ID" --json` | structured AX JSON projection | same reviewed run id |
| Human-readable review projections | `explain`, `plan`, `govern` with `--run-id "$RUN_ID"` | stdout text | same reviewed run id |
| Legitimacy decision | `authorize --agent <agent> --run-id "$RUN_ID"` | run-bound decision/bundle artifacts | same reviewed run id |
| Attestation verification | `attest verify ... --json` | structured JSON verification record | subject/attestation paths bind the reviewed artifact |

There is no global `--json` or `--machine` flag. Strict option validation rejects unsupported flags and duplicate value options, so agents should consult `docs/cli-command-manifest.json` before synthesizing command lines.

## Target-repo CI recipe

Example package scripts in the target repo:

```json
{
  "scripts": {
    "quality": "npm run build --silent && npm run test:coverage --silent",
    "test:coverage": "mkdir -p coverage && node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info",
    "screening:doctor": "ts-quality doctor --config ts-quality.config.json --machine",
    "screening:witness-refresh": "ts-quality witness refresh --config ts-quality.config.json",
    "screening:check": "ts-quality check --config ts-quality.config.json",
    "screening:report": "ts-quality report --json"
  }
}
```

Example CI step:

```bash
set -euo pipefail

CHANGED_SCOPE="${TSQ_CHANGED_SCOPE:-src/auth/token.ts}"
RUN_ID="${TSQ_RUN_ID:-ci-${GITHUB_SHA:-local}}"

npm ci
npm run quality --silent

npx ts-quality doctor --config ts-quality.config.json --machine --changed "$CHANGED_SCOPE"
npx ts-quality witness refresh --config ts-quality.config.json --changed "$CHANGED_SCOPE"
npx ts-quality check --config ts-quality.config.json --changed "$CHANGED_SCOPE" --run-id "$RUN_ID"
npx ts-quality report --run-id "$RUN_ID" --json > ".ts-quality/runs/$RUN_ID/report.projected.json"
npx ts-quality explain --run-id "$RUN_ID"
npx ts-quality govern --run-id "$RUN_ID"
```

Use a comma-separated changed scope for multiple files:

```bash
npx ts-quality check --changed "src/a.ts,src/b.ts" --run-id "$RUN_ID"
```

Do not pass repeated `--changed` options such as `--changed src/a.ts --changed src/b.ts`; strict CLI validation rejects duplicate value options. Prefer a repo-generated diff file in `ts-quality.config.json` when CI needs exact hunk-level scope.

Upload the run directory as the CI artifact:

```text
.ts-quality/runs/<run-id>/
```

The immutable source of truth is `run.json`. Markdown, stdout, `report --json`, authorization files, and next-evidence-action sidecars are projections or run-bound decision records.

## Coverage and TypeScript runtime parity

`ts-quality check` is strongest when LCOV already exists. If CI does not produce LCOV as a separate step, configure `coverage.generateCommand` so `check` creates the LCOV parent directory, runs the repo-local coverage command when LCOV is missing, fails closed on generation errors, and records the generation receipt in `run.json` plus `coverage-generation.json` / `coverage-generation.txt` sidecars.

For TypeScript projects that execute built output, make source-map coverage explicit, for example:

```bash
NODE_OPTIONS=--enable-source-maps node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info
```

Keep screening on authored `src/**`, configure `mutations.runtimeMirrorRoots` for built runtime roots such as `dist`, and make the mutation test command build before testing when needed.

## Witnesses in CI

`witness refresh` is the repo-native CI/operator surface for pre-refreshing configured execution witnesses against the current changed scope before `check`.

For one-off/manual witness proof, keep the command narrow:

```bash
npx ts-quality witness test \
  --invariant auth.refresh.validity \
  --scenario expired-boundary \
  --source-files src/auth/token.ts \
  --test-files test/auth/token.test.ts \
  --out .ts-quality/witnesses/auth-refresh-expired-boundary.json \
  -- npm run test:auth-token --silent
```

A broad repo-global test can be a mutation baseline, but the witness should prove the smallest behavior-bearing scenario you would trust in review.

## Fail-closed handling

A failed run is still useful evidence. Do not widen changed scope or lower policy thresholds to make CI green. Inspect:

- `check-summary.txt` for the concise evidence basis,
- `next-evidence-action.json` for the primary evidence obligation,
- `mutation-remediation.json` when survivors remain,
- `coverage-generation.txt` when coverage generation failed,
- `govern.txt` and `authorize.*.json` when governance or legitimacy blocks.

Turn `nextEvidenceAction` into bounded work rather than broad cleanup:

1. read `.ts-quality/runs/$RUN_ID/next-evidence-action.json`,
2. keep the follow-up inside `primaryAction.suggestedEditFiles` and any named witness/governance/coverage targets,
3. use `next-evidence-action.prompt.md` for LLM handoff or `next-evidence-action.ak-task.json` when the target repo uses task tooling,
4. rerun the target repo quality command plus the same `check --changed "$CHANGED_SCOPE" --run-id "$RUN_ID"` shape or a new explicit run id for the follow-up review.

Do not widen changed scope, lower thresholds, or switch to ambient latest-pointer projections to make a failed run green. For examples where high coverage still fails because mutation pressure is weak, see `docs/adoption/negative-path-examples.md`.

## Attestation and authorization

When CI signs or authorizes a run, bind every command to the same run id:

```bash
npx ts-quality attest sign \
  --root . \
  --issuer ci.verify \
  --key-id ci.verify \
  --private-key .ts-quality/keys/ci.verify.pem \
  --subject ".ts-quality/runs/$RUN_ID/verdict.json" \
  --claims ci.tests.passed \
  --out .ts-quality/attestations/ci.tests.passed.json

npx ts-quality attest verify \
  --root . \
  --attestation .ts-quality/attestations/ci.tests.passed.json \
  --trusted-keys .ts-quality/keys \
  --json

npx ts-quality authorize --root . --agent release-bot --run-id "$RUN_ID"
```

`authorize` writes run-bound decision and bundle artifacts under `.ts-quality/runs/<run-id>/`. If the grant, confidence floor, governance state, or attestation binding is insufficient, keep the non-approval result and route human review.

## Developing ts-quality against fixtures

When maintaining this repo from source, fixture commands may use the built CLI directly:

```bash
npm run build --silent
node dist/packages/ts-quality/src/cli.js check --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js explain --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js report --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js govern --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js authorize --root fixtures/governed-app --agent release-bot --run-id fixture-review
```

Those source-tree commands are repo-development examples, not the preferred target-repo CI shape.
