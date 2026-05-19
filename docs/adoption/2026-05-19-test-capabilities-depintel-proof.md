---
summary: "Durable ts-quality adoption proof for the test-capabilities dependency-intelligence corridor pilot."
read_when:
  - "Reviewing test-capabilities dependency-intelligence corridor evidence."
  - "Checking whether ts-quality should run or only record quality proof for dependency evidence."
type: "evidence"
---

# Test-capabilities dependency-intelligence proof — 2026-05-19

## Design membrane

This document records durable `ts-quality` adoption evidence for the `test-capabilities` dependency-intelligence corridor pilot.

`ts-quality` does not own runtime tracing, Gardener static analysis, dep-diet fusion, dep-viz rendering, or dep-redteam validation. In this slice, `ts-quality` records durable quality proof only because no TypeScript/JavaScript source change was being reviewed.

Boundary principle:

```text
static centrality != runtime observation != declared-unobserved status != removal/remediation authority
```

## Source-owner evidence

Primary target-repo evidence:

```text
test-capabilities:4625109 docs/project/dependency-intelligence-corridor-pilot.md
```

That source-owner doc records the full target-specific corridor:

```text
test-capabilities doctor command
-> runtime-trace-insights runtime bundle
-> Gardener target-specific static analysis
-> dep-diet static/runtime fusion
-> dep-viz report render
```

## Artifact root

Temporary artifacts were produced under:

```text
/tmp/test-capabilities-depintel-controller-20260519080023
```

Key artifact digests:

| Artifact | SHA-256 |
|---|---|
| `runtime/runtime-trace-bundle.json` | `47c4a414b17b0735435546f31ce453d4607a18400161e5fc19809ea34999fed5` |
| `gardener/output/test_capabilities_dependency_analysis.json` | `40d3704fa5d28cf963d4939ef435f8df436e52d30da1234917ed1e9b0039fcbf` |
| `depdiet/depmodel.json` | `07de947a4aae3d0de9f1ea92d1e1249d1a4c5878eea9188e039517e03b36e7cd` |
| `depviz/report/index.html` | `f5f9706d95c787449d16f9a535f2bdad98ff3b010ae513ab99c7dd6e112c5a15` |

## Quality interpretation

The target-specific fused depmodel reported:

```json
{
  "modelVersion": "depmodel.v1",
  "modules": 1,
  "packages": 282,
  "edges": 352,
  "observedPackages": 1,
  "classifications": {
    "declared-unobserved": 279,
    "static-central-unobserved": 2,
    "static-runtime-confirmed": 1
  }
}
```

Observed package:

```json
{
  "name": "commander",
  "version": "12.0.0",
  "packageId": "npm:commander@12.0.0",
  "classification": "static-runtime-confirmed",
  "evidenceKind": "runtime-command-observation",
  "commandLine": "node ./bin/test-capabilities doctor --json"
}
```

This is quality/adoption evidence because the corridor replaced a prior blocker — missing target-specific Gardener/static evidence — with an explicit target-specific static/runtime packet. It is still a one-command runtime scenario, so declared-unobserved classifications remain evidence-seeking prompts, not unused-dependency conclusions.

## Why no `ts-quality check` run was needed

No TypeScript/JavaScript source change was made in the target repo for this pilot. A `ts-quality` run would therefore not add merge-confidence evidence for a changed source slice. The truthful `ts-quality` role is this durable proof record.

If a future dependency-intelligence follow-up changes source, tests, config, or dependency declarations in `test-capabilities`, then run `ts-quality` against that exact changed scope and record the run id/artifacts separately.

## dep-redteam applicability

No dep-viz exploitability-validation handoff or vulnerability triage cluster existed in this pilot:

```json
{
  "vulnPackages": 0,
  "vulnCount": 0,
  "triageClusters": 0,
  "depRedteamApplicable": false
}
```

So dep-redteam remains out of scope until a future vulnerability handoff exists.

## Validation

Validation for this proof slice:

```bash
cd /home/tryinget/ai-society/softwareco/owned/test-capabilities
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run docs:list -- --task "dependency intelligence corridor" --top 5

cd /home/tryinget/ai-society/softwareco/owned/ts-quality
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run lint
```

## Follow-up

Useful future work should be explicitly scoped:

1. add more representative runtime scenarios such as `demo`, `test` against a fixture, or `capability:drill` only after checking runtime cost and side effects;
2. compare classifications across runtime scenarios;
3. use dep-viz output for operator review;
4. keep dep-redteam out of scope unless vulnerability handoff evidence exists;
5. run `ts-quality` only for concrete source/change review, not for read-only evidence discovery.
