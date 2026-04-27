---
summary: "Product overview for ts-quality alpha: deterministic evidence, explainable trust, and CLI entrypoints."
read_when:
  - "When onboarding to this repo"
  - "When validating the shipped CLI surface or artifact contract"
type: "reference"
---

# ts-quality v0.1.0

[![Completely Vibe Engineered](https://img.shields.io/badge/completely-vibe%20engineered-ff4fd8?style=for-the-badge)](https://github.com/tryingET/ts-quality)
[![Alpha](https://img.shields.io/badge/status-alpha-f59e0b?style=for-the-badge)](https://github.com/tryingET/ts-quality/blob/main/CHANGELOG.md)
[![Verify](https://img.shields.io/github/actions/workflow/status/tryingET/ts-quality/ci.yml?branch=main&style=for-the-badge&label=verify)](https://github.com/tryingET/ts-quality/actions/workflows/ci.yml)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://github.com/tryingET/ts-quality/blob/main/package.json)
[![MIT License](https://img.shields.io/badge/license-MIT-2563eb?style=for-the-badge)](https://github.com/tryingET/ts-quality/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/tryingET/ts-quality?style=for-the-badge)](https://github.com/tryingET/ts-quality/releases)

> **Special notice:** yes, this project is **completely vibe engineered** — but the artifacts, mutation pressure, governance checks, and authorization surfaces are intentionally deterministic.

**Deterministic TypeScript quality for teams building with agents — and for agents building with agents.**

`ts-quality` turns software-change evidence into explainable trust.
It is an offline-first TypeScript quality platform that combines structural risk, mutation pressure, invariant evidence, constitutional governance, and legitimacy checks into one inspectable review surface.

If you are building agentic systems in TypeScript, this repo is aimed directly at the hard part: not generating more code, but deciding **when a change is actually trustworthy**.

## Why this exists

AI-heavy repos fail in boring ways:

- tests pass but barely constrain behavior
- mutation pressure is missing or fake-green
- architectural boundaries are violated through aliases or clever indirection
- approvals and attestations drift away from the exact run being reviewed
- teams talk about “confidence” without a durable evidence trail

`ts-quality` is designed to make those failure modes explicit.
It does not try to be mystical. It tries to be **deterministic, inspectable, and usable in real repos**.

## Why agent builders care

When agents write code, review code, or authorize code, you need more than style checks:

- **Evidence** — what changed, what is covered, and what is risky?
- **Behavior pressure** — do tests actually kill meaningful mutants?
- **Intent alignment** — do invariants and focused tests support the claimed behavior?
- **Boundary safety** — did the change cross a forbidden architectural line?
- **Legitimacy** — which agent or human had standing to approve, override, or attest to this run?

That is the stack `ts-quality` ships.

## What it does

It progresses through five layers:

1. **Evidence** — `crap4ts` finds risky code and maps LCOV coverage to functions.
2. **Judgment** — `ts-mutate` runs deterministic mutation tests and `ts-quality check` computes merge confidence for changed code.
3. **Understanding** — invariants encode behavior in code and generate deterministic missing-test obligations.
4. **Governance** — constitutions encode architectural boundaries, approvals, rollback evidence, and domain risk budgets.
5. **Legitimacy** — agents, authority grants, attestations, overrides, and amendments determine who may change the system and under what evidence burden.

## What makes this different

### Deterministic depth, not semantic theater

`ts-quality` is intentionally deterministic. It does **not** claim to prove semantics from natural language. Instead it combines:

- structural evidence (coverage + CRAP)
- behavioral pressure (mutation outcomes)
- focused lexical test evidence for invariants
- explicit governance and legitimacy rules

Invariant scenario support is therefore a deterministic lexical witness, not execution-backed behavioral proof. Current lexical-only matches are reported as `lexically-supported`. The plain `supported` label is now reserved for scenarios backed by explicit execution witness artifacts, so the tool is no longer silently upgrading deterministic lexical alignment into proof-like status.

That makes the system explainable and debuggable. It also means shallow tests produce shallow evidence.

### Governance that follows real import flow

The governance layer is built to catch the kinds of boundary bypasses that show up in real TypeScript codebases, not just toy `import x from 'y'` examples.

It now catches forbidden imports that flow through:

- re-export declarations and TS `import = require(...)` declarations
- local `require` aliases
- chained assignments
- sequence-expression aliases when the final operand resolves to the loader
- statically-resolved conditional aliases when the condition collapses to one branch
- logical fallback aliases (`||`, `&&`, `??`) when static semantics make the loader flow explicit
- destructuring
- aliased destructuring containers
- destructured parameter defaults
- property access and element access on tracked containers
- object and array rest bindings
- extensionless imports, TS path aliases, and dynamic imports

When a boundary-scoped file uses a non-literal `import(...)` or `require(...)` target that cannot be statically proven safe, governance fails closed instead of silently assuming the target is fine.

### Run-bound decisions instead of ambient trust

Downstream decisions are anchored to the exact reviewed run:

- `check` snapshots the immutable evidence/control-plane bundle into `run.json`
- `report.json` and `report --json` keep the same run fields but add `decisionContext` metadata so operators can tell whether they are looking at the persisted check-time report or a later projected decision view
- `explain`, `report`, `plan`, `govern`, and `authorize` can all target that exact persisted run via `--run-id <id>`
- when `--run-id` is omitted, those read/projection commands fall back to `.ts-quality/latest.json`
- approvals, waivers, and attestations are re-evaluated only when they target that run correctly; authorization also re-applies overrides against the exact scoped run
- drift in changed files or control-plane inputs is surfaced on projected review surfaces and causes authorization to fail closed

That matters a lot in agent-heavy workflows, where generated artifacts and support files can change quickly.

## Try it now

There are two truthful ways to start with `ts-quality`: prove the package-operator path the repo can now ship, or evaluate the project directly from source.

### 1) Prove the package-operator path

```bash
npm install
npm run build
npm run smoke:packaging
```

This stages the package under `.ts-quality/npm/ts-quality/package`, validates the staged manifest contract, validates staged and packed file boundaries, installs the tarball into a fresh temp project, and proves the shipped CLI/API/types surfaces.

If you are preparing the public release, do **not** publish from a local shell. Use `npm run release:plan -- --version <next-version>` and `npm run release:prepare -- --version <next-version> --apply`, then create a GitHub Release whose tag exactly matches the public package version. The release workflow re-runs the packaging proof and publishes the staged package to npm through Trusted Publishing/OIDC.

### 2) Evaluate the repo from source

```bash
npm install
npm run build
npm run verify
```

This validates the repo, regenerates sample artifacts, and checks that reviewed examples stay deterministic.

### 3) Run the CLI on the included fixture

```bash
node dist/packages/ts-quality/src/cli.js check --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js explain --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js report --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js govern --root fixtures/governed-app --run-id fixture-review
node dist/packages/ts-quality/src/cli.js authorize --root fixtures/governed-app --agent release-bot --run-id fixture-review
```

### 4) Inspect the generated outputs

Look at:

```text
.ts-quality/runs/<run-id>/run.json
.ts-quality/runs/<run-id>/verdict.json
.ts-quality/runs/<run-id>/report.json
.ts-quality/runs/<run-id>/report.md
.ts-quality/runs/<run-id>/pr-summary.md
.ts-quality/runs/<run-id>/check-summary.txt
.ts-quality/runs/<run-id>/explain.txt
.ts-quality/runs/<run-id>/plan.txt
.ts-quality/runs/<run-id>/govern.txt
.ts-quality/runs/<run-id>/attestation-verify.txt
.ts-quality/runs/<run-id>/execution-witnesses.json        # optional, when witness plans were considered
.ts-quality/runs/<run-id>/execution-witnesses.txt         # optional, when witness plans were considered
.ts-quality/runs/<run-id>/authorize.<agent>.<action>.json
.ts-quality/runs/<run-id>/bundle.<agent>.<action>.json
.ts-quality/amendments/<proposal-id>.result.json
.ts-quality/amendments/<proposal-id>.result.txt
```

If you want a reviewed example bundle without generating your own first, see:

```text
examples/artifacts/governed-app/
```

The checked-in sample bundle includes legitimacy-facing operator surfaces such as:

```text
examples/artifacts/governed-app/authorize.release-bot.json
examples/artifacts/governed-app/authorize.maintainer-approved.json
examples/artifacts/governed-app/attestation.verify.txt
examples/artifacts/governed-app/amend.txt
```

## Top-level commands

```bash
npx ts-quality init
npx ts-quality materialize
npx ts-quality check [--run-id <id>]
npx ts-quality explain [--run-id <id>]
npx ts-quality report [--run-id <id>]
npx ts-quality trend
npx ts-quality plan [--run-id <id>]
npx ts-quality govern [--run-id <id>]
npx ts-quality authorize --agent release-bot [--run-id <id>]
npx ts-quality witness test --invariant auth.refresh.validity --scenario expired-boundary --source-files src/auth/token.js --test-files test/token.test.js --out .ts-quality/witnesses/auth-refresh-expired-boundary.json -- node --test test/token.test.js
npx ts-quality witness refresh [--changed <a,b,c>]
npx ts-quality attest sign --issuer ci.verify --key-id sample --private-key .ts-quality/keys/sample.pem --subject .ts-quality/runs/<run-id>/verdict.json --claims ci.tests.passed --out .ts-quality/attestations/ci.tests.passed.json
npx ts-quality attest verify --attestation .ts-quality/attestations/ci.tests.passed.json --trusted-keys .ts-quality/keys
npx ts-quality amend --proposal proposal.json
```

When `--run-id` is omitted on `explain`, `report`, `plan`, `govern`, or `authorize`, the CLI uses `.ts-quality/latest.json`. Pass an explicit run id whenever multiple reviewed runs coexist and you want to avoid ambient latest-pointer selection.

`run.json` remains the immutable `check`-time bundle. `report --json` emits the selected run plus an additive `decisionContext` block instead of echoing raw `run.json` bytes, so automation can tell whether it is reading the persisted check-time report or a later projected decision view and whether drift was detected.

`trend` only compares the latest run against the nearest earlier **comparable** run. If changed scope, invariant baseline, or snapped policy/constitution baseline differs, it reports that no comparable prior run exists instead of inventing a misleading delta.

`witness refresh` is the repo-native pre-check surface for running all configured impacted execution-witness commands from the current changed scope and writing their artifacts before `check`. `check` also auto-generates those same configured witnesses when you skip the explicit pre-refresh step, but `witness refresh` is useful in CI or when you want witness artifact churn to be an explicit stage. For the canonical witness contract and config surface, see `docs/invariant-dsl.md` and `docs/config-reference.md`; for the recommended CI/operator flow, see `docs/ci-integration.md`.

If you are integrating `ts-quality` into a repo for the first time, start with:
- `docs/adoption/agent-integration-how-to.md` for brownfield rollout
- `docs/adoption/greenfield-bootstrap-how-to.md` for greenfield bootstrap

Then use `docs/adoption/repo-screening-entry.template.json` plus `node scripts/register-screening-catalog.mjs --entry ...` to keep the central rollout catalog aligned.

`authorize` writes `.ts-quality/runs/<run-id>/authorize.<agent>.<action>.json` and the paired `.ts-quality/runs/<run-id>/bundle.<agent>.<action>.json`. The decision artifact remains the operator-facing legitimacy record, while its additive `evidenceContext` points back to the exact evaluated run, blocking governance findings, run-scoped attestation verification outcomes, and the first at-risk invariant provenance summary instead of inventing a second authority beyond `run.json` and the paired bundle.

`amend` writes `.ts-quality/amendments/<proposal-id>.result.json`, mirrors the same JSON to stdout, and also writes a concise human-readable `.ts-quality/amendments/<proposal-id>.result.txt` summary. The JSON result remains authoritative for automation, while the additive `proposalContext` block is also projected into the reviewed text surface so operators can see the proposal title/rationale, explicit evidence entries, per-change rule summary, and approval-burden basis without inventing a second amendment authority beyond the proposal and constitution.

`attest sign` expects `--subject` to point at a repo-local artifact under `--root` (for example `.ts-quality/runs/<run-id>/verdict.json`), reports missing repo-local subjects as missing input, and rejects subjects that only appear repo-local through symlink escapes outside the repository root. Signed subject digests bind to the exact file bytes on disk instead of a UTF-8-decoded text view, so binary or malformed-byte subjects cannot mutate silently while still verifying. `attest verify` defaults to human-readable text output and also supports `--json` for a versioned machine-readable verification record. Single-file CLI verification still treats an unreadable attestation path as an operator error with a non-zero exit, while malformed JSON or schema-invalid attestation content is reported through the canonical verification record. Signed `payload.runId` / `payload.artifactName` are only valid for run-scoped subjects under `.ts-quality/runs/<run-id>/...`, persisted run artifacts redact raw OS read-error detail for unreadable attestation files, and signing plus verification now share the same attestation-contract validation: blank issuers are rejected, renderable issuer/subject metadata cannot contain control, next-line, line/paragraph separator, bidi override/isolation, zero-width, BOM, or other invisible Unicode format characters, run-scoped payload metadata must match the signed `subjectFile`, the CLI fails closed on duplicate, unknown, missing-value, or subcommand-irrelevant options instead of swallowing them silently, and human-readable verification output plus CLI error text escape unsafe characters that arrive from filenames, paths, or other fallback labels instead of rendering them raw. Every `check` also writes `.ts-quality/runs/<run-id>/attestation-verify.txt` using that same human-readable verification framing so run-bound legitimacy review stays attached to the evaluated run.

## What a run produces

A successful `check` writes a stable evidence bundle under `.ts-quality/runs/<run-id>/`:

- `run.json` — immutable machine-readable run bundle
- `verdict.json` — merge-confidence verdict
- `report.json` — machine-readable report view with additive `decisionContext` metadata (`projection`, `drift`)
- `report.md` — human-readable report
- `pr-summary.md` — PR-facing summary with concise invariant evidence provenance
- `check-summary.txt` — terse run-status summary with the first at-risk invariant provenance when present; when configured witness commands run, it also records auto-ran vs skipped execution witness activity
- `explain.txt` — explanation trail
- `plan.txt` — governance plan with related invariant evidence provenance for the at-risk claim
- `govern.txt` — governance findings with related invariant evidence provenance for the at-risk claim
- optional `execution-witnesses.json` / `execution-witnesses.txt` — additive per-run summary of configured execution witness commands that auto-ran and those skipped by scope

`run.json` also carries additive execution receipts that make the run boundary explicit instead of implicit:

- `analysis` records the preallocated run id, canonical config path, canonical coverage path, exact changed scope, source file set, runtime mirror roots, and mutation execution fingerprint
- `controlPlane` records a schema-versioned run-bound snapshot of the config digest, policy defaults, constitution digest + rules, agent digest + grants, and the exact support-path bindings for later approval/waiver/override/attestation lookups
- `mutationBaseline` records whether the baseline test command was green before mutants were interpreted

Each impacted invariant also carries a structured `behaviorClaims[].evidenceSummary` in `run.json`, exposing the invariant-scoped evidence basis directly: `evidenceSemantics` / `evidenceSemanticsSummary`, impacted files, focused tests, optional `executionWitnessFiles`, changed functions, coverage pressure, mutation counts, per-scenario support, and named deterministic sub-signals such as `focused-test-alignment`, `execution-witness`, `scenario-support`, `coverage-pressure`, `mutation-pressure`, and `changed-function-pressure`. Every sub-signal is also labeled as `explicit`, `inferred`, or `missing` so reviewers can tell whether support came from direct configured/artifact evidence or deterministic alignment heuristics.

`run.json` is the historical source of truth for what `check` persisted. The generated `report.json` is the check-time report view over that run, and later `report --json` / `explain` / `plan` / `govern` / `authorize` calls reproject the selected run with current targeted approvals, waivers, attestations, and drift detection instead of blindly echoing the persisted bundle.

Execution witness artifacts now also persist additive sidecar receipts beside the witness file itself (for example `.ts-quality/witnesses/<name>.receipt.json`), recording the exact command, scoped source/test files, and execution receipt that produced the witness. That keeps execution-backed invariant support inspectable instead of collapsing it into a naked pass artifact.

Authorization artifacts written by `ts-quality authorize` add an additive `evidenceContext` that points back to the exact evaluated run (`runId`, artifact paths, blocking governance findings, run-scoped attestation verification outcomes, and the first at-risk invariant provenance summary). The paired `bundle.<agent>.<action>.json` artifact carries the same run-scoped attestation verification summary so legitimacy inputs remain inspectable at the exact authorization boundary without inventing a second evidence authority beyond `run.json`.

## What makes a run meaningful

A strong `ts-quality` result depends on explicit inputs, not hidden inference:

- **Explicit changed scope** — provide CLI `--changed <a,b,c>`, `changeSet.files`, or a `changeSet.diffFile` with at least one changed hunk. `check` fails closed when no changed scope is supplied instead of silently widening to the whole repo.
- **Coverage evidence** — provide `coverage/lcov.info` so CRAP and covered-only mutation selection are grounded in executed code.
- **Green mutation baseline** — `mutations.testCommand` must pass before mutation results are trusted. A broken baseline blocks mutation scoring instead of pretending every failing run killed a mutant.
- **Executable tests** — `mutations.testCommand` must actually fail when behavior changes, or mutants will survive and confidence will drop. The command must contain at least one executable argument.
- **Hermetic mutation execution** — mutation subprocesses drop inherited nested test-runner recursion context (for example `NODE_TEST_CONTEXT`) so the same repo does not score differently just because `check` was launched from inside `node --test`.
- **Measured mutation pressure** — if the evaluated scope produces no killed or surviving mutants, `ts-quality` treats that as missing evidence instead of a perfect 1.0 mutation score.
- **Runtime parity for built-output tests** — when tests execute compiled output from roots such as `dist/` or `lib/`, configured runtime mirrors receive mutated JS directly for JS sources and transpiled JS for TS/TSX sources so mutation pressure stays aligned with the runtime under test.
- **Focused test evidence** — invariant scenarios are matched against tests aligned to the impacted source by file naming/import hints or explicit `requiredTestPatterns`, not by unrelated repo-global keyword hits. Deterministic lexical support also has to come from one assertion-bearing focused test case, not from stitching happy-path and failure-path keywords across separate tests in the same file or relying on setup-only non-asserting cases. That evidence is deterministic lexical alignment unless the scenario also carries a matching execution witness artifact.
- **Execution-backed witnesses** — when you have a narrow runtime proof command, `ts-quality witness test ... -- <command>` can generate a scoped execution witness artifact under `.ts-quality/witnesses/` so invariant support can graduate from `lexically-supported` to `supported` without hand-authoring JSON. For recurring scenarios, the same witness command/output can now be declared directly on the invariant scenario so `ts-quality check` auto-generates it for impacted scope.

## Materialized runtime config

`materialize` exports the current data-only config and repo-local support modules into canonical runtime JSON under `.ts-quality/materialized/` so later checks can run from boring generated artifacts instead of author-authored module files.
Any configured diff input is copied into a reserved `.ts-quality/materialized/inputs/` subtree so user filenames cannot overwrite canonical artifacts.

```bash
npx ts-quality materialize
npx ts-quality check --config .ts-quality/materialized/ts-quality.config.json
```

## Stability

`ts-quality` is currently **alpha** (`0.x.y`).
Before 1.0, breaking changes are allowed when they improve deterministic evidence, safety, trust-boundary correctness, or contract clarity.
That is not permission for silent drift: intentional breaking changes must still be called out in `CHANGELOG.md`, reflected in affected docs, and backed by tests or validation where appropriate.

One important current example: config and repo-local support modules are treated as **data-only modules**, not executable project code.
Literal exports remain supported across `.ts`, `.js`, `.mjs`, `.cjs`, and `.json`, including computed property names backed by top-level `const` bindings, but runtime expressions and side effects are intentionally rejected.

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

`npm test` now runs the full `test/*.test.mjs` surface before exiting so one early failure does not hide later regressions. Failing runs also write a compact deterministic summary to `.ts-quality/test-runner/failure-summary.json`, which is cleared before a clean passing run so stale failure state does not linger. For local debugging when you explicitly want the old stop-on-first-failure behavior, set `TS_QUALITY_TEST_RUNNER_FAIL_FAST=1`.

## Repo task workflow (AK)

Live repo task state stays in Agent Kernel (`ak`).
Use `ak` as the canonical entrypoint for readiness, claims, dependencies, and completion state.

```bash
ak --doctor
ak task ready --format json | jq '.[] | select(.repo == env.PWD)'
ak task list --format json --verbose | jq '.[] | select(.repo == env.PWD and (.id == 181 or .id == 182))'
ak task claim 182 --agent pi
```

## Repo-local handoff sync

`governance/work-items.json` is an exported AK projection, while `docs/project/*` and `next_session_prompt.md` remain manually curated downstream handoff surfaces.
Use the handoff helper to keep those repo-local projections reconciled against AK without treating them as the live queue.

```bash
npm run handoff:sync
npm run handoff:check
```

`npm run handoff:sync` exports `governance/work-items.json` and runs the direction reconciliation flow (`ak direction import`, `ak direction check`, `ak direction export`).
`npm run handoff:check` fails closed when the checked-in work-items projection or downstream handoff docs drift from AK, but it is only a repo-local drift check: it does **not** replace `ak task *` for live queue truth or CI/job status for live automation truth.

## Verification artifacts and guardrails

```bash
npm run verify
npm run verify:ci
```

`npm run verify` is the repo-root verification gate and refreshes the generator-owned verification artifacts.
`npm run verify:ci` reruns that gate without reinstalling dependencies and fails if `VERIFICATION.md` or `verification/verification.log` drift from what `scripts/verify.mjs` would emit.
Those files are deterministic checked-in reference artifacts for the latest recorded successful verification snapshot, not a replacement for rerunning verify or checking live CI/job status when current correctness matters.

## Sample artifacts

Generated sample artifacts live under `examples/artifacts/governed-app/` after `npm run sample-artifacts`, including concise operator surfaces like `pr-summary.md`, `check-summary.txt`, `plan.txt`, `govern.txt`, legitimacy-facing outputs such as `attestation.verify.txt`, `authorize.release-bot.json`, `authorize.maintainer-approved.json`, and the human-readable amendment summary `amend.txt`.
The sample generation flow is idempotent over the checked-in bundle: `npm run verify` reruns `sample-artifacts` twice and fails if the second pass changes the reviewed examples.
Keep `run.json`, authorization decision artifacts, paired bundle artifacts, and amendment JSON authoritative; the reviewed sample text/JSON surfaces are there to make the shipped operator path inspectable without inventing a second legitimacy authority.
The generated `verification/verification.log` is intentionally sanitized for volatile duration fields, so it stays reviewable and stable across equivalent runs rather than acting as a byte-for-byte raw transcript.

## Why it is explainable

Every score, block, waiver, attestation, override, and amendment connects back to explicit evidence:

- changed files and diff hunks
- coverage and CRAP hotspots
- mutation survivors and killed mutants
- invariant impact and missing-test obligations
- constitutional rules and governance findings
- agent grants, attestation claims, approvals, and overrides

## Credits

This project builds on ideas and prior work that deserve explicit credit:

- **Robert C. Martin / Uncle Bob** — CRAP as a practical way to reason about risk in code change. Twitter: [@unclebobmartin](https://twitter.com/unclebobmartin)
- **`crap4clj`** — prior CRAP-oriented tooling work: https://github.com/unclebob/crap4clj
- **`clj-mutate`** — prior mutation-testing tooling work: https://github.com/unclebob/clj-mutate
- **`pi-mono` by badlogic** — agent tooling and operating-model influence: https://github.com/badlogic/pi-mono
