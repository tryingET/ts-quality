---
summary: "Architecture design for a one-output dependency intelligence product: Gardener + runtime-trace-insights + dep-diet evidence rendered through dep-viz."
read_when:
  - "Designing the Gardener / runtime-trace-insights / dep-diet / dep-viz integration."
  - "Deciding which repo owns evidence capture, evidence fusion, depmodel production, or human-facing visualization."
  - "Planning visual dep-viz enhancements from Gardener static importance and runtime evidence."
type: "architecture"
---

# Dependency intelligence one-output architecture — 2026-04-30

## Architecture thesis

The product should have **one operator-facing output**:

```text
dep-viz renders the enriched depmodel.
```

The other systems provide or fuse evidence for that output:

```text
softwareco/contrib/gardener
  -> static dependency graph and centrality evidence

runtime-trace-insights
  -> runtime observation evidence

dep-diet
  -> evidence fusion, actionability-adjacent classification, and depmodel production

dep-viz
  -> human-facing report / visual explanation of the depmodel
```

This keeps source ownership clean while allowing dep-viz to become the unified dependency-intelligence workbench.

## Non-goals

- `dep-viz` must not call Gardener directly.
- `dep-viz` must not execute runtime tracing directly.
- Gardener must not decide dependency removal safety.
- `runtime-trace-insights` must not decide dependency risk or pruning.
- `dep-diet` must not own long-lived report interaction semantics.
- The system must not collapse static centrality, runtime observation, vulnerability policy, and removal authority into one opaque score.

## Owner boundaries

| Concern | Owner | Output contract |
|---|---|---|
| Static graph, import graph, centrality, dependency importance | Gardener | Gardener JSON, consumed as static evidence |
| Runtime command observation and trace artifact references | runtime-trace-insights | `runtime-trace-insights.runtime-trace-bundle.v1` |
| Evidence fusion, conflict naming, actionability-adjacent classification, depmodel production | dep-diet | `depmodel.v1` with additive evidence fields |
| Human/operator inspection, visual overlays, explanation copy, filters | dep-viz | HTML/report/UI from depmodel |

## Canonical data path

```text
Gardener output
  + runtime-trace-insights runtime bundle
  + manifest/lock/security/policy/domain inputs
  -> dep-diet analyze/fusion
  -> depmodel.v1
  -> dep-viz report/UI
```

The depmodel is the shared boundary. It should remain additive-first and forward-compatible.

## Depmodel responsibility correction

For the enriched dependency-intelligence corridor, the depmodel should be treated as:

```text
dep-diet-produced, dep-viz-consumed
```

Older wording in some dep-viz contract docs may still describe `depviz` as the primary producer and `depdiet` as the primary consumer. That can remain historically true for older scanner/model-generation surfaces, but it is not the right ownership model for the Gardener/runtime evidence corridor.

A follow-up doc/code pass should clarify the contract as one of these two explicit modes:

1. **scanner-origin depmodel mode** — dep-viz/native scanner or compatible producer emits baseline depmodel primitives;
2. **intelligence-enriched depmodel mode** — dep-diet emits enriched depmodel evidence consumed by dep-viz.

The architecture should not pretend there is only one producer forever. It should say: depmodel is a contract; producers can vary; dep-viz is the canonical renderer.

## Evidence layers inside depmodel

The enriched depmodel should carry separate, inspectable evidence namespaces instead of a single mixed score.

Recommended package-level additive field:

```json
{
  "evidence": {
    "staticRuntime": {
      "schemaVersion": "depdiet.static-runtime-corridor.v1",
      "classification": "static-runtime-confirmed",
      "static": {
        "provider": "gardener",
        "centralityPercentage": 12.4,
        "pagerank": 0.124,
        "importance": "high",
        "foundInManifests": ["package.json"]
      },
      "runtime": {
        "provider": "runtime-trace-insights",
        "observed": true,
        "commandLine": "npm test",
        "sourcePath": "out/runtime-trace-insights/runtime-trace-bundle.json",
        "evidenceKind": "runtime-record"
      },
      "authority": {
        "removalAuthority": false,
        "note": "Static/runtime evidence is context for review, not standalone removal permission."
      }
    }
  }
}
```

The current corridor already has the core of this shape. The main refinement is to make the authority boundary more explicit and visually useful.

## Classification vocabulary

Dep-diet owns these classifications; dep-viz renders them.

| Classification | Meaning | Visual treatment |
|---|---|---|
| `static-runtime-confirmed` | Static evidence and runtime evidence agree. | Strong node, confirmed badge, solid link. |
| `runtime-only` | Observed at runtime but absent or unmatched in static evidence. | Pulse/glow, dynamic-path badge. |
| `declared-unobserved` | Declared/static evidence exists, runtime bundle did not observe it. | Faded node, review-needed badge. |
| `static-central-unobserved` | Gardener marks central/important, but runtime bundle did not observe it. | Large/central node with caution halo. |
| `ambiguous-evidence` | Inputs are incomplete or contradictory. | Split/striped badge, require follow-up. |

Future dep-diet-owned actionability terms may include `critical-soil`, `dead-branch`, `hidden-root`, `support-worthy`, `prune-candidate`, and `risky-core`, but those should be distinct from raw static/runtime evidence classifications.

## Visual architecture for dep-viz

Dep-viz should become the single page/report where the operator can answer:

1. Why is this dependency present?
2. Is it statically central?
3. Was it observed at runtime?
4. Is the evidence contradictory?
5. What does dep-diet recommend or withhold?
6. What evidence must be collected next?

Recommended visual layers:

### 1. Overview evidence board

A top-level panel showing counts:

- static/runtime confirmed
- runtime-only
- declared-unobserved
- static-central-unobserved
- ambiguous evidence
- policy/vulnerability blockers
- SBOM partial-scan warnings

This already exists in a basic form; it should become more visually expressive and clearly tied to the graph/report below.

### 2. Dependency graph overlay

For package nodes:

- node size = Gardener centrality / static importance
- outline color = classification
- pulse/glow = runtime observed
- dashed/faded = declared but unobserved
- warning halo = static-central-unobserved or ambiguous
- vulnerability marker = severity/policy finding

For edges:

- solid = manifest/static known edge
- animated/bright = runtime-observed path
- dotted = inferred/transitive path
- red/amber = vulnerable or policy-relevant path

### 3. Package detail inspector

When selecting a package, dep-viz should show:

- package identity and version
- direct/transitive/introducer path facts
- Gardener static facts: centrality, rank, evidence ref, graph digest when available
- runtime facts: observed boolean, command, trace artifact, evidence kind
- vulnerability/policy facts
- dep-diet classification and actionability-adjacent rationale
- authority note: evidence context, not automatic removal authority
- next evidence action, if dep-diet provides one

### 4. Evidence conflict explanations

Dep-viz should render named conflict sentences generated by dep-diet, for example:

```text
Direct manifest dependency + no Gardener import edge + no runtime observation
=> candidate dead branch; verify plugin/dynamic usage before pruning.
```

```text
Transitive dependency + central Gardener path + runtime observation
=> hidden root; do not prune casually.
```

Dep-viz may format and prioritize these explanations, but dep-diet owns the conflict classification text or machine code.

## Dep-diet architecture

Dep-diet should expose an operator path like:

```bash
depdiet analyze <project> \
  --gardener-output <gardener.json> \
  --runtime-bundle <runtime-trace-bundle.json> \
  --out-depmodel <depmodel.json> \
  --format json
```

Current repo evidence indicates this already exists as a first slice. The next architecture step is to harden it as the primary producer path for enriched depmodel output.

Dep-diet should add or preserve:

- exact schema version for static/runtime evidence;
- stable summary counts;
- raw evidence refs/digests where possible;
- explicit diagnostics when inputs are missing, stale, unsupported, or contradictory;
- explicit non-authority metadata for static/runtime-only evidence;
- optional actionability layer that remains separate from raw evidence classification.

## Runtime-trace-insights architecture

Runtime-trace-insights should stay narrow:

```text
record one command -> normalize observed packages -> write runtime bundle
```

It should improve alignment with dep-diet by ensuring runtime bundle entries carry:

- stable package name/ecosystem/version when known;
- `packageId` compatible with depmodel package IDs;
- `moduleId` when known;
- observed command and trace artifact reference;
- diagnostics for incomplete capture.

It should not know or care about Gardener. Its job is to make runtime facts easy for dep-diet to compare against static facts.

## Gardener architecture

Gardener remains an upstream/contrib static analyzer. For this architecture, the desired seam is:

```text
Gardener JSON profile -> dep-diet adapter -> static evidence namespace
```

Potential later upstream contribution candidates:

- documented machine-consumer JSON profile;
- stable centrality metric labels;
- explicit graph digest;
- cleaner package/component identifiers;
- optional no-network mode or resolved-url diagnostics.

These are useful but not blockers. Dep-diet can map current Gardener JSON now.

## Compatibility and validation

Each repo should own one compatibility check:

1. `runtime-trace-insights`: fixture bundle conforms to runtime bundle contract.
2. `dep-diet`: Gardener fixture + runtime bundle fixture emits deterministic depmodel.
3. `dep-viz`: dep-diet-emitted depmodel loads and renders with the expected visual/report primitives.
4. Cross-repo optional assertions should run when sibling repos are present, but not make isolated package tests impossible.

## Implementation order

### Slice 1 — contract wording cleanup

- Clarify `depmodel.v1` producer/consumer language in dep-viz docs.
- State that dep-viz is canonical renderer, not necessarily canonical producer.
- Preserve historical scanner-origin depmodel language if still valid, but add enriched depmodel mode.

### Slice 2 — dep-diet enriched depmodel hardening

- Treat `depdiet analyze --gardener-output --runtime-bundle --out-depmodel` as the primary enriched output path.
- Add non-authority metadata or docs around `evidence.staticRuntime`.
- Preserve classification summary in report JSON.

### Slice 3 — dep-viz visual overlay upgrade

- Upgrade overview panel from simple counts to visual evidence board.
- Add graph/node visual encodings for centrality and runtime observation.
- Add package detail inspector fields for Gardener and runtime evidence.
- Add tests that assert semantic data attributes rather than brittle visual styling.

### Slice 4 — runtime-trace bundle alignment

- Tighten package/module identifier compatibility with dep-diet.
- Add diagnostics for incomplete runtime observation.
- Keep runtime evidence capture independent from dep-diet/de-viz concerns.

### Slice 5 — optional Gardener upstream polish

- Only after downstream needs stabilize, consider upstream machine-output improvements.

## Acceptance criteria

The architecture is working when an operator can run:

```bash
# produce runtime evidence
runtime-trace-insights ... --out runtime-bundle.json

# produce / obtain static evidence
gardener ... --output gardener.json

# fuse evidence into one depmodel
depdiet analyze . \
  --gardener-output gardener.json \
  --runtime-bundle runtime-bundle.json \
  --out-depmodel depmodel.json

# inspect one final human-facing output
depviz report --model depmodel.json --out dependency-intelligence.html
```

And the resulting dep-viz report clearly shows:

- what was statically central;
- what was runtime observed;
- where the two disagree;
- what dep-diet classified;
- what remains non-authoritative evidence rather than removal permission;
- what the operator should investigate next.

## Short product name

This can be framed as:

```text
Dependency Intelligence Report
```

with dep-viz as the report surface and dep-diet as the evidence-fusion producer.
