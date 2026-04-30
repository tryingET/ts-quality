---
summary: "Adoption evidence: dep-viz adds a copy/paste static-runtime transcript and renderer for dep-diet emitted depmodels."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking the operator path from dep-diet compact output into dep-viz explanation."
type: "evidence"
---

# Static/runtime transcript renderer — 2026-04-30

## Purpose

This slice closes the operator copy/paste gap between dep-diet output and dep-viz explanation.

The corridor now has a concrete transcript path:

```text
copy fixture or target repo inputs
-> dep-diet analyze --compact --out-depmodel ...
-> dep-viz render_depmodel_report --model ... --out ...
-> open static HTML explanation
```

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

## Repo changed

### dep-viz

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Commit: `4950223 feat: add static runtime transcript renderer`
- Changed files:
  - `scripts/render_depmodel_report.mjs`
  - `tests/static-runtime-corridor-fixture.test.mjs`
  - `docs/operations/static-runtime-operator-path.md`

## What changed

### Static report renderer utility

Added a small report utility:

```bash
node scripts/render_depmodel_report.mjs --model <depmodel.v1.json> --out <report.html>
```

This reads an existing `depmodel.v1` artifact, runs the same dep-viz model loader/app-shell/render path used by tests, and writes a static HTML explanation. It is a report utility, not a replacement for the primary Go `depviz` CLI.

### Copy/paste operator transcript

Updated `docs/operations/static-runtime-operator-path.md` with a single copy/paste block that:

1. creates a temp workspace;
2. stages dep-diet's project/Gardener/runtime fixtures;
3. runs dep-diet compact static/runtime analysis;
4. writes `out/depdiet/analyze/depmodel.json`;
5. renders `out/depviz/static-runtime-report.html`;
6. prints the report path to open.

Expected compact transcript includes:

```text
Static/runtime evidence: confirmed=1 runtime-only=1 declared-unobserved=2 static-central-unobserved=0 ambiguous=0.
Authority: evidence context, not removal authority.
Rendered dep-viz report: out/depviz/static-runtime-report.html
```

### Regression coverage

The existing static/runtime corridor integration test now also runs the renderer against the dep-diet-emitted depmodel and asserts the static HTML includes:

- `data-depviz-static-report="true"`
- `data-overview-static-runtime="true"`
- `data-sunshine-static-runtime-classification="static-runtime-confirmed"`
- `Evidence context, not removal authority.`

## Verification

### dep-viz targeted transcript test

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
node --test tests/static-runtime-corridor-fixture.test.mjs
```

Result:

```text
2 pass / 0 fail
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
87 pass / 0 fail
git diff --check: pass
## main
```

## Repos intentionally not changed

- `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
  - no mutation needed; runtime bundle contract is unchanged.
- `/home/tryinget/ai-society/softwareco/owned/dep-diet`
  - no mutation needed; compact CLI and depmodel output already exist.

## Publication posture

No external push was performed. The dep-viz and ts-quality evidence commits remain local on `main`.

## Next recommended slice

Add one dependency-intelligence index/README that links the whole corridor in order across runtime-trace-insights, Gardener, dep-diet, dep-viz, and ts-quality evidence docs so future operators have one durable entry point.
