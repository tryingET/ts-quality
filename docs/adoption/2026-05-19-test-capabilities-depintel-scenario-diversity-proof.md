---
summary: "Durable ts-quality adoption proof for the test-capabilities dependency-intelligence scenario-diversity pilot."
read_when:
  - "Reviewing non-CLI/package-level test-capabilities dependency evidence."
  - "Checking whether ts-quality should run or only record durable quality proof."
type: "evidence"
---

# Test-capabilities dependency-intelligence scenario-diversity proof — 2026-05-19

## Design membrane

This document records durable `ts-quality` adoption evidence for the `test-capabilities` dependency-intelligence scenario-diversity follow-up.

`ts-quality` does not own runtime tracing, Gardener static analysis, dep-diet fusion, dep-viz rendering, dep-redteam validation, or target-repo source facts. In this slice, `ts-quality` records durable quality proof only because no TypeScript/JavaScript source change was made in `test-capabilities`.

## Source-owner evidence

Primary target-repo evidence:

```text
test-capabilities:1e57031 docs/project/dependency-intelligence-scenario-diversity-pilot.md
```

That source-owner doc records non-CLI/package-level runtime-autodiscovery probes fused by dep-diet scenario-set support.

## Artifact root

Temporary artifacts were produced under:

```text
/tmp/test-capabilities-depintel-scenario-diversity-20260519090938
```

Key artifact digests:

| Artifact | SHA-256 |
|---|---|
| `runtime/index-load.runtime-trace-bundle.json` | `1832f7862be9cf36bf20df57a2b2c1b0720b2ccfa0b674d13a0d14fa35f78888` |
| `runtime/api-doctor.runtime-trace-bundle.json` | `3f2020b51e8253a97390d05f7b4fa960a8be464f9a5df85891f57079fc75b568` |
| `runtime/api-demo.runtime-trace-bundle.json` | `7dd647f993e82168c160dbb39db36eab11551236e6a907444df5fee84028971d` |
| `runtime/api-test-fixture.runtime-trace-bundle.json` | `255dcbdffc59030430e40ef1f3e50ec503481bb1f20935166af2168900edf0ed` |
| `runtime/quantum-module.runtime-trace-bundle.json` | `88f069b6627b536c089673922147a8cb385c859cd89babd10a6ee913a55e5102` |
| `runtime/healing-module.runtime-trace-bundle.json` | `a65ab6400c9b325b07657b59cdd03cce2bb968c172086343245534873430f246` |
| `runtime/surf-runtime-module.runtime-trace-bundle.json` | `13b1c92595ac17b128a582aa5b352702cf10c66043e2200cd54576d0a00d15db` |
| `depdiet/scenario-diversity.depmodel.json` | `4959f660bfec8c2f50bc2d61e6d1c2861d676eaf2380fe59fd95be74fcd10cf8` |
| `depviz/scenario-diversity/report/index.html` | `210d91c4d081d975a1ffd8c3e934298c484c7bfbba99c76da389669230891428` |

## Quality interpretation

The scenario-diversity depmodel reported:

```json
{
  "packages": 281,
  "edges": 351,
  "observedPackages": 2,
  "classifications": {
    "declared-unobserved": 278,
    "static-central-unobserved": 1,
    "static-runtime-confirmed": 2
  }
}
```

The useful signal is separation of runtime contexts:

- shared CLI startup observed 27 packages in the prior runtime-autodiscovery pilot;
- non-CLI/public API probes observed only `js-yaml@4.1.1` and `zod@3.25.76`;
- module-specific probes for quantum, healing, and surf-runtime observed no external npm packages;
- therefore CLI rendering/startup dependencies are distinguishable from package-level API/internal module paths.

This is review evidence, not dependency-removal authority.

## Why no `ts-quality check` run was needed

No TypeScript/JavaScript source, test, config, or dependency declaration changed in `test-capabilities`. Running `ts-quality check` would not add merge-confidence evidence for a changed target slice. The truthful `ts-quality` role is this durable adoption proof record.

## Validation

Validation for this proof slice:

```bash
cd /home/tryinget/ai-society/softwareco/owned/test-capabilities
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run docs:list -- --task "dependency intelligence scenario diversity" --top 5

cd /home/tryinget/ai-society/softwareco/owned/ts-quality
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
git diff --check
npm run lint
```

## Follow-up

Future proof should focus on owner-approved architecture review or tests for dependency groups. Continue treating `declared-unobserved` as an evidence prompt, not an unused-dependency conclusion.
