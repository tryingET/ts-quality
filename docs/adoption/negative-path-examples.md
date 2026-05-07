---
summary: "Negative-path adoption examples where ts-quality blocks or lowers confidence truthfully."
read_when:
  - "When explaining why high coverage or a witness can still fail a run"
  - "When adding governance, authorization, or mutation-pressure examples to adoption docs"
  - "When reviewing outside-repo pilots for truthful fail-closed behavior"
type: "reference"
---

# Negative-path adoption examples

`ts-quality` is useful when it blocks truthfully. A green run is not the only successful adoption signal; a precise fail can be the evidence that prevents fake trust.

Use this page to explain common negative paths without weakening the core contract.

## High coverage plus a witness can still fail

The minimal executable fixture now protects this behavior locally: `test/minimal-external-adoption-fixture.test.mjs` rewrites the tiny target test so coverage and a manual witness still exist, but the boundary mutant survives and `nextEvidenceAction.primaryAction.kind` stays `mutation-survivors`.

The public `0.3.1` real monorepo pilot against a temp copy of `pi-extensions` remains the clearest external example. The run screened:

```text
packages/pi-provenance/src/provenance-core.js
```

It had strong structural and witness evidence:

```json
{
  "coveragePct": 96,
  "changedFunctionsUnder80Coverage": 0,
  "evidenceSemantics": "execution-backed",
  "supportKind": "execution-witness"
}
```

It still failed because mutation pressure found surviving behavior deltas:

```json
{
  "mergeConfidence": 66,
  "mutationSitesInScope": 8,
  "killedMutantsInScope": 4,
  "survivingMutantsInScope": 4,
  "authorizeOutcome": "require-human-approver"
}
```

Interpretation:

- coverage said the changed file was exercised,
- the witness said one invariant scenario had explicit runtime support,
- mutation survivors said the focused test corpus still did not constrain all changed behavior,
- authorization correctly refused automation approval under the configured confidence floor.

This is the intended product behavior. Merge confidence is not coverage percentage.

Source evidence: `test/minimal-external-adoption-fixture.test.mjs` and `docs/adoption/eighth-public-0.3.1-real-monorepo-pi-extensions-pilot.md`.

## Mutation survivors should produce an evidence obligation

When surviving mutants remain, the run should name mutation pressure as the next obligation rather than asking for generic confidence.

Expected surfaces:

- `check-summary.txt` includes the evidence closure headline plus coverage and mutation basis,
- `next-evidence-action.json` has `primaryAction.kind: "mutation-survivors"`,
- `mutation-remediation.json` names survivor sites when available,
- `next-evidence-action.prompt.md` and `next-evidence-action.ak-task.json` project bounded follow-up for humans or agents.

Do not fix this by widening changed scope, lowering thresholds, or treating a broad green test run as proof. Add or improve focused assertions that kill the observed mutants, or route the residual risk explicitly.

## Governance boundary violations should block run-bound authorization

A package-boundary or architectural-rule violation is not merely advisory when it affects the reviewed scope. A healthy negative path should show:

- `govern --run-id <id>` names the blocking rule and affected path,
- `report` / `explain` keep the finding tied to the selected run,
- `authorize --agent <agent> --run-id <id>` refuses approval unless a valid run-bound approval/waiver/override with standing exists,
- drift in the constitution, agents, approvals, waivers, overrides, or changed files fails closed instead of trusting ambient edits.

The current public monorepo package-boundary pilot proves healthy package attribution and approval, but it did not intentionally violate the boundary. The executable negative-path proof is now recorded in `docs/adoption/2026-05-07-negative-governance-authorization-proof.md` and protected by `test/authorization-integration.test.mjs`. The older planning/checklist detail remains in `docs/adoption/negative-governance-authorization-pilot.md` for future disposable external-target pilots.

Source evidence: `docs/adoption/seventh-public-0.3.1-monorepo-package-boundary-pilot.md`, `docs/adoption/2026-05-07-negative-governance-authorization-proof.md`, and `test/authorization-integration.test.mjs`.

## Wrong-run or stale legitimacy artifacts must not become ambient trust

Approvals, attestations, overrides, and authorization decisions are only meaningful when bound to the exact reviewed run.

Expected negative outcomes:

- an approval that targets a different run does not authorize the current run,
- an attestation whose payload metadata does not match the signed run artifact is rejected,
- an override grant that does not match the exact changed scope is not a blanket bypass,
- unsupported or malformed control-plane snapshots instruct the operator to rerun rather than projecting stale authority.

Use explicit `--run-id` in CI and agent workflows so these failures are visible and reproducible. The wrong-run, older-run attestation, and insufficient-grant checks in `test/authorization-integration.test.mjs` fail if approval can leak from a different run id, unmatched grant, or stale sidecar; see `docs/adoption/2026-05-07-negative-governance-authorization-proof.md` for the executable evidence summary.

## Adoption habit

When a first target-repo run fails:

1. read `check-summary.txt`,
2. read `next-evidence-action.json`,
3. inspect the named sidecar (`mutation-remediation.json`, `coverage-generation.txt`, `govern.txt`, or authorization JSON),
4. fix or route the named evidence obligation,
5. rerun the same bounded scope with an explicit run id.

Do not broaden to whole-repo scope to hide the negative path. The negative path is often the product doing its job.
