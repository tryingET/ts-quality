---
summary: "Active handoff: SG6 legitimacy-surface follow-through is live, with task 1766 next after SG5 closure and task 1767 staged behind it."
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
- **Strategic goal:** SG6 — return the active wave to core product/runtime evidence surfaces after SG5 closure
- **Tactical goal:** TG17 — surface attestation verification outcomes in authorization artifacts and bundle surfaces
- **Operating slice:** OP1 — surface attestation verification outcomes inside authorize evidence context and bundle artifacts (`task:1766`)

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
5. Start with `task:1766`; keep `task:1767` as the staged sibling follow-on behind it.

## CURRENT QUEUE TRUTH
Ready now:
- `#1766` — surface attestation verification outcomes inside authorize evidence context and bundle artifacts

Sequenced behind it:
- `#1767` — project amendment evaluation context into human-readable outputs and sample artifacts

Just completed:
- `#1765` — close SG5 or materialize the last SG5 follow-through
- `#1764` — align README operator guidance with handoff sync and verification guard surfaces
- `#1763` — promote TG15 after SG5 first-pass implementation lands
- `#190` — automate AK-to-handoff projection sync
- `#191` — stabilize or untrack volatile verification artifacts

## READ-FIRST ORDER
1. `AGENTS.md`
2. `README.md`
3. `ARCHITECTURE.md`
4. `docs/attestation-format.md`
5. `docs/project/strategic_goals.md`
6. `docs/project/tactical_goals.md`
7. `docs/project/operating_plan.md`
8. `packages/evidence-model/src/index.ts`
9. `packages/ts-quality/src/index.ts`
10. `test/authorization-integration.test.mjs`
11. `governance/work-items.json`

## EXECUTION RULES
- Keep AK authoritative for live task state.
- Keep `governance/work-items.json` exported from AK rather than hand-authored.
- Keep `docs/project/*` and `next_session_prompt.md` downstream of AK rather than turning them into generated runtime authority.
- Keep authorization/additive legitimacy surfaces downstream of exact run-bound attestation verification truth.
- If queue truth changes, refresh `docs/project/*`, `next_session_prompt.md`, and `governance/work-items.json` together.
- If docs change, run `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`.

## END-OF-SESSION
- keep this file short and current
- point it at the next real AK task, not vague backlog prose
- move session narrative to `diary/`
- keep AK authoritative for live task state
