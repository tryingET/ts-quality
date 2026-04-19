---
summary: "ADR defining which repo-local handoff/projection surfaces are generated from AK and which remain manually curated downstream projections."
read_when:
  - "When changing how ts-quality maintains docs/project/*, next_session_prompt.md, or governance/work-items.json"
  - "When deciding whether repo-local handoff surfaces should be generated from AK or curated manually"
system4d:
  container:
    boundary: "Repo-local direction/handoff and planning projection surfaces for ts-quality."
    edges:
      - "../../AGENTS.md"
      - "../project/strategic_goals.md"
      - "../project/tactical_goals.md"
      - "../project/operating_plan.md"
      - "../../next_session_prompt.md"
      - "../../governance/work-items.json"
      - "../../governance/README.md"
  compass:
    driver: "Keep AK authoritative for live queue truth without losing reviewable repo-local handoff surfaces."
    outcome: "A durable hybrid contract that distinguishes generated AK projections from manually curated downstream direction docs."
  engine:
    invariants:
      - "AK remains the live authority for repo-local task state."
      - "governance/work-items.json is an exported projection, not a hand-authored queue."
      - "docs/project/* and next_session_prompt.md remain manually curated downstream projections, reconciled against AK rather than generated as the runtime source of truth."
  fog:
    risks:
      - "Operators may still forget to refresh manual projections when queue truth changes."
      - "Generated projections can be mistaken for live authority if their contract is not stated clearly."
      - "Full auto-generation of narrative docs could collapse useful human framing into brittle mechanical summaries."
---

# ADR-2026-04-19 — Repo-local projection authority contract

## Status
- accepted
- date: 2026-04-19
- owner: ts-quality maintainers
- reviewers: operator, pi
- related_docs:
  - AGENTS.md
  - governance/README.md
  - next_session_prompt.md
  - docs/project/strategic_goals.md
  - docs/project/tactical_goals.md
  - docs/project/operating_plan.md

## Executive summary

`ts-quality` adopts a **hybrid projection contract** for repo-local handoff surfaces.

- **Agent Kernel (`ak`) is the live authority** for repo-local task state.
- **`governance/work-items.json` is a generated projection** exported from AK and must not be treated as hand-authored live truth.
- **`docs/project/*` and `next_session_prompt.md` remain manually curated downstream projections** that summarize and explain the active repo posture, but they must stay reconciled against AK via the direction workflow rather than becoming a second queue.

This rejects both extremes:
- treating all checked-in handoff docs as the live authority
- fully generating all narrative handoff docs from AK without preserving repo-specific explanation and selection

## Context

The repo already had an explicit split emerging in practice:

- `AGENTS.md` says AK is authoritative for live repo task state
- `AGENTS.md` also says `governance/work-items.json` is a checked-in projection/planning artifact, not the live queue
- `docs/project/*` and `next_session_prompt.md` are used as durable direction/handoff surfaces and are reconciled through `ak direction import|check|export`
- deferred `task:190` exists because automating those surfaces without a clear contract would risk changing authority boundaries accidentally

The unresolved question was whether all of these surfaces should be generated from AK, or whether some should remain manual while staying downstream of AK truth.

## Problem statement

Without an explicit contract, repo-local projection work can drift in two equally harmful directions:

1. **manual drift** — checked-in handoff docs stop matching AK task truth
2. **over-generation** — narrative handoff surfaces are treated as if they should be machine-derived from AK, collapsing useful human framing into a brittle export and making it easier to mistake those outputs for the runtime authority itself

The repo needs a durable rule for which surfaces are generated and which stay manual.

## Decision drivers

- keep AK authoritative for live queue truth
- keep checked-in review surfaces deterministic and inspectable
- preserve human-authored direction/handoff framing where that framing carries real value
- avoid manual editing of files that are already defined as projections from AK
- unblock future automation without silently rewriting authority boundaries

## Decision

`ts-quality` will use the following repo-local projection authority contract.

### 1) Live authority

**AK is authoritative for live repo task state.**

That includes readiness, claims, dependency truth, completion state, and task-native metadata.
No checked-in markdown or JSON artifact may supersede AK for those questions.

### 2) Generated projection

**`governance/work-items.json` is a generated AK projection.**

That means:
- it is exported from AK with `ak work-items export`
- it is checked in for repo-local planning visibility and schema validation
- it must **not** be hand-edited as if it were the live queue
- drift should be resolved by exporting from AK again, not by manually patching the JSON to match an intended story

### 3) Manually curated downstream projections

**`docs/project/*` and `next_session_prompt.md` remain manually curated downstream projections.**

That means:
- they stay checked in as repo-local direction/handoff artifacts
- they may include narrative explanation, sequencing rationale, and read-first guidance that AK does not natively store as a full generated document surface
- they must still remain downstream of AK truth rather than acting as a separate planning authority
- when queue truth changes materially, they must be refreshed in the same pass and reconciled with:
  - `ak direction import`
  - `ak direction check`
  - `ak direction export`

### 4) Automation boundary

Future automation is allowed to:
- export `governance/work-items.json`
- run direction reconciliation checks
- scaffold or assist human updates for handoff docs
- detect drift between AK and checked-in handoff surfaces

Future automation is **not** allowed, without a new explicit decision, to:
- replace `docs/project/*` or `next_session_prompt.md` with a fully generated queue surface
- imply that generated markdown is more authoritative than AK
- reclassify `governance/work-items.json` as hand-authored truth

## Scope

- in scope:
  - `docs/project/*`
  - `next_session_prompt.md`
  - `governance/work-items.json`
  - the repo-local workflow for reconciling those surfaces against AK
- out of scope:
  - FCOS / cross-repo planning models
  - `VERIFICATION.md` and `verification/verification.log` (handled by a separate decision)
  - the detailed implementation plan for `task:190`

## Ownership / seam / policy notes

- owner: ts-quality maintainers
- allowed seams:
  - improving export/check helpers around the existing hybrid contract
  - adding better operator tooling that drafts or validates handoff docs while keeping them explicitly downstream of AK
  - tightening docs/gates when projection drift proves easy to reintroduce
- prohibited patterns:
  - manual edits to `governance/work-items.json` as if it were live authority
  - treating `docs/project/*` or `next_session_prompt.md` as a replacement for `ak task *`
  - introducing full auto-generation of narrative handoff docs without a superseding ADR

## Alternatives considered

### Option A — Generate all repo-local handoff surfaces from AK
- description:
  - treat `docs/project/*`, `next_session_prompt.md`, and `governance/work-items.json` as purely generated views from AK state
- pros:
  - reduces manual drift risk
  - keeps every checked-in surface mechanically aligned to the DB
- cons:
  - loses narrative explanation and read-first curation that the repo actually uses
  - encourages confusing generated markdown with live authority
  - makes direction docs more brittle and less useful as human handoff artifacts
- why not chosen:
  - the repo needs human-curated direction framing, not only machine exports

### Option B — Keep all repo-local surfaces manual
- description:
  - let maintainers edit all handoff/projection files directly, including `governance/work-items.json`
- pros:
  - maximally flexible
  - simplest authoring story at first glance
- cons:
  - directly conflicts with the repo's existing AK-authoritative posture
  - makes projection drift easier to hide
  - undermines the deterministic planning-model contract around `governance/work-items.json`
- why not chosen:
  - it weakens the exact authority boundary this repo has already adopted

### Option C — Hybrid contract: generated work-items projection, manual direction/handoff docs downstream of AK
- description:
  - keep AK authoritative, generate `governance/work-items.json`, and maintain narrative handoff docs manually with explicit AK reconciliation checks
- pros:
  - preserves live authority boundaries
  - keeps the review/planning JSON deterministic
  - preserves useful repo-specific narrative in the handoff docs
  - matches how the repo is already operating when disciplined correctly
- cons:
  - still requires manual doc refreshes when queue truth changes
  - leaves some drift risk unless checks stay habitual
- why chosen or not chosen:
  - chosen because it balances authority clarity, reviewability, and useful narrative handoff context

## Consequences

### Positive
- live task authority stays anchored in AK
- `governance/work-items.json` has a clear generated/exported status
- repo-local handoff docs keep their explanatory value without pretending to be the runtime queue
- future automation can focus on export/check/scaffolding instead of silently rewriting repo authority rules

### Costs
- maintainers still need to refresh manual handoff docs consciously
- direction drift can still happen if operators skip the reconciliation pass
- the contract is slightly more complex than an all-generated or all-manual model

### Risks
- people may still mistake checked-in projections for live authority when reading quickly
- tooling could gradually re-expand into full generation without a fresh decision
- partial automation may create false confidence if it exports JSON but leaves markdown stale

### Mitigations
- keep `AGENTS.md` explicit about AK authority and projection status
- use `ak direction import|check|export` whenever direction docs change or queue truth rolls forward
- use `ak work-items export` instead of hand-editing the projection JSON
- record a superseding ADR before changing the manual/generated boundary

## Migration / rollout

- phase 1:
  - record this ADR
  - treat `task:190` as implementation work against this contract rather than a blank-slate authority choice
- phase 2:
  - refine automation around export/check/scaffolding without turning narrative docs into generated queue authority
- rollback / escape hatch:
  - supersede this ADR if the repo later decides that a narrower or broader generated surface is genuinely better

## Architecture fitness functions / validation

- invariant 1:
  - AK remains the live authority for repo-local task truth
- invariant 2:
  - `governance/work-items.json` is regenerated from AK rather than hand-authored
- invariant 3:
  - `docs/project/*` and `next_session_prompt.md` are reconciled against AK after queue/direction changes
- command checks:
  - `ak work-items export`
  - `ak direction import`
  - `ak direction check`
  - `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`
- test / review gates:
  - if queue truth changes, refresh both the checked-in projection and the handoff docs in the same pass
  - if the repo wants to widen generation beyond `governance/work-items.json`, record a superseding decision first

## Follow-up decisions / open questions

- what is the narrowest truthful automation surface for `task:190` under this hybrid contract?
- should the repo add a deterministic helper that bundles `ak direction import|check|export` with `ak work-items export` for one-shot projection refresh?

## Supersession
- supersedes:
- superseded_by:
