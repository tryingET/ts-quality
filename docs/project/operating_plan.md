---
summary: "Operating plan with TG10 active: package-contract hardening is complete, and release-surface alignment now runs through checklist, release-draft, and README tasks 1751-1753."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating Plan

Active strategic goal: **SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics**

Active tactical goal: **TG10 — Align public install and release surfaces with the proven staged-package path**

## Current state

The repo now has the hard package proof it was missing: `npm run smoke:packaging` stages the package, verifies the staged manifest and staged file boundaries, asserts the final `.tgz` file set, installs that tarball into a fresh temp project, and `npm run verify` gates the whole path. What is still missing is downstream operator and release copy that describes that proven staged-package path instead of relying on remembered manual sequencing or repo-only assumptions.

## Active operating slices

### OP1 — Align npm publishing checklist with the proven staged-package path
- **AK task:** `task:1751`
- **State:** active
- **Deliverable:** `docs/npm-publishing-checklist.md` describes the current deterministic staged-package operator path, including the proven helper and validation sequence, without implying a different publish topology than the repo actually ships.
- **Guardrails:** keep the slice documentation-native; do not widen it into release automation or build-topology changes.

### OP2 — Align the public release draft with the staged-package publish path
- **AK task:** `task:1752`
- **State:** staged behind OP1
- **Deliverable:** the release draft describes first-user and first-release behavior in terms that match the proven staged-package path rather than older repo-only quickstart assumptions.
- **Guardrails:** keep public claims downstream of verified package reality; do not market package ergonomics the repo has not yet proven.

### OP3 — Align README package-operator quickstart with the staged-package path
- **AK task:** `task:1753`
- **State:** staged behind OP2
- **Deliverable:** the README points package operators at the current truthful staged-package path while preserving repo-local developer workflow guidance.
- **Guardrails:** keep README truth additive and operator-facing; do not smuggle unrelated repo workflow churn into this slice.

## Queue discipline
- `task:1751` is the live ready slice for TG10
- `task:1752` depends on `task:1751`, and `task:1753` depends on `task:1752`
- completed package-contract tasks `task:1731-1733` stay closed unless the package contract itself changes again
- deferred contract-first tasks `task:190-191` remain out of the active SG3 execution wave
