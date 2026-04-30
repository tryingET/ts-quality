---
summary: "Closeout inventory for the local dependency-intelligence vertical corridor slice."
read_when:
  - "Reviewing local dependency-intelligence corridor state before push or handoff."
  - "Checking which repos and commits make up the static/runtime evidence corridor."
type: "evidence"
---

# Dependency-intelligence vertical corridor closeout — 2026-04-30

## Corridor frame

```text
runtime-trace-insights
-> Gardener (softwareco/contrib)
-> dep-diet
-> dep-viz
-> ts-quality evidence
-> softwareco/owned repo-capability-map routing
```

Boundary principle:

```text
static importance != runtime observation != removal authority
```

Static graph centrality, runtime observation, declared-unobserved status, and runtime-only status are evidence context. They are not automatic prune/remove authority.

## Local commit inventory

### runtime-trace-insights

Repo: `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`

Latest corridor commit:

- `0930886 feat: add runtime trace bundle corridor fixture`

Role:

- owns normalized runtime observation evidence and runtime trace bundle contracts.

### dep-diet

Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`

Latest corridor commits:

- `81c85dd feat: add static runtime CLI guidance modes`
- `8f42809 feat: expose static runtime depmodel output`
- `cd82157 feat: fuse static and runtime dependency evidence`
- `bda59b2 feat: add gardener static evidence adapter`

Role:

- consumes Gardener static output and runtime trace bundles;
- fuses evidence into `depmodel.v1`;
- exposes UX/AX CLI modes with `--compact`, `--json`, and `--json --compact`.

### dep-viz

Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`

Latest corridor commits:

- `4950223 feat: add static runtime transcript renderer`
- `914c451 feat: explain static runtime package evidence`
- `6ec8dc8 feat: clarify static runtime evidence authority`
- `eabd1c5 test: consume static runtime operator output`
- `c02f32d feat: surface static runtime evidence in reports`

Role:

- consumes `depmodel.v1`;
- renders overview and package-row static/runtime evidence explanations;
- provides a static report renderer for dep-diet-emitted depmodels.

### ts-quality

Repo: `/home/tryinget/ai-society/softwareco/owned/ts-quality`

Latest evidence commits:

- `19af7c5 docs: capture static runtime transcript renderer`
- `a001d66 docs: capture static runtime cli howtos`
- `95fee06 docs: capture static runtime package explanations`
- `e9d76a7 docs: capture static runtime authority copy`
- `fa43650 docs: capture depviz static runtime consumption`
- `da86caa docs: capture static runtime operator path`
- `9df1687 docs: capture static runtime vertical slice`

Role:

- durable adoption/proof evidence only;
- not owner truth for runtime trace, dep-diet fusion, or dep-viz report behavior.

### softwareco/owned lane root

Repo: `/home/tryinget/ai-society/softwareco/owned`

Latest routing commit:

- `2ffc496 docs: route dependency intelligence corridor`

Role:

- DRY routing entry point in `docs/project/repo-capability-map.md`.

## Verification matrix

| Repo | Verification | Result |
|---|---|---|
| runtime-trace-insights | `bash scripts/ci/full.sh`; `npm test`; `git diff --check` | passed before closeout |
| dep-diet | `bash scripts/ci/full.sh`; `npm test`; `git diff --check` | `rocs validate: OK`; `ci-targeted: ok (29 files)`; pass |
| dep-viz | `bash scripts/ci/full.sh`; `npm test`; `git diff --check` | `rocs validate: OK`; `87 pass / 0 fail`; pass |
| ts-quality | `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`; `git diff --check` | `Strict check: pass`; pass |
| softwareco/owned lane root | `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs docs/project --strict`; `git diff --check` | `Strict check: pass`; pass |

Note: full lane-root docs strictness over `.` still reports pre-existing unrelated nested/brownfield docs issues, so targeted `docs/project` strictness is the truthful validation for the changed lane-root routing document.

## Local git posture at closeout

Expected status after this closeout:

```text
runtime-trace-insights: ## main
dep-diet:               ## main
dep-viz:                ## main
softwareco/owned:       ## main
ts-quality:             ## main...origin/main [ahead 18]
```

No external push was performed.

## Operator decision point

Before any external publication, decide whether to:

1. push local `main` commits as-is;
2. review/squash/reorder any local commits;
3. create a review/release gate;
4. keep the corridor local for another pilot run.

## Next pilot candidate

Use the corridor on a real repo, starting with `designmd-foundry` as a brownfield target:

```text
Gardener static evidence for designmd-foundry
+ a representative runtime/design CLI command bundle
-> dep-diet analyze --compact --out-depmodel ...
-> dep-viz render_depmodel_report ...
```

Treat that pilot as evidence discovery, not prune/remove authority.
