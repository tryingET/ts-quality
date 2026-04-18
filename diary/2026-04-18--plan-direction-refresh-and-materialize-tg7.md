---
summary: "Session capture for refreshing ts-quality's direction ladder into an AK-backed TG7 amendment-output wave with tasks 1711-1713."
read_when:
  - "When resuming after the 2026-04-18 direction refresh"
  - "When checking why TG7 and tasks 1711-1713 became the active SG2 path"
type: "diary"
---

# 2026-04-18 — direction refresh and TG7 materialization

## What I Did
- Re-read the repo direction stack (`vision`, `strategic_goals`, `tactical_goals`, `operating_plan`) against README, architecture, AK truth, and the last repo-local tasks.
- Treated the current concern as execution-first rather than contract-first because the repo already had enough owner-side binding to say what the next SG2 product wave should be: amendment-facing results still compress proposal/rule context too far.
- Refreshed `docs/project/strategic_goals.md` so the strategic layer now names one active SG2 wave and one next SG3 adoption wave in a form `ak direction` can actually import.
- Rewrote `docs/project/tactical_goals.md` into one explicit SG2 child set: completed TG5/TG6 plus active TG7.
- Rewrote `docs/project/operating_plan.md` into one explicit TG7 child set with three operating slices instead of a prose-only "none materialized yet" posture.
- Materialized repo-local AK tasks `1711-1713` and chained them so only the first slice is ready.
- Updated `next_session_prompt.md` so startup now includes `ak direction import/check/export` and points at `task:1711` rather than a generic audit instruction.

## Candidates Considered
- **Chosen active tactical wave:** amendment-result context parity, because `runAmend` still emits a verdict-only decision even though proposal title/rationale, exact rule actions, evidence list, and approval-burden basis are already available at evaluation time.
- **Kept as completed siblings:** authorization evidence context (`task:192`) and attestation verification context (`task:195-197`) because those slices are already landed and contract-bearing.
- **Kept as next strategic, not active tactical work:** packaging/release ergonomics, because npm-pack/publish adoption is real but less urgent than the still-compressed SG2 legitimacy surface.
- **Explicitly excluded:** deferred decision tasks `190-191`, speculative broader legitimacy redesign, and unrelated ROCS/tooling residue from task `326`.

## Patterns
- The repo had durable direction prose, but the lower layers had stalled at "none materialized yet" even though repo-local work was clearly still unfinished.
- `ak direction` only becomes useful here when the docs use one active SG, one active TG, and one active OP with parented done/current/next siblings.
- The honest next move was not another abstract planning note; it was creating a small AK-backed child set for the next product wave.

## Crystallization Candidates
- → docs/learnings/ if the repo wants a durable note on converting prose-only direction into an AK-backed active child set without inventing speculative backlog.
