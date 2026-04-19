---
summary: "Tactical handoff with SG6 active: TG17 legitimacy-surface continuity is live, TG18 amendment-surface continuity is staged behind it, and the SG5 follow-through is complete history."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG6 — Return the active wave to core product/runtime evidence surfaces after SG5 closure**

SG5 is now closed. The next unfinished repo-local concern is a native legitimacy/operator-artifact gap: `authorize` already depends on exact run-bound attestations and exposes additive evidence context, but that authorization surface still compresses attestation verification detail more than the dedicated attestation review path does.

## Active tactical goals

### TG17 — Surface attestation verification outcomes in authorization artifacts and bundle surfaces
- **Why this is active:** `attest verify` already exposes exact subject/run/artifact review detail, and legitimacy decisions can require those attestations, but the authorization artifact/bundle story still does not carry that verification outcome with the same additive continuity. That makes the next truthful SG6 slice a product-native legitimacy projection pass rather than more queue/control-plane work.
- **Completion target:** authorization decision artifacts and bundle-facing surfaces project additive attestation verification outcomes for the exact evaluated run without inventing a second legitimacy authority outside the existing verification record.
- **Materialized through:** repo-local AK task `task:1766`.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `2`

### TG18 — Project amendment evaluation context into human-readable outputs and reviewed sample artifacts
- **Why this is next:** amendment JSON already carries additive `proposalContext`, but the human-readable/sample story still needs the same context continuity so operators do not have to fall back to raw JSON to understand rule/action/evidence posture.
- **Completion target:** human-readable amendment outputs and reviewed samples carry proposal/rule context that stays aligned with the additive amendment result artifact.
- **Promotion trigger:** promote after TG17 completes through `task:1766-1767`.
- **Eisenhower-3D:** importance `2`, urgency `1`, difficulty `2`

## Recently completed tactical history

### TG16 — Close SG5 or materialize one last concrete SG5 follow-through
- **Completed by:** repo-local AK task `task:1765`.
- **What landed:** SG5 retired cleanly, the ladder rolled forward into SG6, and the next product-native follow-through queue was materialized as `task:1766-1767` instead of leaving the repo with a stale finished wave.

### TG15 — Align operator-facing docs and handoff surfaces with the settled SG5 automation/guard contract
- **Completed by:** repo-local AK tasks `task:1763-1764`.
- **What landed:** README plus the active direction/handoff surfaces now describe the settled handoff-sync and verification-artifact guard contract without depending on hidden session memory.

### TG14 — Implement the settled projection and verification artifact contracts
- **Completed by:** repo-local AK tasks `task:190-191`.
- **What landed:** the repo now has a local `handoff:sync` / `handoff:check` automation surface, `verify:ci` enforces the stabilized verification-artifact contract, and the tracked verification log stays canonical across full and skip-install verification paths.

### TG13 — Record explicit authority contracts for repo-local projections and verification artifacts
- **Completed by:** repo-local AK tasks `task:1760-1761`.
- **What landed:** the repo now has ADRs for the hybrid projection-authority contract and for keeping verification artifacts as checked-in generated reference surfaces.

## Tactical guardrails
- keep AK authoritative for live queue truth even while SG6 work returns to shipped runtime/docs/tests
- keep authorization and amendment surfaces downstream of exact run-bound evidence/verification truth rather than inventing a second legitimacy authority
- keep additive-first contract growth in `evidenceContext`, reviewed samples, and operator docs
- do not reopen SG5 or generic control-plane cleanup unless SG6 surfaces reveal a concrete contract failure
