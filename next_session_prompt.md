---
summary: "Active handoff: SG4 authority-decision wave is live, with task 1760 ready to record the projection authority contract before verification-artifact contract work proceeds."
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
- **Strategic goal:** SG4 — settle repo-local projection and verification artifact authority without drifting from AK
- **Tactical goal:** TG13 — record explicit authority contracts for repo-local projections and verification artifacts
- **Operating slice:** OP1 — record the repo-local projection authority contract (`task:1760`)

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
5. If `task:1760` is ready, record the explicit projection-authority contract before resuming `task:190` or changing the handoff surfaces.

## CURRENT QUEUE TRUTH
Ready now:
- `#1760` — record repo-local projection authority contract

Sequenced behind it:
- `#1761` — record verification artifact contract

Just completed:
- `#1759` — promote SG4 authority-decision wave after release-story completion
- `#1758` — reflect first-release decision in release draft
- `#1756` — record first-release decision after staged-package rehearsal
- `#1755` — capture first staged-package release rehearsal

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
7. `docs/decisions/README.md`
8. `governance/README.md`
9. `VERIFICATION.md`
10. `scripts/verify.mjs`
11. `governance/work-items.json`

## EXECUTION RULES
- Keep AK authoritative for live task state.
- Keep `docs/project/*` and `next_session_prompt.md` downstream of that truth rather than pretending they are the runtime queue.
- Record authority decisions explicitly before resuming deferred implementation tasks `#190-191`.
- When queue truth changes, refresh `docs/project/*`, `next_session_prompt.md`, and `governance/work-items.json` together.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
