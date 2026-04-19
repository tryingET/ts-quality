---
summary: "Tactical handoff with SG7 active: TG19 adoption-surface revalidation is live, TG20 packaged-proof deepening is staged behind it, and SG6 legitimacy continuity is complete history."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG7 — Re-test adoption-facing operator paths against the richer SG6 legitimacy surface**

SG6 is now complete. The next unfinished repo-local concern is adoption-facing truth: the repo's public operator/release surfaces and packaged proof path were aligned before the richer SG6 authorize/amend outputs landed, so the next tactical wave should revalidate those surfaces before assuming outside-repo operators will infer the new behavior from generic legitimacy wording.

## Active tactical goals

### TG19 — Refresh public operator and release surfaces for the richer SG6 legitimacy outputs
- **Why this is active:** README, publish guidance, and release surfaces already describe the staged-package path, but they still frame legitimacy/operator behavior mostly at the pre-SG6 granularity. The next truthful SG7 slice is to point those adoption-facing surfaces at the run-bound authorization evidence and human-readable amendment summary that now exist, using reviewed artifacts instead of hand-wavy claims.
- **Completion target:** adoption-facing docs and release guidance describe the richer SG6 legitimacy outputs and their reviewed sample anchors truthfully, without inventing a second authority beyond `run.json`, authorization artifacts, or the amendment decision JSON/text pair.
- **Materialized through:** repo-local AK tasks `task:1791-1793`.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

### TG20 — Re-prove the staged-package operator path with a representative SG6 review flow
- **Why this is next:** the current packaging smoke path proves staging/install/load/init/materialize/API/types, but not a representative `check` / governance / legitimacy flow from the shipped package. Once TG19 refreshes the public operator story, the next truthful SG7 follow-through is to prove that richer path from a fresh installed package rather than leaving it as implied capability.
- **Completion target:** a deterministic fresh-install proof exercises a representative SG6 review/legitimacy workflow from the packaged surface and keeps that proof inside the repo's normal validation contract.
- **Promotion trigger:** promote after TG19 completes through `task:1791-1793`.
- **Eisenhower-3D:** importance `2`, urgency `1`, difficulty `3`

## Recently completed tactical history

### TG18 — Project amendment evaluation context into human-readable outputs and reviewed sample artifacts
- **Completed by:** repo-local AK task `task:1767`.
- **What landed:** amendment evaluation now persists `.result.txt` alongside the authoritative JSON result, the reviewed sample bundle includes `amend.txt`, and the README documents that additive human-readable contract.

### TG17 — Surface attestation verification outcomes in authorization artifacts and bundle surfaces
- **Completed by:** repo-local AK task `task:1766`.
- **What landed:** authorization artifacts and bundles now project run-scoped attestation verification outcomes in additive form instead of forcing operators to cross-reference a separate attestation review path manually.

### TG16 — Close SG5 or materialize one last concrete SG5 follow-through
- **Completed by:** repo-local AK task `task:1765`.
- **What landed:** SG5 retired cleanly, the ladder rolled forward into SG6, and the next product-native follow-through queue was materialized as `task:1766-1767` instead of leaving the repo with a stale finished wave.

## Tactical guardrails
- keep adoption-facing operator surfaces downstream of exact SG6 artifacts rather than marketing generic legitimacy claims
- keep README/release/checklist guidance aligned to reviewed sample artifacts and current shipped commands
- keep additive-first contract growth intact: SG7 should restate current truth, not invent a new report model
- do not reopen SG6 or generic control-plane cleanup unless the SG7 revalidation work finds a concrete contract contradiction
