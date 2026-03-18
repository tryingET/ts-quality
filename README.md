---
summary: "Product overview for ts-quality v5: deterministic evidence, explainable trust, and CLI entrypoints."
read_when:
  - "When onboarding to this repo"
  - "When validating the shipped CLI surface or artifact contract"
type: "reference"
---

# ts-quality v5.0.0

`ts-quality` is an offline-first TypeScript quality platform that turns static evidence into explainable trust for software change.

It progresses through five layers:

1. **Evidence** — `crap4ts` finds risky code and maps LCOV coverage to functions.
2. **Judgment** — `ts-mutate` runs deterministic mutation tests and `ts-quality check` computes merge confidence for changed code.
3. **Understanding** — invariants encode behavior in code and generate deterministic missing-test obligations.
4. **Governance** — constitutions encode architectural boundaries, approvals, rollback evidence, and domain risk budgets.
5. **Legitimacy** — agents, authority grants, attestations, overrides, and amendments determine who may change the system and under what evidence burden.

## What makes a run meaningful

A strong `ts-quality` result depends on explicit inputs, not hidden inference:

- **Coverage evidence** — provide `coverage/lcov.info` so CRAP and covered-only mutation selection are grounded in executed code.
- **Green mutation baseline** — `mutations.testCommand` must pass before mutation results are trusted. A broken baseline now blocks mutation scoring instead of pretending every failing run killed a mutant.
- **Executable tests** — `mutations.testCommand` must actually fail when behavior changes, or mutants will survive and confidence will drop.
- **Focused test evidence** — invariant scenarios are matched against tests aligned to the impacted source by file naming/import hints or explicit `requiredTestPatterns`, not by unrelated repo-global keyword hits.

## Deterministic depth, not semantic guesswork

`ts-quality` is intentionally deterministic. It does **not** claim to prove semantics from natural language. Instead it combines:

- structural evidence (coverage + CRAP)
- behavioral pressure (mutation outcomes)
- focused lexical test evidence for invariants
- explicit governance and legitimacy rules

That makes the system explainable and debuggable, but it also means shallow tests will produce shallow evidence.

## Top-level commands

```bash
npx ts-quality init
npx ts-quality check [--run-id <id>]
npx ts-quality explain
npx ts-quality report
npx ts-quality trend
npx ts-quality plan
npx ts-quality govern
npx ts-quality authorize --agent release-bot
npx ts-quality attest sign --issuer ci.verify --key-id sample --private-key .ts-quality/keys/sample.pem --subject .ts-quality/runs/<run-id>/verdict.json --claims ci.tests.passed --out .ts-quality/attestations/ci.tests.passed.json
npx ts-quality amend --proposal proposal.json
```

## What a run produces

A successful `check` writes a stable evidence bundle under `.ts-quality/runs/<run-id>/`:

- `run.json` — complete machine-readable bundle
- `verdict.json` — merge-confidence verdict
- `report.md` — human-readable report
- `pr-summary.md` — PR-facing summary with concise invariant evidence provenance
- `check-summary.txt` — terse run-status summary with the first at-risk invariant provenance when present
- `explain.txt` — explanation trail
- `plan.txt` — governance plan with related invariant evidence provenance for the at-risk claim
- `govern.txt` — governance findings with related invariant evidence provenance for the at-risk claim

`run.json` now also carries additive execution receipts that make the run boundary explicit instead of implicit: `analysis` records the preallocated run id, exact changed scope, source file set, and mutation execution fingerprint; `mutationBaseline` records whether the baseline test command was green before mutants were interpreted. Caller-supplied run ids are treated as artifact ids and must use only letters, numbers, dots, underscores, and hyphens.

Each impacted invariant also carries a structured `behaviorClaims[].evidenceSummary` in `run.json`, exposing the invariant-scoped evidence basis directly: impacted files, focused tests, changed functions, coverage pressure, mutation counts, per-scenario support, and named deterministic sub-signals such as `focused-test-alignment`, `scenario-support`, `coverage-pressure`, `mutation-pressure`, and `changed-function-pressure`. Every sub-signal is also labeled as `explicit`, `inferred`, or `missing` so reviewers can tell whether support came from direct configured/artifact evidence or deterministic alignment heuristics.

## Why it is explainable

Every score, block, waiver, attestation, override, and amendment connects back to explicit evidence:

- changed files and diff hunks
- coverage and CRAP hotspots
- mutation survivors and killed mutants
- invariant impact and missing-test obligations
- constitutional rules and governance findings
- agent grants, attestation claims, approvals, and overrides

## Workspace layout

```text
packages/
  evidence-model/
  crap4ts/
  ts-mutate/
  invariants/
  policy-engine/
  governance/
  legitimacy/
  ts-quality/
fixtures/
examples/
docs/
.github/workflows/
```

## Development

```bash
npm run build
npm run typecheck
npm run lint
npm test
npm run sample-artifacts
npm run smoke
npm run verify
```

## Repo task workflow (AK)

This repo now includes the same repo-local Agent Kernel launcher pattern used in related quality repos.
Use `./scripts/ak.sh` as the canonical entrypoint and `./scripts/ak-v2.sh` as the compatibility alias.

```bash
./scripts/ak.sh --doctor
./scripts/ak.sh task ready --format json | jq '.[] | select(.repo == env.PWD)'
./scripts/ak.sh task list --format json --verbose | jq '.[] | select(.repo == env.PWD and (.id == 181 or .id == 182))'
./scripts/ak.sh task claim 182 --agent pi
```

## Sample artifacts

Generated sample artifacts live under `examples/artifacts/governed-app/` after `npm run sample-artifacts`, including concise operator surfaces like `pr-summary.md`, `check-summary.txt`, `plan.txt`, and `govern.txt`.
