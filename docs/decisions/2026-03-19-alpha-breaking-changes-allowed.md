---
summary: "ADR accepting alpha-stage breaking changes when they improve deterministic evidence, safety, or trust-boundary correctness."
read_when:
  - "When deciding whether ts-quality should preserve backward compatibility before 1.0"
  - "When planning breaking changes to config, evidence, governance, or legitimacy contracts"
system4d:
  container:
    boundary: "Repo policy for pre-1.0 compatibility and release discipline."
    edges:
      - "../README.md"
      - "../config-reference.md"
      - "../../CHANGELOG.md"
  compass:
    driver: "Allow correctness and trust-boundary hardening to move faster than backward-compatibility promises during alpha."
    outcome: "Durable repo policy that breaking changes are acceptable before 1.0 when clearly documented."
  engine:
    invariants:
      - "Before 1.0, correctness, determinism, and safety outrank compatibility preservation."
      - "Breaking changes remain documented in README, changelog, and affected contract docs."
      - "Alpha status is never used as an excuse for undocumented contract drift."
  fog:
    risks:
      - "Operators may overuse alpha status to justify avoidable churn."
      - "Users may still assume semver-like stability unless the repo says otherwise clearly."
      - "Breaking changes can still damage trust if migration notes are omitted."
---

# ADR-2026-03-19 — Alpha-stage breaking changes are allowed

## Status
- accepted
- date: 2026-03-19
- owner: ts-quality maintainers
- reviewers: operator, pi
- related_docs:
  - README.md
  - docs/config-reference.md
  - CHANGELOG.md
  - AGENTS.md

## Executive summary
`ts-quality` is still in alpha, so backward compatibility is not yet a governing constraint. Before 1.0, maintainers may make breaking changes when doing so improves deterministic evidence, trust-boundary correctness, safety, or architectural clarity, provided the break is documented clearly in the changelog, README, and affected contract docs.

## Context

- current state:
  - the repo is evolving quickly in evidence, governance, legitimacy, and config semantics
  - several recent hardening passes exposed places where preserving compatibility can keep unsafe or misleading behavior alive
- evidence / incidents / constraints:
  - config loading remains a trust boundary under active review
  - mutation/runtime and governance/import hardening both benefited from preferring correctness over legacy assumptions
  - the product is explicitly pre-1.0 and should not imply a stability contract it has not earned yet
- why this decision is needed now:
  - maintainers need a durable policy reference when deciding whether to break existing users in service of correctness
  - future agents and operators need one canonical answer instead of rediscovering intent through chat history or diary notes

## Problem statement

Without an explicit repo decision, maintainers can become inconsistent: sometimes over-preserving compatibility and leaving defects in place, and other times making breaking changes without a shared standard for when that is acceptable. The repo needs a durable alpha-stage compatibility policy.

## Decision drivers

- deterministic evidence correctness
- trust-boundary hardening
- architectural clarity before 1.0
- avoiding false promises of stability
- making breaking changes deliberate and documented rather than accidental

## Decision

Before 1.0, `ts-quality` may make breaking changes.

Breaking changes are explicitly allowed when they improve one or more of the following:
- deterministic evidence correctness
- trust-boundary or safety hardening
- explainability and contract clarity
- architectural simplification that removes misleading or unsafe legacy behavior

Alpha status does **not** remove the documentation obligation.
Every intentional breaking change must still be:
- called out in `CHANGELOG.md`
- reflected in `README.md` when it changes user expectations
- reflected in the affected contract doc(s) such as `docs/config-reference.md`
- implemented with tests or validation coverage appropriate to the changed contract

### Scope
- in scope:
  - config contract changes
  - artifact/report contract changes before 1.0
  - governance / legitimacy semantics before 1.0
  - CLI and runtime behavior changes before 1.0
- out of scope:
  - undocumented breaking changes
  - silent drift between runtime behavior and docs
  - post-1.0 compatibility policy

### Ownership / seam / policy notes
- owner: ts-quality maintainers
- allowed seams:
  - breaking changes before 1.0 with explicit documentation and validation
  - migration notes when a change affects operator workflows or checked-in examples
- prohibited patterns:
  - using “alpha” as justification for untracked churn
  - shipping contract breaks without changelog/docs updates
  - implying stability guarantees stronger than the repo actually offers

## Alternatives considered

### Option A — Preserve backward compatibility by default even in alpha
- description:
  - treat current users as if the repo were already under a strong stability contract
- pros:
  - lowers short-term migration pain
  - reduces visible churn
- cons:
  - keeps unsafe or misleading behavior alive longer
  - slows architectural cleanup
  - creates false confidence that current contracts are already stable
- why not chosen:
  - it optimizes for early compatibility at the cost of product truth and safety

### Option B — Allow any break because alpha means anything goes
- description:
  - break compatibility freely without a documentation standard
- pros:
  - fastest possible iteration
- cons:
  - destroys operator trust
  - encourages hidden drift
  - makes future stabilization harder
- why not chosen:
  - the repo still needs discipline, even before 1.0

### Option C — Allow breaking changes before 1.0, but require explicit documentation and validation
- description:
  - treat alpha as permission to prioritize correctness while still enforcing clear contract communication
- pros:
  - preserves freedom to harden unsafe behavior
  - avoids false stability promises
  - creates a durable paper trail for future users and maintainers
- cons:
  - increases documentation burden
  - still causes migration work for early adopters
- why chosen or not chosen:
  - chosen because it balances speed, correctness, and institutional memory

## Consequences

### Positive
- maintainers can remove unsafe or misleading behavior without pretending compatibility is sacred before 1.0
- future agents have a durable policy reference instead of relying on chat history
- trust-boundary and evidence-quality fixes become easier to justify and sequence

### Costs
- early adopters may need to update configs, scripts, or workflows more often
- maintainers must keep docs and changelog disciplined

### Risks
- the policy could be overused to justify unnecessary churn
- users may still miss the alpha warning if it is only recorded in one place

### Mitigations
- repeat the policy in README, changelog, and affected contract docs
- keep changes purposeful and tested
- require explicit breaking-change notes rather than silent drift

## Migration / rollout

- phase 1:
  - record this ADR
  - add the alpha compatibility statement to README and AGENTS
  - mention it in config docs and changelog
- phase 2:
  - use this ADR as the policy basis for future contract-hardening work, including config-loader safety
- rollback / escape hatch:
  - supersede this ADR with a stricter compatibility policy once the repo approaches beta or 1.0

## Architecture fitness functions / validation

- invariant 1:
  - before 1.0, correctness and safety may outrank backward compatibility
- invariant 2:
  - no intentional breaking change is considered complete unless docs and validation reflect it
- command checks:
  - `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`
  - `npm run verify`
- test / review gates:
  - changed contract surfaces must have regression coverage where practical
  - README / config-reference / changelog must stay aligned with runtime truth

## Follow-up decisions / open questions
- what exact non-executable config contract should replace the current executable TS/JS config path?
- when should the repo move from alpha to a stricter compatibility policy?

## Supersession
- supersedes:
- superseded_by:
