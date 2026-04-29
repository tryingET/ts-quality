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

Command recommendations in the compact machine protocol use repeated `command_arg=` fields instead of comma-joined command strings.

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
- `nextEvidenceAction.witnessStatus: "execution-backed witness considered"`

## Protected run-artifact compatibility expectation

Current run artifacts declare `version: "0.2.0"` because `0.2.0` introduced additive run fields. The `0.3.x` public contract does not require downstream parsers to understand every optional field, but it does require repo-owned projections to tolerate older run packets without newer additive fields.

Installed-package smoke currently proves a legacy `0.1.0`-style run packet without these additive fields still projects through:

- `report --json`
- `explain`
- `plan`
- `govern`
- `authorize`

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
