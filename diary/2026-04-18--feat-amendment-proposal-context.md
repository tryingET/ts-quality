---
summary: "Session capture for task 1711, adding additive proposal/rule context to amendment decisions without inventing a second authority."
read_when:
  - "When resuming after task 1711"
  - "When checking why amendment decisions now include proposalContext"
type: "diary"
---

# 2026-04-18 — amendment proposal context

## What I Did
- Extended the amendment decision contract in `packages/evidence-model/src/index.ts` with additive `proposalContext` fields.
- Taught `evaluateAmendment()` in `packages/legitimacy/src/index.ts` to project proposal title/rationale, explicit evidence entries, per-change rule context, and the sensitivity basis behind the approval burden.
- Kept the proposal file and constitution canonical: the decision now projects concise context from those inputs instead of inventing a second amendment authority.
- Updated the product surface in `packages/ts-quality/src/index.ts` while keeping `runAmend()` behavior otherwise stable.
- Rebuilt `dist/` and verified the landed behavior with `npm run build`, `npm run typecheck`, `node --test test/amend-integration.test.mjs`, and a targeted CLI proof that emitted `proposalContext` for a sensitive risk-rule amendment.

## What Surprised Me
- Existing amendment integration tests were already tolerant of additive JSON growth, so the feature could land cleanly before the sample/doc and golden-parity follow-ons.

## Patterns
- The repo already had the right authority inputs for amendment review; the missing piece was not more evaluation logic, but a truthful projection of the proposal/rule context that the evaluator was already using.

## Crystallization Candidates
- → docs/learnings/ if we want a durable note on additive decision-context projection for legitimacy surfaces.
