---
summary: "Active handoff: AK #192 is complete; no ready repo-local follow-on SG2 slice is materialized yet, so the next session should decompose amendment/attestation-facing outputs first."
read_when:
  - "At the start of every work session"
  - "When resuming work in ts-quality after a pause"
type: "reference"
---

# Next Session Prompt

## SESSION TRIGGER (AUTO-START)
Reading this file is authorization to begin immediately.
Do not ask for permission to start.

## ACTIVE GOAL STACK
- **Strategic goal:** SG2 — carry the same evidence truth into governance/legitimacy decision surfaces that still compress authority too far
- **Tactical goal:** none materialized yet
- **Operating slice:** no ready repo-local follow-on SG2 task is materialized yet

## START HERE
1. Run `./scripts/ak.sh --doctor`
2. Confirm repo-local ready work with:
   ```bash
   ./scripts/ak.sh task ready --format json | jq '.[] | select(.repo == "/home/tryinget/ai-society/softwareco/owned/ts-quality")'
   ```
3. If readiness is still empty, audit amendment-facing results and attestation-review outputs, then materialize the next SG2 AK slice before coding.

## CURRENT QUEUE TRUTH
Ready now:
- none repo-local

Completed this session:
- `#192` — surface run-boundary evidence in authorization decisions

Deferred with AK binding this session:
- `#190` — automate AK-to-handoff projection sync
- `#191` — stabilize or untrack volatile verification artifacts

## READ-FIRST ORDER
1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `docs/project/strategic_goals.md`
5. `docs/project/tactical_goals.md`
6. `docs/project/operating_plan.md`
7. `docs/legitimacy-agent-licensing.md`
8. `docs/governance-constitution.md`
9. relevant amendment / attestation source + tests for the SG2 candidate slice

## EXECUTION RULES
- Keep `behaviorClaims[].evidenceSummary` as the additive authority.
- Do not invent a second evidence/report authority.
- Make the smallest end-to-end additive change that proves the claimed slice.
- Update `docs/project/*`, `next_session_prompt.md`, diary, and `governance/work-items.json` when queue truth changes.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, or say clearly that none is materialized yet
- move session narrative to `diary/`
- keep AK authoritative for live task state
