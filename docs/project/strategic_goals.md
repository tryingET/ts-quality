---
summary: "Strategic handoff after v0.2.0: SG7 adoption-surface revalidation is complete, SG8 now proves the public 0.2.0 outside-repo adoption loop, and SG9 keeps artifact compatibility behind it."
read_when:
  - "When deciding the next major bets for ts-quality"
  - "When reconciling vision.md with the current repo-local direction posture"
type: "reference"
---

# Strategic Goals

Product-maturity context for the post-`0.2.0` sequence lives in [`product_posture.md`](product_posture.md); this file keeps the active strategic direction rather than becoming product-status or task truth.

## Active strategic goal

### SG8 — Prove the public `0.2.0` outside-repo adoption loop with compact agent diagnostics
- **Why now:** `0.2.0` is public and closes several adoption-friction gaps exposed by the designmd-foundry and pi-server pilots: configured LCOV generation is stronger, mutation survivors are actionable, next-evidence-action artifacts exist, built-output LCOV warnings are explicit, release notes now carry breaking-change / agent-migration guidance, and `doctor --machine` gives harnessed LLMs a compact setup diagnostic. The next production-readiness proof is not another internal feature; it is proving that a fresh outside repo can use the public package and these surfaces without hidden maintainer narration.
- **Success signal:** a real outside target repo can start from `npx -p ts-quality@0.2.0 ts-quality doctor --machine`, choose or adjust an init preset/config, run a bounded `check`, inspect `explain` / next-evidence-action output, and produce or refresh one focused witness with enough evidence that the remaining blocker is understandable from shipped artifacts.
- **Eisenhower-3D:** importance `3`, urgency `2`, difficulty `3`

## Next strategic goal

### SG9 — Stabilize artifact-schema compatibility and agent consumption contracts
- **Why next:** `0.2.0` intentionally bumps the run artifact schema and adds new downstream surfaces (`analysisWarnings`, `mutationRemediation`, `verdict.confidenceBreakdown`, `nextEvidenceAction`). Agents and CI consumers need explicit compatibility fixtures and migration checks so additive growth does not become another adoption regression.
- **Success signal:** tests and docs prove that supported readers tolerate older `0.1.0` run artifacts where possible, consume `0.2.0` artifacts intentionally, and point agents at the compact machine/line-protocol surfaces before they scrape prose.
- **Eisenhower-3D:** importance `2`, urgency `2`, difficulty `2`

## Recently completed strategic history

### SG7 — Re-test adoption-facing operator paths against the richer SG6 legitimacy surface
- **Completed by:** repo-local AK tasks including the SG7 documentation/proof work and the `0.2.0` release-readiness follow-through (`task:1914-1917`).
- **What landed:** public operator docs, release workflow, release notes, CLI manifest, and harnessed-LLM guidance now describe current run-bound legitimacy/adoption surfaces truthfully; `0.2.0` added `doctor`, init presets, actionable mutation remediation, next-evidence-action artifacts, source-vs-built coverage warnings, coverage-generation sidecars, categorized release notes with breaking-change / agent-migration guidance, and compact `doctor --machine` diagnostics.

### SG6 — Return the active wave to core product/runtime evidence surfaces after SG5 closure
- **Completed by:** repo-local AK tasks `task:1766-1767`.
- **What landed:** authorization artifacts now carry run-scoped attestation verification outcomes in additive `evidenceContext` / bundle surfaces, amendment evaluation now persists a concise human-readable summary alongside the authoritative JSON decision, and the reviewed sample bundle plus README were refreshed to keep those legitimacy surfaces downstream of exact run/proposal truth.

### SG5 — Implement the settled projection and verification artifact contracts
- **Completed by:** repo-local AK tasks `task:1763-1765`.
- **What landed:** the repo refreshed the active ladder after the first SG5 implementation pass, aligned README operator guidance with the settled handoff-sync / verification-artifact guard contract, then retired SG5 cleanly while promoting the next native product wave into AK-backed SG6 follow-through tasks `task:1766-1767`.

### SG4 — Settle repo-local projection and verification artifact authority without drifting from AK
- **Completed by:** repo-local AK tasks `task:1760-1761`.
- **What landed:** the repo now has explicit ADRs for the hybrid projection-authority contract and the checked-in verification-artifact contract, which resolved the authority questions that had kept `task:190-191` deferred.

### SG3 — Prove first outside-repo adoption through deterministic packaging and release ergonomics
- **Completed by:** repo-local AK tasks `task:1751-1758`.
- **What landed:** the repo aligned its staged-package operator surfaces, rehearsed the first public staged-package publish path through a real npm dry-run, recorded an explicit first-release go decision, and reflected that decision back into the release draft.

## Not current strategic goals

These matter, but they are not the top repo-level bets right now:
- adding broad new evidence layers before proving the public `0.2.0` adoption loop
- treating `doctor --machine` as a heavyweight JSON CI API rather than a compact harnessed-LLM diagnostic
- treating the existing staged-package smoke proof as if it already proves repeated real outside-repo adoption
- reopening generic control-plane cleanup when the visible gap is target-repo adoption proof and artifact-consumer compatibility
