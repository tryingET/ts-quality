---
summary: "Runtime architecture for ts-quality's deterministic evidence, policy, governance, and legitimacy layers."
read_when:
  - "When changing core package boundaries or data flow"
  - "When aligning docs with shipped runtime behavior"
type: "reference"
---

# Architecture

## Overview

`ts-quality` is split into deterministic layers.

### `packages/evidence-model`

Shared types and storage primitives. It defines the canonical JSON artifact model, path normalization, repo-local path containment checks (including symlink escapes), stable serialization, hashing, diff-hunk parsing, run storage, waiver matching, additive execution receipts, and exact/unique coverage-path resolution helpers.

### `packages/crap4ts`

AST-backed CRAP analysis for TS/JS. It parses LCOV, discovers function-like nodes, computes cyclomatic complexity, maps line coverage to functions, computes CRAP scores, and marks changed functions. When both changed files and diff hunks are present, diff hunks now narrow the effective scope within the file instead of silently widening back to whole-file analysis.

### `packages/ts-mutate`

Deterministic mutation testing. It discovers mutation sites from the TypeScript AST, applies exact-span mutations, validates that the baseline test command passes before trusting mutant outcomes, prepares one isolated temporary workspace per mutation run and deterministically resets it back to a pristine snapshot between mutant executions, strips inherited nested test-runner recursion context before launching mutation subprocesses, mirrors mutated JS into configured built-runtime roots when tests execute compiled output, transpiles mutated TS/TSX into matching JS runtime mirrors when the runtime under test is compiled output, and caches results in a manifest keyed by a deterministic execution fingerprint that includes the effective execution environment plus runtime-mirror configuration so test-corpus drift or runner-context leakage cannot silently reuse stale answers.

### `packages/invariants`

Behavioral understanding layer. Invariants bind expected behavior to paths, symbols, and domains. The engine maps changed code, mutation survivors, and test corpus evidence back to invariants, emits missing-test obligations, and records compact invariant-scoped evidence summaries plus named deterministic sub-signals for reports and run artifacts. Lexical-only matches remain explicitly weaker (`lexically-supported`), while execution-backed support is earned through scoped witness artifacts plus sidecar receipts. The canonical operator/config contract for that witness lane lives in `docs/invariant-dsl.md` and `docs/config-reference.md`.

### `packages/policy-engine`

Judgment layer. It combines CRAP, mutation outcomes, invariant impact, waivers, and governance findings into a merge-confidence verdict with machine-readable findings and human-readable explanations.

### `packages/governance`

Constitution layer. It enforces architectural boundaries, approval rules, rollback evidence, ownership reservations, and domain risk budgets. Boundary checks use repo-aware module resolution, walking from the importer toward the repo root for the nearest `tsconfig.json`, so TS path aliases, extensionless local imports, and dynamic `import(...)` calls — including no-substitution template-literal specifiers such as ``import(`../identity/store`)`` — cannot silently bypass the constitution in common nested package layouts. When a boundary-scoped file uses a non-literal dynamic `import(...)`/`require(...)` expression that cannot be statically resolved, governance now fails closed instead of silently assuming the target is safe. It also produces implementation plans with explicit tradeoffs.

### `packages/legitimacy`

Legitimacy layer. It models agents and grants, builds proof-carrying change bundles, signs and verifies attestations with Ed25519, validates attestation shape before trust decisions, evaluates change authorization, records overrides, and evaluates constitutional amendments. Attestations are trusted only when they bind to repo-local artifacts under the exact evaluated run boundary, and authorization refuses vacuous empty-file scopes. Overrides are re-validated against override grants on the exact changed scope; a recorded override is not a blanket bypass.

### `packages/ts-quality`

Product surface. It loads configuration through a data-only module contract rather than executing repo code, canonicalizes path-bearing analysis inputs into a repo-local preflight manifest before execution, enforces repo-local trust/input paths for config-driven artifacts, binds signed subject digests to exact file bytes instead of UTF-8-decoded text views, can materialize author-authored config/support files into canonical runtime JSON artifacts with reserved input subtrees for copied user files, orchestrates the engines, writes artifacts, and exposes the unified CLI. It also owns the run-bound decision-context projection used by downstream review, governance, and legitimacy commands so explain/report/plan/govern/authorize can target an explicit persisted `--run-id` instead of depending on ambient repo state; when no run id is supplied, those commands fall back to the repo-local latest pointer. `run.json` stays the immutable `check`-time bundle, while `report.json` / `report --json` add a small `decisionContext` envelope (`projection`, `drift`) so machine consumers can tell whether they are reading the persisted report view or a later projection. The same run now snapshots the decision control plane — schema version, config digest, policy defaults, constitution digest + rules, agent digest + grants, and support-path bindings for approvals / waivers / overrides / attestation trust inputs — so later explain/report/plan/govern/authorize surfaces can reject unsupported or malformed snapshot schemas and fail closed on control-plane drift instead of silently trusting live repo edits. It also executes config-declared witness commands for impacted scenarios, writes witness + receipt artifacts, persists per-run auto-ran/skipped witness summaries, and exposes explicit operator/CI surfaces (`witness test`, `witness refresh`) documented canonically in `docs/invariant-dsl.md`, `docs/config-reference.md`, and `docs/ci-integration.md`.

## Data flow

1. `ts-quality check` loads `ts-quality.config.ts`.
2. A canonical preflight manifest resolves repo-local config inputs (coverage path, changed scope, diff path, runtime mirror roots), derives effective changed files from explicit file lists and/or diff hunks, and fails closed when no changed scope is supplied instead of widening to the whole repo; then a preallocated analysis context establishes the run id, exact changed-file list, optional diff hunks, source file set, and mutation execution fingerprint.
3. `crap4ts` computes structural risk, with diff hunks narrowing changed scope inside files when present.
4. `ts-mutate` validates the baseline test command, computes behavioral pressure in a hermetic subprocess context, fingerprints the effective execution environment, and records a baseline execution receipt.
5. `ts-quality` optionally auto-runs config-declared execution-witness commands for impacted invariant scenarios, writing witness artifacts plus sibling receipt sidecars before invariant evaluation.
6. `invariants` interprets evidence against declared system intent using focused test corpora aligned to impacted files or explicit `requiredTestPatterns`, upgrades scenarios to execution-backed support when matching witness artifacts bind to the same invariant/scenario/source scope, and emits per-invariant evidence summaries with named sub-signals (focused-test alignment, execution-witness, changed-function pressure, coverage pressure, mutation pressure, and scenario support) plus additive provenance modes (`explicit`, `inferred`, `missing`).
7. `policy-engine` emits an explainable merge-confidence verdict and explicitly blocks on invalid mutation baselines or mutation execution errors.
8. `governance` evaluates constitutional constraints, including exact run-targeted approvals and ownership reservations, and produces a plan.
9. `legitimacy` consumes the evidence bundle for authorization, attestation, override, and amendment flows.
10. After `check`, downstream review/decision surfaces (`explain`, `report`, `plan`, `govern`, `authorize`) can read a caller-selected persisted run id, keep using the snapped constitution / grants / policy from that run, re-evaluate current targeted approvals / waivers / attestations (and overrides where relevant), and fail closed when the analyzed changed files or snapped control-plane files drift on disk. The machine-readable report view carries additive `decisionContext` metadata so projected-vs-persisted semantics stay explicit.
11. Artifacts are persisted to `.ts-quality/runs/<run-id>/`, including optional execution-witness run summaries when configured witness plans were considered.

## Design choices

- **Offline-first**: every core flow works locally with no network dependency.
- **Deterministic semantics**: invariant reasoning is keyword- and selector-driven, not opaque.
- **Stable artifacts**: JSON is key-sorted for hashing, signing, and diffability.
- **Preconditions before confidence**: mutation scoring is only trustworthy when the baseline command is green, the execution context is explicitly fingerprinted, and the evaluated scope produces measurable mutation pressure instead of a synthetic success state.
- **Run-bound downstream decisions**: review, governance, and legitimacy projections must stay anchored to the exact evaluated run id, the snapped config / policy / constitution / grants for that run, exact run-targeted approvals/attestations, and current digests of the analyzed changed files plus snapped control-plane files.
- **Comparable trends or no trend**: delta output is only truthful when runs keep the same changed scope and evidence baseline. When scope or invariant/policy/constitution baseline differs, trend fails closed instead of comparing arbitrary runs.
- **Human overrideability**: automation can be blocked, narrowed, or overridden with recorded standing and rationale, but override grants must still match the exact changed scope.
