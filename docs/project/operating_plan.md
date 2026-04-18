---
summary: "Operating plan with TG9 active: staged package contract hardening is now the live wave, with manifest, staged-file, and tarball-file-set checks bound to tasks 1731-1733."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

Active tactical goal: **TG9 — Lock publish-correct staged package metadata and file boundaries**

## Current state

The repo now has deterministic packaged-behavior proof: `npm run smoke:packaging` stages the tarball, installs it into a fresh temp project, exercises the shipped CLI/API, and `npm run verify` gates that proof path. What is still missing is a package-contract surface strict enough to fail closed when the staged manifest, staged file boundaries, or final tarball contents drift away from the intended public package.

## Active operating slices

### OP1 — Assert staged package manifest contract
- **AK task:** `task:1731`
- **State:** active
- **Deliverable:** the staged package manifest fields and entrypoint bindings are checked against an intentional public-package contract instead of being whatever the helper happened to emit.
- **Guardrails:** keep the contract native to the staged package; do not widen the slice into release-copy or broader publish automation.

### OP2 — Assert staged package file-boundary contract
- **AK task:** `task:1732`
- **State:** staged behind OP1
- **Deliverable:** the staged package directory is checked for the intended publish surface before `npm pack`, including required runtime assets and explicit exclusions for repo-only material.
- **Guardrails:** encode exact allowed/disallowed staged paths; do not rely on the current `dist/` tree shape staying accidental truth.

### OP3 — Assert packed tarball file-set contract
- **AK task:** `task:1733`
- **State:** staged behind OP2
- **Deliverable:** the final `.tgz` contents are checked against the intended publish contract so `npm pack` cannot silently broaden, drop, or relink the public file set.
- **Guardrails:** prove tarball reality, not just stage-directory intent; keep the slice focused on the package contract rather than public-doc rewrite.

## Queue discipline
- `task:1731` is the live ready slice for TG9
- `task:1732` depends on `task:1731`, and `task:1733` depends on `task:1732`
- deferred contract-first tasks `task:190-191` remain out of the active SG3 execution wave
- when OP1-OP3 land, promote TG10 instead of inventing parallel SG3 tactical work
