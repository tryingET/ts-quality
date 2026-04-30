---
summary: "Adoption evidence: dep-diet adds greenfield/brownfield static-runtime how-tos plus UX/AX CLI modes."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking dep-diet operator/agent CLI guidance for static-runtime evidence."
type: "evidence"
---

# Static/runtime CLI UX/AX and how-tos — 2026-04-30

## Purpose

This slice addresses the operator/agent adoption layer for the dependency-intelligence corridor.

It adds dep-diet-side how-tos for both greenfield and brownfield target repos and makes the analyze CLI easier to use in two modes:

- UX: concise operator output via `--compact`;
- AX: machine/agent output via `--json`, with `--json --compact` for one-line automation logs.

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

## Repo changed

### dep-diet

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Commit: `81c85dd feat: add static runtime CLI guidance modes`
- Changed files:
  - `README.md`
  - `scripts/depdiet.mjs`
  - `src/cmd/analyze_cli.mjs`
  - `src/cmd/analyze_reporters.mjs`
  - `tests/integration_analyze_contract.test.mjs`
  - `docs/operations/static-runtime-greenfield-how-to.md`
  - `docs/operations/static-runtime-brownfield-how-to.md`

## What changed

### Greenfield/brownfield how-tos

Added two dep-diet adoption guides:

- `docs/operations/static-runtime-greenfield-how-to.md`
  - for new target repos where dependency evidence paths can be shaped before drift appears;
  - recommends explicit Gardener/runtime/depmodel artifact paths;
  - documents first-slice loop and evidence interpretation.
- `docs/operations/static-runtime-brownfield-how-to.md`
  - for existing target repos with possible dynamic loading, stale manifests, wrappers, and runtime drift;
  - emphasizes narrow representative runtime commands and evidence-class review before any actionability planning.

Both guides keep prune/remove authority separate from static/runtime evidence classification.

### CLI UX/AX modes

`depdiet analyze` now supports:

```bash
# UX: compact operator summary
node scripts/depdiet.mjs analyze <project-path> \
  --gardener-output <gardener.json> \
  --runtime-bundle <runtime-bundle.json> \
  --out-depmodel out/depdiet/analyze/depmodel.json \
  --compact

# AX: schema-valid JSON for agents/tools
node scripts/depdiet.mjs analyze <project-path> --json

# AX compact: one-line machine JSON for automation logs
node scripts/depdiet.mjs analyze <project-path> --json --compact
```

The compact static/runtime UX output includes an authority reminder:

```text
Authority: evidence context, not removal authority.
```

## Verification

### dep-diet targeted CLI tests

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-diet
node --test tests/integration_analyze_contract.test.mjs
```

Result:

```text
8 pass / 0 fail
```

### dep-diet requested repo verification

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-diet
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Results:

```text
rocs validate: OK
ci-targeted: ok (29 files).
git diff --check: pass
## main
```

## Repos intentionally not changed

- `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
  - no mutation needed; runtime bundle contract is unchanged.
- `/home/tryinget/ai-society/softwareco/owned/dep-viz`
  - no mutation needed; dep-viz already consumes and explains the emitted depmodel evidence.

## Publication posture

No external push was performed. The dep-diet and ts-quality evidence commits remain local on `main`.

## Next recommended slice

Run one compact CLI transcript end-to-end from dep-diet output into dep-viz consumption docs, so operators can copy a single greenfield or brownfield command block and see where the resulting depmodel is opened/explained.
