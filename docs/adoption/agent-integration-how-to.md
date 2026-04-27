---
summary: "How-to guide for agents integrating ts-quality into a target repository without fake-green evidence."
read_when:
  - "You are wiring ts-quality into a target repo for the first time."
  - "You need a brownfield rollout recipe instead of only the core product semantics."
type: "how-to"
---

# Target-repo agent integration how-to

This guide is for agents and operators integrating `ts-quality` into a new or existing **target repository**.

Use `docs/harnessed-llm-operator-guide.md` instead when you are maintaining or reviewing the `ts-quality` repo itself. Use `docs/adoption/greenfield-bootstrap-how-to.md` instead when the target repo is new enough to shape its structure from day one. Use this guide only for brownfield-style target-repo adoption: selecting the first screened slice, adding repo-local control-plane files, running witnesses/checks, and recording rollout state.

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

For a concrete one-slice target-repo example, use `docs/adoption/minimal-external-walkthrough.md` after this guide.

This guide is about **adoption and rollout**, not replacing those contracts.

## One-slice rollout loop

Adoption improves by deleting ambiguity, not by widening scope. Keep one behavior-bearing slice open until its evidence debt is either resolved or explicitly routed.

For each slice:

1. **Select** one behavior-bearing implementation boundary.
2. **Bind** the repo-local control plane for that slice: config, invariants, governance/agents as needed, changed-scope mapping, and witness command if execution-backed support is claimed.
3. **Run** the target repo's normal quality command, then the narrow witness/check commands with explicit `--changed` and `--run-id` values.
4. **Classify** the result honestly: pass, warn, fail, unsupported, lexically-supported, or execution-backed. Do not rewrite evidence just to make the slice green.
5. **Route debt** before widening:
   - resolve blocking in-scope debt now,
   - defer out-of-scope debt with reason and reopen trigger, or
   - stop with the next blocking debt named as the next slice ceiling.
6. **Record** current-vs-target state in the target repo and update the central catalog only after repo-local truth is stable.

Do not compensate for ambiguous aliases, missing focused tests, bad coverage remapping, or governance uncertainty by broadening changed scope or searching unrelated tests. Narrow the slice or fix the target repo evidence first.

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

This recipe assumes the target repo already has structure, tests, and possible facade/runtime drift. If those constraints do not exist yet, stop here and use the greenfield guide instead of importing brownfield recovery work into a new repo.

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
- already testable with one focused test or witness command

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
# target repo's existing normal quality gate; name varies by repo
npm run check

# docs strictness when the target repo uses this docs contract
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict

# target repo wrapper commands around ts-quality
npm run screening:witness-refresh -- --changed <repo-local-path>
npm run screening:check -- --changed <repo-local-path> --run-id <repo-slice-id>
```

Always use an explicit changed path and run id in harnessed automation. Avoid relying on an ambient latest pointer when comparing or authorizing reviewed runs.

If the screening run fails on mutation pressure, coverage pressure, or governance, keep that truth.
A good integration can still yield a failing screening verdict when the repo risk is real.

### 10) Record rollout state in the repo

Create a repo-local overview such as:
- `docs/dev/ts-quality-current-vs-target.md`

That file should answer:
- what is live now
- what is next, or explicitly why no single slice is ready-next yet
- what is later
- what the target shape is for that repo

If more than one later candidate is still plausible, keep that truth:
- do not force a provisional ready-next slice just to fill the slot
- leave `readyNextSlices` empty in the central catalog until one candidate has a behavior-bearing implementation target, one focused witness command, and a boundary that is clear enough to review on its own
- treat that as a deliberate pause in widening, not as rollout failure

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
- at least one slice has a truthful run with explicit evidence status; do not require fake-green support before recording reality
- witness refresh works when execution witnesses are configured
- screening check works from the natural repo-facing changed paths
- runtime artifacts are ignored correctly
- the repo has a current-vs-target overview
- the repo is registered in the central catalog after repo-local truth is stable

At that point, widen the net one reviewable slice at a time.
