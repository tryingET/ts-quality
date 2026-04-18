---
summary: "Active handoff: task 1711 landed additive amendment proposalContext, and task 1712 is now the live TG7 follow-on for reviewed sample/doc alignment."
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
- **Strategic goal:** SG2 — carry ts-quality's evidence-native trust model into governance and legitimacy decision surfaces that still compress authority too far
- **Tactical goal:** TG7 — make amendment decisions carry additive proposal/rule context
- **Operating slice:** OP2 — align the reviewed amendment artifact and operator docs with the proposal-context contract (`task:1712`)

## START HERE
1. Run `ak --doctor`
2. Refresh repo direction truth:
   ```bash
   ak direction import
   ak direction check
   ak direction export
   ```
3. Confirm repo-local readiness:
   ```bash
   ak task ready --format json | jq '.[] | select(.repo == "/home/tryinget/ai-society/softwareco/owned/ts-quality")'
   ```
4. If `task:1712` is ready, claim it and align the reviewed amendment sample/docs before touching parity hardening.

## CURRENT QUEUE TRUTH
Ready now:
- `#1712` — align amendment sample/docs with proposal-context contract

Sequenced behind it:
- `#1713` — add parity coverage for amendment proposal-context output

Just completed:
- `#1711` — surface additive proposal context in amendment decisions

Still deferred with AK binding:
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
9. `examples/artifacts/governed-app/amend.json`
10. `scripts/generate-samples.mjs`
11. `README.md` amendment/legitimacy sections

## EXECUTION RULES
- Keep `behaviorClaims[].evidenceSummary`, the amendment proposal, and the constitution as the additive authority.
- Do not invent a second evidence/report authority.
- Make the smallest end-to-end additive change that proves the claimed slice.
- Update `docs/project/*`, `next_session_prompt.md`, diary, and `governance/work-items.json` when queue truth changes.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
