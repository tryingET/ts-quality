---
summary: "Strategic handoff with SG7 active: SG6 legitimacy continuity is complete, SG7 revalidates adoption-facing operator truth against that richer surface, and SG8 keeps deeper installed-package proof just behind it."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

Product-maturity context for the SG7/SG8 sequence lives in [`product_posture.md`](product_posture.md); this file keeps the active strategic direction rather than becoming product-status or task truth.

## Active strategic goal

### SG7 — Re-test adoption-facing operator paths against the richer SG6 legitimacy surface
- **Why now:** SG6 landed through `task:1766-1767`: `authorize` now projects run-scoped attestation verification outcomes and `amend` now persists a concise human-readable summary alongside the authoritative JSON result. The public operator/release surfaces and packaged proof path were aligned before those SG6 outputs existed, so the next unfinished repo-local concern is to revalidate adoption-facing truth against the richer shipped surface instead of assuming operators will infer it from generic legitimacy wording.
- **Success signal:** README, release guidance, and adjacent adoption-facing proof paths all describe the current SG6 legitimacy outputs truthfully enough that an outside-repo operator can follow the surfaced path without hidden repo memory or a second authority model.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

## Next strategic goal

### SG8 — Deepen installed-package proof around representative review/governance/legitimacy flows
- **Why next:** `npm run smoke:packaging` already proves staged manifest/file boundaries, install/load behavior, CLI help, init/materialize, API exports, and consumer type resolution, but it still does not exercise a representative SG6 review/legitimacy path from a fresh installed package. Once SG7 revalidates the public operator story, the next concrete repo-local gap is to prove more of the shipped product surface from that outside-repo install path.
- **Success signal:** the packaged operator proof exercises at least one native review/governance/legitimacy flow from a fresh temp project and keeps that proof deterministic.
- **Eisenhower-3D:** importance `2`, urgency `1`, difficulty `3`

## Recently completed strategic history

### SG6 — Return the active wave to core product/runtime evidence surfaces after SG5 closure
- **Completed by:** repo-local AK tasks `task:1766-1767`.
- **What landed:** authorization artifacts now carry run-scoped attestation verification outcomes in additive `evidenceContext` / bundle surfaces, amendment evaluation now persists a concise human-readable summary alongside the authoritative JSON decision, and the reviewed sample bundle plus README were refreshed to keep those legitimacy surfaces downstream of exact run/proposal truth.

### SG5 — Implement the settled projection and verification artifact contracts
- **Completed by:** repo-local AK tasks `task:1763-1765`.
- **What landed:** the repo refreshed the active ladder after the first SG5 implementation pass, aligned README operator guidance with the settled handoff-sync / verification-artifact guard contract, then retired SG5 cleanly while promoting the next native product wave into AK-backed SG6 follow-through tasks `task:1766-1767`.

### SG4 — Settle repo-local projection and verification artifact authority without drifting from AK
- **Completed by:** repo-local AK tasks `task:1760-1761`.
- **What landed:** the repo now has explicit ADRs for the hybrid projection-authority contract and the checked-in verification-artifact contract, which resolved the authority questions that had kept `task:190-191` deferred.

### SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics
- **Completed by:** repo-local AK tasks `task:1751-1758`.
- **What landed:** the repo aligned its staged-package operator surfaces, rehearsed the first public staged-package publish path through a real npm dry-run, recorded an explicit first-release go decision, and reflected that decision back into the release draft.

## Not current strategic goals

These matter, but they are not the top repo-level bets right now:
- reopening SG6 unless SG7 revalidation reveals a concrete shipped-surface contradiction
- another control-plane/handoff cleanup wave when the visible gap is now on outside-repo operator truth
- treating the existing staged-package smoke proof as if it already covers representative SG6 review/legitimacy workflows
- performing the actual first public publish as a repo-planning wave when that remains operator-triggered execution, not the next default repo-local bet
