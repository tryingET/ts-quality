---
summary: "Updated the npm publishing checklist so it points at the proven staged-package operator path instead of a hypothetical future publish strategy."
read_when:
  - "When resuming after task 1751"
  - "When checking why the npm publishing checklist now centers pack:ts-quality and smoke:packaging"
type: "diary"
---

# 2026-04-19 — Align npm publishing checklist with staged-package proof path

## What I Did

- Re-read `docs/npm-publishing-checklist.md` against the shipped packaging helpers and current smoke path.
- Removed wording that treated staged-package publish as merely one future option and rewrote the checklist around the current truthful operator path.
- Made the checklist explicit about the staged manifest contract, staged file-boundary contract, packed tarball file-set contract, and the end-to-end proof provided by `npm run smoke:packaging`.
- Updated the publish sequence so it now points at `.ts-quality/npm/ts-quality/package` as the package root that may be published after the proof step passes.

## Candidates Considered

- **Chosen framing:** document the staged-package path as current repo truth, because the helper and smoke proof already exist and are the safest operator guidance the repo can defend today.
- **Rejected framing:** keep presenting staged-package publish as just one strategy among peers, because that understates the fact that the repo already has one proven path and still does not support naive publish from `packages/ts-quality/`.

## Patterns

- Once packaging proof exists, release docs should stop speaking in architecture hypotheticals and start speaking in operator-truth sequences.
- The most useful docs alignment was not more publish ceremony, but making the contract checks visible: manifest, staged boundary, tarball boundary, install/load proof.

## Validation

- `npm run smoke:packaging --silent`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Crystallization Candidates

- → docs/learnings/ if the repo wants a durable note on how packaging docs should move from strategy discussion to operator-truth once a deterministic proof path exists.
