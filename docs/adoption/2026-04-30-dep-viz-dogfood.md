---
summary: "External dogfood run: dep-viz depmodel report loading and filtering using public ts-quality@0.5.0."
read_when:
  - "Reviewing external adoption evidence for ts-quality dogfood runs."
  - "Investigating boundary clarity across runtime-trace-insights, dep-diet, and dep-viz."
type: "evidence"
---

# dep-viz external dogfood run — 2026-04-30

## Target and slice

- Target repo source: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Execution mode: temp copy only; no target-repo commit or source mutation.
- Temp run root: `/tmp/tsq-dogfood-depviz-c1Syhl`
- ts-quality CLI: public `ts-quality@0.5.0` via `NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality ...`
- Changed slice: `web/report/src/model-loader.js`, `web/report/src/app-shell.js`
- Focused tests: `tests/report-model-loader.test.mjs`, `tests/report-vulnerabilities.test.mjs`
- Run id: `depviz-report-model-dogfood-050`

## Boundary validated

- What this repo owns: depmodel consumption, report-model normalization, package/module/vulnerability relationship presentation, vulnerability filters, and human-facing report semantics.
- What this repo does not own: vulnerability scanning, dependency removal decisions, dependency-risk policy truth, depmodel production, or runtime trace capture.
- How this connects to the pipeline: `dep-viz` answers, "Given a depmodel, how do humans inspect and understand dependency risk?" It consumes a depmodel produced upstream; it should not decide whether a dependency is safe to remove.

This run validated the first-contact setup/retention path, but it did **not** reach a `ts-quality check` verdict because the focused dep-viz test command already failed in the temp copy. That is useful boundary evidence: the report UI/model contract currently has a stale expectation around overview fields.

## Control-plane shape

- source scope: `web/report/src/**/*.js`
- test scope: `tests/report-model-loader.test.mjs`, `tests/report-vulnerabilities.test.mjs`
- LCOV generation: `node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs`
- mutation baseline: `node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs`
- invariant: `depviz.report.depmodel.filters`
- witness: `.ts-quality/witnesses/depviz-report-depmodel-filters.json`

## Commands and receipts

```bash
find /home/tryinget/ai-society/softwareco/owned/dep-viz/web/report/src -maxdepth 2 -type f

SRC=/home/tryinget/ai-society/softwareco/owned/dep-viz
TARGET=$(mktemp -d /tmp/tsq-dogfood-depviz-XXXXXX)
rsync -a --exclude .git --exclude node_modules --exclude .ts-quality --exclude coverage "$SRC/" "$TARGET/"
cd "$TARGET"

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality doctor \
  --changed web/report/src/model-loader.js,web/report/src/app-shell.js \
  --machine

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality retention --machine

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality witness test \
  --invariant depviz.report.depmodel.filters \
  --scenario depmodel-load-and-filter \
  --source-files web/report/src/model-loader.js,web/report/src/app-shell.js \
  --test-files tests/report-model-loader.test.mjs,tests/report-vulnerabilities.test.mjs \
  --out .ts-quality/witnesses/depviz-report-depmodel-filters.json \
  -- node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs

node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality check \
  --changed web/report/src/model-loader.js,web/report/src/app-shell.js \
  --run-id depviz-report-model-dogfood-050

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality report \
  --run-id depviz-report-model-dogfood-050

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality explain \
  --run-id depviz-report-model-dogfood-050

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality retention --machine
```

Primary generated receipts:

- witness: `/tmp/tsq-dogfood-depviz-c1Syhl/.ts-quality/witnesses/depviz-report-depmodel-filters.json`
- witness receipt sidecar: `/tmp/tsq-dogfood-depviz-c1Syhl/.ts-quality/witnesses/depviz-report-depmodel-filters.receipt.json`
- direct focused-test log: `/tmp/tsq-dogfood-depviz-c1Syhl/logs/depviz-focused-test-direct.log`
- check/report/explain status log: `/tmp/tsq-dogfood-depviz-c1Syhl/logs/depviz-dogfood-check-after-failed-witness.log`

## Result

```json
{
  "outcome": "blocked-before-check",
  "mergeConfidence": null,
  "witness": {
    "status": "fail",
    "file": ".ts-quality/witnesses/depviz-report-depmodel-filters.json"
  },
  "focusedTest": {
    "command": "node --test tests/report-model-loader.test.mjs tests/report-vulnerabilities.test.mjs",
    "pass": 11,
    "fail": 1,
    "failure": "tests/report-model-loader.test.mjs app shell bootstraps from depmodel input: actual overview includes sbomFailedModules: [] but expected object omits it"
  },
  "check": {
    "exit": 1,
    "message": "coverage generation command fail; expected LCOV at coverage/lcov.info"
  },
  "mutation": null,
  "coverage": {
    "lcovGeneratedButCommandFailed": true,
    "checkRunBundle": null
  },
  "nextEvidenceAction": "fix focused dep-viz report-model expectation before rerunning ts-quality check",
  "sidecarSufficiency": "not applicable; check did not create a run bundle"
}
```

Focused-test failure detail:

```text
✖ app shell bootstraps from depmodel input
AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
+   sbomFailedModules: [],
```

The failing test indicates the current app-shell overview includes an `sbomFailedModules` field that the existing report-model test has not accepted. Until dep-viz decides whether that field is a stable report primitive, a focused ts-quality run should not be made green by changing the temp copy only.

## Adoption/retention observations

- `doctor --machine`: correctly loaded `ts-quality.config.json`, accepted comma-separated changed scope, found 10 report source files and 2 focused tests, reported missing LCOV with the configured generator, surfaced the mutation command, and emitted witness/retention/script-snippet recommendations.
- CLI usage note: `--changed` is a single option whose value may be comma-separated; a repeated `--changed` attempt failed with `--changed may only be specified once`.
- `retention --machine` before execution: projected reusable config/control-plane files and future witness/public-key patterns; projected generated runs, latest pointer, mutation manifest, LCOV, witness receipt sidecars, and private keys as ephemeral/ignored.
- `retention --machine` after failed witness/check: correctly treated the failed witness JSON as a reusable execution witness record and kept generated/ambient artifacts ephemeral.
- reusable files: `ts-quality.config.json`, `.ts-quality/invariants.ts`, `.ts-quality/constitution.ts`, `.ts-quality/agents.ts`, approvals/waivers/overrides JSON, and `.ts-quality/witnesses/depviz-report-depmodel-filters.json`.
- ephemeral files: `.ts-quality/runs/`, `.ts-quality/latest.json`, `.ts-quality/mutation-manifest.json`, `coverage/lcov.info`, `.ts-quality/witnesses/*.receipt.json`, private keys.

## Blockers or product hardening candidates

- Target-slice blocker: dep-viz needs a repo decision/test update for whether `sbomFailedModules` is part of the stable overview primitive returned by `createAppShell(...).data.getOverview()`.
- Target-slice blocker: after the focused tests pass, rerun the same public-package `ts-quality check` to collect mutation, coverage, merge-confidence, next-evidence, and sidecar-sufficiency results.
- Product hardening candidate: consider documenting the comma-separated `--changed <a,b,c>` shape prominently in adoption examples, because repeated `--changed` is rejected.
