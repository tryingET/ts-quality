---
summary: "Active handoff: TG15 operator-surface follow-through is live, with task 1764 next after the direction refresh and task 1765 staged behind it."
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
- **Strategic goal:** SG5 — implement the settled projection and verification artifact contracts
- **Tactical goal:** TG15 — align operator-facing docs and handoff surfaces with the settled SG5 automation/guard contract
- **Operating slice:** OP2 — align README operator guidance with handoff sync and verification guard surfaces (`task:1764`)

## START HERE
1. Run `ak --doctor`
2. Refresh repo direction truth:
   ```bash
   ak direction import
   ak direction check
   ak direction export
   ```
3. Refresh the checked-in AK projection:
   ```bash
   ak work-items export
   ```
4. Confirm repo-local readiness:
   ```bash
   ak task ready --format json | jq '.[] | select(.repo == "/home/tryinget/ai-society/softwareco/owned/ts-quality")'
   ```
5. Start with `task:1764`; keep `task:1765` as the staged sibling follow-on behind it.

## CURRENT QUEUE TRUTH
Ready now:
- `#1764` — align README operator guidance with handoff sync and verification guard surfaces

Sequenced behind it:
- `#1765` — close SG5 or materialize the last SG5 follow-through

Just completed:
- `#1763` — promote TG15 after SG5 first-pass implementation lands
- `#190` — automate AK-to-handoff projection sync
- `#191` — stabilize or untrack volatile verification artifacts
- `#1762` — promote SG5 implementation wave after authority decisions land

## READ-FIRST ORDER
1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `docs/decisions/2026-04-19-projection-authority-contract.md`
5. `docs/decisions/2026-04-19-verification-artifact-contract.md`
6. `docs/project/strategic_goals.md`
7. `docs/project/tactical_goals.md`
8. `docs/project/operating_plan.md`
9. `governance/README.md`
10. `VERIFICATION.md`
11. `scripts/verify.mjs`
12. `scripts/handoff-sync.mjs`
13. `governance/work-items.json`

## EXECUTION RULES
- Keep AK authoritative for live task state.
- Keep `governance/work-items.json` exported from AK rather than hand-authored.
- Keep `docs/project/*` and `next_session_prompt.md` downstream of AK rather than turning them into generated runtime authority.
- Keep `VERIFICATION.md` and `verification/verification.log` generator-owned checked-in reference artifacts.
- If queue truth changes, refresh `docs/project/*`, `next_session_prompt.md`, and `governance/work-items.json` together.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
