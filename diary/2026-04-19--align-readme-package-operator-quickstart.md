---
summary: "Updated the README quickstart so package operators see the proven staged-package path before the repo-from-source path."
read_when:
  - "When resuming after task 1753"
  - "When checking why the README now separates the package-operator path from repo-local source evaluation"
type: "diary"
---

# 2026-04-19 — Align README package-operator quickstart with staged-package path

## What I Did

- Reworked the README's "Try it now" section so it no longer starts from repo-only evaluation as though that were the public package operator path.
- Added a first step for proving the staged-package operator path with `npm run smoke:packaging` and publishing from `.ts-quality/npm/ts-quality/package` after the proof passes.
- Kept the repo-from-source path, but moved it into its own explicit second step so contributor evaluation and package-operator guidance are no longer blurred together.

## Candidates Considered

- **Chosen framing:** two explicit starts — package operator path and repo-from-source path — because the README serves both audiences and they now have different truthful first actions.
- **Rejected framing:** keep only the source-evaluation quickstart, because that hides the proven staged-package publish surface that TG10 is explicitly trying to align.

## Patterns

- README quickstarts become safer when they distinguish who the first action is for instead of assuming one operator surface fits every audience.
- Once the package path is proven, it should appear before repo-from-source guidance in package-facing docs.

## Validation

- `npm run smoke:packaging --silent`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Crystallization Candidates

- → docs/learnings/ if the repo wants a durable note on when a README should split package-operator quickstart from contributor quickstart.
