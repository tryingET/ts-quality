---
summary: "Non-invasive Gardener spike against a temp copy of dep-diet from upstream-current Gardener main."
read_when:
  - "Reviewing Gardener as a static dependency-importance provider for dep-diet."
  - "Planning dep-diet Gardener adapter fixtures or upstream Gardener contribution candidates."
type: "evidence"
---

# Gardener dep-diet spike — 2026-04-30

## Objective

Test whether upstream-current Gardener can produce useful static dependency graph and centrality evidence for a future dep-diet adapter, without mutating `dep-diet` or depending on the divergent local Gardener branch.

## Gardener checkout posture

- Repo: `/home/tryinget/ai-society/softwareco/contrib/gardener`
- Remote: `https://github.com/drips-network/gardener`
- Starting local posture: `main...origin/main [ahead 2, behind 3]`
- Remote HEAD checked without local ref mutation: `6d077bfab569927b77f19457c90cebab98ed347b`
- Temporary clean worktree was removed.
- Divergent local `main` was preserved as local backup branch: `backup/gardener-divergent-main-20260430` at `7239ef1`.
- Local `main` was then reset to `origin/main` at `6d077bf`.

Why not preserve by stash: the divergence was committed history, not uncommitted working-tree changes. The safe equivalent was to create a backup branch before resetting.

## Execution mode

- Target source: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Target execution mode: temp copy only; no target-repo mutation.
- Gardener execution mode: normal checkout at upstream-current `main`, with UV virtualenv outside the repo.
- Temp run root: `/tmp/gardener-depdiet-spike-uy1hpW`
- Temp target copy: `/tmp/gardener-depdiet-spike-uy1hpW/dep-diet-copy`
- Output JSON: `/tmp/gardener-depdiet-spike-uy1hpW/output/depdiet_dependency_analysis.json`
- Run log: `/tmp/gardener-depdiet-spike-uy1hpW/gardener-run.log`

## Commands

```bash
REPO=/home/tryinget/ai-society/softwareco/contrib/gardener
WT=/tmp/gardener-origin-main-KhSAql
cd "$REPO"

git worktree remove "$WT"
git branch backup/gardener-divergent-main-20260430 main
git fetch origin main
git reset --hard origin/main
```

```bash
GARDENER=/home/tryinget/ai-society/softwareco/contrib/gardener
SRC=/home/tryinget/ai-society/softwareco/owned/dep-diet
RUNROOT=$(mktemp -d /tmp/gardener-depdiet-spike-XXXXXX)
TARGET="$RUNROOT/dep-diet-copy"
OUTDIR="$RUNROOT/output"
VENV="$RUNROOT/uv-venv"
mkdir -p "$OUTDIR"
rsync -a --exclude .git --exclude node_modules --exclude .ts-quality --exclude coverage "$SRC/" "$TARGET/"

cd "$GARDENER"
UV_PROJECT_ENVIRONMENT="$VENV" uv run --python 3.12 \
  python -m gardener.main_cli "$TARGET" \
  -o "$OUTDIR/depdiet" \
  --minimal-outputs \
  -l javascript
```

After the UV run, `uv.lock` in the Gardener checkout had been touched by `uv run`; it was reverted to keep the contrib checkout clean.

## Result summary

```json
{
  "gardenerCommit": "6d077bf",
  "externalPackageCount": 10,
  "topDependencyCount": 20,
  "graph": {
    "nodes": 216,
    "links": 1135
  },
  "analyzer": {
    "totalFiles": 170,
    "languagesDetected": ["javascript"],
    "fileImportsCount": 131,
    "localImportsCount": 97,
    "filePackageComponentsCount": 142
  }
}
```

Top dependencies by PageRank percentage:

| package | percentage | ecosystem | repository URL |
|---|---:|---|---|
| `fs` | 22.52 | unknown | |
| `node:path` | 17.59 | unknown | |
| `node:assert/strict` | 11.82 | unknown | |
| `node:test` | 11.82 | unknown | |
| `zod` | 8.41 | npm | `https://github.com/colinhacks/zod` |
| `node:url` | 6.32 | unknown | |
| `node:child_process` | 5.32 | unknown | |
| `node:os` | 4.92 | unknown | |
| `node:module` | 2.13 | unknown | |
| `node:crypto` | 1.94 | unknown | |
| `chalk` | 1.78 | npm | `https://github.com/chalk/chalk` |
| `lodash` | 1.68 | npm | `https://github.com/lodash/lodash` |

External packages detected:

| package | ecosystem | version | repository URL |
|---|---|---|---|
| `zod` | npm | `3.23.8` | `https://github.com/colinhacks/zod` |
| `@appland/appmap` | npm | `^3.196.1` | |
| `appmap-node` | npm | `^2.24.3` | `https://github.com/getappmap/appmap-node` |
| `lodash` | npm | `4.17.21` | `https://github.com/lodash/lodash` |
| `axios` | npm | `^1.7.0` | `https://github.com/axios/axios` |
| `vitest` | npm | `^2.0.0` | `https://github.com/vitest-dev/vitest` |
| `@scope/pkg` | npm | `1.0.0` | |
| `chalk` | npm | `5.3.0` | `https://github.com/chalk/chalk` |
| `react` | npm | `^18.3.0` | `https://github.com/facebook/react` |
| `@types/node` | npm | `^20.11.30` | `https://github.com/DefinitelyTyped/DefinitelyTyped` |

## What this proves

Gardener is immediately useful as a raw static-evidence producer for dep-diet:

- It scans a realistic dep-diet temp copy without needing dep-diet dependencies installed.
- It emits stable JSON with `external_packages`, `dependency_graph`, `top_dependencies`, and `analyzer_details`.
- It captures local import structure, file/package components, and centrality scores that can become dep-diet static graph evidence.
- It resolves repository URLs for several npm packages.

## Adapter implications for dep-diet

The future dep-diet adapter should map Gardener output, not consume it as a final decision:

```text
Gardener output
  -> dep-diet staticGraphEvidence
  -> dependencyImportance evidence
  -> dep-diet actionability classification only after combining runtime/security/policy/directness evidence
```

Immediate mapper requirements:

- Separate Node builtins such as `fs`, `node:path`, `node:test`, and `node:assert/strict` from external package actionability.
- Preserve `found_in_manifests` so dep-diet can distinguish root manifest dependencies from test fixture dependencies.
- Preserve `repository_url` and missing-URL cases as evidence quality signals, not blockers.
- Preserve graph node/link counts and a graph digest for traceability.
- Keep Gardener centrality separate from vulnerability severity, directness, runtime observation, and removal recommendation.

## Product/contribution observations for Gardener

Potential upstream contribution candidates, based on this spike:

1. A documented machine-consumer output profile for downstream tools such as dep-diet.
2. Explicit classification of language/runtime builtins versus package-manager dependencies in `top_dependencies`.
3. Optional scope filters for tests/fixtures/examples so downstream consumers can request production-only or all-code evidence.
4. URL-resolution receipt/cache metadata so network-dependent package URL lookup can be classified cleanly.
5. A concise JSON summary alongside the full node-link graph for adapter use.

These are candidates, not blockers. Dep-diet can start with an adapter/fixture using the current Gardener JSON.

## Recommended next step

Create a dep-diet spike doc or adapter task with this concrete first slice:

- fixture: `fixtures/gardener/depdiet-minimal-gardener-output.json`
- source: `src/adapters_gardener/**/*.mjs`
- test: `tests/gardener_static_adapter.test.mjs`
- invariant: Gardener static centrality is translated into dep-diet evidence without becoming removal authority.

Then run public `ts-quality@0.5.0` against that adapter slice once it exists.
