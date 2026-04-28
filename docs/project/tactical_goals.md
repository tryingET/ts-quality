---
summary: "Tactical handoff after v0.2.0: TG21 public outside-repo adoption proof is active, TG22 artifact compatibility is staged behind it, and SG7 adoption-surface revalidation is complete history."
read_when:
  - "When planning the next sprint/week for ts-quality"
  - "When turning the current strategic state into bounded delivery waves"
type: "reference"
---

# Tactical Goals

Active strategic goal: **SG8 — Prove the public `0.2.0` outside-repo adoption loop with compact agent diagnostics**

SG7 is now complete. `0.2.0` shipped the adoption-friction package and the release process now enforces categorized breaking-change / agent-migration notes. The next unfinished repo-local concern is proving the public package loop against a real outside target repo using the new `doctor --machine`, remediation, and next-evidence-action surfaces instead of assuming the internal architecture is enough.

## Active tactical goals

### TG21 — Run a public `0.2.0` outside-repo adoption pilot from `doctor --machine`
- **Why this is active:** the designmd-foundry and pi-server pilots proved the first-witness habit before `0.2.0`, and the pi-server rerun identified exactly the friction that `0.2.0` now addresses. The next truthful tactical slice is to rerun the habit from the published package with the compact agent diagnostic as the first step.
- **Completion target:** an adoption evidence doc records a real outside-repo run using `ts-quality@0.2.0`, including `doctor --machine`, selected preset/config, bounded `check`, `explain`, next-evidence-action output, and one focused witness or a documented reason why the witness was not the next truthful step.
- **Materialized through:** next repo-local AK pilot task.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

### TG22 — Add artifact-schema compatibility and compact-machine-surface regression coverage
- **Why this is next:** `0.2.0` intentionally changes the run artifact schema version and adds new additive surfaces. Agents and parsers need fixtures and checks that keep older run artifacts readable where possible and keep `doctor --machine` compact rather than drifting into token-heavy JSON.
- **Completion target:** tests and docs cover legacy `0.1.0` run artifacts, current `0.2.0` run artifacts, and the `TSQ_DOCTOR_MACHINE_V1` line protocol contract.
- **Promotion trigger:** promote after TG21 identifies which compatibility edges matter most for outside-repo agents.
- **Eisenhower-3D:** importance `2`, urgency `2`, difficulty `2`

## Recently completed tactical history

### TG20 — Re-prove the staged-package operator path with a representative SG6 review flow
- **Completed by:** `task:1914-1917`.
- **What landed:** release preparation and verification prove the package path through Trusted Publishing/OIDC, staged package smoke, installed CLI/API/types, representative review/governance/legitimacy flows, public npm visibility, and GitHub Release attachment.

### TG19 — Refresh public operator and release surfaces for the richer SG6 legitimacy outputs
- **Completed by:** repo-local AK tasks `task:1791-1793` plus follow-through release-note and harnessed-LLM guidance tasks.
- **What landed:** README, publishing guidance, release notes, CLI command manifest, and harnessed-LLM guide now point at current run-bound legitimacy/adoption outputs and include regression coverage for release-note drift.

### TG18 — Project amendment evaluation context into human-readable outputs and reviewed sample artifacts
- **Completed by:** repo-local AK task `task:1767`.
- **What landed:** amendment evaluation now persists `.result.txt` alongside the authoritative JSON result, the reviewed sample bundle includes `amend.txt`, and README documents the additive contract.

### TG17 — Surface attestation verification outcomes in authorization artifacts and bundle surfaces
- **Completed by:** repo-local AK task `task:1766`.
- **What landed:** authorization artifacts and bundles now project run-scoped attestation verification outcomes in additive form instead of forcing operators to cross-reference a separate attestation review path manually.

## Tactical guardrails

- prove public-package adoption from target-repo truth rather than repo-internal assumptions
- use `doctor --machine` for harnessed LLM setup diagnostics and avoid token-heavy JSON unless a CI/report surface explicitly needs it
- keep adoption-facing operator surfaces downstream of exact run artifacts rather than marketing generic confidence claims
- keep additive-first contract growth intact: compatibility work should preserve older artifacts where truthful and require explicit migration notes where not
- do not add broad new semantic claims before the public `0.2.0` adoption loop is repeated
