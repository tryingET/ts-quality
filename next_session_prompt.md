---
summary: "Active handoff: SG5 implementation wave is live, with task 190 preferred as the next slice and task 191 also ready as the sibling follow-on."
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
- **Tactical goal:** TG14 — implement the settled projection and verification artifact contracts
- **Operating slice:** OP1 — implement projection sync under the hybrid authority contract (`task:190`)

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
5. Start with `task:190`; keep `task:191` as the sibling follow-on once the projection-sync contract is implemented.

## CURRENT QUEUE TRUTH
Ready now:
- `#190` — automate AK-to-handoff projection sync
- `#191` — stabilize or untrack volatile verification artifacts

Preferred next slice:
- `#190` — implement projection sync under the newly recorded hybrid contract

Just completed:
- `#1762` — promote SG5 implementation wave after authority decisions land
- `#1760` — record repo-local projection authority contract
- `#1761` — record verification artifact contract
- `#1759` — promote SG4 authority-decision wave after release-story completion

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
12. `governance/work-items.json`

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
