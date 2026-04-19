---
summary: "Active handoff: TG10 release-surface alignment is now live, with task 1751 ready to align the npm publishing checklist with the proven staged-package path."
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
- **Tactical goal:** TG10 — align public install and release surfaces with the proven staged-package path
- **Operating slice:** OP1 — align npm publishing checklist with the proven staged-package path (`task:1751`)

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
4. If `task:1751` is ready, claim it and align `docs/npm-publishing-checklist.md` with the proven staged-package path before touching the release draft or README.

## CURRENT QUEUE TRUTH
Ready now:
- `#1751` — align npm publishing checklist with staged-package proof path

Sequenced behind it:
- `#1752` — align release draft with staged-package publish path
- `#1753` — align README package-operator quickstart with staged-package path

Just completed:
- `#1744` — promote TG10 in direction and handoff docs
- `#1731` — assert staged package manifest contract
- `#1732` — assert staged package file-boundary contract
- `#1733` — assert packed tarball file-set contract

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
7. `docs/npm-publishing-checklist.md`
8. `docs/releases/2026-03-20-v0.1.0-github-release-draft.md`
9. `packages/ts-quality/package.json`
10. `scripts/pack-ts-quality.mjs`
11. `scripts/packaging-smoke.mjs`
12. `scripts/verify.mjs`

## EXECUTION RULES
- Keep the staged package downstream of the repo-root build; do not invent a second hidden build topology.
- Keep public docs and release promises downstream of the proven staged-package path.
- Preserve explicit package-contract expectations instead of falling back to accidental workspace layout assumptions.
- Update `docs/project/*`, `next_session_prompt.md`, diary, and `governance/work-items.json` when queue truth changes.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
