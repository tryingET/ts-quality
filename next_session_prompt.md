---
summary: "Active handoff: TG11 staged-release rehearsal is still live, with task 1756 ready to record the first-release decision after the successful rehearsal."
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
- **Strategic goal:** SG3 — prove first outside-repo adoption through deterministic packaging and release ergonomics
- **Tactical goal:** TG11 — rehearse the first public staged-package operator path from the aligned surfaces
- **Operating slice:** OP2 — record the first-release decision after the successful rehearsal (`task:1756`)

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
4. If `task:1756` is ready, record the explicit first-release decision from the rehearsal evidence before changing the package path again.

## CURRENT QUEUE TRUTH
Ready now:
- `#1756` — record first-release decision after staged-package rehearsal

Sequenced behind it:
- `#1758` — reflect first-release decision in release draft

Just completed:
- `#1757` — point handoff at first-release decision after rehearsal
- `#1755` — capture first staged-package release rehearsal
- `#1754` — promote TG11 after release-surface alignment completes
- `#1751` — align npm publishing checklist with staged-package proof path
- `#1752` — align release draft with staged-package publish path
- `#1753` — align README package-operator quickstart with staged-package path

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
7. `docs/releases/2026-04-19-staged-package-release-rehearsal.md`
8. `docs/npm-publishing-checklist.md`
9. `docs/releases/2026-03-20-v0.1.0-github-release-draft.md`
10. `scripts/pack-ts-quality.mjs`
11. `scripts/packaging-smoke.mjs`
12. `scripts/verify.mjs`

## EXECUTION RULES
- Keep the staged package downstream of the repo-root build; do not invent a second hidden build topology.
- Keep the first-release decision explicit and evidence-bound.
- Avoid letting local working-tree residue accidentally redefine what the package contains.
- Update `docs/project/*`, `next_session_prompt.md`, diary, and `governance/work-items.json` when queue truth changes.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
