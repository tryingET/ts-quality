---
summary: "Operating plan with SG6/TG17 active: attestation-to-authorization continuity is the live slice, amendment-output continuity is staged behind it, and SG5 closure is complete history."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG6 — Return the active wave to core product/runtime evidence surfaces after SG5 closure**

Active tactical goal: **TG17 — Surface attestation verification outcomes in authorization artifacts and bundle surfaces**

## Current state

SG5 is now complete: the repo's projection/verification contracts are settled, the README and handoff surfaces carry that truth, and the queue no longer needs another control-plane-only rollover pass. The next truthful move is back on the shipped product surface: close the legitimacy continuity gap between `attest verify` and `authorize`, then carry the same additive-context discipline into amendment-facing human-readable/sample outputs.

## Active operating slices

### OP1 — Surface attestation verification outcomes inside authorize evidence context and bundle artifacts
- **AK task:** `task:1766`
- **State:** active
- **Deliverable:** shipped authorization artifacts, docs, and tests project exact attestation verification outcomes for the evaluated run in an additive form that stays downstream of the existing attestation verification record.
- **Guardrails:** reuse the exact run/subject verification truth that already exists; do not invent a parallel legitimacy authority or opaque summary path.

### OP2 — Project amendment evaluation context into human-readable outputs and reviewed sample artifacts
- **AK task:** `task:1767`
- **State:** next
- **Deliverable:** amendment-facing human-readable outputs and reviewed samples carry the same proposal/rule context already present in the additive amendment result artifact.
- **Guardrails:** extend the current amendment contract additively, and keep the JSON amendment result authoritative when a concise surface needs to stay short.

## Recently completed operating history

- **SG5 closure/promotion (`task:1765`):** the repo retired SG5 cleanly, materialized `task:1766-1767`, and refreshed the handoff ladder so active direction points at a native product/runtime wave again.
- **README operator guidance alignment (`task:1764`):** the repo documented `ak` as live task authority plus the settled `handoff:sync` / `handoff:check` and `verify` / `verify:ci` guard contract.
- **Direction/handoff refresh (`task:1763`):** the repo promoted TG15 after the first SG5 implementation pass and removed the stale references to completed `task:190-191` as active work.

## Queue discipline
- `task:1766` is the live ready slice for SG6/TG17
- `task:1767` depends on `task:1766`
- completed SG5 tasks `task:1763-1765` stay closed unless the settled contracts prove insufficient in practice
- SG7 stays horizon-only until TG17/TG18 materially land
