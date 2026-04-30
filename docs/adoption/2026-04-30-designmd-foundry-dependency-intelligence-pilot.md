---
summary: "Pilot evidence: first real use of the dependency-intelligence corridor on designmd-foundry."
read_when:
  - "Reviewing dependency-intelligence corridor pilot usage."
  - "Checking what happened when the static/runtime corridor was tried on designmd-foundry."
type: "evidence"
---

# designmd-foundry dependency-intelligence pilot — 2026-04-30

## Purpose

This pilot used the dependency-intelligence corridor on a real owned repo:

```text
designmd-foundry
-> Gardener static evidence
-> designmd-foundry typecheck runtime command observation
-> dep-diet static/runtime depmodel
-> dep-viz static HTML explanation
```

Boundary preserved:

```text
static importance != runtime observation != removal authority
```

This pilot is evidence discovery only. It does not grant prune/remove authority.

## Target repo

- Repo: `/home/tryinget/ai-society/softwareco/owned/designmd-foundry`
- Status after pilot: `## main`
- No files were changed in the target repo.

## Pilot workspace

Generated artifacts were kept out of git under:

```text
/tmp/designmd-depintel-pilot/
```

Key generated files:

```text
/tmp/designmd-depintel-pilot/gardener/designmd-foundry_dependency_analysis.json
/tmp/designmd-depintel-pilot/runtime/designmd-foundry-runtime-bundle.json
/tmp/designmd-depintel-pilot/depmodel/designmd-foundry.depmodel.v1.json
/tmp/designmd-depintel-pilot/depviz/designmd-foundry-static-runtime-report.html
```

## Static evidence command

Gardener was run from the local contrib checkout with Python 3.12 through `uv`:

```bash
cd /home/tryinget/ai-society/softwareco/contrib/gardener
uv run --python 3.12 python -m gardener.main_cli \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  -o /tmp/designmd-depintel-pilot/gardener/designmd-foundry \
  -l typescript,javascript \
  --minimal-outputs
```

Result summary:

```text
Found 28 source files, 1 total manifest files (1 at root)
Found 3 unique external packages
Dependency graph built with 48 nodes and 154 edges
Analysis results saved to: /tmp/designmd-depintel-pilot/gardener/designmd-foundry_dependency_analysis.json
```

Top package-manager dependencies from the Gardener output:

```text
@open-pencil/cli              2.60%
@types/node                   2.60%
@typescript/native-preview    2.60%
```

Gardener also ranked Node builtins highly (`node:assert/strict`, `node:path`, `fs`, `node:child_process`, etc.); dep-diet treats those as static graph evidence but not package-manager removal candidates.

Operational note: `uv run` initially updated Gardener's `uv.lock` metadata; this was reverted. The Gardener repo ended clean after the pilot.

## Runtime command observation

The representative runtime/tooling command was:

```bash
cd /home/tryinget/ai-society/softwareco/owned/designmd-foundry
npm run typecheck
```

Result:

```text
> designmd-foundry@1.1.0 typecheck
> tsgo --noEmit
```

This command completed successfully.

A pilot runtime trace bundle was then written under `/tmp/designmd-depintel-pilot/runtime/` with a single command-level observed package:

```text
@typescript/native-preview@7.0.0-dev.20260421.2
```

Caveat: this bundle records a command-level observation for the typecheck tool path. It is not full runtime coverage of the application, and it grants no removal authority.

## dep-diet fusion command

```bash
cd /tmp/designmd-depintel-pilot
node /home/tryinget/ai-society/softwareco/owned/dep-diet/scripts/depdiet.mjs analyze \
  /home/tryinget/ai-society/softwareco/owned/designmd-foundry \
  --gardener-output gardener/designmd-foundry_dependency_analysis.json \
  --runtime-bundle runtime/designmd-foundry-runtime-bundle.json \
  --out-depmodel depmodel/designmd-foundry.depmodel.v1.json \
  --compact
```

Compact output:

```text
Analyze ../../home/tryinget/ai-society/softwareco/owned/designmd-foundry: 70 findings, 70 packages, 59 edges, 54 introducer paths.
Report: out/depdiet/analyze/report.json
Depmodel: depmodel/designmd-foundry.depmodel.v1.json
Static/runtime evidence: confirmed=1 runtime-only=0 declared-unobserved=2 static-central-unobserved=0 ambiguous=0.
Authority: evidence context, not removal authority.
```

Static/runtime package classifications:

| Package | Classification | Runtime observed |
|---|---|---:|
| `@typescript/native-preview` | `static-runtime-confirmed` | yes |
| `@open-pencil/cli` | `declared-unobserved` | no |
| `@types/node` | `declared-unobserved` | no |

Interpretation:

- `@typescript/native-preview` is confirmed for the typecheck command path.
- `@open-pencil/cli` being declared-unobserved in this typecheck slice is expected; OpenPencil is optional adapter tooling and was not exercised by `npm run typecheck`.
- `@types/node` is type metadata and being declared-unobserved at runtime is expected.
- None of these classifications are removal recommendations.

## dep-viz render command

```bash
cd /tmp/designmd-depintel-pilot
node /home/tryinget/ai-society/softwareco/owned/dep-viz/scripts/render_depmodel_report.mjs \
  --model depmodel/designmd-foundry.depmodel.v1.json \
  --out depviz/designmd-foundry-static-runtime-report.html
```

Result:

```text
Rendered dep-viz report: depviz/designmd-foundry-static-runtime-report.html
```

Generated report:

```text
/tmp/designmd-depintel-pilot/depviz/designmd-foundry-static-runtime-report.html
```

## Lessons from first real use

1. The corridor works on a real TypeScript owned repo without mutating that repo.
2. The current runtime bundle production step is still partly manual for real repos; runtime-trace-insights has the bundle contract and fixture but not yet a one-command production path from a real command into `runtime-trace-bundle.v1`.
3. The classification output was useful and unsurprising:
   - typecheck tooling confirmed;
   - optional OpenPencil adapter not observed by typecheck;
   - type metadata not runtime-observed.
4. The authority reminder is necessary: this pilot could easily be misread as removal guidance if the runtime command's limited coverage were ignored.

## Next recommended slice

Add a runtime-trace-insights command or adapter path that can produce `runtime-trace-insights.runtime-trace-bundle.v1` from a real observed command, so future pilots do not need a manual runtime-bundle bridge.
