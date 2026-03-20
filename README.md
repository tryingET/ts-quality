---
summary: "Product overview for ts-quality v5: deterministic evidence, explainable trust, and CLI entrypoints."
read_when:
  - "When onboarding to this repo"
  - "When validating the shipped CLI surface or artifact contract"
type: "reference"
---

# ts-quality v5.0.0

`ts-quality` is an offline-first TypeScript quality platform that turns static evidence into explainable trust for software change.

## Stability

`ts-quality` is currently **alpha**.
Before 1.0, breaking changes are allowed when they improve deterministic evidence, safety, trust-boundary correctness, or contract clarity.
That is not permission for silent drift: intentional breaking changes must still be called out in `CHANGELOG.md`, reflected in affected docs, and backed by tests or validation where appropriate.

One important current example: config and repo-local support modules are now treated as **data-only modules**, not executable project code.
Literal exports remain supported across `.ts`, `.js`, `.mjs`, `.cjs`, and `.json`, including computed property names backed by top-level `const` bindings, but runtime expressions and side effects are intentionally rejected.

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
- **Executable tests** — `mutations.testCommand` must actually fail when behavior changes, or mutants will survive and confidence will drop. The command must contain at least one executable argument.
- **Hermetic mutation execution** — mutation subprocesses drop inherited nested test-runner recursion context (for example `NODE_TEST_CONTEXT`) so the same repo does not score differently just because `check` was launched from inside `node --test`.
- **Runtime parity for built-output tests** — when tests execute compiled output from roots such as `dist/` or `lib/`, configured runtime mirrors now receive mutated JS directly for JS sources and transpiled JS for TS/TSX sources so mutation pressure stays aligned with the runtime under test.
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
npx ts-quality materialize
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

`attest sign` expects `--subject` to point at a repo-local artifact under `--root` (for example `.ts-quality/runs/<run-id>/verdict.json`). `attest verify` defaults to human-readable text output and also supports `--json` for a versioned machine-readable verification record. Single-file CLI verification still treats an unreadable attestation path as an operator error with a non-zero exit, while malformed JSON or schema-invalid attestation content is reported through the canonical verification record. Signed `payload.runId` / `payload.artifactName` are only valid for run-scoped subjects under `.ts-quality/runs/<run-id>/...`, persisted run artifacts redact raw OS read-error detail for unreadable attestation files, and verification rejects empty issuers plus control characters in signed issuer/subject metadata before rendering text output.

Downstream decision commands now project from the latest evaluated run rather than from ambient repo state alone:

- `plan`, `govern`, and `authorize` re-evaluate approvals and attestations only when they bind to the exact run id they are reviewing
- `authorize` refuses repository drift on the analyzed changed files and tells the operator to re-run `check` before trusting the decision

`materialize` exports the current data-only config and repo-local support modules into canonical runtime JSON under `.ts-quality/materialized/` so later checks can run from boring generated artifacts instead of author-authored module files. Any configured diff input is copied into a reserved `.ts-quality/materialized/inputs/` subtree so user filenames cannot overwrite canonical artifacts:

```bash
npx ts-quality materialize
npx ts-quality check --config .ts-quality/materialized/ts-quality.config.json
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

`run.json` now also carries additive execution receipts that make the run boundary explicit instead of implicit: `analysis` records the preallocated run id, canonical config path, canonical coverage path, exact changed scope, source file set, runtime mirror roots, and mutation execution fingerprint; `mutationBaseline` records whether the baseline test command was green before mutants were interpreted. Path-bearing analysis inputs (`coverage.lcovPath`, `changeSet.files`, `changeSet.diffFile`, and `mutations.runtimeMirrorRoots`) are canonicalized to repo-local paths before execution and rejected if they escape `--root`. When `changeSet.files` is absent or empty, `check` falls back to all discovered source files instead of silently analyzing an empty authorization scope. The mutation execution fingerprint now includes the effective execution environment after nested test-runner recursion context is stripped, so stale cache entries from runner leakage are not silently reused. Caller-supplied run ids are treated as artifact ids and must use only letters, numbers, dots, underscores, and hyphens.

Each impacted invariant also carries a structured `behaviorClaims[].evidenceSummary` in `run.json`, exposing the invariant-scoped evidence basis directly: impacted files, focused tests, changed functions, coverage pressure, mutation counts, per-scenario support, and named deterministic sub-signals such as `focused-test-alignment`, `scenario-support`, `coverage-pressure`, `mutation-pressure`, and `changed-function-pressure`. Every sub-signal is also labeled as `explicit`, `inferred`, or `missing` so reviewers can tell whether support came from direct configured/artifact evidence or deterministic alignment heuristics.

Authorization artifacts written by `ts-quality authorize` now add an additive `evidenceContext` that points back to the exact evaluated run (`runId`, artifact paths, blocking governance findings, and the first at-risk invariant provenance summary). This keeps legitimacy decisions traceable without creating a second evidence authority beyond `run.json`.

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

Generated sample artifacts live under `examples/artifacts/governed-app/` after `npm run sample-artifacts`, including concise operator surfaces like `pr-summary.md`, `check-summary.txt`, `plan.txt`, and `govern.txt`. The sample generation flow is now idempotent over the checked-in bundle: `npm run verify` reruns `sample-artifacts` twice and fails if the second pass changes the reviewed examples.
 reviewed examples.
