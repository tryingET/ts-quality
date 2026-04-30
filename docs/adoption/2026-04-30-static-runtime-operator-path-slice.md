---
summary: "Adoption evidence: dep-diet analyze can turn explicit Gardener static output plus runtime trace bundle input into a depmodel.v1 artifact."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Planning dep-diet/dep-viz operator-facing static-runtime evidence work."
type: "evidence"
---

# Static/runtime operator path slice — 2026-04-30

## Purpose

This slice moves the dependency-intelligence corridor one step beyond fixture-only proof.

```text
Gardener static evidence JSON
+ runtime-trace-insights runtime trace bundle JSON
-> dep-diet analyze CLI
-> depmodel.v1 artifact with packages[].evidence.staticRuntime
```

The boundary remains explicit:

```text
static importance != runtime observation != removal authority
```

Static centrality, runtime observation, declared-unobserved status, and runtime-only status are evidence classifications. They are not automatic prune/remove decisions.

## Repo changed

### dep-diet

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-diet`
- Commit: `8f42809 feat: expose static runtime depmodel output`
- Changed files:
  - `scripts/depdiet.mjs`
  - `src/cmd/analyze_command.mjs`
  - `tests/integration_analyze_contract.test.mjs`

## Operator-facing path

`dep-diet analyze` now accepts explicit static/runtime corridor inputs:

```bash
node scripts/depdiet.mjs analyze <project-path> \
  --gardener-output <gardener.json> \
  --runtime-bundle <runtime-bundle.json> \
  --out-depmodel <depmodel.json> \
  --format json
```

The command writes the normal analysis report/table artifacts and also writes the requested `depmodel.v1` output when the corridor inputs are valid. The JSON analysis report records the depmodel artifact path under `artifacts.depmodel` and includes the static/runtime evidence summary.

## Evidence scenario

The new integration test drives the existing corridor fixtures through the CLI rather than calling the fusion function directly:

- Gardener fixture: `fixtures/gardener/depdiet-minimal-gardener-output.json`
- Runtime bundle fixture: `fixtures/runtime_trace_bundle/v1/dependency-corridor-runtime-bundle.json`
- Written depmodel: `out/static-runtime-depmodel.json` in a temporary test workspace

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

The integration test also validates the emitted depmodel against the existing `depmodel.v1` required-structure validator and asserts that no `actions`, `removalAuthority`, `remove`, or `prune` fields are implied by the evidence classification.

## Verification

### dep-diet targeted integration test

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-diet
node --test tests/integration_analyze_contract.test.mjs
```

Result:

```text
pass 6 / fail 0
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
  - status checked: `## main`
  - no mutation needed because the runtime bundle contract and fixture already satisfy this slice.
- `/home/tryinget/ai-society/softwareco/owned/dep-viz`
  - status checked: `## main`
  - no mutation needed because dep-viz already consumes the same `packages[].evidence.staticRuntime` depmodel shape.

## Publication posture

No external push was performed. The new dep-diet and ts-quality evidence commits remain local on `main`.

## Next recommended slice

Add a dep-viz operator fixture or report walkthrough generated from the new dep-diet CLI output, so the UI proof consumes an artifact emitted through the operator path rather than only a checked-in fixture copy.
