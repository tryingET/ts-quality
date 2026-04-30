---
summary: "Vertical contract slice: runtime-trace-insights -> dep-diet -> dep-viz static/runtime dependency evidence corridor."
read_when:
  - "Reviewing cross-repo dependency intelligence adoption evidence."
  - "Planning next Gardener/runtime-trace/depmodel integration work."
type: "evidence"
---

# Static/runtime vertical contract slice — 2026-04-30

## Purpose

This slice proves the first end-to-end dependency intelligence corridor:

```text
runtime-trace-insights runtime bundle fixture
+ Gardener static evidence fixture
-> dep-diet static/runtime evidence fusion
-> depmodel.v1 fixture
-> dep-viz overview/report consumption
```

## Repos and commits

### runtime-trace-insights

- Repo: `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
- Commit: `0930886 feat: add runtime trace bundle corridor fixture`
- Key files:
  - `docs/project/runtime-trace-bundle-contract.md`
  - `fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json`
  - `tests/runtime_trace_bundle_contract.test.mjs`
  - `scripts/run_record_runtime_tests.mjs`

Contract responsibility:

```text
runtime-trace-insights owns normalized runtime observation bundle evidence.
```

### dep-diet

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Commit: `cd82157 feat: fuse static and runtime dependency evidence`
- Key files:
  - `docs/project/static-runtime-evidence-corridor.md`
  - `fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json`
  - `fixtures/depmodel.v1/static-runtime-corridor.json`
  - `src/evidence_fusion/static_runtime_evidence_corridor.mjs`
  - `tests/static_runtime_evidence_corridor.test.mjs`

Contract responsibility:

```text
dep-diet owns evidence fusion and actionability-adjacent classification, not runtime capture or report UI.
```

### dep-viz

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Commit: `c02f32d feat: surface static runtime evidence in reports`
- Key files:
  - `fixtures/depmodel.v1/static-runtime-corridor.json`
  - `web/report/src/model-loader.js`
  - `web/report/src/views/Overview.js`
  - `tests/report-model-loader.test.mjs`
  - `tests/static-runtime-corridor-fixture.test.mjs`
  - `docs/depmodel-contract.md`

Contract responsibility:

```text
dep-viz consumes depmodel evidence and surfaces static/runtime distinctions for operators.
```

## Fixture scenario

The corridor fixture intentionally keeps four packages:

| Package | Static evidence | Runtime evidence | Classification |
|---|---:|---:|---|
| `zod` | yes, central | yes | `static-runtime-confirmed` |
| `debug` | no | yes, dynamic/plugin path | `runtime-only` |
| `chalk` | yes, low centrality | no | `declared-unobserved` |
| `lodash` | yes, low centrality | no | `declared-unobserved` |

The current summary emitted by dep-diet is:

```json
{
  "staticRuntimeConfirmed": 1,
  "staticCentralUnobserved": 0,
  "runtimeOnly": 1,
  "declaredUnobserved": 2,
  "ambiguousEvidence": 0
}
```

## Verification

### runtime-trace-insights

```bash
cd /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Result:

```text
rocs validate: OK
runtime-record-tests: ok (4 files)
## main
```

### dep-diet

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-diet
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Result:

```text
rocs validate: OK
ci-targeted: ok (29 files)
## main
```

### dep-viz

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Result:

```text
rocs validate: OK
85 pass / 0 fail
## main
```

## Alignment checks

- `runtime-trace-insights` asserts its runtime bundle fixture matches dep-diet's consumer copy when the sibling repo is present.
- `dep-diet` asserts its runtime bundle copy matches runtime-trace-insights and that the depmodel fixture is generated from current fusion code.
- `dep-viz` asserts its depmodel fixture matches dep-diet's producer fixture when the sibling repo is present.

## Product meaning

This is now more than isolated repo hardening. It establishes the first product spine:

```text
static importance != runtime observation != removal authority
```

The UI can now show that a dependency is statically important, runtime-observed, runtime-only, or declared-but-unobserved without pretending any single evidence layer is final pruning authority.

## Next recommended slice

Move from fixture-only fusion to an operator-facing dep-diet command or report field that can read explicit `--gardener-output` and `--runtime-bundle` inputs and emit the same depmodel evidence corridor artifact.
