---
summary: "Operating plan with TG8 active: task 1722 is now the live staged-tarball smoke-proof slice, with CLI/API proof hardening and verification gating sequenced behind it."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

Active tactical goal: **TG8 — Prove staged tarball install/load behavior from a fresh temp project**

## Current state

The repo already ships a staged packaging helper (`npm run pack:ts-quality`), a public package manifest under `packages/ts-quality/package.json`, and release/checklist docs that describe the intended outside-repo path.
What is still missing is deterministic repo-local proof coverage: the packaged tarball path is not yet guarded by the active validation surfaces, so outside-repo adoption still depends on manual rehearsal.

## Active operating slices

### OP1 — Add staged tarball install smoke coverage
- **AK task:** `task:1722`
- **State:** active
- **Deliverable:** automated repo-local smoke coverage stages the tarball and installs it into a fresh temp project instead of assuming workspace-relative execution.
- **Guardrails:** use temp directories and the staged tarball path; fail closed on install/entrypoint errors; do not widen the slice into docs or publish automation.

### OP2 — Harden staged package CLI/API proof points
- **AK task:** `task:1723`
- **State:** staged behind OP1
- **Deliverable:** the packaged proof path asserts the public CLI and module entrypoint behaviors that matter for first outside-repo adoption.
- **Guardrails:** prove only the shipped package entrypoints; do not accidentally turn internal workspace layout into public API surface area.

### OP3 — Gate staged tarball proof in repo verification
- **AK task:** `task:1724`
- **State:** staged behind OP2
- **Deliverable:** repo verification runs the packaged-proof surface so SG3 no longer depends on manual release rehearsal.
- **Guardrails:** keep the gate deterministic and scoped; do not re-open SG4 authority decisions while wiring proof into validation.

## Queue discipline
- `task:1722` is the live ready slice for TG8
- `task:1723` stays sequenced behind `task:1722`, and `task:1724` stays sequenced behind `task:1723`
- deferred contract-first tasks `task:190-191` remain out of the active SG3 execution wave
- when OP1-OP3 land, promote TG9 instead of inventing parallel SG3 tactical work
