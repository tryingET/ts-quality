---
summary: "ADR choosing a data-only module contract for ts-quality config and repo-local support files instead of executable module evaluation."
read_when:
  - "When changing how ts-quality loads config or repo-local support files"
  - "When deciding what syntax is allowed inside ts-quality.config.* or .ts-quality/*.ts files"
system4d:
  container:
    boundary: "Config and repo-local support-file loading contract for ts-quality."
    edges:
      - "../config-reference.md"
      - "../../README.md"
      - "../../CHANGELOG.md"
  compass:
    driver: "Eliminate executable config loading as a trust-boundary weakness while keeping a readable authoring format."
    outcome: "A durable rule that config/support modules are data-only and never executed."
  engine:
    invariants:
      - "Config and repo-local support modules are parsed, not executed."
      - "Allowed syntax is data-only and deterministic."
      - "Breaking away from executable config is acceptable during alpha when documented clearly."
  fog:
    risks:
      - "Some early users may rely on executable config patterns."
      - "The data-only surface may still need future refinement."
      - "If docs lag, users may not understand why formerly valid code is now rejected."
---

# ADR-2026-03-19 — Config and repo-local support modules are data-only, not executable

## Status
- accepted
- date: 2026-03-19
- owner: ts-quality maintainers
- reviewers: operator, pi
- related_docs:
  - README.md
  - docs/config-reference.md
  - CHANGELOG.md
  - docs/decisions/2026-03-19-alpha-breaking-changes-allowed.md

## Executive summary
`ts-quality` no longer executes project config and repo-local support modules as code. Instead, `.ts`, `.js`, `.mjs`, and `.cjs` config-like files are parsed under a data-only contract. This removes a trust-boundary weakness while preserving a readable authoring surface for literal configuration data.

## Context

- current state:
  - `ts-quality` previously transpiled and executed config-like files through `vm`
  - that gave project code execution privileges at config load time
- evidence / incidents / constraints:
  - config loading was identified as the sharpest remaining trust-boundary issue after the broader repo-contract hardening work
  - the repo is still alpha, so backward compatibility is not the governing constraint
  - maintainers still want a readable config format beyond raw JSON where useful
- why this decision is needed now:
  - the repo needed an exact replacement contract for task `#193`
  - the previous executable model undermined the deterministic and safety-first posture the product claims elsewhere

## Problem statement

Executing project-owned TS/JS config modules creates an avoidable trust boundary and makes configuration semantics broader than necessary. The repo needs a durable rule for what config/support files may contain and how they are loaded.

## Decision drivers

- trust-boundary hardening
- deterministic loading semantics
- readability of checked-in config
- alpha-stage willingness to break unsafe legacy behavior
- keeping config semantics narrow and explainable

## Decision

`ts-quality` now treats config and repo-local support modules as **data-only modules**.

That means:
- `.json` files remain plain JSON
- `.ts`, `.js`, `.mjs`, and `.cjs` files are parsed, not executed
- allowed syntax is limited to deterministic data construction such as:
  - object literals
  - array literals
  - string / number / boolean / null literals
  - top-level `const` bindings that resolve to data
  - object and array spread over already-resolved data
  - `export default ...`
  - `module.exports = ...`
- rejected syntax includes executable or runtime-dependent behavior such as:
  - function calls
  - runtime property access like `process.env.X`
  - imperative module bodies
  - non-`const` declarations

This contract applies to:
- `ts-quality.config.*`
- repo-local support files loaded through the same path, such as:
  - `.ts-quality/invariants.*`
  - `.ts-quality/constitution.*`
  - `.ts-quality/agents.*`
  - approvals / waivers / overrides files when authored as JS/TS modules instead of JSON

### Scope
- in scope:
  - config loading semantics
  - repo-local support file loading semantics
  - allowed syntax in code-like config files
- out of scope:
  - broader plugin or extension execution models
  - secret management
  - post-1.0 compatibility guarantees

### Ownership / seam / policy notes
- owner: ts-quality maintainers
- allowed seams:
  - future expansion of the data-only grammar when it remains deterministic and non-executable
  - migration from `.ts`/`.js` data-only files to `.json` if desired later
- prohibited patterns:
  - executing repo code during config load
  - reading runtime environment directly from config expressions
  - hiding imperative behavior inside config/support files

## Alternatives considered

### Option A — Keep executable TS/JS config loading
- description:
  - continue transpiling and evaluating config modules at runtime
- pros:
  - maximally flexible
  - minimal migration effort for users who want code in config
- cons:
  - preserves a trust-boundary weakness
  - allows hidden side effects
  - broadens config semantics beyond what the product needs
- why not chosen:
  - flexibility here is not worth the safety and explainability cost

### Option B — Switch everything to JSON-only
- description:
  - only `.json` would be accepted for config/support files
- pros:
  - simplest trust model
  - easiest to explain
- cons:
  - more disruptive than necessary during migration
  - loses a readable typed-like authoring surface for literal data
- why not chosen:
  - too restrictive for the current repo ergonomics when a data-only parser captures most benefits

### Option C — Parse TS/JS/MJS/CJS as data-only modules
- description:
  - preserve familiar file types but narrow them to deterministic data syntax
- pros:
  - removes code execution at load time
  - keeps current authoring style mostly intact for literal exports
  - stays compatible with generated/exported data-only files
- cons:
  - some previously valid dynamic patterns now break
  - parser surface must be maintained explicitly
- why chosen or not chosen:
  - chosen because it gives most of the safety benefit with less authoring disruption than JSON-only

## Consequences

### Positive
- config loading is no longer an arbitrary code-execution surface
- repo-local support files now obey a narrower, more explainable contract
- the product’s deterministic posture is more internally consistent

### Costs
- dynamic config patterns stop working
- users must express values as resolved data instead of code
- parser support becomes part of the product surface

### Risks
- some valid-looking TS/JS patterns may now be rejected unexpectedly
- users may misunderstand “TS config supported” to mean “arbitrary TS logic supported” unless docs are explicit

### Mitigations
- document the contract in README, config-reference, and changelog
- add regression tests for allowed and rejected patterns
- prefer clear error messages for unsupported expressions or statements

## Migration / rollout

- phase 1:
  - replace executable loading with data-only parsing
  - keep `.ts` / `.js` / `.mjs` / `.cjs` support for literal exports
- phase 2:
  - update docs and examples to make the new contract explicit
  - reject unsupported executable patterns with deterministic errors
- rollback / escape hatch:
  - because the repo is alpha, the preferred rollback is not restoring executable loading by default; instead, refine the data-only grammar if a deterministic non-executable authoring pattern proves necessary

## Architecture fitness functions / validation

- invariant 1:
  - config loading never executes repo code
- invariant 2:
  - the same config file produces the same loaded value without depending on runtime side effects
- command checks:
  - `npm run build`
  - `npm test`
  - `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`
  - `npm run verify`
- test / review gates:
  - add regression coverage for accepted data-only forms and rejected executable forms
  - update docs whenever allowed syntax changes

## Follow-up decisions / open questions
- should the long-term target eventually become JSON-only after more alpha learning?
- should the data-only grammar explicitly support more constructs such as computed property names over bound constants?
- should config error messages surface a short migration hint for common rejected patterns like `process.env`?

## Supersession
- supersedes:
- superseded_by:
