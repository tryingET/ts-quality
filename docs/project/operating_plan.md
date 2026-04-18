---
summary: "Operating plan with TG7 active: task 1711 landed additive proposalContext in amendment decisions, and task 1712 is now the live docs/sample follow-on with regression parity still staged behind it in task 1713."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG2 — Carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far**

Active tactical goal: **TG7 — Make amendment decisions carry additive proposal/rule context**

## Current state

Authorization and attestation-review already carry explicit run-bound decision context through `task:192` and `task:195-197`.
Task `1711` has now landed the first amendment-output implementation slice: `ts-quality amend` decisions keep proposal title/rationale, explicit evidence entries, per-change rule context, and the sensitivity basis behind the approval burden visible through additive `proposalContext` instead of collapsing back to verdict-only shorthand.
The active follow-on is now docs/sample alignment so the reviewed artifact contract says the same thing the runtime emits.

## Active operating slices

### OP1 — Surface additive proposal/rule context in amendment decisions
- **AK task:** `task:1711`
- **State:** done
- **Outcome:** `AmendmentDecision` and `ts-quality amend` now emit additive `proposalContext` fields that keep title/rationale, rule-target/action summary, evidence burden, and approval-burden basis visible without inventing a second authority beyond the proposal and constitution.
- **Guardrails retained as completed boundary:** keep the proposal file and constitution canonical; keep schema changes additive-first; do not infer ambient repo state that the amendment flow did not actually evaluate.

### OP2 — Align the reviewed amendment artifact and operator docs with the proposal-context contract
- **AK task:** `task:1712`
- **State:** active
- **Deliverable:** `examples/artifacts/governed-app/amend.json`, sample generation, and operator-facing docs describe the same amendment-result contract the runtime emits.
- **Guardrails:** keep the reviewed sample deterministic and avoid documenting fields the runtime does not actually ship.

### OP3 — Lock amendment proposal-context parity with targeted regression coverage
- **AK task:** `task:1713`
- **State:** staged behind OP2
- **Deliverable:** targeted integration/golden coverage proves CLI/runtime/sample parity for the amendment-result contract and makes future context regressions harder to reintroduce.
- **Guardrails:** harden the exact emitted contract rather than broadening test scope into unrelated legitimacy behavior.

## Queue discipline
- `task:1712` should be the live ready follow-on once `task:1711` closes; `task:1713` stays sequenced behind it through AK dependencies
- do not revive deferred decision tasks `task:190-191` as a substitute for TG7 product work
- when OP2-OP3 land, refresh SG2 direction truth before promoting SG3 packaging/release work
