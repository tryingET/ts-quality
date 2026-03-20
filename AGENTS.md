---
summary: "Repo operating contract for ts-quality (deterministic evidence, explainable trust, and additive-first artifact/report contracts)."
read_when:
  - "You start work in this repo"
  - "You need repo-wide guardrails, validation commands, or root/package boundary rules"
type: "reference"
---

# AGENTS.md — ts-quality

## TRUE INTENT
Build a deterministic TypeScript quality platform that turns explicit software-change evidence into explainable trust.
The monorepo root is the control plane; package-specific runtime behavior belongs in package source, tests, and docs.

## Root/package boundary
- Root owns shared docs, examples, sample-artifact generation, repo-wide verification, and the unified `ts-quality` CLI surface.
- `packages/*` are monorepo members, not standalone repos.
- Put package-specific execution details in package source/tests/docs rather than duplicating them here.
- Treat `docs/_core/**` as immutable snapshot context.

## Core axioms (non-negotiable)
1. **Deterministic evidence axiom**: identical inputs produce identical artifacts and verdicts.
2. **Focused-evidence axiom**: invariant support must come from aligned or explicitly-scoped tests, not repo-global keyword coincidence.
3. **Additive-schema axiom**: run artifact and config changes should be additive-first whenever possible.
4. **Explainability axiom**: every score, block, waiver, attestation, override, or amendment must trace back to explicit evidence in artifacts and reports.
5. **Architecture-boundary axiom**: external workflow doctrine does not become core semantics unless this repo explicitly adopts it as native design.

## Repo-wide rules
- No secrets in git.
- Keep docs aligned with shipped behavior and CLI/report surfaces.
- Alpha-stage policy: before 1.0, breaking changes are allowed when they improve deterministic evidence, safety, trust-boundary correctness, or contract clarity; record the decision in `docs/decisions/`, reflect it in `README.md`, and mark it in `CHANGELOG.md`.
- When runtime behavior changes, rebuild `dist/` and keep generated sample artifacts under `examples/artifacts/` intentional and reviewable.
- Keep invariant reasoning deterministic and inspectable; do **not** broaden evidence search just to make outputs greener.
- Treat coverage, mutation, invariant, governance, and legitimacy as separate evidence layers even when they roll up into one verdict.
- Do **not** market semantic depth beyond what deterministic evidence actually supports.

## AK workflow
- Agent Kernel is authoritative for live repo task state.
- `governance/work-items.json` is a checked-in projection/planning artifact, not the live queue.
- This repo now ships a repo-local AK launcher copied from the working `ts-quality-tools` pattern:
  - canonical entrypoint: `./scripts/ak.sh`
  - compatibility alias: `./scripts/ak-v2.sh`
  - doctor / runner resolution: `./scripts/ak.sh --doctor`
  - ready tasks: `./scripts/ak.sh task ready --format json`
  - inspect repo task detail: `./scripts/ak.sh task list --format json --verbose | jq '.[] | select(.repo == "/home/tryinget/ai-society/softwareco/owned/ts-quality" and .id == <TASK_ID>)'`
  - claim a repo-scoped task: `./scripts/ak.sh task claim <TASK_ID> --agent pi`

## Product/runtime source of truth
For exact shipped behavior, read and keep aligned:
- `README.md`
- `ARCHITECTURE.md`
- `docs/config-reference.md`
- `docs/invariant-dsl.md`
- `docs/ci-integration.md`
- relevant package source under `packages/**/src/*.ts`
- relevant regression tests under `test/*.mjs`
- latest relevant `docs/learnings/` and `diary/` entry for the slice you are touching

`docs/project/*` exists for durable direction. Use `purpose.md`, `mission.md`, `vision.md`, `strategic_goals.md`, `tactical_goals.md`, and `operating_plan.md` as the current direction layer, but do **not** treat project prose as richer authority than the README, architecture, runtime code, or current durable learnings when they diverge.

## Validation contract
- Root gate: `npm run verify`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`
- Smoke: `npm run smoke`
- Sample artifacts: `npm run sample-artifacts`
- Docs strictness when docs/handoff change: `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Operator workflows
- Initialize config: `npx ts-quality init`
- Run the main evaluation: `npx ts-quality check`
- Explain the latest run: `npx ts-quality explain`
- Render report/trend output: `npx ts-quality report`, `npx ts-quality trend`
- Produce planning/governance output: `npx ts-quality plan`, `npx ts-quality govern`
- Authorization and attestations: `npx ts-quality authorize --agent <agent>`, `npx ts-quality attest sign ...`
- Amendment flow: `npx ts-quality amend --proposal <proposal.json>`

## Read order
1. `README.md`
2. `ARCHITECTURE.md`
3. `next_session_prompt.md`
4. `docs/config-reference.md`
5. `docs/invariant-dsl.md`
6. `docs/ci-integration.md`
7. latest relevant `docs/learnings/` or `diary/` entry
8. relevant package source under `packages/`
9. relevant regression tests under `test/`

## Architecture-native direction
- Prefer smaller truthful evidence improvements over broader but noisier inference.
- Keep artifact/report evolution additive-first so old consumers do not break silently.
- Improve explainability by making evidence more explicit, not by inventing opaque confidence theater.
- Keep core semantics native to `ts-quality` rather than importing unrelated workflow doctrine.

## Knowledge flow
Session output -> `diary/` -> `docs/learnings/` -> docs/runtime contracts/tests/report surfaces.
A review is not complete until the same class of evidence ambiguity is harder to reintroduce.
