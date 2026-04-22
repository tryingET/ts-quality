---
summary: "How-to guide for agents integrating ts-quality into a new project."
read_when:
  - "You are wiring ts-quality into a repo for the first time."
  - "You need a brownfield rollout recipe instead of only the core product semantics."
type: "how-to"
---

# Agent integration how-to

This guide is for agents and operators integrating `ts-quality` into a new repository.

Use it when the question is not just _how does ts-quality work?_ but instead:
- which file should be screened first?
- how do I keep the rollout narrow and reviewable?
- where does repo-local truth live vs central overview?
- how do I avoid fake-green evidence in a brownfield repo?

Canonical product semantics still live in:
- `README.md`
- `docs/invariant-dsl.md`
- `docs/config-reference.md`
- `docs/ci-integration.md`

This guide is about **adoption and rollout**, not replacing those contracts.

## Authority model

Keep the layers separate:

- **repo-local truth** lives in the integrated repo
  - recommended file: `docs/dev/ts-quality-current-vs-target.md`
- **repo-local control plane** lives with that repo
  - for example: `ts-quality.config.json`, `.ts-quality/**`, `scripts/screening/**`
- **central overview** lives here in `ts-quality`
  - `docs/adoption/repo-screening-catalog.json`
  - `docs/adoption/repo-screening-catalog.md`

The central catalog is downstream visibility, not the authority for any one repo.

## Brownfield rollout recipe

### 1) Inventory the behavior-bearing boundaries

Before writing config, inspect the target repo and identify:
- high-risk implementation files
- focused contract tests that already exist
- whether tests execute authored source or built runtime (`dist/**`, `lib/**`, etc.)
- facade barrels or public entrypoints that should stay aliases rather than screening targets

Prefer files with real behavior and meaningful failure modes over export glue.

### 2) Pick one narrow first slice

Choose **one** slice that is:
- behavior-bearing
- high enough value to matter
- small enough to review cleanly
- already testable with one focused witness command

Good first slices usually look like:
- fail-closed dispatch paths
- error-surface helpers
- bounded filesystem helpers
- deterministic config-shaping logic

Bad first slices usually look like:
- facade/export barrels with almost no logic
- broad orchestrator surfaces that mix too many concerns
- half-implemented areas whose runtime contract is still moving

### 3) Screen the implementation file, not the facade barrel

If the repo exposes a facade such as `src/foo.ts` but the real logic lives in `src/foo-core.ts`, screen the implementation file.

If operators or CI naturally touch the facade path, add **explicit normalization** from:
- facade source path -> implementation path
- runtime built path -> implementation path

Keep this mapping repo-owned and deterministic.
Do **not** teach `ts-quality` to guess these aliases heuristically.

### 4) Decide whether the slice is single-file or a small cluster

A slice may be:
- **single-file** — one implementation file owns the behavior, or
- **clustered** — one behavior claim spans a few tightly coupled implementation files

Use a cluster only when one behavior contract is genuinely split across a small implementation set.
Do not widen to a cluster just because it is convenient.

### 5) Add the repo-local control plane

Typical repo-local files:
- `ts-quality.config.json`
- `.ts-quality/invariants.ts`
- `.ts-quality/constitution.ts`
- `.ts-quality/agents.ts`
- `.ts-quality/approvals.json`
- `.ts-quality/waivers.json`
- `.ts-quality/overrides.json`
- `.ts-quality/witnesses/README.md`
- repo wrapper scripts such as `scripts/screening/*`

Keep repo-local docs DRY:
- record only repo-specific integration truth there
- link back here for canonical `ts-quality` semantics

### 6) If tests run built runtime, keep screening on authored source

For TypeScript brownfield repos, tests often execute built output under `dist/**`.
That is fine, but do **not** let that drift screening away from authored source.

Recommended pattern:
- screen `src/**`
- run tests against built runtime
- collect LCOV from the built runtime
- remap coverage back onto `src/**` using source maps
- then run `ts-quality`

A path-only `SF:` rewrite is not enough when generated line numbers diverge from source line numbers.
Use real source-map line remapping if the repo depends on dist-backed runtime tests.

### 7) Add one focused witness command

For each slice:
- choose one focused contract test or witness command
- wire it through the invariant scenario
- make sure witness generation writes:
  - witness artifact
  - sibling `.receipt.json` sidecar

Do not make the witness command broad just because the repo has many tests.
Broad test corpora can still be used as the runtime test baseline, but the witness should stay focused.

### 8) Keep runtime artifacts out of git

Ignore generated artifacts such as:
- coverage output
- `.ts-quality/runs/`
- `.ts-quality/materialized/`
- `.ts-quality/attestations/`
- `.ts-quality/keys/`
- generated witness and receipt JSON

Keep only committed control-plane files and the witness-directory README.

### 9) Verify the slice truthfully

Minimum truthful verification usually looks like:

```bash
npm run check
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
npm run screening:witness-refresh -- --changed <repo-local-path>
npm run screening:check -- --changed <repo-local-path> --run-id <repo-slice-id>
```

If the screening run fails on mutation pressure, coverage pressure, or governance, keep that truth.
A good integration can still yield a failing screening verdict when the repo risk is real.

### 10) Record rollout state in the repo

Create a repo-local overview such as:
- `docs/dev/ts-quality-current-vs-target.md`

That file should answer:
- what is live now
- what is next
- what is later
- what the target shape is for that repo

### 11) Register the repo in the central catalog

Use the template:
- `docs/adoption/repo-screening-entry.template.json`

Then register the repo:

```bash
node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json
node scripts/register-screening-catalog.mjs --check
```

This keeps the central overview synchronized without introducing a database too early.

## Anti-patterns

Avoid these:
- screening facade barrels when the real logic lives elsewhere
- widening to the whole repo before one slice is trustworthy
- fuzzy alias inference instead of explicit repo-owned normalization
- duplicating canonical `ts-quality` semantics into every integrated repo
- promoting the central catalog into repo-local authority
- using a database before git-tracked repo truth and a central catalog stop being enough

## Definition of a good first integration

A new repo integration is in good shape when:
- at least one slice is live and supported
- witness refresh works
- screening check works from the natural repo-facing changed paths
- runtime artifacts are ignored correctly
- the repo has a current-vs-target overview
- the repo is registered in the central catalog

At that point, widen the net one reviewable slice at a time.
