---
summary: "Adoption evidence: dep-viz package rows explain static/runtime evidence classifications without granting removal authority."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking package-level static/runtime explanation behavior in dep-viz."
type: "evidence"
---

# Static/runtime package explanations — 2026-04-30

## Purpose

This slice extends the dependency-intelligence corridor from overview-level counts to package-row explanations in dep-viz.

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

Package classifications are shown as evidence context. They are not prune/remove decisions.

## Repo changed

### dep-viz

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Commit: `914c451 feat: explain static runtime package evidence`
- Changed files:
  - `web/report/src/views/Sunshine.js`
  - `tests/report-sunshine.test.mjs`
  - `docs/operations/static-runtime-operator-path.md`

## What changed

The Sunshine package panel now renders per-package static/runtime evidence details when `packages[].evidence.staticRuntime` is present.

For each package row, dep-viz now exposes:

- the static/runtime classification;
- a human explanation of what the classification means;
- static provider context when available;
- runtime provider/observation context when available;
- the authority note: `Evidence context, not removal authority.`

Current explanation coverage includes:

| Classification | Package-row explanation intent |
|---|---|
| `static-runtime-confirmed` | Static evidence declares the package and runtime evidence observed it. |
| `runtime-only` | Runtime evidence observed the package, but matching static dependency evidence was not present. |
| `declared-unobserved` | Static evidence declares the package, but the runtime bundle did not observe it. |
| `static-central-unobserved` | Static evidence marks the package as central, but the runtime bundle did not observe it. |
| `ambiguous-evidence` | Static/runtime evidence is incomplete or contradictory. |

## Verification

### dep-viz targeted package/detail tests

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
node --test tests/report-sunshine.test.mjs tests/report-model-loader.test.mjs tests/static-runtime-corridor-fixture.test.mjs
```

Result:

```text
25 pass / 0 fail
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
  - no mutation needed; runtime trace bundle contract is unchanged.
- `/home/tryinget/ai-society/softwareco/owned/dep-diet`
  - no mutation needed; depmodel static/runtime evidence structure is unchanged.

## Publication posture

No external push was performed. The dep-viz and ts-quality evidence commits remain local on `main`.

## Next recommended slice

Add dep-diet-side docs or CLI report guidance explaining how operators should interpret static/runtime evidence classifications before they move into prune/remove planning flows. Keep that guidance separate from any removal authority mechanism.
