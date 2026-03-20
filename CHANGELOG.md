---
summary: "Release history and notable shipped changes for ts-quality."
read_when:
  - "When reviewing what changed between releases"
  - "When preparing release notes or upgrade communication"
type: "reference"
---

# Changelog

## Unreleased

- Policy: `ts-quality` is alpha, so breaking changes are allowed before 1.0 when they improve deterministic evidence, safety, trust-boundary correctness, or contract clarity. Intentional breaks must still be documented in the changelog and affected docs.
- BREAKING: config and repo-local support modules (`ts-quality.config.*`, `.ts-quality/invariants.*`, `.ts-quality/constitution.*`, `.ts-quality/agents.*`, and similar loaded data files) are now parsed as **data-only modules** instead of being executed as project code. Literal exports remain supported, including computed property names backed by top-level `const` bindings, but function calls, runtime property access, and imperative module bodies are rejected.
- Added configurable mutation runtime mirror roots and nested-tsconfig-aware governance import resolution so built-output tests and common monorepo alias layouts stay inside the same repo-contract semantics.
- Hardened runtime mirrors so TS/TSX mutations are transpiled into configured built-runtime roots instead of only copying JS sources.
- Added `ts-quality materialize`, which exports config/support modules into canonical runtime JSON under `.ts-quality/materialized/` so later runs can execute from boring generated artifacts.
- Reserved a dedicated `.ts-quality/materialized/inputs/` subtree for copied user inputs such as diff files so materialization cannot overwrite canonical generated artifacts.
- Fixed glob semantics so patterns like `src/**/*.js` and `tests/**/*.mjs` match files directly under `src/` and `tests/`.
- Added `.mjs`/`.cjs` support across source discovery, mutation defaults, config loading, config discovery, and governance import resolution.
- Tightened invariant evidence so only focused tests aligned to impacted files or explicit `requiredTestPatterns` count toward support.
- Added regression tests for `.mjs` config loading, extension-aware source discovery, and focused invariant evidence.
- Clarified docs around deterministic scope, coverage prerequisites, and focused test evidence.
- Added explicit/inferred/missing provenance modes to invariant evidence sub-signals and rendered report/explain output.
- Hardened repo-local trust boundaries so configured attestation/key paths and other config-driven artifact paths reject `--root` escapes, including symlink escapes.
- Added additive analysis-context and mutation-baseline receipts to run artifacts, exact diff-hunk narrowing inside changed files, deterministic mutation execution fingerprints, explicit blocking for invalid mutation baselines, exact run-id binding for approval rules, ownership-rule enforcement, deeper package attribution, override-scope revalidation, and safe run-id validation to prevent artifact-path traversal.

## 5.0.0

- Added a root `ts-quality` CLI and unified config surface.
- Added a canonical evidence model and stable artifact storage under `.ts-quality/`.
- Added change-centric merge-confidence scoring with Markdown and JSON reporting.
- Added an invariant DSL and deterministic missing-test obligation generation.
- Added constitutional governance primitives, architectural boundary checks, and rollout planning.
- Added legitimacy primitives: agents, grants, proof-carrying change bundles, Ed25519 attestations, overrides, and amendments.
- Added tests, fixtures, examples, CI, verification scripts, and generated sample artifacts.
