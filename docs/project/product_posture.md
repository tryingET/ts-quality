---
summary: "Product posture snapshot for ts-quality: current maturity, target product experience, major gaps, and proof signals."
read_when:
  - "When deciding where ts-quality stands relative to its product vision"
  - "When selecting or reviewing the next product-readiness slice from product maturity rather than task history"
  - "When checking whether active AK work converges on the intended product experience"
type: "reference"
---

# Product Posture: ts-quality

## Purpose

This file is the status-bearing bridge between durable vision and active execution.

It captures where the product stands, what target experience it is converging toward, which gaps matter most, and what proof would close those gaps.

It does **not** replace:

- shipped runtime/source truth in package code, tests, README, and architecture docs
- AK task or decision authority
- live queue, sequencing, claim, or completion state

This file should be **exceptionally useful**: concise, grounded in shipped truth, and strong enough to guide strategy without becoming a task log, release log, or mandatory status file for every repo.

## Posture in one sentence

`ts-quality` already has the core deterministic trust layers in place — scoped evidence, generated/consumed coverage evidence, mutation pressure, invariant reasoning, governance, legitimacy, run-bound artifacts, public npm release through `0.5.0`, Trusted Publishing provenance, representative installed-package proof, production-clean npm README presentation, first-user CLI help, compact public `doctor --machine` diagnostics, compact evidence-basis check output, `adopt` / `retention` adoption lifecycle commands, public-package proof that manual focused witnesses become `check` evidence, public contract verification across the `0.3` baseline and `0.4` evidence-closure contract, and multiple outside-repo adoption/dogfood pilots — but its main maturity gap is broader compatibility coverage across real target repo shapes as the public evidence surface grows.

## Product maturity map

| Area | Current posture | Target posture | Main gap | Proof of closure |
|---|---|---|---|---|
| Scoped change truth | `check` requires explicit changed scope from CLI/config/diff and fails closed instead of widening silently. | Operators can always tell exactly which files, hunks, config inputs, and control-plane artifacts were reviewed. | Scope truth is strong, but adoption docs and examples must keep teaching it as the normal path rather than an internal constraint. | Fresh operators can run the documented flow without accidentally evaluating an ambient whole-repo scope. |
| Structural evidence | Coverage, configured LCOV generation, complexity, changed functions, package attribution, and diff-hunk narrowing exist in deterministic artifacts. | Structural risk reads as the first visible layer of a broader trust ladder. | Structural facts need to stay legible in concise surfaces without crowding out behavior/governance truth, and generated coverage must stay target-repo-command explicit rather than magic. | A reviewer can identify the highest structural risk from summary output and trace it to `run.json`. |
| Mutation pressure | Mutation testing validates the baseline command, isolates execution, mirrors built runtime roots, fingerprints execution context, and fails closed on empty pressure. | Mutation pressure is a trusted behavioral constraint signal for changed code and invariant claims. | Runtime-mirror and coverage prerequisites are powerful but adoption-sensitive. | Representative external projects can configure and understand mutation pressure without hidden repo memory. |
| Invariant evidence | Invariants produce focused evidence summaries, sub-signals, explicit/inferred/missing modes, lexical-vs-execution-backed support, and test obligations. | Invariants become the operator-facing language for declared behavior claims and missing proof. | The concept is strong but still needs simple operator affordances for writing, refreshing, and interpreting witnesses. | A new repo can add one useful invariant + focused witness and understand every emitted obligation. |
| Execution witnesses | Witness commands, witness artifacts, receipt sidecars, scenario-configured auto-run witnesses, and default discovery for matching manual `.ts-quality/witnesses/**/*.json` pass witnesses exist; public package pilots prove manual witnesses are consumed without duplicated scenario config across JS, TypeScript/dist, monorepo, and real temp-copy shapes. | Important invariant scenarios can graduate from deterministic lexical evidence to explicit proof artifacts. | The witness path now needs accepted repo-local adoption validation in more target shapes, not another core semantic correction. | A fresh repo can create one manual focused witness from the public package, rerun `check`, and see execution-backed support without duplicating the witness path/command in invariant config. |
| Governance | Constitution rules, boundary checks, approvals, waivers, ownership, rollback, and risk budgets are evaluated against the run. | Governance explains whether a change fits the repo's declared operating constraints. | Governance output should remain clearly downstream of exact evidence, not a separate policy theatre. | Governance findings in reports/plans point to exact run evidence and concrete remediation. |
| Legitimacy / authorization | Agents, grants, run-bound attestations, overrides, authorization, and amendments exist with exact-run binding and drift checks. | The product can answer who or what has standing to approve a specific change under the evidence available. | Legitimacy is rich enough that public/operator surfaces must keep it understandable. | An outside operator can follow check → attest/verify → authorize/amend without reading internals. |
| Artifact contract | `run.json`, verdict/report artifacts, decision context, authorization outputs, amendment JSON/text, PR summaries, trend output, sample artifacts, next-evidence-action `primaryAction` / `evidenceBasis`, installed-package compatibility proof for legacy `0.1.0` run projections, current `0.2.0` artifact-schema packets with unknown future optional fields, fail-closed malformed/unsupported control-plane snapshots, and `docs/public-contract.md` exist. | Artifacts behave like an audit packet: machine-stable, human-inspectable, and projection-aware. | Compatibility proof now needs breadth across more real historical/current artifact shapes and target repos, not just fixture-shaped packets. | Concise Markdown and JSON artifacts tell the same story, with no competing authority, across legacy and current run packets. |
| Operator summaries | `pr-summary.md`, check summaries, explain/report/plan/govern/authorize surfaces project key evidence. | A reviewer can start from one concise summary and know the riskiest evidence gap plus next action. | Summaries must stay short while preserving provenance modes and run-bound truth. | The most common review summary names explicit/inferred/missing support for the riskiest claim. |
| CI integration | Build/test/coverage/witness/check guidance exists, configured LCOV generation can fill missing coverage before analysis, and the repo has deterministic verification scripts. | CI gives a reproducible trust packet for each bounded change. | Current docs are truthful but need continued validation against outside-repo usage, especially source-map coverage for built TypeScript targets. | A fresh CI integration can run the documented sequence and produce interpretable artifacts. |
| Packaged outside-repo use | Public npm publishing works through GitHub Release + Trusted Publishing/OIDC through `0.5.0`; `smoke:packaging` proves installed CLI/API/types plus representative review, governance, legitimacy, materialized-config, drift, monorepo fixture flows, manual witness consumption, run-artifact compatibility matrix, compact check evidence-basis output, and the shared public CLI/evidence contract; npm shows the production-clean README; adoption evidence now covers compact diagnostics, manual witness proof, TypeScript/dist, monorepo package attribution, a real monorepo negative-path pilot, and `adopt` / `retention` post-pilot asset handling. | Installed package use should feel production-clean from the first public page through first bounded review and pilot-to-repo adoption. | The compact doctor/release-contract gap, manual witness-consumption gap, 0.3 contract-baseline gap, verifier parser false-positive, next-evidence-action contract gap, and pilot asset-retention gap are closed; the next adoption gap is proving the same flow across additional real target repo shapes and expanding schema compatibility fixtures from real captures. | A fresh target repo follows a minimal bounded review plus one manual focused witness from the public package, understands any mutation/governance blocker, and can convert reusable setup assets without committing ephemeral run state. |
| CLI first-user guidance | Top-level and command-specific help now teach the first bounded review contract, explicit changed-scope preconditions, `--run-id` habits, run artifact authority, the first focused witness path, `doctor`, init presets, and compact `doctor --machine` diagnostics for harnessed LLMs. | Operators and agents can discover the trust contract, setup risks, and first witness upgrade from the CLI before reading deeper docs. | The CLI now names the habit; the next maturity gap is validating that first-time outside users and harnessed LLMs can execute it correctly in real target repos. | A fresh operator or harnessed LLM can move from `doctor --machine` / `--help` to `check --changed ... --run-id ...` to one focused `witness test`/`witness refresh` proof without hidden repo memory. |
| Adoption / rollout guidance | Greenfield and brownfield adoption guides exist with first-slice/witness/control-plane advice. | Adoption guidance helps repos introduce truthful evidence gradually without fake-green rollout. | Guidance must stay aligned with shipped CLI behavior and sample artifacts. | A new repo can land one narrow, behavior-bearing slice with explicit current vs target rollout truth. |

## Current strengths

- The architecture already separates evidence, judgment, invariant understanding, governance, and legitimacy.
- The runtime is consistently fail-closed around missing scope, invalid mutation baselines, control-plane drift, path escapes, and unsupported snapshot schemas.
- Invariant evidence has a meaningful provenance model: explicit, inferred, and missing support are not silently mixed.
- Legitimacy is unusually concrete for an alpha tool: grants, attestations, overrides, amendments, and authorization decisions are tied to exact runs.
- The package path is no longer just conceptual; staged packaging, public npm publication through `0.5.0`, Trusted Publishing provenance, production-clean npm README presentation, first-user CLI help including the first focused witness path, configured LCOV generation, compact public `doctor --machine` diagnostics, compact `retention --machine`, representative installed-package review/governance/legitimacy smoke proof, public release verification for manual witness evidence, the 0.3 contract baseline, the 0.4 evidence-closure contract, executable negative governance/authorization proof, and multiple outside-repo adoption/dogfood pilots now including an ESM TypeScript/Vitest target-shape artifact capture exist.

## Current gaps

- The outside-repo operator story is not yet as mature as the repo-internal architecture.
- Outside-repo adoption now has public and local dogfood evidence for compact doctor diagnostics, configured LCOV generation, mutation remediation, next-evidence-action output, manual and scenario-configured execution witnesses, TypeScript/dist source-map coverage, monorepo package attribution, and a real negative-path case where high coverage plus a witness still failed on mutation pressure.
- Manual `witness test` artifacts are visible in the first-user CLI/README path, public `0.2.2` made matching `.ts-quality/witnesses/**/*.json` pass witnesses first-class `check` evidence, public `0.3.0` made that path part of the baseline evidence contract, public `0.4.0` made next-evidence-action the evidence-closure contract, and public `0.5.0` added `adopt` / `retention` for pilot-to-repo asset handling; the remaining proof gap is broader real target-shape validation, not core witness consumption.
- Concise summaries must keep improving without becoming a second authority over `run.json`; the compact check evidence-basis lines are a good start, but real operators still need negative-path examples that explain why confidence is not coverage percentage.
- Adoption docs, sample artifacts, release-note breaking-change / agent-migration guidance, public contract docs, and compatibility fixtures must stay synchronized with shipped artifact schema changes.

## Target product experience

A reviewer should be able to run `ts-quality` on a bounded change and understand, from one concise surface:

1. what changed,
2. what evidence constrains it,
3. which support is explicit, inferred, or missing,
4. whether governance and legitimacy allow the action,
5. what exact evidence obligation would improve the decision.

A release operator can now repeat representative review/governance/legitimacy flows from an installed package in fixture-backed smoke proof, npm presents the production-clean README, the CLI/README teach the first bounded-review plus first-witness contract directly, public `doctor --machine` gives harnessed LLMs a compact setup diagnostic, public `witness test` artifacts are first-class `check` evidence without duplicated scenario config, public `0.3.x` shipped the baseline evidence contract, public `0.4.x` made next-evidence-action the explicit evidence-closure contract, and public `0.5.0` added `adopt` / `retention` so temporary pilots can become repo-local reusable setup without committing generated run state. The `0.5.x` line should continue broadening compatibility/adoption proof and artifact-schema clarity rather than adding feature breadth; the kinetic-caption-studio ESM/Vitest capture is one step, not closure of broad real-target coverage.

## Near-term convergence path

1. Expand schema-version compatibility fixtures beyond the current fixture matrix into more real historical/current artifact captures from target repos.
2. Continue outside-repo pilots across additional target shapes, now focusing on whether the public `doctor --machine` -> manual `witness test` -> `check` -> `report`/`explain` -> `retention` story remains understandable without maintainer narration.
3. Continue expanding negative-path public examples beyond the now-executable mutation-survivor and governance/authorization proofs, especially more real target-shape governance violations and wrong-run evidence captures.
4. Keep witness discovery narrow: invariant id, scenario id, pass status, and impacted source scope must all match before manual artifacts count as execution-backed support.
5. Continue making concise summaries downstream of `run.json`, not competing authorities.
6. Preserve artifact compatibility and exact-run binding as the trust surface grows.

## Hard rules for status language

- Say “the core trust layers exist” rather than “the product is fully mature.”
- Say “installed package proof covers representative fixture-backed and temp-copy review/governance/legitimacy flows” but not “outside-repo production adoption is solved” until accepted repo-local/live adoption follows the path without hidden maintainer narration.
- Say “lexical support is deterministic evidence” rather than “lexical support proves behavior.”
- Say “authorization is run-bound” rather than “agent trust is ambient.”
- Say “sample outputs are projections” rather than “sample outputs are a second authority.”
- Keep this posture file product-level; task-level current truth belongs in AK tasks, not in a parallel operating-plan document.

## Authority map

- Durable ambition: `docs/project/vision.md`
- Product posture: this file
- Shipped operator/runtime truth: `README.md`, `ARCHITECTURE.md`, `docs/config-reference.md`, `docs/invariant-dsl.md`, `docs/ci-integration.md`, package source, and tests
- Live execution and sequencing truth: repo-local AK tasks
- Raw session evidence: `diary/`
- Crystallized learning: `docs/learnings/`
