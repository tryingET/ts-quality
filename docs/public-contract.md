---
summary: "Public contract baseline for ts-quality 0.3: stable operator paths, machine protocols, witness semantics, and artifact compatibility expectations."
read_when:
  - "When preparing or reviewing a 0.3.x release"
  - "When deciding whether a CLI, artifact, or machine-output change is breaking"
  - "When writing agent or downstream-parser migration guidance"
type: "reference"
---

# Public Contract Baseline

This document names the public surfaces that `ts-quality` treats as protected starting with the `0.3.x` line.

`ts-quality` is still alpha software, so future releases may change behavior when that improves deterministic evidence, safety, or contract clarity. The rule is not "never change". The rule is: changes to these surfaces must be intentional, documented in release notes, covered by staged/public verification where practical, and explained for downstream agents or parsers.

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

Compact machine protocol v1 grammar:

- the first line is exactly `TSQ_DOCTOR_MACHINE_V1`
- records are LF-delimited; fields inside a record are TAB-delimited
- the first field is the record kind, for example `root`, `config`, `changed`, `files`, `scripts`, `coverage`, `mutation`, `risk`, or `recommend`
- key/value fields use `key=value`; consumers split on the first equals sign
- v1 values are token-light safe text: producers replace TAB/CR/LF with spaces and trim
- list-valued status fields may use comma-joined safe text when they are advisory
- command recommendations use repeated `command_arg=<argv item>` fields in order instead of comma-joined command strings; harnessed agents must not split command recommendations on commas

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

Every `check` run emits one canonical `nextEvidenceAction` packet in `run.json` and `.ts-quality/runs/<run-id>/next-evidence-action.{json,txt}`. This packet is the public next-step surface for humans and LLM agents; downstream operators should prefer it over scraping verdict prose.

This is a breaking alpha cleanup of the older `nextEvidenceAction` shape: consumers must stop reading the removed compatibility summary fields (`remainingBlocker`, `bestNextAction`, `coverageStatus`, `witnessStatus`, `mutationStatus`, `governanceStatus`, and top-level `artifactPaths`) and read the closure contract below instead.

The packet contains:

- exactly one `primaryAction` with `id`, `kind`, `title`, `rationale`, `targetFiles`, `commands`, `artifactPaths`, `completionCriteria`, and ordered `steps`
- `evidenceBasis` with compact coverage, mutation, witness, governance, and confidence facts
- artifact links back to `run.json`, `report.md`, `explain.txt`, `govern.txt`, `check-summary.txt`, and optional remediation receipts

For survivor-driven failures, `primaryAction.kind` is `mutation-survivors`, the action points to `mutation-remediation.json`, and each step includes the assertion hint plus focused test command when available.

The compact `check` stdout and generated `check-summary.txt` must surface the same closure headline plus coverage and mutation basis, so a user can distinguish coverage percentage from merge confidence without opening `run.json` first.

## Minimum viable adoption story

The protected minimum public adoption story is:

1. run `doctor --machine --changed <slice>` to obtain a compact setup packet before inventing setup steps
2. create one manual `witness test` artifact for the behavior-bearing slice
3. run `check --run-id <id>` and confirm the matching witness is consumed as execution-backed evidence
4. read `report --run-id <id>` and `explain --run-id <id>` as the operator-facing projections

The shared public CLI contract fixture proves that sequence from an installed package and records it as `doctor-machine -> manual witness -> check -> report/explain by run id`.

## Protected run-artifact compatibility expectation

Current run artifacts declare `version: "0.2.0"` because `0.2.0` introduced additive run fields. The `0.3.x` public contract does not require downstream parsers to understand every optional field, but it does require repo-owned projections to tolerate older run packets without newer additive fields.

Installed-package smoke currently proves a run-artifact compatibility matrix:

- a legacy `0.1.0`-style run packet without additive `0.2.x` fields still projects through `report --json`, `explain`, `plan`, `govern`, and `authorize`
- a current `0.2.0` packet carrying unknown future optional fields still projects through those same surfaces without requiring downstream parsers or repo projections to understand the unknown fields
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
