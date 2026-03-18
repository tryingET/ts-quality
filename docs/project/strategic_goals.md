---
summary: "Strategic goals for ts-quality selected from the current vision and unfinished repo-local work using Eisenhower-3D."
read_when:
  - "When deciding the next quarter-scale direction for ts-quality"
  - "When translating the vision into bounded delivery waves"
type: "reference"
---

# Strategic goals

## Selection rule used here
This file now lists the **top 2 unfinished strategic goals** derived from `vision.md` plus present-tense repo truth.
Completed foundation work (`#179` → `#183`) stays as prerequisite context, not as the active strategy queue.

## Completed prerequisite foundation
The repo already proved the additive evidence foundation:
- invariant-scoped evidence summaries exist
- sub-signals are decomposed and mode-aware
- `pr-summary.md`, `plan.txt`, and `govern.txt` already project concise provenance from the same authority

That foundation narrows the real strategic choice to what still remains unfinished.

## Top 2 strategic goals (Eisenhower-3D)

| Rank | Goal | Importance | Urgency | Difficulty | Why it made the cut |
|---|---|---:|---:|---:|---|
| 1 | **SG1 — Close the remaining concise operator-surface gaps under `behaviorClaims[].evidenceSummary`** | 5 | 5 | 3 | Runtime concise surfaces and the reviewed sample bundle/README contract are now aligned, but parity-hardening regression coverage still lags behind that shipped evidence surface. |
| 2 | **SG2 — Carry the same evidence truth into governance/legitimacy decision surfaces that still compress authority too far** | 4 | 3 | 4 | The vision explicitly calls for governance and legitimacy to consume the same explainable evidence basis, but the repo has not yet decomposed that later wave into executable repo-local work. |

## Active now vs next
- **Active now:** SG1
- **Next after SG1:** SG2

## SG1 — Close the remaining concise operator-surface gaps under `behaviorClaims[].evidenceSummary`

### Why this is the active strategic goal
The vision says reviewers should be able to tell what evidence is explicit, inferred, or missing without guesswork.
The repo now does that in the canonical artifact and the concise runtime surfaces touched so far, but the reviewed example/documentation contract and parity-hardening work are not fully caught up yet.

Current repo-local evidence for SG1:
- `packages/ts-quality/src/index.ts` now writes `check-summary.txt` with merge confidence, outcome, best-next-action, and the first at-risk invariant provenance when present
- `packages/ts-quality/src/index.ts` now renders `trend` with deltas plus the latest run's first at-risk invariant provenance when relevant
- `scripts/generate-samples.mjs` still exports `pr-summary.md`, `plan.txt`, and `govern.txt`, but not `check-summary.txt`
- concise-output regression coverage still needs a dedicated hardening pass so future report tweaks do not silently drift the operator contract

### Success signals
- every concise run-status surface stays visibly downstream of the additive invariant evidence authority
- reviewers can still see the riskiest invariant context even when using terse surfaces
- sample artifacts and README contract language describe the same concise surfaces the code emits
- no new report authority is introduced

## SG2 — Carry the same evidence truth into governance/legitimacy decision surfaces that still compress authority too far

### Why this is next, not current
This is important, but it is one layer farther from the current proven operator-surface wave.
The repo should finish SG1 before decomposing this next decision-surface wave.

### Likely scope when promoted
- authorization / attestation / amendment review surfaces
- governance and legitimacy docs where authority boundaries could drift from emitted artifacts
- any remaining decision-facing outputs that summarize evidence without enough provenance context

### Success signals
- governance and legitimacy actions stay visibly tied to exact evidence artifacts and run boundaries
- reviewer-facing decision outputs remain explainable without competing with `run.json`
- exact approval / attestation / override semantics stay clearer in concise outputs and docs

## Non-goals for this strategic window
- semantic proof or non-deterministic scoring theater
- repo-global keyword matching as fake understanding
- another top-level evidence authority outside the additive artifact contract
- cross-repo program work not owned by this repo

## Relationship to downstream docs
- `tactical_goals.md` must decompose **SG1 only** until SG1 is materially complete
- `operating_plan.md` must decompose the single highest-priority tactical goal under SG1
- `next_session_prompt.md` must point at the first active AK slice from that operating plan
