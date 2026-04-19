---
summary: "Captured the first staged-package release rehearsal, including a successful npm publish dry-run from the staged package root."
read_when:
  - "When resuming after task 1755"
  - "When checking what the staged-package rehearsal proved and what caveats were present"
type: "diary"
---

# 2026-04-19 — Capture staged-package release rehearsal

## What I Did

- Rehearsed the aligned public package path by running `npm run build`, `npm run smoke:packaging --silent`, and `npm publish --dry-run --access public` from `.ts-quality/npm/ts-quality/package`.
- Noticed a pre-existing unrelated local README working-tree diff would leak into the staged package because the helper copies `README.md` from the working tree.
- Temporarily stashed that unrelated README diff, reran the rehearsal against committed repo state, then restored the local diff afterward.
- Recorded the rehearsal result in `docs/releases/2026-04-19-staged-package-release-rehearsal.md`.

## Candidates Considered

- **Chosen rehearsal stop:** `npm publish --dry-run`, because it exercises the publish path without making a real registry mutation.
- **Rejected rehearsal basis:** using the dirty working tree as-is, because that would have made the staged package reflect a local README variant rather than the committed repo state.

## Patterns

- Packaging helpers that copy docs from the working tree make local doc residue part of the package unless the rehearsal explicitly controls for it.
- A publish dry-run from the staged package root is a much stronger release rehearsal than simply trusting that `npm pack` succeeded.

## Validation

- `npm run build`
- `npm run smoke:packaging --silent`
- `cd .ts-quality/npm/ts-quality/package && npm publish --dry-run --access public`
- `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Crystallization Candidates

- → docs/learnings/ if the repo wants a durable note on controlling working-tree doc residue when the publish helper copies README/LICENSE into the staged package.
