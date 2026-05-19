---
summary: "Durable ts-quality adoption proof for the test-capabilities dependency-intelligence runtime-autodiscovery pilot."
read_when:
  - "Reviewing test-capabilities runtime-autodiscovered dependency evidence."
  - "Checking whether ts-quality should run or only record durable quality proof."
type: "evidence"
---

# Test-capabilities dependency-intelligence runtime-autodiscovery proof — 2026-05-19

## Design membrane

This document records durable `ts-quality` adoption evidence for the `test-capabilities` dependency-intelligence runtime-autodiscovery follow-up.

`ts-quality` does not own runtime tracing, Gardener static analysis, dep-diet fusion, dep-viz rendering, dep-redteam validation, or target-repo source facts. In this slice, `ts-quality` records durable quality proof only because no TypeScript/JavaScript source change was made in `test-capabilities`.

Boundary principle:

```text
runtime-loaded in this scenario set != exhaustively covered
static/runtime unobserved != removal/remediation authority
```

## Source-owner evidence

Primary target-repo evidence:

```text
test-capabilities:b1e40b5 docs/project/dependency-intelligence-runtime-autodiscovery-pilot.md
```

Enabling implementation evidence:

```text
runtime-trace-insights:277048c feat: autodiscover node runtime packages
dep-diet:6b816e1 feat: fuse runtime bundle scenario sets
```

The source-owner doc records:

```text
runtime-trace-insights Node package autodiscovery per scenario
+ reused target-specific Gardener static output
-> dep-diet scenario-set static/runtime fusion
-> dep-viz scenario-set report render
```

## Artifact root

Temporary artifacts were produced under:

```text
/tmp/test-capabilities-depintel-autodiscovery-20260519085727
```

Key artifact digests:

| Artifact | SHA-256 |
|---|---|
| `runtime/doctor.runtime-trace-bundle.json` | `11cfc4b636492c79cb9b5bd2c3ecde82c11766c9a78f69abe20198a4466dfd6b` |
| `runtime/demo.runtime-trace-bundle.json` | `e94b1c6bcc52477a30cbe1b7ad3517ee842f14e2d021a91e3d4ba9008130597a` |
| `runtime/test-fixture.runtime-trace-bundle.json` | `6e56bcc872004f746b2d9cf6331ab441fa01bf50d67a56cc8b50980c951fb7a2` |
| `runtime/capability-drill.runtime-trace-bundle.json` | `2d552601c73590183475ee4666a890039395acb90901429b1b9ed4a8fd3f6b33` |
| `depdiet/scenario-set.depmodel.json` | `b183ed9290b733ac9275f9fdc1ad1f5f0abd8af2efe80caa3d8f4f87ac52d95f` |
| `depviz/scenario-set/report/index.html` | `5c3e9d2ff16b73ba1d1cc178c8f43f091e111165d39ccd2864d3c50a4e1d1a9a` |

## Quality interpretation

The follow-up improved evidence quality over the prior manual-observation pilot. Runtime-trace-insights now discovers Node packages loaded during each scenario instead of relying on manually declared observed-package flags.

The scenario-set depmodel reported:

```json
{
  "packages": 281,
  "edges": 351,
  "observedPackages": 27,
  "classifications": {
    "declared-unobserved": 253,
    "static-central-unobserved": 1,
    "runtime-only": 21,
    "static-runtime-confirmed": 6
  }
}
```

Static/runtime-confirmed packages under this scenario set:

```text
chalk@4.1.2
commander@12.1.0
figlet@1.10.0
js-yaml@4.1.1
ora@5.4.1
zod@3.25.76
```

All 27 runtime-observed packages were observed in all four scenarios. That is evidence about the shared CLI startup/import path, not exhaustive application coverage.

## Why no `ts-quality check` run was needed

No TypeScript/JavaScript source, test, config, or dependency declaration changed in `test-capabilities`. Running `ts-quality check` would not add merge-confidence evidence for a changed target slice. The truthful `ts-quality` role is this durable adoption proof record.

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
cd /home/tryinget/ai-society/softwareco/owned/runtime-trace-insights
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm test

cd /home/tryinget/ai-society/softwareco/owned/dep-diet
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm test

cd /home/tryinget/ai-society/softwareco/owned/test-capabilities
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run docs:list -- --task "dependency intelligence runtime autodiscovery" --top 5

cd /home/tryinget/ai-society/softwareco/owned/ts-quality
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run lint
```

## Follow-up

Future proof should focus on scenario diversity or deeper instrumentation, not merely more shared CLI commands. Continue treating `declared-unobserved` and `runtime-only` as review prompts, not direct action authority.
