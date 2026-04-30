---
summary: "Draft boundary-contract plan for runtime-trace-insights, dep-diet, and dep-viz after public ts-quality@0.5.0 dogfoods."
read_when:
  - "Planning repo-local boundary-contract docs for the runtime evidence to dependency-risk pipeline."
  - "Investigating boundary clarity across runtime-trace-insights, dep-diet, and dep-viz."
type: "plan"
---

# Cross-repo boundary contract plan — 2026-04-30

## Pipeline boundary model

```text
softwareco/contrib/gardener
  -> contributes static dependency graph + centrality / dependency-importance evidence

runtime-trace-insights
  -> captures/normalizes runtime evidence

dep-diet
  -> combines Gardener static evidence, runtime evidence, manifest/lock/security/policy evidence
  -> decides dependency risk/actionability and produces depmodel

dep-viz
  -> visualizes/explains depmodel evidence for humans/operators
```

Gardener should remain a contrib/upstream analyzer. Dep-diet should consume Gardener output through a subprocess/JSON adapter and translate it into evidence; it should not absorb Gardener or treat Gardener's funding-oriented centrality as dependency-removal authority.

Detailed opportunity note: `docs/adoption/2026-04-30-gardener-dep-diet-integration-opportunity.md`.

## Recommended target docs

Create these repo-local docs in follow-up target-repo changes. Do not push `runtime-trace-insights` or `dep-viz` directly to `main`; their AGENTS files require merge requests only.

- `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights/docs/project/boundary-contract.md`
- `/home/tryinget/ai-society/softwareco/owned/dep-diet/docs/project/boundary-contract.md`
- `/home/tryinget/ai-society/softwareco/owned/dep-viz/docs/project/boundary-contract.md`

## Shared template

```md
# Boundary contract

## This repo owns

## This repo consumes

## This repo produces

## This repo does not own

## Compatibility expectations

## First ts-quality slice

## Retention policy
```

## runtime-trace-insights boundary doc draft

### This repo owns

- Runtime observation only.
- Runtime trace capture and normalization.
- Runtime trace manifest schema and runtime-record result schema.
- Runtime-record adapters for downstream consumers.
- AppMap/setup guidance when runtime capture support is unavailable.

### This repo consumes

- A target project path and observed command.
- Runtime-capture availability/configuration, including AppMap availability when relevant.
- Optional prior runtime trace manifest entries for appending/deduplication.

### This repo produces

- Runtime trace artifacts.
- Runtime trace manifest artifacts.
- Runtime-record result objects.
- AppMap setup guidance artifacts when capture support is missing.
- Adapter outputs suitable for `dep-diet` runtime-evidence ingestion.

### This repo does not own

- Dependency pruning/removal decisions.
- Vulnerability policy or risk thresholds.
- Depmodel-wide actionability decisions.
- Visualization/report UI or long-term report interaction semantics.

### Compatibility expectations

- Runtime-record outputs should remain schema-versioned and additive-first.
- Runtime trace manifest paths should remain stable enough for downstream evidence ingestion.
- Adapter contracts should not imply risk/actionability conclusions; they should identify the runtime fact and its proving artifact.

### First ts-quality slice

- Evidence doc: `docs/adoption/2026-04-30-runtime-trace-insights-dogfood.md`
- First invariant: `runtime.record.flow.artifacts`
- Changed file: `src/runtime_record/runtime_record_flow.mjs`
- Focused test: `tests/runtime_record_flow.test.mjs`
- Current result: public `ts-quality@0.5.0` produced execution-backed witness evidence but failed merge readiness with 25/100 confidence, 3 killed / 12 sites, 9 survived, 0 errors, and 16 changed functions under 80% coverage.

### Retention policy

- Commit reusable ts-quality control-plane files only after target-repo maintainers accept the slice.
- Keep `.ts-quality/runs/`, `.ts-quality/latest.json`, `.ts-quality/mutation-manifest.json`, coverage outputs, witness receipt sidecars, and private keys ephemeral or gitignored.
- Commit witness JSON only when it is a reviewed durable evidence record.

## dep-diet boundary doc draft

### This repo owns

- Dependency evidence and actionability.
- Dependency graph evidence and introducer-path reasoning.
- Package/vulnerability/domain mapping.
- "Why is this dependency here?" reasoning.
- Prune/remove actionability and safety gates.
- Depmodel production for visualization/inspection consumers.

### This repo consumes

- Static dependency evidence, including Gardener graph/centrality output when available.
- Runtime evidence from `runtime-trace-insights` or compatible runtime-record adapters.
- Vulnerability findings and policy inputs.
- Domain mapping inputs and allow/block configuration.

### This repo produces

- Depmodel artifacts.
- Dependency risk/actionability decisions.
- Static-importance evidence mapped from Gardener without converting it directly into removal authority.
- Justification and evidence links for prune/remove proposals.
- Safety-gate outputs for downstream reporting and operator review.

### This repo does not own

- Runtime trace capture internals.
- AppMap/setup guidance behavior.
- Visualization UI/report semantics.
- Long-term report interaction behavior.

### Compatibility expectations

- Consumed runtime-record artifacts should be treated as evidence, not as actionability conclusions.
- Consumed Gardener artifacts should be treated as static importance evidence, not as prune-safety or vulnerability-policy conclusions.
- Produced depmodels should remain schema-versioned and additive-first for `dep-viz` consumers.
- Mapping quality should be supported by focused evidence rather than broad keyword coincidence.
- Evidence conflicts should be explicit: for example, direct manifest dependency + no Gardener import + no runtime observation is a candidate `dead-branch`, while transitive manifest dependency + central Gardener path + runtime observation is a candidate `hidden-root`.

### First ts-quality slice

- Evidence doc: `docs/adoption/2026-04-30-dep-diet-dogfood.md`
- First invariant: `mapping.quality.scll`
- Changed file: `src/domain/mappingQuality.mjs`
- Focused test: `tests/mapping_quality_checks.test.mjs`
- Result: pass; merge confidence 100/100; mutation 3 killed / 3 sites, 0 survived, 0 errors; coverage 3 files with changed-function minimum 87.23%; next evidence action none; sidecar sufficiency turnkey.

### Retention policy

- Commit reusable ts-quality config/control-plane/witness files for accepted slices.
- Keep generated run bundles, latest pointer, mutation manifest, LCOV, witness receipt sidecars, and private keys out of normal durable state.
- Snapshot reviewed examples deliberately only when they serve docs or fixtures.

## dep-viz boundary doc draft

### This repo owns

- Depmodel consumption and explanation UI.
- Depmodel loading into stable report primitives.
- Package/module/vulnerability relationship rendering.
- Filters by module, severity, ecosystem, and directness.
- Human-facing "why here?" surfaces and report semantics.

### This repo consumes

- Depmodel artifacts from `dep-diet` or compatible producers.
- Vulnerability, dependency relationship, runtime usage, and static-importance fields already present in the depmodel.
- Operator-facing configuration needed to choose report views and filters.

### This repo produces

- Human-readable dependency-risk reports.
- UI/report state for packages, modules, vulnerabilities, introducer paths, and "why here?" explanations.
- Filtered views and report primitives that preserve depmodel semantics without redefining policy truth.

### This repo does not own

- Scanning or vulnerability-policy truth.
- Dependency removal/pruning decisions.
- Runtime trace capture.
- Depmodel production semantics beyond consumer compatibility expectations.

### Compatibility expectations

- Report-model primitives should be stable and tested; additive fields such as `sbomFailedModules` need explicit test acceptance when they become durable UI contract.
- Filters must preserve module/severity/ecosystem/directness semantics from the depmodel.
- Static-importance rendering should explain Gardener-derived centrality as evidence, not as actionability or removal authority.
- UI/report copy should explain evidence without turning visualization into the policy authority.

### First ts-quality slice

- Evidence doc: `docs/adoption/2026-04-30-dep-viz-dogfood.md`
- First invariant: `depviz.report.depmodel.filters`
- Changed files: `web/report/src/model-loader.js`, `web/report/src/app-shell.js`
- Focused tests: `tests/report-model-loader.test.mjs`, `tests/report-vulnerabilities.test.mjs`
- Current result: blocked before `ts-quality check`; focused test command failed 11 pass / 1 fail because `getOverview()` now includes `sbomFailedModules: []` while the test expected object omits it.

### Retention policy

- Do not commit temp-copy `.ts-quality` files until the focused report-model test passes and target-repo maintainers accept the repo-local adoption slice.
- Keep generated run bundles, latest pointer, mutation manifest, LCOV, witness receipt sidecars, and private keys out of normal durable state.
- Commit a reviewed witness JSON only after the focused tests and `ts-quality check` produce a useful durable evidence record.

## Recommended sequencing

1. Add or tighten `runtime-trace-insights` focused assertions for runtime-record survivor groups, then rerun the same public-package ts-quality slice.
2. Resolve the `dep-viz` report-model contract around `sbomFailedModules`, then rerun the same public-package ts-quality slice.
3. Run a non-invasive Gardener spike against a temp copy of `dep-diet`; do not update the divergent Gardener checkout blindly.
4. Draft a bounded dep-diet Gardener adapter contract from observed JSON: Gardener output -> dep-diet static evidence -> depmodel fragment.
5. Add the three boundary-contract docs in the target repos once the first slices have accepted local wording and retention posture.
6. Add cross-repo fixture compatibility tests: Gardener static fixture + runtime-record adapter fixture -> dep-diet runtime/static evidence input -> depmodel fixture -> dep-viz loading/filtering fixture.
