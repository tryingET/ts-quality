---
summary: "FCOS dependency-intelligence corridor quality proof tying runtime, fusion, visualization, and redteam slices into ts-quality adoption evidence."
read_when:
  - "Reviewing FCOS dependency-intelligence corridor closeout."
  - "Checking whether dependency-intelligence evidence is quality-signal context rather than remediation or exploitability authority."
type: "evidence"
---

# FCOS dependency-intelligence corridor quality proof — 2026-05-18

## Design membrane

This document is the `ts-quality` evidence slice for the FCOS dependency-intelligence corridor:

```text
runtime-trace-insights
-> dep-diet
-> dep-viz
-> dep-redteam
-> ts-quality adoption/quality proof
```

`ts-quality` is not the runtime-trace, dependency-fusion, visualization, or exploitability-validation owner. Its role here is durable quality/adoption evidence: record the verified cross-repo proof, make the trust boundary explicit, and preserve the corridor as quality-signal context for future deterministic review.

Boundary principle:

```text
static importance != runtime observation != visualization explanation != reachability review != removal/remediation/exploitability authority
```

## Source-owner evidence inventory

| Slice | Owner repo | Evidence commit / doc | What it proves | What it does not authorize |
|---|---|---|---|---|
| Runtime bundle | `runtime-trace-insights` | `b2968b7 docs/project/dependency-corridor-runtime-pilot.md` | A representative runtime trace bundle can observe `zod` under the dep-diet targeted test command. | Dependency removal, depmodel fusion, visualization, risk, exploitability, disclosure, or release approval. |
| Static/runtime fusion | `dep-diet` | `c2c2cc4 docs/project/dependency-corridor-fusion-pilot.md` | Static Gardener evidence and runtime trace evidence can fuse into `depmodel.v1` context with classifications such as `static-runtime-confirmed` and `declared-unobserved`. | Removal authority or proof that unobserved dependencies are unused. |
| Operator explanation | `dep-viz` | `a13fb07 docs/operations/dependency-corridor-visualization-pilot.md` | The fused depmodel renders as an operator-facing report while preserving the static/runtime authority note. | Replacement safety, exploitability proof, disclosure, or merge/release readiness. |
| Validation review boundary | `dep-redteam` | `c0a08fb docs/project/dependency-corridor-redteam-pilot.md` | A dep-viz exploitability-validation handoff can become passive validation, a non-executing local-lab plan, and a review summary. | Exploit execution, safe reproducer confirmation, public disclosure, or remediation approval. |
| Control-board closeout | `fcos-control-board` | `5150c2d`, `0b96c46`, `b174afe`, `e95feed` | FCOS tracked and closed the runtime, dep-diet, dep-viz, and dep-redteam slices with evidence refs. | Source-owner fact mutation or AK runtime truth mutation. |

## Corridor facts captured as quality signals

The dep-diet fused depmodel used in the FCOS corridor had digest:

```text
/tmp/depdiet-fcos-depmodel.v1.json
sha256: 27b9e537be0de4c76b9eb1ef2069100ec0989c652feac2a8107a91c95b90eea8
```

Observed package classifications:

| Package | Classification | Review signal | Quality interpretation |
|---|---|---|---|
| `zod` | `static-runtime-confirmed` | `critical-soil` | Preserve high-context dependency evidence before change; not a removal candidate by this evidence alone. |
| `chalk` | `declared-unobserved` | `declared-unobserved-review` | Needs more scenario evidence before interpreting absence as unused. |
| `lodash` | `declared-unobserved` | `declared-unobserved-review` | Needs more scenario evidence before interpreting absence as unused. |

Dep-redteam review output from its corridor fixture preserved the evidence ladder:

```json
{
  "dependency_present_only": 1,
  "reachable_unproven": 1,
  "safe_reproducer_confirmed": 0
}
```

For `ts-quality`, these are adoption-quality facts: they show source-owner tools can produce deterministic, inspectable packets that resist authority inflation. They are not `ts-quality` run verdicts and should not be treated as merge confidence, governance approval, or authorization records.

## Verification summary

Source-owner validations completed during the corridor:

| Repo | Validation evidence |
|---|---|
| `runtime-trace-insights` | Runtime trace bundle command succeeded and evidence doc committed. |
| `dep-diet` | `npm run lint`; `npm run test:ci-targeted`; strict docs check noted a pre-existing generated-artifact front-matter issue outside the committed doc slice. |
| `dep-viz` | `node --test tests/static-runtime-corridor-fixture.test.mjs`; `npm run lint`; `npm run test:ci-targeted`; docs strict; `git diff --check`. |
| `dep-redteam` | `uv run pytest` passed; docs strict passed; `git diff --check` passed; `uv run ruff check .` still reports a pre-existing dirty line-length issue in `tests/test_handoff.py`. |
| `fcos-control-board` | `fcos status --json`; `fcos gates --json`; `fcos nexus --verify-surface-refs --json` passed after each closeout. |
| `ts-quality` | This evidence doc is validated with docs strictness and whitespace diff checks. |

## Quality proof meaning

This corridor is useful quality evidence because every step kept its owner boundary:

1. Runtime observation stayed with `runtime-trace-insights`.
2. Static/runtime classification stayed with `dep-diet`.
3. Operator visualization stayed with `dep-viz`.
4. Passive exploitability-validation review stayed with `dep-redteam`.
5. Cross-repo state stayed with FCOS.
6. This repo records adoption-quality proof without pretending to own those facts.

The trust pattern aligns with `ts-quality`'s core model: explicit evidence should make the weakest boundary visible instead of upgrading weak signals into green authority.

## Future use

Use this proof as a reference when evaluating future dependency-intelligence or remediation work:

- cite the owner repo evidence first;
- treat package classification, runtime observation, visualization, and reachability review as separate layers;
- require a fresh `ts-quality` run if a TypeScript/JavaScript code change needs merge-confidence evidence;
- require source-owner and human approval before removal, remediation, exploit execution, disclosure, merge, or release.

The next corridor-quality slice should either run `ts-quality` on a real TypeScript target affected by dependency-intelligence changes or bind a source-owner review packet into a run-bound `ts-quality` artifact without importing source-owner authority into this repo.
