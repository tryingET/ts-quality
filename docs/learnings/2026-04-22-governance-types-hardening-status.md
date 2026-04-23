---
summary: "Repo-state-only status memo on governance hardening and type hardening in ts-quality."
read_when:
  - "You need a current snapshot of governance/type hardening status"
  - "You are deciding whether to keep slicing governance work or shift focus"
type: "learning"
---

# Governance and Type Hardening Status

## Executive summary

Based on current repo state, `ts-quality` is now **substantially hardened on governance semantics** and **partially hardened on TypeScript discipline**.

Governance hardening is no longer shallow or toy-level: the repo now ships a dedicated import-provenance subsystem, boundary evaluation fails closed on opaque dynamic imports, approvals can bind to exact runs, ownership rules are enforced, and packaging tests prove the governance runtime ships in the staged package.

Type hardening has also progressed, but it is less complete. The repo uses strong compiler settings (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`) and now relies on the real `@types/node` package instead of a local ambient shim. However, several core implementation packages still contain explicit `any` usage, especially outside the governance subsystem.

Bottom line: governance hardening appears far enough along that **continued broad governance slicing is no longer the highest-leverage default**. The main remaining hardening value is repo-wide type debt reduction, with only narrow governance backfill where concrete gaps still exist.

## Completed work

### Governance hardening completed

- `packages/governance/src/index.ts` now evaluates multiple rule kinds from one typed entrypoint:
  - `boundary`
  - `risk`
  - `approval`
  - `rollback`
  - `ownership`
- Boundary enforcement no longer depends on naive import matching. It now routes through:
  - `packages/governance/src/import-collector.ts`
  - `packages/governance/src/import-provenance.ts`
- The governance subsystem tracks import flow through a broad set of syntax forms, including:
  - static imports
  - `import = require(...)`
  - re-exports and export-all declarations
  - dynamic imports
  - aliased `require`
  - destructuring and aliased destructuring containers
  - property/element access on tracked containers
  - rest bindings
  - chained assignments
  - conditional, logical, and sequence expressions
- Boundary checks fail closed when governance cannot statically prove a non-literal dynamic import/require target is safe.
- Approval handling has been hardened to count only unique targeted approvals and to accept exact run-targeted approvals when `runId` is supplied.
- Ownership handling has been hardened to require either explicit owner approval or approval from an allowed agent.

### Governance regression and packaging hardening completed

- `test/governance.test.mjs` provides a large regression net over the boundary-analysis surface, especially aliasing and import-flow edge cases.
- `test/packaging.test.mjs` proves the package operator path, not just source-local behavior.
- Packaging expectations explicitly include the governance runtime artifacts:
  - `dist/packages/governance/src/index.*`
  - `dist/packages/governance/src/import-collector.*`
  - `dist/packages/governance/src/import-provenance.*`
- Packaging smoke also proves staged manifest contract, staged file boundaries, tarball contents, installed CLI behavior, installed API shape, and installed typecheck behavior.

### Type hardening completed

- `tsconfig.base.json` enables strong compiler discipline:
  - `strict: true`
  - `noImplicitAny: true`
  - `noUncheckedIndexedAccess: true`
  - `exactOptionalPropertyTypes: true`
  - `noImplicitOverride: true`
- `package.json` exposes an explicit `typecheck` command and a repo-level `verify` gate.
- `types/node/index.d.ts` is now only a deprecation stub; the repo has moved to the real `@types/node` package.
- The governance subsystem itself is meaningfully typed, with explicit interfaces such as:
  - `ImportReference`
  - `BindingScope`
  - `ValueProvenance`
- No `@ts-ignore` or `@ts-expect-error` markers were found in `packages/`, `types/`, or `scripts/` during this audit.

## Remaining risks / debt

### Remaining type debt

Type hardening is not finished. Explicit `any` usage remains in core implementation files outside governance, including:

- `packages/invariants/src/index.ts`
- `packages/ts-mutate/src/index.ts`
- `packages/crap4ts/src/index.ts`
- `packages/ts-quality/src/config.ts`
- `packages/evidence-model/src/index.ts`
- `packages/ts-quality/src/index.ts`

This is the clearest remaining hardening gap in the repo.

### Remaining governance debt

- Governance complexity is now large enough to be a maintenance concern in its own right:
  - `packages/governance/src/index.ts` is substantial
  - `packages/governance/src/import-collector.ts` is substantial
  - `packages/governance/src/import-provenance.ts` is substantial
  - `test/governance.test.mjs` is large and boundary-heavy
- The strongest direct regression density is around boundary/import provenance. `risk` and `rollback` are implemented in `packages/governance/src/index.ts`, but the current governance-specific unit file is weighted much more heavily toward boundary behavior than those rule families.
- `skipLibCheck` remains enabled in `tsconfig.base.json`, which is reasonable for velocity but means the repo is not at maximal strictness.

### Packaging and typing boundary

- The package surface is strongly tested, but most of the remaining type hardening work is internal implementation quality rather than public API typing.
- The installed-package type proof in `test/packaging.test.mjs` is meaningful, but it does not eliminate internal `any` debt in source packages.

## Does continued governance slicing still make sense?

Only in a narrow sense.

Broad governance slicing no longer looks like the best default hardening strategy. The repo already has:

- a dedicated governance provenance subsystem
- broad boundary regression coverage
- fail-closed behavior on opaque import targets
- exact run-bound approval handling
- ownership rule enforcement
- package-level proof that governance artifacts ship and work

That means governance is no longer the most obviously underbuilt part of the system. Additional governance slicing should now be justified by one of these triggers:

- a concrete false positive or false negative
- a targeted backfill for `risk` or `rollback`
- a maintainability refactor that simplifies the current governance subsystem without widening semantics

Without that kind of trigger, more governance slicing is likely to add complexity faster than it adds trust.

## Recommendation with rationale

### Recommendation

**Stop broad governance slicing. Continue targeted governance maintenance only. Continue type hardening aggressively.**

### Rationale

1. **Governance hardening appears sufficiently mature for this phase.**
   The repo already contains real semantic hardening and a large regression net around the hardest governance surface: import-boundary enforcement.

2. **The main remaining hardening value is now in typing, not governance breadth.**
   The biggest visible debt is the remaining `any` usage across core packages outside governance.

3. **Further governance slicing now risks diminishing returns.**
   The governance subsystem is already large and specialized. More slices should be driven by concrete misses, not by the existence of the subsystem alone.

4. **A balanced next step is clear.**
   Shift the main hardening lane to reducing `any` and improving internal type precision in:
   - `packages/invariants/src/index.ts`
   - `packages/ts-mutate/src/index.ts`
   - `packages/crap4ts/src/index.ts`
   - `packages/ts-quality/src/config.ts`
   - `packages/evidence-model/src/index.ts`
   - `packages/ts-quality/src/index.ts`

A small governance backfill still makes sense for direct `risk` and `rollback` rule coverage, but governance should no longer be the default slicing axis.

## Audit basis

This memo is based on current repo state only, primarily:

- `README.md`
- `tsconfig.base.json`
- `tsconfig.json`
- `package.json`
- `packages/ts-quality/package.json`
- `types/node/index.d.ts`
- `packages/governance/src/index.ts`
- `packages/governance/src/import-collector.ts`
- `packages/governance/src/import-provenance.ts`
- `test/governance.test.mjs`
- `test/packaging.test.mjs`
- repo-wide grep for explicit `any` / TS escape markers in source packages
