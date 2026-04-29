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

`ts-quality` already has the core deterministic trust layers in place — scoped evidence, generated/consumed coverage evidence, mutation pressure, invariant reasoning, governance, legitimacy, run-bound artifacts, public npm release through `0.2.1`, Trusted Publishing provenance, representative installed-package proof, production-clean npm README presentation, first-user CLI help, compact public `doctor --machine` diagnostics, and four outside-repo adoption pilots — but its main maturity gap is making the documented manual focused-witness habit become first-class check evidence without requiring duplicated scenario-level auto-run configuration.

## Product maturity map

| Area | Current posture | Target posture | Main gap | Proof of closure |
|---|---|---|---|---|
| Scoped change truth | `check` requires explicit changed scope from CLI/config/diff and fails closed instead of widening silently. | Operators can always tell exactly which files, hunks, config inputs, and control-plane artifacts were reviewed. | Scope truth is strong, but adoption docs and examples must keep teaching it as the normal path rather than an internal constraint. | Fresh operators can run the documented flow without accidentally evaluating an ambient whole-repo scope. |
| Structural evidence | Coverage, configured LCOV generation, complexity, changed functions, package attribution, and diff-hunk narrowing exist in deterministic artifacts. | Structural risk reads as the first visible layer of a broader trust ladder. | Structural facts need to stay legible in concise surfaces without crowding out behavior/governance truth, and generated coverage must stay target-repo-command explicit rather than magic. | A reviewer can identify the highest structural risk from summary output and trace it to `run.json`. |
| Mutation pressure | Mutation testing validates the baseline command, isolates execution, mirrors built runtime roots, fingerprints execution context, and fails closed on empty pressure. | Mutation pressure is a trusted behavioral constraint signal for changed code and invariant claims. | Runtime-mirror and coverage prerequisites are powerful but adoption-sensitive. | Representative external projects can configure and understand mutation pressure without hidden repo memory. |
| Invariant evidence | Invariants produce focused evidence summaries, sub-signals, explicit/inferred/missing modes, lexical-vs-execution-backed support, and test obligations. | Invariants become the operator-facing language for declared behavior claims and missing proof. | The concept is strong but still needs simple operator affordances for writing, refreshing, and interpreting witnesses. | A new repo can add one useful invariant + focused witness and understand every emitted obligation. |
| Execution witnesses | Witness commands, witness artifacts, receipt sidecars, and scenario-configured auto-run witnesses exist; the public `0.2.1` pi-server pilot proved auto-run witnesses are recognized by `check`. | Important invariant scenarios can graduate from deterministic lexical evidence to explicit proof artifacts. | Manual `witness test --out .ts-quality/witnesses/...` artifacts are not yet first-class check evidence unless the scenario also declares execution-witness configuration. | A fresh repo can create one manual focused witness, rerun `check`, and see execution-backed support without duplicating the witness path/command in invariant config. |
| Governance | Constitution rules, boundary checks, approvals, waivers, ownership, rollback, and risk budgets are evaluated against the run. | Governance explains whether a change fits the repo's declared operating constraints. | Governance output should remain clearly downstream of exact evidence, not a separate policy theatre. | Governance findings in reports/plans point to exact run evidence and concrete remediation. |
| Legitimacy / authorization | Agents, grants, run-bound attestations, overrides, authorization, and amendments exist with exact-run binding and drift checks. | The product can answer who or what has standing to approve a specific change under the evidence available. | Legitimacy is rich enough that public/operator surfaces must keep it understandable. | An outside operator can follow check → attest/verify → authorize/amend without reading internals. |
| Artifact contract | `run.json`, verdict/report artifacts, decision context, authorization outputs, amendment JSON/text, PR summaries, trend output, and sample artifacts exist. | Artifacts behave like an audit packet: machine-stable, human-inspectable, and projection-aware. | Artifact authority and projection boundaries must stay obvious as outputs multiply. | Concise Markdown and JSON artifacts tell the same story, with no competing authority. |
| Operator summaries | `pr-summary.md`, check summaries, explain/report/plan/govern/authorize surfaces project key evidence. | A reviewer can start from one concise summary and know the riskiest evidence gap plus next action. | Summaries must stay short while preserving provenance modes and run-bound truth. | The most common review summary names explicit/inferred/missing support for the riskiest claim. |
| CI integration | Build/test/coverage/witness/check guidance exists, configured LCOV generation can fill missing coverage before analysis, and the repo has deterministic verification scripts. | CI gives a reproducible trust packet for each bounded change. | Current docs are truthful but need continued validation against outside-repo usage, especially source-map coverage for built TypeScript targets. | A fresh CI integration can run the documented sequence and produce interpretable artifacts. |
| Packaged outside-repo use | Public npm publishing works through GitHub Release + Trusted Publishing/OIDC through `0.2.1`; `smoke:packaging` proves installed CLI/API/types plus representative review, governance, legitimacy, materialized-config, drift, monorepo fixture flows, and the shared public CLI contract; npm shows the production-clean README; and `docs/adoption/fourth-witness-pilot-0.2.1.md` records the public compact-diagnostics pilot. | Installed package use should feel production-clean from the first public page through first bounded review. | The compact doctor/release-contract gap is closed; the remaining adoption gap is aligning manual witness artifacts with what `check` consumes. | A fresh target repo follows a minimal bounded review plus one manual focused witness from the public package, and the resulting artifacts are understandable without maintainer narration. |
| CLI first-user guidance | Top-level and command-specific help now teach the first bounded review contract, explicit changed-scope preconditions, `--run-id` habits, run artifact authority, the first focused witness path, `doctor`, init presets, and compact `doctor --machine` diagnostics for harnessed LLMs. | Operators and agents can discover the trust contract, setup risks, and first witness upgrade from the CLI before reading deeper docs. | The CLI now names the habit; the next maturity gap is validating that first-time outside users and harnessed LLMs can execute it correctly in real target repos. | A fresh operator or harnessed LLM can move from `doctor --machine` / `--help` to `check --changed ... --run-id ...` to one focused `witness test`/`witness refresh` proof without hidden repo memory. |
| Adoption / rollout guidance | Greenfield and brownfield adoption guides exist with first-slice/witness/control-plane advice. | Adoption guidance helps repos introduce truthful evidence gradually without fake-green rollout. | Guidance must stay aligned with shipped CLI behavior and sample artifacts. | A new repo can land one narrow, behavior-bearing slice with explicit current vs target rollout truth. |

## Current strengths

- The architecture already separates evidence, judgment, invariant understanding, governance, and legitimacy.
- The runtime is consistently fail-closed around missing scope, invalid mutation baselines, control-plane drift, path escapes, and unsupported snapshot schemas.
- Invariant evidence has a meaningful provenance model: explicit, inferred, and missing support are not silently mixed.
- Legitimacy is unusually concrete for an alpha tool: grants, attestations, overrides, amendments, and authorization decisions are tied to exact runs.
- The package path is no longer just conceptual; staged packaging, public npm publication through `0.2.1`, Trusted Publishing provenance, production-clean npm README presentation, first-user CLI help including the first focused witness path, configured LCOV generation, compact public `doctor --machine` diagnostics, representative installed-package review/governance/legitimacy smoke proof, and four outside-repo adoption pilots exist.

## Current gaps

- The outside-repo operator story is not yet as mature as the repo-internal architecture.
- Outside-repo adoption now has a public `0.2.1` pilot proving compact doctor diagnostics, configured LCOV generation, mutation remediation, next-evidence-action output, and scenario-configured execution witnesses against pi-server.
- Manual `witness test` artifacts are visible in the first-user CLI/README path, but the public `0.2.1` pilot found that `check` did not consume a manually-created pass witness unless the invariant scenario also declared execution-witness auto-run configuration.
- Concise summaries must keep improving without becoming a second authority over `run.json`.
- Adoption docs, sample artifacts, and release-note breaking-change / agent-migration guidance must stay synchronized with shipped artifact schema changes.

## Target product experience

A reviewer should be able to run `ts-quality` on a bounded change and understand, from one concise surface:

1. what changed,
2. what evidence constrains it,
3. which support is explicit, inferred, or missing,
4. whether governance and legitimacy allow the action,
5. what exact evidence obligation would improve the decision.

A release operator can now repeat representative review/governance/legitimacy flows from an installed package in fixture-backed smoke proof, npm presents the production-clean README, the CLI/README teach the first bounded-review plus first-witness contract directly, public `doctor --machine` gives harnessed LLMs a compact setup diagnostic, and the public `0.2.1` pi-server pilot proved the compact-diagnostics loop through generated coverage, mutation remediation, and scenario-configured execution-backed witness evidence. The next product-readiness step is making manual `witness test` artifacts first-class evidence for `check`.

## Near-term convergence path

1. Make `check` discover matching manually-created `.ts-quality/witnesses/*.json` artifacts by invariant id, scenario id, pass status, and source scope, or explicitly narrow the public docs if that behavior is intentionally unsupported.
2. Re-run the public outside-repo pilot from `0.2.1` or the next patch to prove manual `witness test` -> `check` upgrades scenario support without hidden config duplication.
3. Add schema-version compatibility fixtures for older `0.1.0` run artifacts and current `0.2.x` artifacts so downstream agents and parsers can survive additive artifact growth.
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
