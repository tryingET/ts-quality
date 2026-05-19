---
summary: "Durable ts-quality adoption proof for the test-capabilities dependency-intelligence multi-scenario pilot."
read_when:
  - "Reviewing test-capabilities dependency-intelligence multi-scenario evidence."
  - "Checking whether ts-quality should run or only record durable quality proof."
type: "evidence"
---

# Test-capabilities dependency-intelligence multi-scenario proof — 2026-05-19

## Design membrane

This document records durable `ts-quality` adoption evidence for the `test-capabilities` dependency-intelligence multi-scenario follow-up.

`ts-quality` does not own runtime tracing, Gardener static analysis, dep-diet fusion, dep-viz rendering, dep-redteam validation, or target-repo source facts. In this slice, `ts-quality` records durable quality proof only because no TypeScript/JavaScript source change was being reviewed.

Boundary principle:

```text
static centrality != runtime observation != declared-unobserved status != removal/remediation authority
```

## Source-owner evidence

Primary target-repo evidence:

```text
test-capabilities:108286d docs/project/dependency-intelligence-multiscenario-pilot.md
```

That source-owner doc records the multi-scenario corridor:

```text
runtime-trace-insights per-scenario runtime bundles
+ reused target-specific Gardener static output
-> dep-diet per-scenario static/runtime fusion
-> dep-viz per-scenario report render
-> scenario classification comparison
```

## Artifact root

Temporary artifacts were produced under:

```text
/tmp/test-capabilities-depintel-multiscenario-20260519082444
```

Key artifact digests:

| Artifact | SHA-256 |
|---|---|
| `runtime/doctor.runtime-trace-bundle.json` | `ba79b29c3050d8a61ef5f49a9460e8b4f13a9f00be4a7c1a2c524f7aeb2e9ba8` |
| `runtime/demo.runtime-trace-bundle.json` | `66202cb47e17fa4352ec17bd618d028a13cfa9cf3168cac73ff3a2bef29df086` |
| `runtime/test-fixture.runtime-trace-bundle.json` | `c774a18f65fbe48280e772a0f4af8ddb2c380952a2dd638ad935dcd61165ee9d` |
| `runtime/capability-drill.runtime-trace-bundle.json` | `bfd3c3c5547ce99d3925ab7244aecfb60e7993fbd1c5caef1f91e1b7f0a44936` |
| `gardener/output/test_capabilities_dependency_analysis.json` | `40d3704fa5d28cf963d4939ef435f8df436e52d30da1234917ed1e9b0039fcbf` |
| `depdiet/classification-comparison.json` | `05e7418521b4c5538a5e4e50dddc7a152409af4e1fbc63c30288c4f49dba495e` |
| `depviz/capability-drill/report/index.html` | `0652dc62a92c9bdd6c2821dbe862250a02800972293ab00ed706311782fd57a0` |

## Quality interpretation

The follow-up improved the evidence basis from one command to four representative runtime scenarios:

| Scenario | Observed packages | `static-runtime-confirmed` | `static-central-unobserved` | `declared-unobserved` |
|---|---:|---:|---:|---:|
| `doctor` | 1 | 1 | 2 | 279 |
| `demo` | 2 | 2 | 1 | 280 |
| `test-fixture` | 3 | 3 | 1 | 280 |
| `capability-drill` | 3 | 3 | 1 | 280 |

The useful quality signal is not that unobserved packages are unused. The useful signal is that the corridor now has scenario-specific evidence showing how classifications change when additional runtime commands are observed.

The runtime bundles remain command-level observations with explicitly declared observed packages. They do not prove exhaustive dependency coverage.

## Why no `ts-quality check` run was needed

No TypeScript/JavaScript source, dependency declaration, test, or config change was made in the target repo for this proof. Running `ts-quality check` would not add merge-confidence evidence for a changed source slice. The truthful `ts-quality` role is this durable adoption proof record.

If a future dependency-intelligence follow-up changes target source, tests, config, or dependency declarations, run `ts-quality` against that exact changed scope and record the run id/artifacts separately.

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
npm run docs:list -- --task "dependency intelligence multiscenario" --top 5

cd /home/tryinget/ai-society/softwareco/owned/ts-quality
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run lint
```

## Follow-up

Future proof should stay bounded:

1. run `ts-quality` only when concrete TS/JS source, test, config, or dependency-declaration changes are under review;
2. keep dependency-intelligence evidence in source-owner docs and temporary artifact roots unless an owning repo adopts a durable artifact contract;
3. continue treating declared-unobserved classifications as evidence prompts, not unused-dependency conclusions.
