---
summary: "Active handoff: SG3 packaging proof is now live, with task 1722 ready to codify staged tarball install smoke coverage."
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
- **Tactical goal:** TG8 — prove staged tarball install/load behavior from a fresh temp project
- **Operating slice:** OP1 — add staged tarball install smoke coverage (`task:1722`)

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
4. If `task:1722` is ready, claim it and codify staged tarball install smoke coverage before touching CLI/API proof hardening or verification gating.

## CURRENT QUEUE TRUTH
Ready now:
- `#1722` — add staged tarball install smoke coverage

Sequenced behind it:
- `#1723` — harden staged package CLI/API proof points
- `#1724` — gate staged tarball proof in repo verification

Just completed:
- `#1711` — surface additive proposal context in amendment decisions
- `#1712` — align amendment sample/docs with proposal-context contract
- `#1713` — add parity coverage for amendment proposal-context output

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
8. `packages/ts-quality/package.json`
9. `scripts/pack-ts-quality.mjs`
10. `scripts/verify.mjs`
11. `docs/releases/2026-03-20-v0.1.0-github-release-draft.md`

## EXECUTION RULES
- Keep the staged package downstream of the repo-root build; do not invent a second hidden build topology.
- Prove packaged behavior from a fresh temp project, not from workspace-relative paths that consumers will not have.
- Keep release/docs promises downstream of packaged proof.
- Update `docs/project/*`, `next_session_prompt.md`, diary, and `governance/work-items.json` when queue truth changes.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
