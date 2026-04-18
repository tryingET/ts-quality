---
summary: "Tactical handoff with SG2 active: authorization and attestation-review are completed siblings, and TG7 is now the active amendment-output wave materialized through AK tasks 1711-1713."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG2 — Carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far**

SG1's earlier concise operator-surface wave is complete through `task:184-187`.
Within SG2, the current child set is now explicit instead of stopping at a vague "no tactical slice materialized yet" posture.

## Active tactical goals

### TG5 — Make authorization decisions cite exact run-bound evidence
- **Why this was active:** legitimacy decisions were still collapsing trust down to outcome + reasons even when the reviewed run already contained exact artifact identity, governance findings, and risky-invariant provenance.
- **Outcome:** `ts-quality authorize` now projects additive run-bound `evidenceContext` without competing with `run.json`, and the reviewed sample plus targeted regression coverage lock that contract.
- **Completed by:** repo-local AK task `task:192`.
- **Eisenhower-3D:** importance `4`, urgency `3`, difficulty `2`

### TG6 — Make attestation verification outputs cite exact signed subject context
- **Why this was active:** attestation review was the next legitimacy surface still hiding exact subject/run context even though the signed payload already carried it.
- **Outcome:** `attest verify` now keeps signed subject path, run/artifact identity, canonical verification-record parity, and machine-readable JSON output visible through repo-local AK tasks `task:195-197`.
- **Completed by:** repo-local AK tasks `task:195-197`.
- **Eisenhower-3D:** importance `4`, urgency `3`, difficulty `2`

### TG7 — Make amendment decisions carry additive proposal/rule context
- **Why this is active:** after TG5 and TG6 landed, `ts-quality amend` is the next repo-local SG2 surface still compressing authority too far. The current amendment result only returns `proposalId`, `outcome`, `reasons`, `approvalsAccepted`, and `requiredApprovals`, even though the CLI already has the proposal title/rationale, exact change set, evidence list, and the sensitivity basis that determines approval burden.
- **Completion target:** amendment decisions and `.ts-quality/amendments/<proposal-id>.result.json` project additive proposal/rule context without inventing a second authority, the reviewed sample/docs stay aligned with that contract, and targeted regression coverage locks CLI/runtime/sample parity.
- **Seeded by:** repo-local AK tasks `task:1711-1713`.
- **Eisenhower-3D:** importance `5`, urgency `3`, difficulty `3`

## Tactical guardrails
- keep `behaviorClaims[].evidenceSummary` and proposal/constitution artifacts as the additive authority
- do not let concise legitimacy outputs outrank `run.json`, the amendment proposal, or the constitution itself
- prefer small end-to-end slices over a broad legitimacy redesign
- keep SG3 packaging/release work out of the active tactical queue until TG7 is materially complete
