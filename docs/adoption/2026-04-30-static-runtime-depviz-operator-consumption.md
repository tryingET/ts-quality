---
summary: "Adoption evidence: dep-viz consumes depmodel output emitted by the dep-diet static/runtime operator path."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Planning dep-viz report/UI proof for dep-diet emitted depmodel artifacts."
type: "evidence"
---

# Static/runtime dep-viz operator consumption — 2026-04-30

## Purpose

This slice proves that dep-viz can consume a depmodel artifact emitted through the new dep-diet operator-facing path, not only a checked-in fixture copy.

```text
Gardener static evidence fixture
+ runtime-trace-insights runtime bundle fixture
-> dep-diet analyze --gardener-output --runtime-bundle --out-depmodel
-> emitted depmodel.v1
-> dep-viz model loader + overview render path
```

Boundary principle preserved:

```text
static importance != runtime observation != removal authority
```

The dep-viz report path surfaces static/runtime evidence classes as explanation, not automatic prune/remove authority.

## Repo changed

### dep-viz

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Commit: `eabd1c5 test: consume static runtime operator output`
- Changed files:
  - `tests/static-runtime-corridor-fixture.test.mjs`
  - `docs/operations/static-runtime-operator-path.md`

## What changed

The static/runtime corridor test now verifies two related contracts when the sibling dep-diet repo is present:

1. dep-viz's checked-in corridor fixture remains byte-aligned with dep-diet's producer fixture.
2. dep-viz can consume a `depmodel.v1` emitted by the dep-diet CLI operator path:

```bash
node /home/tryinget/ai-society/softwareco/owned/dep-diet/scripts/depdiet.mjs analyze project \
  --gardener-output fixtures/gardener/depdiet-minimal-gardener-output.json \
  --runtime-bundle fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json \
  --out-depmodel out/depdiet/analyze/depmodel.json \
  --format json
```

The test stages the dep-diet project, Gardener, and runtime-bundle fixtures into a temporary workspace, runs the CLI, loads the emitted depmodel through dep-viz's normal model loader, and renders the overview.

## Evidence scenario

Expected package classifications remain:

| Package | Classification |
|---|---|
| `zod` | `static-runtime-confirmed` |
| `debug` | `runtime-only` |
| `chalk` | `declared-unobserved` |
| `lodash` | `declared-unobserved` |

Expected summary remains:

```json
{
  "staticRuntimeConfirmed": 1,
  "staticCentralUnobserved": 0,
  "runtimeOnly": 1,
  "declaredUnobserved": 2,
  "ambiguousEvidence": 0
}
```

The rendered overview assertions cover:

- `data-overview-static-runtime="true"`
- `data-static-runtime-classification="static-runtime-confirmed">confirmed: 1`
- `data-static-runtime-classification="runtime-only">runtime-only: 1`
- `data-static-runtime-classification="declared-unobserved">declared-unobserved: 2`

## Verification

### dep-viz targeted operator-path test

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
node --test tests/static-runtime-corridor-fixture.test.mjs
```

Result:

```text
pass 2 / fail 0
```

### dep-viz requested repo verification

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Results:

```text
rocs validate: OK
86 pass / 0 fail
git diff --check: pass
## main
```

## Repos intentionally not changed

- `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
  - no mutation needed; the runtime bundle fixture already serves the path.
- `/home/tryinget/ai-society/softwareco/owned/dep-diet`
  - no new mutation in this slice beyond the prior local commit `8f42809 feat: expose static runtime depmodel output`.

## Publication posture

No external push was performed. The dep-viz and ts-quality evidence commits remain local on `main`.

## Next recommended slice

Add a small human-facing dep-viz explanation refinement that makes the boundary explicit in the UI copy: static/runtime evidence is evidence context, not removal authority. Keep it additive to the existing overview/report surface.
