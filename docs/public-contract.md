---
summary: "Current public contract for ts-quality alpha: stable operator paths, machine protocols, witness semantics, evidence-closure packets, and artifact compatibility expectations."
read_when:
  - "When preparing or reviewing a public release"
  - "When deciding whether a CLI, artifact, or machine-output change is breaking"
  - "When writing or validating current public artifact consumers"
type: "reference"
---

# Public Contract Baseline

This document names the public surfaces that `ts-quality` treats as protected in the current alpha line. It began as the `0.3.x` public contract baseline, and now also covers later protected additions such as the `0.4.x` evidence-closure packet and the `0.5.x` adoption-retention flow.

`ts-quality` is still alpha software, so future releases may change behavior when that improves deterministic evidence, safety, or contract clarity. The rule is not "never change". The rule is: changes to these surfaces must be intentional, documented in release notes, covered by staged/public verification where practical, and explained for downstream agents or parsers.

Package versions and artifact schema versions are related but independent. The npm package may be `0.5.x` while persisted run artifacts still declare an older run-artifact `version` such as `0.2.0` when the artifact schema has not changed. Consumers should branch on artifact fields/schema versions for machine parsing and use package release notes for migration context.

## Protected operator paths

The release path is GitHub-Release-authoritative:

1. prepare local release files with `npm run release:prepare -- --version <version> --apply`
2. commit and tag `v<version>`
3. create the GitHub Release
4. let `.github/workflows/publish.yml` publish through npm Trusted Publishing/OIDC
5. run `npm run release:verify-public -- --version <version>` after publication

Do not publish with local `npm publish`.

## Protected CLI discovery contract

Public release verification protects these first-contact commands:

```bash
ts-quality --help
ts-quality doctor --help
ts-quality doctor --machine --changed src/index.ts
```

The top-level help must begin with:

```text
ts-quality commands:
```

`doctor --help` must expose `--machine`.

`doctor --machine` must begin with:

```text
TSQ_DOCTOR_MACHINE_V1
```

## Agent Experience (AX) terminology

AX means Agent Experience: the agent-facing experience across both structured machine consumers and token-sensitive harnessed LLMs. This repo uses the core ontology concept `core.AgentExperience` for the shared term.

`ts-quality` treats these as AX projection modes:

- `--json` — structured AX for deterministic parsers, CI systems, dashboards, and programmatic agents
- `--compact` — compact AX for harnessed LLMs and agent workbenches where token budget and next-action clarity matter

Both modes should derive from the same durable artifact contract. The durable truth stays in run artifacts such as `run.json`; compact outputs are token-efficient projections, not separate authority. Existing command-specific compact protocols such as `doctor --machine` and `retention --machine` follow this compact AX principle even before every command exposes a `--compact` flag.

Compact doctor machine protocol v1 grammar:

- the first line is exactly `TSQ_DOCTOR_MACHINE_V1`
- records are LF-delimited; fields inside a record are TAB-delimited
- the first field is the record kind, for example `root`, `config`, `changed`, `files`, `scripts`, `coverage`, `mutation`, `risk`, or `recommend`
- key/value fields use `key=value`; consumers split on the first equals sign
- v1 values are token-light safe text: producers replace TAB/CR/LF with spaces and trim
- list-valued status fields may use comma-joined safe text when they are advisory
- command recommendations use repeated `command_arg=<argv item>` fields in order instead of comma-joined command strings; harnessed agents must not split command recommendations on commas

Compact retention machine protocol v1 grammar:

- the first line is exactly `TSQ_RETENTION_PLAN_V1`
- records are LF-delimited; fields inside a record are TAB-delimited
- `root\t<absolute-root>` names the inspected repo root
- `config\tok\tpath=<repo-relative-config>` means config loaded; `config\terror\tmessage=<safe text>` means config was absent or invalid
- `keep\t<status>\t<path>\treason=<safe text>` names reusable files or patterns to commit/review, such as config/control-plane/witness records and trusted public keys
- `ignore\t<status>\t<path>\treason=<safe text>` names generated, ephemeral, or sensitive files to keep out of commits unless deliberately snapshotting reviewed examples
- `warning\t<safe text>` records advisory retention risks
- values follow the same safe-text rule as doctor v1; status is usually `present`, `missing`, or `pattern`

## Protected manual witness contract

The public release verifier also protects the first manual witness path:

```bash
ts-quality witness test \
  --invariant <id> \
  --scenario <id> \
  --source-files <src> \
  --test-files <test> \
  --out .ts-quality/witnesses/<name>.json \
  -- <focused proof command>
ts-quality check --run-id <id>
```

A matching pass witness under `.ts-quality/witnesses/**/*.json` is first-class `check` evidence when all of these match:

- invariant id
- scenario id
- `status: "pass"`
- impacted source scope through repo-relative `sourceFiles`

Sibling `.receipt.json` sidecars are execution receipts, not witness records to consume as scenario support.

A successful manual witness upgrade must surface as:

- `evidenceSemantics: "execution-backed"`
- scenario `supportKind: "execution-witness"`
- `nextEvidenceAction.evidenceBasis.witness.status: "execution-backed"`

## Protected actionable evidence closure contract

Every `check` run emits one canonical `nextEvidenceAction` packet in `run.json` and `.ts-quality/runs/<run-id>/next-evidence-action.{json,txt}`. It also writes `.ts-quality/runs/<run-id>/next-evidence-action.prompt.md` for LLM handoff and `.ts-quality/runs/<run-id>/next-evidence-action.ak-task.json` as an AK-ready task manifest projection. This packet is the public next-step surface for humans and LLM agents; downstream operators should prefer it over scraping verdict prose.

The packet contains:

- exactly one `primaryAction` with `id`, `kind`, `title`, `rationale`, optional `expectedConfidenceLift`, `targetFiles`, `suggestedEditFiles`, `evidenceTargets`, `commands`, `artifactPaths`, `completionCriteria`, grouped/ordered `steps`, `groups`, additive `sidecarSufficiency`, and a `taskManifest`
- `evidenceBasis` with compact coverage, mutation, witness, governance, confidence, and `nonBlockingSignals` facts
- artifact links back to `run.json`, `report.md`, `explain.txt`, `govern.txt`, `check-summary.txt`, and optional remediation receipts

Protected `primaryAction.kind` values:

- `mutation-survivors` — surviving mutants remain; steps point at grouped survivor assertions and likely test edit files
- `mutation-baseline` — the baseline test command failed before mutation interpretation
- `mutation-missing` — no killed or surviving mutation evidence was measured
- `governance` — blocking governance findings remain
- `coverage` — LCOV coverage evidence is missing or failed to generate
- `witness` — execution-backed invariant witness evidence is missing
- `analysis-warning` — reserved for future source/dist or analysis-risk closure actions
- `none` — no blocking evidence action remains

For survivor-driven failures, `primaryAction.kind` is `mutation-survivors`, the action points to `mutation-remediation.json`, groups equivalent survivors, includes likely `suggestedEditFiles`, includes a focused rerun command when available, and publishes the same plan through the prompt and AK-task sidecar artifacts. Survivor steps also carry generalized assertion guidance: the affected symbol when known, the observable behavior delta, an assertion strategy, and a masking/observability note warning that obvious call paths may still pass when downstream guards, fallbacks, normalization, or serialization collapse original and mutated behavior.

`sidecarSufficiency` is an additive actionability rubric for humans and agents:

- `bounded` — the sidecar identifies the closure class and scope, but a maintainer or agent must still infer the repair path.
- `actionable` — the sidecar identifies the edit target, verification command, completion criteria, and behavior/observability guidance needed to perform a focused repair.
- `turnkey` — no blocking closure work remains, or the sidecar is complete enough to execute without interpretation.
- `misleading` — the sidecar selected a blocking action but failed to identify enough scope or steps to be safe to follow.

For mutation-survivor closure, `actionable` is the expected healthy state: concrete test code is still intentionally left to the repo operator or agent, but the sidecar must remove hidden source archaeology by naming the behavior delta and masking risk.

The compact `check` stdout and generated `check-summary.txt` must surface the same closure headline plus coverage and mutation basis, so a user can distinguish coverage percentage from merge confidence without opening `run.json` first.

## Artifact contract summary

`run.json` is the immutable check-time audit packet. Other generated JSON/text surfaces are projections or decision records that point back to the selected run rather than replacing it.

For adoption-facing parser habits across legacy packets, additive fields, authorization records, and next-evidence sidecars, see `docs/adoption/artifact-consumer-compatibility-guide.md`.

Consumer-safe parsing rules:

- read `run.json` as the source of truth for changed scope, evidence, verdict, control-plane snapshot, and `nextEvidenceAction`
- tolerate unknown optional fields unless release notes explicitly mark a breaking change
- treat absent additive fields as unknown/not-provided, not as proof of success
- fail closed on unsupported or malformed control-plane snapshots when making governance or authorization decisions
- use `report --json` when a projected machine view is desired; it includes additive `decisionContext` metadata instead of pretending to be raw `run.json`
- use authorization, bundle, amendment, witness receipt, and next-evidence-action sidecars as run-bound records/projections, not independent authority over the reviewed run

Protected top-level artifact expectations:

| Artifact | Authority role | Required consumer habit |
|---|---|---|
| `.ts-quality/runs/<run-id>/run.json` | immutable check-time evidence bundle | parse by artifact fields/version; tolerate additive fields |
| `verdict.json` | verdict projection from the run | treat as derived from `run.json` |
| `report.json` / `report --json` | machine report projection with `decisionContext` | distinguish persisted check-time report from later projected views |
| `authorize.<agent>.<action>.json` | run-bound legitimacy decision | require `evidenceContext` / run id to match the reviewed run |
| `bundle.<agent>.<action>.json` | proof-carrying change bundle | treat as paired with the authorization decision, not as broader approval |
| `.ts-quality/amendments/*.result.json` | amendment evaluation result | treat proposal + constitution as authority; result is the evaluated decision record |
| `.ts-quality/witnesses/*.receipt.json` | execution receipt for a witness record | do not consume receipts as scenario support witnesses |
| `next-evidence-action.json` | canonical next evidence obligation | prefer over scraping verdict prose |

## Negative-path contract

A healthy public contract must explain blocks, not only green runs. Negative paths that downstream docs, fixtures, or release verification should continue to exercise include:

- mutation survivors: `check` lowers confidence, emits `primaryAction.kind: "mutation-survivors"`, and names survivor remediation evidence
- missing coverage: `check` fails or blocks with a coverage-oriented `nextEvidenceAction` unless configured generation succeeds
- missing or stale witness: invariant support stays lexical/missing rather than execution-backed
- governance boundary violation: `govern` and `authorize` surface blocking findings tied to the exact run
- wrong-run approval/attestation: projected decision surfaces fail closed instead of trusting ambient files
- insufficient agent grant or confidence floor: `authorize` returns a non-approval outcome such as human approval required
- malformed or unsupported control-plane snapshot: governance/authorization projections instruct the operator to rerun rather than silently projecting stale authority

Automation should prefer explicit non-zero command status plus the generated artifact fields over prose matching when asserting these paths. The concrete docs-only pilot plan for the governance boundary, wrong-run authorization, and insufficient-grant cases is `docs/adoption/negative-governance-authorization-pilot.md`.

## Minimum viable adoption story

The protected minimum public adoption story is:

1. run `doctor --machine --changed <slice>` to obtain a compact setup packet before inventing setup steps
2. create one manual `witness test` artifact for the behavior-bearing slice
3. run `check --run-id <id>` and confirm the matching witness is consumed as execution-backed evidence
4. read `report --run-id <id>` and `explain --run-id <id>` as the operator-facing projections
5. run `retention [--config <file>] [--machine]` when converting pilot output into repo assets so reusable config/control-plane/witness/public-key files are distinguished from generated run artifacts, latest pointers, mutation scratch files, coverage output, receipt sidecars, and private keys

The shared public CLI contract fixture proves the core evidence sequence from an installed package and records it as `doctor-machine -> manual witness -> check -> report/explain by run id`. The retention projection is an additive read-only adoption aid, not a new authority over `run.json` or repository policy.

## Protected run-artifact compatibility expectation

Current run artifacts declare `version: "0.2.0"` because `0.2.0` introduced additive run fields. The current public contract does not require downstream parsers to understand every optional field, but it does require repo-owned projections to tolerate older run packets without newer additive fields. Adoption consumers should follow `docs/adoption/artifact-consumer-compatibility-guide.md` when deciding which missing, malformed, legacy, or future fields are display-only versus fail-closed decision inputs.

Installed-package smoke and the checked-in parser fixtures under `fixtures/artifact-compatibility/` currently prove a run-artifact compatibility matrix:

- a legacy `0.1.0`-style run packet without additive `0.2.x` fields still projects through `report --json`, `explain`, `plan`, `govern`, and `authorize`
- a current `0.2.0` packet carrying unknown future optional fields still projects through those same surfaces without requiring downstream parsers or repo projections to understand the unknown fields
- a current `0.2.0` packet whose `nextEvidenceAction` lacks recent optional sidecar fields such as `sidecarSufficiency`, `taskManifest.guidance`, and per-step behavior guidance still projects through those same surfaces
- unsupported or malformed control-plane snapshots fail closed with a re-run instruction instead of being silently projected into authorization or governance decisions

Protected compatibility principle:

- additive fields may be added when they improve explainability or traceability
- downstream projections must not require optional additive fields unless release notes call out a breaking change
- unsupported or malformed control-plane snapshots still fail closed with a re-run instruction
- `run.json` remains the immutable check-time source of truth; Markdown and stdout are projections

## Protected release-note contract

Release notes are local release-please-style notes with these sections:

- `### Breaking Changes`
- at least one categorized change section such as `### Added`, `### Changed`, or `### Fixed`
- `### Agent migration notes`

If a change affects agent prompts, parsers, fixtures, machine protocols, artifact schemas, or operator command paths, the agent migration notes must say what downstream agents need to do.

## Current non-goals

This baseline does not claim:

- full semantic proof from natural-language invariants
- stable major-version API guarantees
- solved adoption across every repo shape
- that sample artifacts are authority over run artifacts

The contract is narrower: deterministic evidence packets, public operator paths, compact diagnostics, witness semantics, and projection compatibility should be hard to regress accidentally.
