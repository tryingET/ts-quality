---
summary: "Active handoff: TG9 package-contract hardening is now live, with task 1731 ready to codify the staged package manifest contract."
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
- **Tactical goal:** TG9 — lock publish-correct staged package metadata and file boundaries
- **Operating slice:** OP1 — assert staged package manifest contract (`task:1731`)

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
4. If `task:1731` is ready, claim it and codify the staged package manifest contract before touching staged file-boundary or tarball file-set checks.

## CURRENT QUEUE TRUTH
Ready now:
- `#1731` — assert staged package manifest contract

Sequenced behind it:
- `#1732` — assert staged package file-boundary contract
- `#1733` — assert packed tarball file-set contract

Just completed:
- `#1722` — add staged tarball install smoke coverage
- `#1723` — harden staged package CLI/API proof points
- `#1724` — gate staged tarball proof in repo verification

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
10. `scripts/packaging-smoke.mjs`
11. `scripts/verify.mjs`
12. `docs/releases/2026-03-20-v0.1.0-github-release-draft.md`

## EXECUTION RULES
- Keep the staged package downstream of the repo-root build; do not invent a second hidden build topology.
- Prove package-contract truth from the staged directory and the packed tarball, not from workspace-relative assumptions.
- Keep release/docs promises downstream of the proven package contract.
- Update `docs/project/*`, `next_session_prompt.md`, diary, and `governance/work-items.json` when queue truth changes.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
