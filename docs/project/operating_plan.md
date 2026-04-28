---
summary: "Operating plan after v0.2.0: public outside-repo adoption proof with doctor --machine is the live wave; artifact compatibility follows."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG8 — Prove the public `0.2.0` outside-repo adoption loop with compact agent diagnostics**

Active tactical goal: **TG21 — Run a public `0.2.0` outside-repo adoption pilot from `doctor --machine`**

## Current state

`0.2.0` is public. It added the production-readiness adoption package: configured coverage-generation polish, actionable mutation remediation, source-vs-built LCOV warnings, confidence breakdowns, next-evidence-action artifacts, `doctor`, init presets, categorized release notes with breaking-change / agent-migration guidance, and compact `doctor --machine` diagnostics for harnessed LLMs. SG7/TG19 adoption-surface revalidation is complete enough to move the active wave from documentation alignment to public-package adoption proof.

## Active operating slices

### OP1 — Select and bind the public `0.2.0` outside-repo pilot target
- **AK task:** `task:1921`
- **State:** active
- **Deliverable:** choose one real outside target repo and record a bounded pilot plan: changed file/slice, expected test command, expected coverage path, likely init preset, and off-limits repo mutations.
- **Guardrails:** use a temp copy or explicit non-mutating target posture; do not broaden into unrelated repos; do not treat raw pilot artifacts as canonical target-repo truth.

### OP2 — Execute the pilot from `doctor --machine` through first bounded review
- **AK task:** `task:1922`
- **State:** next
- **Deliverable:** run the public package path (`npx -p ts-quality@0.2.0 ts-quality doctor --machine`, init/config, bounded `check`, `explain`, next-evidence-action inspection, and one focused witness or documented deferral) and capture what worked / what remained red.
- **Guardrails:** use the public npm package, not local source; keep changed scope explicit; preserve target-repo evidence truth even when the result stays red.

### OP3 — Convert pilot findings into the next smallest product slice
- **AK task:** `task:1923`
- **State:** next
- **Deliverable:** either add artifact/schema compatibility fixtures, improve `doctor --machine` recommendations, or sharpen mutation remediation based on the first concrete pilot blocker.
- **Guardrails:** one finding class per slice; prefer tests over prose-only corrections; keep `run.json` authoritative.

## Recently completed operating history

- **Compact doctor machine diagnostics (`task:1917`):** `doctor --machine` now emits a token-light `TSQ_DOCTOR_MACHINE_V1` line protocol for harnessed LLMs/agents, while existing `--json` surfaces remain for CI/report projections.
- **Release-note contract repair (`task:1916`):** release notes now follow release-please-style categories, reject generic fallback titles, require `### Breaking Changes`, and require `### Agent migration notes` when breaking changes are non-empty.
- **`0.2.0` adoption-readiness package (`task:1914-1915`):** run artifact schema `0.2.0`, actionable mutation remediation, coverage-generation sidecars, built-output LCOV warnings, confidence breakdowns, next-evidence-action artifacts, `doctor`, init presets, docs, dist, examples, and public release were completed.
- **SG7 adoption-surface documentation/proof (`task:1791-1793`):** README, release/publishing docs, and regression checks were aligned with richer SG6 legitimacy outputs.
- **Amendment human-readable/sample continuity (`task:1767`):** amendment results now persist `.result.txt`, the reviewed sample bundle includes `amend.txt`, and README documents the additive contract.
- **Authorization attestation-verification continuity (`task:1766`):** authorization artifacts and bundles now project run-scoped attestation verification outcomes from the exact evaluated run.

## Queue discipline

- OP1 is the live next planning slice.
- OP2 should not start until a target and bounded slice are explicit.
- OP3 should be evidence-driven by OP2, not guessed from internal preference.
- TG22 compatibility work stays staged until the pilot identifies which consumer edge matters most, unless a direct artifact-reader regression appears first.
- Release publication remains GitHub Release / Trusted Publishing only; do not run local `npm publish`.
