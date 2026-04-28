---
summary: "Reusable product posture template for repos whose vision-to-strategy bridge needs an explicit maturity snapshot."
read_when:
  - "When creating docs/project/product_posture.md for a product repo"
  - "When deciding whether a product posture file is warranted"
  - "When adapting the product posture pattern before broader template rollout"
type: "template"
---

# Product Posture Template

Copy this template to:

```text
docs/project/product_posture.md
```

when the repo needs a product-level maturity bridge between durable vision and active direction.

## Use rule

Create `product_posture.md` when at least one is true:

- the repo is a product or platform with multiple capability layers,
- the vision is durable but strategy selection needs a high-level maturity snapshot,
- operators keep confusing current capability with target-state ambition,
- active work looks busy but convergence toward the product experience is unclear,
- a recurring current-vs-target question is product-wide rather than a single migration seam.

Do **not** create it just because a template can generate it.
Do **not** use it as a task log, changelog, release log, or second operating plan.
Do **not** make it the runtime authority for behavior that code, artifacts, AK, or owner docs already own.

## Template

```md
---
summary: "Product posture snapshot for <repo>: current maturity, target product experience, major gaps, and proof signals."
read_when:
  - "When deciding where <repo> stands relative to its product vision"
  - "When selecting or reviewing product bets from maturity rather than task history"
  - "When checking whether active work converges on the intended product experience"
type: "reference"
---

# Product Posture: <repo>

## Purpose

This file is the status-bearing bridge between durable vision and product-maturity choices.

It captures where the product stands, what target experience it is converging toward, which gaps matter most, and what proof would close those gaps.

It does **not** replace:

- shipped runtime/source truth
- AK task or decision authority
- live queue, sequencing, claim, or completion state

This file should be **exceptionally useful**: concise, grounded in shipped truth, and strong enough to guide product choices without becoming a task log or second operating plan.

## Posture in one sentence

<One sentence that says what is real now, what the target experience is, and what the main maturity gap is.>

## Product maturity map

| Area | Current posture | Target posture | Main gap | Proof of closure |
|---|---|---|---|---|
| <capability area> | <what exists now> | <what should be true> | <what is missing> | <observable proof> |
| <operator experience area> | ... | ... | ... | ... |
| <artifact / contract area> | ... | ... | ... | ... |
| <adoption / integration area> | ... | ... | ... | ... |

## Current strengths

- <Strength grounded in shipped code/artifacts/docs.>

## Current gaps

- <Gap that affects product maturity, not just one task.>

## Target product experience

<Describe the intended user/operator/system journey in concrete terms.>

## Near-term convergence path

1. <Highest-leverage product maturity move.>
2. <Next maturity move.>
3. <Proof/adoption/validation move.>

## Hard rules for status language

- Say “<truthful current capability>” rather than “<over-claim>.”
- Say “<target-state phrase>” only when <proof condition> has landed.
- Keep this file product-level; task-level current truth belongs in AK tasks, not in a parallel operating-plan document.

## Authority map

- Durable ambition: `docs/project/vision.md`
- Product posture: this file
- Shipped runtime/operator truth: <README/ARCHITECTURE/runtime docs/source/tests>
- Live execution and sequencing truth: <AK or repo-declared task authority>
- Raw session evidence: `diary/`
- Crystallized learning: `docs/learnings/`
```

## Quality bar

An excellent `product_posture.md` is:

- grounded in shipped code, artifacts, docs, tests, or authoritative runtime state;
- short enough to read before strategy work;
- concrete about current posture, target posture, gaps, and proof of closure;
- honest about both over-claim and under-claim;
- clearly separate from the task queue and release log.

## Prompt/template integration rule

Prompt Vault and local prompts may read or update `product_posture.md` when explicitly doing product posture or convergence work.
They should not require the file for ordinary repo-direction execution.

If a concern is a specific authority/cutover seam, prefer a dated seam packet instead of product posture, for example:

```text
docs/project/YYYY-MM-DD-<seam>-current-vs-target-boundary.md
```

Use `product_posture.md` for product-wide maturity posture, not every transition boundary.
