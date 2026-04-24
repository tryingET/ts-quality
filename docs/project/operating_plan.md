---
summary: "Operating plan with SG7/TG19 active: adoption-facing docs/release surfaces are the live wave, packaged SG6 proof remains next, and SG6 runtime continuity is complete history."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG7 — Re-test adoption-facing operator paths against the richer SG6 legitimacy surface**

Active tactical goal: **TG19 — Refresh public operator and release surfaces for the richer SG6 legitimacy outputs**

## Current state

SG6 is now complete through `task:1766-1767`: the shipped runtime already exposes additive run-bound authorization evidence and a concise human-readable amendment summary, and the active direction ladder has moved to SG7/TG19 adoption-facing revalidation. The next truthful move is to revalidate adoption-facing docs and release surfaces against that richer SG6 output contract before promoting the deeper installed-package proof wave.

## Active operating slices

### OP1 — Align README and publish checklist with SG6 legitimacy outputs
- **AK task:** `task:1791`
- **State:** active
- **Deliverable:** README and `docs/npm-publishing-checklist.md` point operators at the current SG6 legitimacy outputs and reviewed artifact anchors where that outside-repo guidance actually benefits from them.
- **Guardrails:** keep `run.json`, authorization artifacts, and amendment JSON/text outputs authoritative; do not over-market semantics or imply packaged proof that the repo has not yet run.

### OP2 — Align public release docs with SG6 legitimacy outputs
- **AK task:** `task:1792`
- **State:** next
- **Deliverable:** the public release draft and first-release decision surfaces describe the richer SG6 legitimacy outputs truthfully enough that the release story matches the current shipped surface.
- **Guardrails:** keep release wording downstream of current reviewed repo truth; do not turn release notes into a second technical authority surface.

### OP3 — Add regression coverage for SG7 adoption-surface drift
- **AK task:** `task:1793`
- **State:** next
- **Deliverable:** regression coverage fails closed if the refreshed adoption-facing SG6 guidance drifts from the reviewed surfaces again.
- **Guardrails:** add the smallest truthful regression surface; if validation reveals a deeper shipped-product gap, materialize that exact next slice instead of papering it over with prose-only checks.

## Recently completed operating history

- **Amendment human-readable/sample continuity (`task:1767`):** amendment results now persist `.result.txt`, the reviewed sample bundle includes `amend.txt`, and README documents the additive contract.
- **Authorization attestation-verification continuity (`task:1766`):** authorization artifacts and bundles now project run-scoped attestation verification outcomes from the exact evaluated run.
- **SG5 closure/promotion (`task:1765`):** the repo retired SG5 cleanly, materialized `task:1766-1767`, and refreshed the handoff ladder so active direction returned to a native product/runtime wave.

## Queue discipline
- `task:1791` is the live ready slice for SG7/TG19
- `task:1792` depends on `task:1791`
- `task:1793` depends on `task:1791-1792`
- completed SG6 tasks `task:1766-1767` stay closed unless SG7 surfaces reveal a concrete contract contradiction
- TG20 stays staged until TG19 materially lands
