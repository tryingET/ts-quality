---
summary: "Optional handoff for ts-quality when resuming without an exact AK task id."
read_when:
  - "You are resuming ts-quality work without an exact AK task id"
  - "You need lightweight repo orientation before choosing the next AK task"
type: "reference"
---

# Next Session Prompt

This file is optional handoff context.
If the operator supplies an exact AK task id, ignore this file and follow task truth + scope first.

## Use this file only when
- no exact AK task id was provided
- you need lightweight repo orientation before choosing work

## Start
1. Run `ak --doctor`
2. Check ready repo-local tasks:
   ```bash
   ak task ready --format json | jq '.[] | select(.repo == "/home/tryinget/ai-society/softwareco/owned/ts-quality")'
   ```
3. Choose the exact task in AK before reading broader handoff/project surfaces
4. Read `README.md`, `ARCHITECTURE.md`, and only the code/tests/docs needed for that task

## Guardrails
- AK is live task truth.
- `governance/work-items.json` is an exported projection, not the live queue.
- `docs/project/*` is optional direction context, not default startup for exact-task sessions.
- Do not update this file during normal implementation work.
- Update this file only when the repo's handoff contract changes materially.

## Optional deeper context
Read these only if the chosen task is meta/control-plane work or truly needs them:
- `docs/project/*`
- `governance/work-items.json`
- relevant `docs/learnings/` or `diary/`
