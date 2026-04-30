---
summary: "Integration opportunity: use Gardener as dep-diet's static dependency-importance provider without absorbing upstream ownership."
read_when:
  - "Planning Gardener integration into the dep-diet evidence pipeline."
  - "Investigating static dependency graph and centrality evidence for dep-diet, runtime-trace-insights, and dep-viz."
type: "plan"
---

# Gardener + dep-diet integration opportunity — 2026-04-30

## Core architecture sentence

Dep-diet should use Gardener as its static dependency-importance provider, runtime-trace-insights as its observed-usage provider, and then own the final dependency actionability judgment that dep-viz renders.

## Why this belongs in the boundary plan

The current three-repo boundary model is:

```text
runtime-trace-insights
  -> captures/normalizes runtime evidence

dep-diet
  -> combines static/runtime/dependency evidence and decides dependency risk/actionability

dep-viz
  -> visualizes/explains depmodel evidence for humans/operators
```

Gardener adds a high-value upstream static-analysis lane:

```text
softwareco/contrib/gardener
  -> static dependency graph + centrality / dependency importance

runtime-trace-insights
  -> observed runtime usage evidence

dep-diet
  -> combines Gardener static importance, runtime evidence, manifest/lock/security/policy evidence
  -> produces depmodel and actionability classification

dep-viz
  -> renders the enriched depmodel for humans/operators
```

This keeps source-owner boundaries clean. Gardener remains a contrib/upstream analyzer; dep-diet consumes its JSON output as evidence and owns the final judgment.

## Ownership boundary

### Gardener owns

- Static manifest/source scanning.
- Import extraction across supported languages.
- Static dependency graph construction.
- Centrality/importance metrics such as PageRank or Katz.
- External package repository URL resolution where available.
- Its native OSS-funding-oriented ranking outputs.

### Gardener does not own

- Dependency removal/pruning decisions for dep-diet.
- Vulnerability policy truth for dep-diet.
- Runtime usage truth.
- Depmodel production authority.
- Dep-viz report semantics.

### Dep-diet owns

- Translating Gardener output into dep-diet evidence.
- Combining static importance with runtime usage, directness, introducer paths, vulnerability findings, and policy.
- Naming evidence conflicts.
- Producing dependency actionability classifications and depmodel output.

### Dep-viz owns

- Rendering the enriched depmodel.
- Explaining static centrality, runtime usage, directness, vulnerabilities, policy state, and actionability without recomputing or redefining those facts.

## Proposed adapter seam

Use a subprocess/JSON seam first rather than importing Gardener as a library:

```text
dep-diet/src/adapters_gardener/
  gardener_static_adapter.mjs
  gardener_output_mapper.mjs
  gardener_contract.mjs
```

Likely execution shape:

```bash
python -m gardener.main_cli /path/to/repo --output /tmp/depdiet-gardener/<run-id> --minimal
```

Then dep-diet reads Gardener JSON and maps it into dep-diet evidence. This keeps Python dependency management out of dep-diet, makes fixture tests straightforward, and allows later replacement with a service/API mode if useful.

## Evidence model extension

Gardener output can become a dedicated dep-diet evidence layer:

```json
{
  "staticGraphEvidence": {
    "producer": "gardener",
    "graphDigest": "sha256:...",
    "filesAnalyzed": 0,
    "languagesDetected": [],
    "packageEdges": [],
    "localImportEdges": [],
    "componentEdges": []
  },
  "dependencyImportance": [
    {
      "packageName": "zod",
      "ecosystem": "npm",
      "repositoryUrl": "https://github.com/colinhacks/zod",
      "centralityMetric": "pagerank",
      "percentage": 12.4,
      "score": 0.124,
      "rank": 3,
      "evidenceRef": "gardener:<run-id>:top_dependencies[2]"
    }
  ]
}
```

Depmodel package entries can then carry static importance as evidence, not as a removal or risk verdict:

```json
{
  "packages": [
    {
      "name": "zod",
      "ecosystem": "npm",
      "repositoryUrl": "https://github.com/colinhacks/zod",
      "evidence": {
        "staticImportance": {
          "producer": "gardener",
          "centralityMetric": "pagerank",
          "percentage": 12.4,
          "rank": 3
        }
      }
    }
  ]
}
```

## Actionability classes enabled by the combined evidence

The value is not merely "used/unused". Gardener + runtime-trace-insights + dep-diet evidence can distinguish:

| Class | Meaning |
|---|---|
| `critical-soil` | high static centrality + runtime evidence |
| `dead-branch` | declared but no static/runtime usage |
| `hidden-root` | transitive/indirect but central to actual behavior |
| `support-worthy` | important dependency with clean risk profile |
| `prune-candidate` | low centrality, no runtime usage, low introducer risk |
| `risky-core` | high importance + vulnerability/policy concern |
| `ambiguous-evidence` | static/runtime/manifest disagree |

These classes should remain dep-diet-owned judgments. Gardener provides importance evidence; it does not decide prune safety.

## Evidence conflict language

Dep-diet should explicitly name disagreements instead of flattening signals:

```text
manifest says direct dependency
Gardener sees no import edge
runtime trace sees no execution
=> candidate dead-branch, but verify dynamic/plugin usage
```

```text
manifest says transitive
Gardener sees package component imported through local path
runtime trace confirms command path
=> hidden-root / do not prune casually
```

## Immediate non-invasive spike

Do not update the divergent local Gardener `main` blindly. Use the existing checkout as-is for a quick local read, or create a clean worktree/branch from `origin/main` for upstream-current analysis.

Suggested spike:

1. Use `/home/tryinget/ai-society/softwareco/contrib/gardener` as the Gardener source.
2. Create a temp copy of `/home/tryinget/ai-society/softwareco/owned/dep-diet`.
3. Run Gardener against the temp copy.
4. Inspect JSON for:
   - external packages
   - graph nodes/edges
   - top dependencies
   - language detection
   - repository URL resolution
5. Draft `dep-diet/docs/project/gardener-integration-spike.md` with the observed JSON shape and proposed adapter contract.
6. Create a bounded AK task for the adapter only after the spike proves the output shape.

## Risks and guardrails

- Gardener's native purpose is OSS funding allocation, not dependency removal. Dep-diet must not treat low funding percentage as safe-to-remove.
- Repository URL resolution may be network-dependent. Dep-diet should cache, receipt, or classify this as advisory when unavailable.
- Gardener is Python while dep-diet is Node; keep subprocess/JSON as the first seam.
- Gardener graph semantics may be richer than current dep-diet evidence structures; preserve raw evidence refs and avoid flattening too early.
- Dep-viz should consume dep-diet's enriched depmodel, not call Gardener directly.

## ts-quality adoption implication

The next high-value public-package dogfood after the current runtime-trace-insights and dep-viz blockers is a dep-diet Gardener fixture slice:

- fixture: `fixtures/gardener/depdiet-minimal-gardener-output.json`
- source slice: `src/adapters_gardener/**/*.mjs`
- focused test: `tests/gardener_static_adapter.test.mjs`
- invariant idea: `gardener static centrality is translated into dep-diet evidence without becoming removal authority`
- witness command: `node --test tests/gardener_static_adapter.test.mjs`

That slice would prove the new source-owner seam with explicit evidence, not just architecture prose.
