---
summary: "External dogfood run: runtime-trace-insights runtime-record flow using public ts-quality@0.5.0."
read_when:
  - "Reviewing external adoption evidence for ts-quality dogfood runs."
  - "Investigating boundary clarity across runtime-trace-insights, dep-diet, and dep-viz."
type: "evidence"
---

# runtime-trace-insights external dogfood run — 2026-04-30

## Target and slice

- Target repo source: `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
- Execution mode: temp copy only; no target-repo commit or source mutation.
- Temp run root: `/tmp/tsq-dogfood-runtime-trace-M9KRBX`
- ts-quality CLI: public `ts-quality@0.5.0` via `NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality ...`
- Changed slice: `src/runtime_record/runtime_record_flow.mjs`
- Focused test: `tests/runtime_record_flow.test.mjs`
- Run id: `runtime-trace-flow-dogfood-050`

## Boundary validated

- What this repo owns: runtime trace capture, runtime-record result shaping, trace/manifest artifacts, and AppMap setup guidance when AppMap is unavailable.
- What this repo does not own: dependency pruning decisions, vulnerability policy, depmodel-wide actionability, or visualization/report UI.
- How this connects to the pipeline: `runtime-trace-insights` answers, "What actually happened at runtime, and what trace artifact proves it?" Its runtime-record artifacts are upstream evidence for `dep-diet`, not a dependency-risk verdict.

This run validated the first-contact setup path and execution-backed witness path, but it did **not** validate merge readiness: the public `ts-quality@0.5.0` check found mutation and coverage pressure in the selected runtime-record slice.

## Control-plane shape

- source scope: `src/runtime_record/**/*.mjs`
- test scope: `tests/runtime_record_flow.test.mjs`
- LCOV generation: `node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info tests/runtime_record_flow.test.mjs`
- mutation baseline: `node --test tests/runtime_record_flow.test.mjs`
- invariant: `runtime.record.flow.artifacts`
- witness: `.ts-quality/witnesses/runtime-record-flow-artifacts.json`

## Commands and receipts

```bash
SRC=/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights
TARGET=$(mktemp -d /tmp/tsq-dogfood-runtime-trace-XXXXXX)
rsync -a --exclude .git --exclude node_modules --exclude .ts-quality --exclude coverage "$SRC/" "$TARGET/"
cd "$TARGET"

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality doctor \
  --changed src/runtime_record/runtime_record_flow.mjs \
  --machine

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality retention --machine

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality witness test \
  --invariant runtime.record.flow.artifacts \
  --scenario trace-manifest-and-guidance \
  --source-files src/runtime_record/runtime_record_flow.mjs \
  --test-files tests/runtime_record_flow.test.mjs \
  --out .ts-quality/witnesses/runtime-record-flow-artifacts.json \
  -- node --test tests/runtime_record_flow.test.mjs

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality check \
  --changed src/runtime_record/runtime_record_flow.mjs \
  --run-id runtime-trace-flow-dogfood-050

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality report \
  --run-id runtime-trace-flow-dogfood-050

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality explain \
  --run-id runtime-trace-flow-dogfood-050

NPM_CONFIG_MIN_RELEASE_AGE=0 npx -p ts-quality@0.5.0 ts-quality retention --machine
```

Primary generated receipts:

- witness: `/tmp/tsq-dogfood-runtime-trace-M9KRBX/.ts-quality/witnesses/runtime-record-flow-artifacts.json`
- witness receipt sidecar: `/tmp/tsq-dogfood-runtime-trace-M9KRBX/.ts-quality/witnesses/runtime-record-flow-artifacts.receipt.json`
- run bundle: `/tmp/tsq-dogfood-runtime-trace-M9KRBX/.ts-quality/runs/runtime-trace-flow-dogfood-050/`
- report: `/tmp/tsq-dogfood-runtime-trace-M9KRBX/.ts-quality/runs/runtime-trace-flow-dogfood-050/report.md`
- explain: `/tmp/tsq-dogfood-runtime-trace-M9KRBX/.ts-quality/runs/runtime-trace-flow-dogfood-050/explain.txt`

## Result

```json
{
  "outcome": "fail",
  "mergeConfidence": 25,
  "mutation": {
    "killed": 3,
    "survived": 9,
    "errors": 0,
    "sites": 12,
    "status": "survivors"
  },
  "coverage": {
    "files": 3,
    "changedFunctionMin": 0,
    "changedFunctionsUnder80": 16,
    "minFileCoverage": 56.25
  },
  "nextEvidenceAction": {
    "kind": "mutation-survivors",
    "title": "Tighten focused assertions for 9 surviving mutant(s) across 8 mutation group(s).",
    "expectedConfidenceLift": 54,
    "suggestedEditFiles": ["tests/runtime_record_flow.test.mjs"]
  },
  "sidecarSufficiency": "actionable"
}
```

The witness itself passed and was matched as explicit execution-backed scenario support. The check failed because the existing focused test did not distinguish 9 selected mutants and left 16 changed functions below 80% coverage. The highest CRAP pressure was `function:detectAppMapPackage` at 42 against the configured budget of 25.

## Adoption/retention observations

- `doctor --machine`: correctly loaded `ts-quality.config.json`, accepted the explicit changed file, found 3 source files and 1 focused test, reported missing LCOV with the configured generator, surfaced the configured mutation command, and emitted witness/retention/script-snippet recommendations.
- `retention --machine` before execution: projected reusable config/control-plane files and future witness/public-key patterns; projected generated runs, latest pointer, mutation manifest, LCOV, witness receipt sidecars, and private keys as ephemeral/ignored.
- `retention --machine` after execution: moved `.ts-quality/witnesses/runtime-record-flow-artifacts.json` into the concrete keep set and kept `.ts-quality/runs/`, `.ts-quality/latest.json`, `.ts-quality/mutation-manifest.json`, `coverage/lcov.info`, witness receipt sidecars, and private key patterns out of the durable set.
- reusable files: `ts-quality.config.json`, `.ts-quality/invariants.ts`, `.ts-quality/constitution.ts`, `.ts-quality/agents.ts`, approvals/waivers/overrides JSON, and the witness JSON.
- ephemeral files: `.ts-quality/runs/`, `.ts-quality/latest.json`, `.ts-quality/mutation-manifest.json`, `coverage/lcov.info`, `.ts-quality/witnesses/*.receipt.json`, private keys.

## Blockers or product hardening candidates

- Target-slice blocker: runtime-record tests need more observable assertions around survivor groups in `tests/runtime_record_flow.test.mjs` before this slice should be considered merge-ready.
- Target-slice blocker: coverage pressure around AppMap probing, optional parsing, manifest parsing/writing, and failure-path helpers should be resolved or split into a narrower first slice before adopting a repo-local quality gate.
- Product hardening: no ts-quality product blocker was found in this run; `doctor`, `witness`, `check`, `report`, `explain`, and `retention` all executed from the public package and produced actionable artifacts.
