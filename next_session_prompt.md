---
summary: "Active handoff: TG7 amendment-result context is now the live SG2 wave, with task 1711 ready and tasks 1712-1713 sequenced behind it."
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
- **Operating slice:** OP1 — surface additive proposal/rule context in amendment decisions (`task:1711`)

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
4. If `task:1711` is still ready, claim it and work the amendment-result contract before touching later slices.

## CURRENT QUEUE TRUTH
Ready now:
- `#1711` — surface additive proposal context in amendment decisions

Sequenced behind it:
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
7. `docs/legitimacy-agent-licensing.md`
8. `docs/governance-constitution.md`
9. `packages/evidence-model/src/index.ts`
10. `packages/legitimacy/src/index.ts`
11. `packages/ts-quality/src/index.ts`
12. `test/amend-integration.test.mjs`

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
