---
summary: "Operating plan with TG7 active: amendment-result context is now the live repo-local wave, carried by task 1711 with docs/sample and regression follow-ons in tasks 1712-1713."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG2 — Carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far**

Active tactical goal: **TG7 — Make amendment decisions carry additive proposal/rule context**

## Current state

Authorization and attestation-review now have explicit run-bound decision context through `task:192` and `task:195-197`.
The next truthful SG2 wave is therefore amendment output: the repo already knows proposal title/rationale, exact change actions + rule ids, supplied evidence, and the sensitivity basis behind `requiredApprovals`, but the emitted amendment decision still compresses that back down to verdict-only shorthand.

## Active operating slices

### OP1 — Surface additive proposal/rule context in amendment decisions
- **AK task:** `task:1711`
- **State:** active
- **Deliverable:** `AmendmentDecision` and `ts-quality amend` emit additive proposal-context fields that keep title/rationale, rule-target/action summary, evidence burden, and approval-burden basis visible without inventing a second authority beyond the proposal and constitution.
- **Guardrails:** keep the proposal file and constitution canonical; make schema changes additive-first; do not infer ambient repo state that the amendment flow did not actually evaluate.

### OP2 — Align the reviewed amendment artifact and operator docs with the proposal-context contract
- **AK task:** `task:1712`
- **State:** staged behind OP1
- **Deliverable:** `examples/artifacts/governed-app/amend.json`, sample generation, and operator-facing docs describe the same amendment-result contract the runtime emits.
- **Guardrails:** keep the reviewed sample deterministic and avoid documenting fields the runtime does not actually ship.

### OP3 — Lock amendment proposal-context parity with targeted regression coverage
- **AK task:** `task:1713`
- **State:** staged behind OP2
- **Deliverable:** targeted integration/golden coverage proves CLI/runtime/sample parity for the amendment-result contract and makes future context regressions harder to reintroduce.
- **Guardrails:** harden the exact emitted contract rather than broadening test scope into unrelated legitimacy behavior.

## Queue discipline
- only `task:1711` should be ready right now; later slices stay sequenced behind it through AK dependencies
- do not revive deferred decision tasks `task:190-191` as a substitute for TG7 product work
- when OP1-OP3 land, refresh SG2 direction truth before promoting SG3 packaging/release work
