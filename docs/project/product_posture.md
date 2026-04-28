---
summary: "Product posture snapshot for ts-quality: current maturity, target product experience, major gaps, and proof signals."
read_when:
  - "When deciding where ts-quality stands relative to its product vision"
  - "When selecting or reviewing strategic goals from product maturity rather than task history"
  - "When checking whether active work converges on the intended product experience"
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

`ts-quality` already has the core deterministic trust layers in place — scoped evidence, generated/consumed coverage evidence, mutation pressure, invariant reasoning, governance, legitimacy, run-bound artifacts, public npm release through `0.2.0`, Trusted Publishing provenance, representative installed-package proof, production-clean npm README presentation, first-user CLI help, compact `doctor --machine` diagnostics for harnessed LLMs, and two temp-copy outside-repo first-witness pilots — but its main maturity gap is proving the new `0.2.0` adoption loop repeatedly from the public package where fresh operators and agents can keep witness-backed reviews habitual across real repos without repo-internal scaffolding.

## Product maturity map

| Area | Current posture | Target posture | Main gap | Proof of closure |
|---|---|---|---|---|
| Scoped change truth | `check` requires explicit changed scope from CLI/config/diff and fails closed instead of widening silently. | Operators can always tell exactly which files, hunks, config inputs, and control-plane artifacts were reviewed. | Scope truth is strong, but adoption docs and examples must keep teaching it as the normal path rather than an internal constraint. | Fresh operators can run the documented flow without accidentally evaluating an ambient whole-repo scope. |
| Structural evidence | Coverage, configured LCOV generation, complexity, changed functions, package attribution, and diff-hunk narrowing exist in deterministic artifacts. | Structural risk reads as the first visible layer of a broader trust ladder. | Structural facts need to stay legible in concise surfaces without crowding out behavior/governance truth, and generated coverage must stay target-repo-command explicit rather than magic. | A reviewer can identify the highest structural risk from summary output and trace it to `run.json`. |
| Mutation pressure | Mutation testing validates the baseline command, isolates execution, mirrors built runtime roots, fingerprints execution context, and fails closed on empty pressure. | Mutation pressure is a trusted behavioral constraint signal for changed code and invariant claims. | Runtime-mirror and coverage prerequisites are powerful but adoption-sensitive. | Representative external projects can configure and understand mutation pressure without hidden repo memory. |
| Invariant evidence | Invariants produce focused evidence summaries, sub-signals, explicit/inferred/missing modes, lexical-vs-execution-backed support, and test obligations. | Invariants become the operator-facing language for declared behavior claims and missing proof. | The concept is strong but still needs simple operator affordances for writing, refreshing, and interpreting witnesses. | A new repo can add one useful invariant + focused witness and understand every emitted obligation. |
| Execution witnesses | Witness commands, witness artifacts, and receipt sidecars exist; `check` / `witness refresh` can generate impacted witnesses. | Important invariant scenarios can graduate from deterministic lexical evidence to explicit proof artifacts. | Witness workflow needs to feel like a first-class review habit rather than an advanced feature. | CI and local docs demonstrate one representative witness-backed review flow from fresh setup. |
| Governance | Constitution rules, boundary checks, approvals, waivers, ownership, rollback, and risk budgets are evaluated against the run. | Governance explains whether a change fits the repo's declared operating constraints. | Governance output should remain clearly downstream of exact evidence, not a separate policy theatre. | Governance findings in reports/plans point to exact run evidence and concrete remediation. |
| Legitimacy / authorization | Agents, grants, run-bound attestations, overrides, authorization, and amendments exist with exact-run binding and drift checks. | The product can answer who or what has standing to approve a specific change under the evidence available. | Legitimacy is rich enough that public/operator surfaces must keep it understandable. | An outside operator can follow check → attest/verify → authorize/amend without reading internals. |
| Artifact contract | `run.json`, verdict/report artifacts, decision context, authorization outputs, amendment JSON/text, PR summaries, trend output, and sample artifacts exist. | Artifacts behave like an audit packet: machine-stable, human-inspectable, and projection-aware. | Artifact authority and projection boundaries must stay obvious as outputs multiply. | Concise Markdown and JSON artifacts tell the same story, with no competing authority. |
| Operator summaries | `pr-summary.md`, check summaries, explain/report/plan/govern/authorize surfaces project key evidence. | A reviewer can start from one concise summary and know the riskiest evidence gap plus next action. | Summaries must stay short while preserving provenance modes and run-bound truth. | The most common review summary names explicit/inferred/missing support for the riskiest claim. |
| CI integration | Build/test/coverage/witness/check guidance exists, configured LCOV generation can fill missing coverage before analysis, and the repo has deterministic verification scripts. | CI gives a reproducible trust packet for each bounded change. | Current docs are truthful but need continued validation against outside-repo usage, especially source-map coverage for built TypeScript targets. | A fresh CI integration can run the documented sequence and produce interpretable artifacts. |
| Packaged outside-repo use | Public npm publishing now works through GitHub Release + Trusted Publishing/OIDC through `0.2.0`; `smoke:packaging` proves installed CLI/API/types plus representative review, governance, legitimacy, materialized-config, drift, and monorepo fixture flows; npm shows the production-clean frontmatter-free/version-neutral README; and `docs/adoption/first-witness-pilot-designmd-foundry.md` plus `docs/adoption/second-witness-pilot-pi-server.md` record two temp-copy outside-repo first-witness pilots. | Installed package use should feel production-clean from the first public page through first bounded review. | The proof is strong; the remaining gap is validating the `0.2.0` adoption loop, including `doctor --machine`, actionable mutation remediation, next-evidence-action artifacts, and release-note breaking-change/agent-migration guidance, from the public package without maintainer-guided command selection. | A fresh target repo follows a minimal bounded review plus one focused witness without hidden repo memory, and the resulting artifacts are understandable without maintainer narration. |
| CLI first-user guidance | Top-level and command-specific help now teach the first bounded review contract, explicit changed-scope preconditions, `--run-id` habits, run artifact authority, the first focused witness path, `doctor`, init presets, and compact `doctor --machine` diagnostics for harnessed LLMs. | Operators and agents can discover the trust contract, setup risks, and first witness upgrade from the CLI before reading deeper docs. | The CLI now names the habit; the next maturity gap is validating that first-time outside users and harnessed LLMs can execute it correctly in real target repos. | A fresh operator or harnessed LLM can move from `doctor --machine` / `--help` to `check --changed ... --run-id ...` to one focused `witness test`/`witness refresh` proof without hidden repo memory. |
| Adoption / rollout guidance | Greenfield and brownfield adoption guides exist with first-slice/witness/control-plane advice. | Adoption guidance helps repos introduce truthful evidence gradually without fake-green rollout. | Guidance must stay aligned with shipped CLI behavior and sample artifacts. | A new repo can land one narrow, behavior-bearing slice with explicit current vs target rollout truth. |

## Current strengths

- The architecture already separates evidence, judgment, invariant understanding, governance, and legitimacy.
- The runtime is consistently fail-closed around missing scope, invalid mutation baselines, control-plane drift, path escapes, and unsupported snapshot schemas.
- Invariant evidence has a meaningful provenance model: explicit, inferred, and missing support are not silently mixed.
- Legitimacy is unusually concrete for an alpha tool: grants, attestations, overrides, amendments, and authorization decisions are tied to exact runs.
- The package path is no longer just conceptual; staged packaging, public npm publication through `0.2.0`, Trusted Publishing provenance, production-clean npm README presentation, first-user CLI help including the first focused witness path, configured LCOV generation, compact `doctor --machine` diagnostics, representative installed-package review/governance/legitimacy smoke proof, and two temp-copy outside-repo first-witness pilots exist.

## Current gaps

- The outside-repo operator story is not yet as mature as the repo-internal architecture.
- Outside-repo adoption has two temp-copy target-repo pilots, plus a pi-server rerun proving configured LCOV generation can clear missing coverage and CRAP pressure, but still needs a public `0.2.0` pilot that starts with `doctor --machine` and validates actionable survivor / next-evidence-action output.
- Execution witnesses are visible in the first-user CLI/README path and worked in pilots, but the desired habit loop still needs lower-friction setup for fresh operators, harnessed LLMs, and real repo slices.
- Concise summaries must keep improving without becoming a second authority over `run.json`.
- Adoption docs, sample artifacts, and release-note breaking-change / agent-migration guidance must stay synchronized with shipped artifact schema changes.

## Target product experience

A reviewer should be able to run `ts-quality` on a bounded change and understand, from one concise surface:

1. what changed,
2. what evidence constrains it,
3. which support is explicit, inferred, or missing,
4. whether governance and legitimacy allow the action,
5. what exact evidence obligation would improve the decision.

A release operator can now repeat representative review/governance/legitimacy flows from an installed package in fixture-backed smoke proof, npm presents the production-clean README, the CLI/README teach the first bounded-review plus first-witness contract directly, `doctor --machine` gives harnessed LLMs a compact setup diagnostic, and two temp-copy outside-repo pilots proved the witness upgrade path against `designmd-foundry` and `pi-server`. The next product-readiness step is proving the public `0.2.0` loop in real outside repos without maintainer narration.

## Near-term convergence path

1. Run a public `0.2.0` outside-repo pilot that starts from `doctor --machine`, uses an init preset where appropriate, and records whether the agent/operator can reach `check`, `explain`, and one focused witness without hidden repo memory.
2. Validate that the new mutation remediation, next-evidence-action, built-output LCOV warning, and coverage-generation sidecars reduce the pi-server-style adoption friction.
3. Add schema-version compatibility fixtures for older `0.1.0` run artifacts and current `0.2.0` artifacts so downstream agents and parsers can survive additive artifact growth.
4. Continue making concise summaries downstream of `run.json`, not competing authorities.
5. Preserve artifact compatibility and exact-run binding as the trust surface grows.

## Hard rules for status language

- Say “the core trust layers exist” rather than “the product is fully mature.”
- Say “installed package proof covers representative fixture-backed review/governance/legitimacy flows” but not “outside-repo production adoption is solved” until a real target repo has followed the path without hidden repo memory.
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
