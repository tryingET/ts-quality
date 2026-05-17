---
summary: "Repo-local engineering-core adoption for ts-quality."
read_when:
  - "You start work that touches TypeScript tooling, validation evidence, reports, or repo control-plane files."
  - "You need repo-local deviations from shared engineering-core guidance."
type: "reference"
---

# ts-quality engineering guidance

## Upstream owner

Shared engineering lane and discipline guidance comes from `/home/tryinget/ai-society/core/engineering-core`.
This file records repo-local overrides for ts-quality. The repo `AGENTS.md` remains the operating authority for deterministic evidence, task workflow, product/runtime truth, and validation commands.

Machine-readable selection lives in `policy/engineering-lane.json`.

## Selected lane

- `ts` — TypeScript CLI/platform package with npm scripts and generated report/artifact surfaces.

```bash
uv tool -n run --from ~/ai-society/core/engineering-core engineering-core show ts
```

## Selected disciplines

- `validation`
- `testing`
- `security-privacy`
- `documentation`
- `dependency-governance`
- `local-first-data`
- `observability`
- `specification-and-dsls`
- `engineering-reasoning`

Catalog/list commands:

```bash
uv tool -n run --from ~/ai-society/core/engineering-core engineering-core catalog --pretty
uv tool -n run --from ~/ai-society/core/engineering-core engineering-core list-disciplines
uv tool -n run --from ~/ai-society/core/engineering-core engineering-core list-templates
```

## Repo-local deviations and emphasis

- Deterministic evidence and explainability are product semantics, not optional process guidance.
- Runtime behavior and CLI/report contracts must stay aligned with `README.md`, `ARCHITECTURE.md`, `docs/config-reference.md`, `docs/invariant-dsl.md`, `docs/ci-integration.md`, relevant package source, and regression tests.
- Artifact/report evolution should be additive-first whenever possible.
- Keep generated sample artifacts under `examples/artifacts/` intentional and reviewable when runtime behavior changes.
- Do not broaden evidence search just to improve scores; support invariants with aligned or explicitly scoped tests.

## Canonical local commands

- Root gate: `npm run verify`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Tests: `npm test`
- Smoke: `npm run smoke`
- Sample artifacts: `npm run sample-artifacts`
- Docs strictness when docs/handoff change: `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Validation evidence expectations

For engineering-core adoption metadata changes:

```bash
python -m json.tool policy/engineering-lane.json >/tmp/ts-quality-engineering-lane.json
node /home/tryinget/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
```

For code/runtime changes, follow `AGENTS.md` and run the smallest truthful npm/Justfile evidence for the touched surface.
