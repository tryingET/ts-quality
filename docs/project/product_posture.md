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
- `docs/project/strategic_goals.md`
- `docs/project/tactical_goals.md`
- `docs/project/operating_plan.md`

This file should be **exceptionally useful**: concise, grounded in shipped truth, and strong enough to guide strategy without becoming a task log, release log, or mandatory status file for every repo.

## Posture in one sentence

`ts-quality` already has the core deterministic trust layers in place — scoped evidence, mutation pressure, invariant reasoning, governance, legitimacy, run-bound artifacts, and package staging — but its main maturity gap is turning those layers into a coherent outside-repo operator experience where concise summaries, authoritative artifacts, legitimacy flows, and installed-package usage all tell the same evidence truth.

## Product maturity map

| Area | Current posture | Target posture | Main gap | Proof of closure |
|---|---|---|---|---|
| Scoped change truth | `check` requires explicit changed scope from CLI/config/diff and fails closed instead of widening silently. | Operators can always tell exactly which files, hunks, config inputs, and control-plane artifacts were reviewed. | Scope truth is strong, but adoption docs and examples must keep teaching it as the normal path rather than an internal constraint. | Fresh operators can run the documented flow without accidentally evaluating an ambient whole-repo scope. |
| Structural evidence | Coverage, complexity, changed functions, package attribution, and diff-hunk narrowing exist in deterministic artifacts. | Structural risk reads as the first visible layer of a broader trust ladder. | Structural facts need to stay legible in concise surfaces without crowding out behavior/governance truth. | A reviewer can identify the highest structural risk from summary output and trace it to `run.json`. |
| Mutation pressure | Mutation testing validates the baseline command, isolates execution, mirrors built runtime roots, fingerprints execution context, and fails closed on empty pressure. | Mutation pressure is a trusted behavioral constraint signal for changed code and invariant claims. | Runtime-mirror and coverage prerequisites are powerful but adoption-sensitive. | Representative external projects can configure and understand mutation pressure without hidden repo memory. |
| Invariant evidence | Invariants produce focused evidence summaries, sub-signals, explicit/inferred/missing modes, lexical-vs-execution-backed support, and test obligations. | Invariants become the operator-facing language for declared behavior claims and missing proof. | The concept is strong but still needs simple operator affordances for writing, refreshing, and interpreting witnesses. | A new repo can add one useful invariant + focused witness and understand every emitted obligation. |
| Execution witnesses | Witness commands, witness artifacts, and receipt sidecars exist; `check` / `witness refresh` can generate impacted witnesses. | Important invariant scenarios can graduate from deterministic lexical evidence to explicit proof artifacts. | Witness workflow needs to feel like a first-class review habit rather than an advanced feature. | CI and local docs demonstrate one representative witness-backed review flow from fresh setup. |
| Governance | Constitution rules, boundary checks, approvals, waivers, ownership, rollback, and risk budgets are evaluated against the run. | Governance explains whether a change fits the repo's declared operating constraints. | Governance output should remain clearly downstream of exact evidence, not a separate policy theatre. | Governance findings in reports/plans point to exact run evidence and concrete remediation. |
| Legitimacy / authorization | Agents, grants, run-bound attestations, overrides, authorization, and amendments exist with exact-run binding and drift checks. | The product can answer who or what has standing to approve a specific change under the evidence available. | Legitimacy is rich enough that public/operator surfaces must keep it understandable. | An outside operator can follow check → attest/verify → authorize/amend without reading internals. |
| Artifact contract | `run.json`, verdict/report artifacts, decision context, authorization outputs, amendment JSON/text, PR summaries, trend output, and sample artifacts exist. | Artifacts behave like an audit packet: machine-stable, human-inspectable, and projection-aware. | Artifact authority and projection boundaries must stay obvious as outputs multiply. | Concise Markdown and JSON artifacts tell the same story, with no competing authority. |
| Operator summaries | `pr-summary.md`, check summaries, explain/report/plan/govern/authorize surfaces project key evidence. | A reviewer can start from one concise summary and know the riskiest evidence gap plus next action. | Summaries must stay short while preserving provenance modes and run-bound truth. | The most common review summary names explicit/inferred/missing support for the riskiest claim. |
| CI integration | Build/test/coverage/witness/check guidance exists and the repo has deterministic verification scripts. | CI gives a reproducible trust packet for each bounded change. | Current docs are truthful but need continued validation against outside-repo usage. | A fresh CI integration can run the documented sequence and produce interpretable artifacts. |
| Packaged outside-repo use | Staged package creation, tarball proof, installed CLI/API/types smoke, and release checklist exist. | Installed package use proves representative review/governance/legitimacy flows, not just help/load/type surfaces. | Packaging proof needs to cover one representative trust workflow from a fresh project. | `smoke:packaging` or equivalent proves a realistic installed-package review/legitimacy path. |
| Adoption / rollout guidance | Greenfield and brownfield adoption guides exist with first-slice/witness/control-plane advice. | Adoption guidance helps repos introduce truthful evidence gradually without fake-green rollout. | Guidance must stay aligned with shipped CLI behavior and sample artifacts. | A new repo can land one narrow, behavior-bearing slice with explicit current vs target rollout truth. |

## Current strengths

- The architecture already separates evidence, judgment, invariant understanding, governance, and legitimacy.
- The runtime is consistently fail-closed around missing scope, invalid mutation baselines, control-plane drift, path escapes, and unsupported snapshot schemas.
- Invariant evidence has a meaningful provenance model: explicit, inferred, and missing support are not silently mixed.
- Legitimacy is unusually concrete for an alpha tool: grants, attestations, overrides, amendments, and authorization decisions are tied to exact runs.
- The package path is no longer just conceptual; staged packaging and installed-surface smoke proof exist.

## Current gaps

- The outside-repo operator story is not yet as mature as the repo-internal architecture.
- Installed-package proof does not yet exercise a representative review/governance/legitimacy flow deeply enough.
- Execution witnesses are powerful but still feel advanced; the desired habit loop needs to be simpler.
- Concise summaries must keep improving without becoming a second authority over `run.json`.
- Adoption docs and sample artifacts must stay synchronized with the richer legitimacy and witness surfaces.

## Target product experience

A reviewer should be able to run `ts-quality` on a bounded change and understand, from one concise surface:

1. what changed,
2. what evidence constrains it,
3. which support is explicit, inferred, or missing,
4. whether governance and legitimacy allow the action,
5. what exact evidence obligation would improve the decision.

A release operator should be able to repeat the same story from an installed package in a fresh project without hidden repo memory.

## Near-term convergence path

1. Keep public operator docs aligned with the current legitimacy outputs and reviewed sample artifacts.
2. Re-prove a representative packaged review/governance/legitimacy flow from fresh installed package use.
3. Continue making concise summaries downstream of `run.json`, not competing authorities.
4. Make first-witness adoption easier to understand and validate.
5. Preserve artifact compatibility and exact-run binding as the trust surface grows.

## Hard rules for status language

- Say “the core trust layers exist” rather than “the product is fully mature.”
- Say “installed package proof covers CLI/API/types today” unless representative review/legitimacy flow proof has actually landed.
- Say “lexical support is deterministic evidence” rather than “lexical support proves behavior.”
- Say “authorization is run-bound” rather than “agent trust is ambient.”
- Say “sample outputs are projections” rather than “sample outputs are a second authority.”
- Keep this posture file product-level; task-level current truth belongs in AK and `operating_plan.md`.

## Authority map

- Durable ambition: `docs/project/vision.md`
- Product posture: this file
- Shipped operator/runtime truth: `README.md`, `ARCHITECTURE.md`, `docs/config-reference.md`, `docs/invariant-dsl.md`, `docs/ci-integration.md`, package source, and tests
- Active direction: `docs/project/strategic_goals.md`, `docs/project/tactical_goals.md`, `docs/project/operating_plan.md`
- Live execution truth: repo-local AK tasks
- Raw session evidence: `diary/`
- Crystallized learning: `docs/learnings/`
