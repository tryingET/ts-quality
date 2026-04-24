---
summary: "Status-independent product vision for ts-quality as an evidence-native trust platform."
read_when:
  - "When aligning long-term direction for ts-quality"
  - "When deciding what kind of evidence/report work belongs in this repo"
type: "reference"
---

# Vision: ts-quality

## North star

`ts-quality` should become the evidence-native trust platform for TypeScript and JavaScript change.

Its purpose is not to make software review sound magical. Its purpose is to make change risk inspectable: a reviewer, release operator, CI system, or agent should be able to ask why a change is trusted, blocked, waived, amended, or authorized, and receive an answer grounded in deterministic artifacts rather than intuition.

The ideal experience is simple:

1. a change is evaluated against explicit repo-local evidence,
2. the tool separates what is proven, what is inferred, and what is missing,
3. the operator sees the weakest trust boundary clearly,
4. the output names the next evidence obligation instead of hiding uncertainty behind a confidence score,
5. downstream decisions stay bound to the exact run that produced the evidence.

## Product promise

`ts-quality` turns software-change evidence into an explainable trust decision.

For every meaningful review surface, the product should answer:

- **What changed?** Which files, functions, regions, packages, and boundaries are actually in scope?
- **What constrains the change?** Which coverage, tests, mutation outcomes, witnesses, invariants, governance rules, approvals, and attestations apply?
- **What is the strength of the evidence?** Which support is explicit, which is deterministic inference, and which is missing?
- **What decision follows?** Is the change mergeable, blocked, under-evidenced, governed, waived, overridden, or authorization-ready?
- **What should happen next?** Which test, witness, approval, attestation, policy change, or amendment would improve the evidence truthfully?

The platform succeeds when a concise summary and the underlying machine artifacts tell the same story at different depths.

## The trust ladder

The product should make evidence maturity visible instead of collapsing every signal into one vague score.

A useful trust ladder for the platform is:

1. **Scoped change truth** — the reviewed files, diff hunks, and control-plane inputs are explicit and repo-local.
2. **Structural evidence** — coverage, complexity, changed functions, and package ownership are mapped deterministically.
3. **Behavioral pressure** — mutation testing shows whether the test corpus constrains changed behavior.
4. **Invariant alignment** — declared behavior claims are connected to focused source and test evidence.
5. **Execution witness support** — important invariant scenarios can be backed by explicit proof artifacts and receipts.
6. **Governance fit** — architectural boundaries, approvals, waivers, rollback expectations, ownership reservations, and risk budgets are checked against the change.
7. **Legitimacy** — agents, humans, grants, attestations, overrides, and amendments are evaluated against the exact reviewed run.
8. **Release-grade reproducibility** — the same evidence story survives packaging, installation, CI use, and outside-repo operator workflows.

The ladder should remain inspectable. Higher layers must not erase lower-layer weakness. A legitimate authorization over weak evidence should still say which evidence is weak.

## Operator experience

`ts-quality` should feel like an evidence debugger for change risk.

The primary operator journey should be:

1. run or receive a check for a bounded change,
2. inspect one concise review surface,
3. drill into stable artifacts only when needed,
4. understand whether the blocking issue is coverage, mutation pressure, invariant support, governance, legitimacy, drift, or package/release proof,
5. take a concrete remediation step.

The best version of the product does not merely say “confidence is low.” It says, for example:

- the changed function has low coverage,
- the relevant mutant survived,
- the invariant scenario has only lexical support,
- the execution witness is missing or stale,
- the approval targets the wrong run,
- the attestation is not bound to the reviewed artifact,
- the constitution blocks this boundary crossing,
- the amendment lacks standing,
- the packaged operator path has not proven this workflow.

That specificity is the product’s advantage.

## Artifact philosophy

Artifacts are the platform, not incidental output.

`run.json` and related outputs should be stable enough for machines, readable enough for humans, and explicit enough for downstream review tools. Concise Markdown, PR summaries, release notes, authorization files, amendment summaries, trend output, and governance plans should all project from the same evidence basis rather than creating parallel authorities.

Artifact evolution should follow these rules:

- add fields before replacing fields,
- version contracts that downstream tools may consume,
- keep machine-readable truth more authoritative than prose,
- make projection context visible,
- preserve exact-run binding for downstream decisions,
- fail closed when scope, control-plane inputs, or trust artifacts drift.

The long-term product should make a run artifact feel like an audit packet: enough evidence to reconstruct why a decision was made, what was missing, and who or what had authority to approve it.

## Determinism and safety

The platform should be boring where trust requires boringness.

Core behavior should remain:

- offline-first,
- deterministic across identical inputs,
- explicit about changed scope,
- strict about repo-local path boundaries,
- safe around config and support-file loading,
- resistant to ambient trust,
- clear about generated versus authored artifacts,
- conservative when evidence cannot be resolved.

Safety is not separate from usability. A tool that silently widens scope, trusts live drift, executes arbitrary config, or upgrades weak evidence into proof makes review faster by making it less truthful. `ts-quality` should choose truthful friction over fake green output.

## Integration potential

The product should integrate with real software delivery workflows without becoming a general workflow engine.

Good integration surfaces include:

- local maintainer review,
- CI checks,
- PR summaries,
- release readiness checks,
- package publish preflights,
- agent-authored change review,
- policy/governance review,
- signed attestation verification,
- amendment and override workflows,
- trend and regression inspection.

The boundary is important: `ts-quality` should not become a task tracker, organization control plane, or natural-language proof system. It should provide the evidence and decision substrate those systems can consume.

## What the app can become

The highest-potential version of `ts-quality` is a local, deterministic trust kernel for agent-era software delivery.

As more code is written, reviewed, and released by agents, the hard question becomes less “can code be generated?” and more “can this specific change be trusted under the evidence we actually have?” `ts-quality` can own that question for TypeScript/JavaScript projects by combining five things that are usually scattered:

- changed-code evidence,
- behavior pressure,
- declared intent,
- governance constraints,
- legitimacy of the actor making the decision.

If those layers stay unified, the product can become the thing a team points to when it needs to justify a merge, block an unsafe change, authorize an automated release, accept an override, or explain why more evidence is required.

The ambition is not broader automation for its own sake. The ambition is better trust: fast enough for daily review, strict enough for release gates, inspectable enough for humans, and structured enough for agents.

## Boundaries

This vision is not:

- natural-language semantic proof,
- repo-global keyword matching dressed up as understanding,
- opaque learned scoring that cannot be inspected,
- a replacement for tests,
- a replacement for human judgment,
- a company-wide workflow/control-plane product,
- a release system by itself.

`ts-quality` should improve its native evidence, invariant, governance, legitimacy, artifact, and operator semantics. It should stay strongest where deterministic evidence can make review more truthful.
