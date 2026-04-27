---
summary: "Release history and notable shipped changes for ts-quality."
read_when:
  - "When reviewing what changed between releases"
  - "When preparing release notes or upgrade communication"
type: "reference"
---

# Changelog

## [Unreleased]

### Fixed

- Fixed `release:github` to use the release notes `## Title` as the GitHub Release title and publish only the `## Release body` content, keeping the public release page aligned with the curated release draft.
- Fixed the release workflow's Trusted Publishing runtime by moving the publish job to Node `24`, asserting npm `>=11.5.1` plus GitHub OIDC request variables before publish, and documenting the exact npm trusted-publisher tuple (`tryingET/ts-quality`, workflow filename `release.yml`).

## [0.1.3] - 2026-04-27

### Added

- Added `docs/harnessed-llm-operator-guide.md` as the repo-local operating guide for AI agents working inside `ts-quality`, including read order, validation choices, artifact boundaries, and improvement/removal candidates.
- Added `docs/adoption/minimal-external-walkthrough.md` and `docs/cli-command-manifest.json` so target-repo adoption has a tiny one-slice example and harnesses can inspect CLI command reads/writes/options without scraping help text.

### Changed

- Clarified brownfield vs greenfield adoption guidance with explicit guide routing, one-slice rollout/bootstrap loops, truthful evidence-status closure, and catalog registration only after repo-local truth is stable.
- Adjusted the GitHub Release publishing workflow so the release job does not configure `actions/setup-node` with `registry-url`, avoiding registry auth-token configuration in the Trusted Publishing/OIDC publish path.

## [0.1.1] - 2026-04-27

- Policy: `ts-quality` is alpha, so breaking changes are allowed before 1.0 when they improve deterministic evidence, safety, trust-boundary correctness, or contract clarity. Intentional breaks must still be documented in the changelog and affected docs.
- Changed release authority: GitHub Release is now the single release intent, and `.github/workflows/release.yml` publishes the staged package to npm through Trusted Publishing/OIDC after re-running deterministic release proof.
- Added local release orchestration scripts for planning, preparing, creating GitHub Releases, and verifying public npm/GitHub release state without making local `npm publish` the operator path.
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
- Hardened the preflight analysis lane so `coverage.lcovPath`, `changeSet.files`, CLI `--changed` overrides, and `mutations.runtimeMirrorRoots` are canonicalized to repo-local paths before execution and rejected when they escape `--root`.
- Expanded governance boundary detection to catch dynamic `import(...)` calls in addition to static imports and `require(...)`, including no-substitution template-literal specifiers such as ``import(`../identity/store`)``; boundary-scoped files now also fail closed on non-literal dynamic import/require expressions when the target cannot be statically proven safe.
- Extended runtime mirror mapping so built-output mutation runs also mirror root-level sources into configured runtime roots such as `dist/index.js`.
- Added additive analysis-context and mutation-baseline receipts to run artifacts, exact diff-hunk narrowing inside changed files, deterministic mutation execution fingerprints, explicit blocking for invalid mutation baselines, exact run-id binding for approval rules, ownership-rule enforcement, deeper package attribution, override-scope revalidation, and safe run-id validation to prevent artifact-path traversal.
- Added a schema-versioned run-bound `controlPlane` snapshot to `run.json` so downstream `plan` / `govern` / `authorize` projections stay anchored to the reviewed config, policy, constitution, and agent-grant layer instead of live repo edits; these commands now reject unsupported or malformed snapshot schemas (including wrong schemaVersion types, malformed constitution/agent entries, and out-of-range policy thresholds), fall back for legacy pre-snapshot runs, and fail closed when the snapped config / constitution / agents drift after `check`.
- Clarified downstream review semantics: `run.json` stays the immutable check-time bundle, `report.json` / `report --json` now expose additive `decisionContext` metadata (`projection`, `drift`), and `explain` / `report` now use the same projected run context and snapshot validation path as `plan` / `govern` / `authorize` instead of echoing stale persisted decision fields.
- Tightened invariant semantics so lexical-only matches are now reported as `lexically-supported` instead of `supported`, added additive `evidenceSemantics` metadata plus optional execution-witness signals/files to invariant summaries, and introduced explicit scenario `executionWitnessPatterns` so the plain `supported` label is reserved for execution-backed witness artifacts that bind to the impacted source scope.
- Added `ts-quality witness test`, which runs a caller-supplied deterministic proof command, sanitizes nested test-runner recursion context, and writes a scoped execution witness artifact under a repo-local path so operators can generate execution-backed invariant witnesses without hand-authoring JSON. Invariant scenarios can now also declare that witness command/output directly so `ts-quality check` auto-generates witnesses for impacted scenarios before evaluating invariant support.
- Hardened trend semantics so `check` and `trend` only compare against the nearest earlier comparable run. Trend now fails closed when changed scope or invariant/policy/constitution baseline differs instead of emitting misleading deltas across unrelated runs.
- Hardened amendment semantics so invalid action values, duplicate constitution rule ids, and replace/remove operations targeting missing rules are denied instead of silently succeeding or being ignored.
- Hardened attestation signing and verification behind one shared render-safe contract: signer-side run metadata must now agree with the signed subject path, zero-width/BOM/invisible Unicode format characters are rejected alongside control and bidi spoofing characters, symlinked subjects that resolve outside `--root` are rejected during signing and verification, signing now reports missing repo-local subjects accurately, command-specific CLI option parsing rejects unknown, missing-value, or irrelevant flags instead of silently swallowing them, signed subject digests bind to exact file bytes instead of UTF-8-decoded text views, verification resolves subject-boundary failures before missing-key noise, and forged-attestation tests now reuse production canonical signing bytes.
- Mutation evidence now fails closed when the evaluated scope produces no killed or surviving mutants: empty mutation pressure is reported as missing evidence instead of a perfect 1.0 score, governance reflects the same missing-evidence state, and mutation-cache fingerprints now hash the full sanitized execution environment instead of a small allowlist.
- BREAKING: `ts-quality check` now requires explicit changed scope from CLI `--changed`, `changeSet.files`, or a non-empty `changeSet.diffFile`. When no changed files or hunks are supplied, `check` fails closed instead of silently widening to all discovered source files; diff-only runs now derive exact changed files from diff hunks.
- Stabilized `verification/verification.log` by normalizing volatile duration output so `npm run verify` no longer dirties the working tree with timing-only churn.

## [0.1.0]

- Reset the public SemVer line to `0.1.0` so the first public release matches the repo's explicit alpha status instead of implying prior stable major generations.
- Added a root `ts-quality` CLI and unified config surface.
- Added a canonical evidence model and stable artifact storage under `.ts-quality/`.
- Added change-centric merge-confidence scoring with Markdown and JSON reporting.
- Added an invariant DSL and deterministic missing-test obligation generation.
- Added constitutional governance primitives, architectural boundary checks, and rollout planning.
- Added legitimacy primitives: agents, grants, proof-carrying change bundles, Ed25519 attestations, overrides, and amendments.
- Added tests, fixtures, examples, CI, verification scripts, and generated sample artifacts.
- Hardened CI dependency installation with cached `npm ci`, retry-on-timeout behavior, and a `verify:ci` path that avoids redundant reinstalls inside GitHub Actions.
