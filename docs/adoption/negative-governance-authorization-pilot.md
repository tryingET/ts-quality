---
summary: "Pilot plan and regression proof for governance boundary violations and run-bound authorization fail-closed behavior."
read_when:
  - "When planning the negative-path governance and authorization adoption proof"
  - "When reviewing run-bound authorization, wrong-run approvals, or insufficient grant outcomes"
  - "When extending public release verification for governance and authorization failures"
type: "plan"
---

# Negative governance and authorization pilot

This document is both a reusable pilot plan and a regression-proof index.

The focused regression subset is implemented in `test/authorization-integration.test.mjs` using the existing `fixtures/mini-monorepo` fixture. It proves:

1. a governance boundary violation blocks run-bound authorization,
2. an approval-like authorization artifact from another run remains bound to that other run and does not approve the violating run, and
3. an insufficient grant fails closed with a non-approval reason.

The broader pilot plan below remains useful when running the same negative-path story in a disposable external target repo. Do not run the pilot in a production checkout unless the target owner explicitly wants to preserve the failing fixture.

## Implemented regression subset

Current executable proof:

```bash
node --test test/authorization-integration.test.mjs
```

Regression cases:

- `mini-monorepo negative pilot keeps boundary violations and wrong-run authorization run-bound`
- `mini-monorepo negative pilot refuses insufficient authorization grants`

Fixture and artifacts exercised:

- `fixtures/mini-monorepo` intentionally violates the `api-cannot-import-identity` boundary when `packages/api/src/consumer.js` imports `packages/identity/src/store.js`.
- `negative-governance-boundary` run id verifies `authorize.maintainer.merge.json` denies automation despite another run having an approval-like decision artifact.
- `authorization-other-run` verifies a clean package-local run can approve while staying bound to its own run id.
- `negative-insufficient-grant` verifies `release-bot` cannot authorize `packages/api/src/consumer.js` with a grant scoped only to `packages/identity/**`.

The test asserts run ids, governance error rule ids, `govern.txt` content, bundle artifact paths, denial outcomes, and non-approval reasons. This is not a public outside-repo adoption proof; it is the repo-local executable regression that protects the negative-path contract.

## External pilot fixture shape

Start from the monorepo package-boundary shape used by `docs/adoption/seventh-public-0.3.1-monorepo-package-boundary-pilot.md`, but make the boundary violation intentional.

Minimal target layout:

```text
packages/api/src/token.js
packages/api/test/token.test.js
packages/web/src/session.js
packages/web/test/session.test.js
.ts-quality/constitution.ts
.ts-quality/agents.ts
.ts-quality/approvals.json
.ts-quality/waivers.json
.ts-quality/overrides.json
.ts-quality/invariants.ts
ts-quality.config.json
```

Intentional violation:

- `packages/web/src/session.js` imports or otherwise depends on `packages/api/src/token.js`.
- The constitution forbids `packages/web/src/**` from depending on `packages/api/src/**`.
- The changed scope is `packages/web/src/session.js`, not the API package.
- `release-bot` has either no `merge` grant for `packages/web/src/**`, or a grant with `minMergeConfidence` above the observed run confidence.

Example control-plane intent:

```ts
// .ts-quality/constitution.ts
export default [{
  id: 'package-boundary.web-must-not-import-api',
  title: 'Web package must not import API internals',
  severity: 'blocker',
  selectors: ['path:packages/web/src/**'],
  forbiddenImports: ['packages/api/src/**'],
  rationale: 'The web package may consume published API contracts, not package internals.'
}];
```

```ts
// .ts-quality/agents.ts
export default [{
  id: 'release-bot',
  kind: 'automation',
  roles: ['ci'],
  grants: [{
    id: 'release-bot-api-merge-only',
    actions: ['merge'],
    paths: ['packages/api/src/**'],
    minMergeConfidence: 65
  }]
}];
```

If the current constitution DSL uses different field names for import boundaries, keep the same semantic shape and update this pilot before running it. The proof target is the artifact behavior, not the exact illustrative TypeScript object above.

## Pilot A: governance boundary violation

Run a single explicit run id for the violating web slice:

```bash
RUN_ID=negative-governance-boundary
npx ts-quality check \
  --config ts-quality.config.json \
  --changed packages/web/src/session.js \
  --run-id "$RUN_ID"
npx ts-quality report --run-id "$RUN_ID"
npx ts-quality explain --run-id "$RUN_ID"
npx ts-quality govern --run-id "$RUN_ID"
npx ts-quality authorize --agent release-bot --run-id "$RUN_ID"
```

Expected run-bound artifacts:

```text
.ts-quality/runs/negative-governance-boundary/run.json
.ts-quality/runs/negative-governance-boundary/verdict.json
.ts-quality/runs/negative-governance-boundary/report.md
.ts-quality/runs/negative-governance-boundary/explain.txt
.ts-quality/runs/negative-governance-boundary/govern.txt
.ts-quality/runs/negative-governance-boundary/check-summary.txt
.ts-quality/runs/negative-governance-boundary/next-evidence-action.json
.ts-quality/runs/negative-governance-boundary/next-evidence-action.txt
.ts-quality/runs/negative-governance-boundary/next-evidence-action.prompt.md
.ts-quality/runs/negative-governance-boundary/next-evidence-action.ak-task.json
.ts-quality/runs/negative-governance-boundary/authorize.release-bot.merge.json
```

Expected failure outcomes:

- `run.json` records the changed scope as `packages/web/src/session.js` and retains the check-time control-plane snapshot.
- `govern.txt` names the package-boundary violation, the blocking rule id, and the affected web path.
- `next-evidence-action.json` selects `primaryAction.kind: "governance"` when the governance finding is the highest-priority blocker.
- `authorize.release-bot.merge.json` is tied to `negative-governance-boundary` and does not approve automation merge.
- The authorization reason includes the blocking governance finding and/or lack of a matching run-bound waiver, approval, or override.
- `report` and `explain` continue to describe the selected run rather than ambient latest state.

Healthy result: command status may be non-zero for the failing `check`, `govern`, or `authorize` commands. Treat explicit non-zero status plus the artifact fields above as the proof. Do not rewrite the fixture to get green output.

## Pilot B: wrong-run authorization artifact

After Pilot A, create a second run id from the same fixture or from a harmless API-only change. The important fact is that the approval/authorization artifact is bound to a different run id than the violating web slice.

```bash
GOOD_RUN_ID=authorization-other-run
npx ts-quality check \
  --config ts-quality.config.json \
  --changed packages/api/src/token.js \
  --run-id "$GOOD_RUN_ID"
npx ts-quality authorize --agent release-bot --run-id "$GOOD_RUN_ID"
```

Then attempt to rely on the other-run decision while reviewing the violating run:

```bash
BAD_RUN_ID=negative-governance-boundary
npx ts-quality authorize --agent release-bot --run-id "$BAD_RUN_ID"
npx ts-quality report --run-id "$BAD_RUN_ID" --json > /tmp/negative-governance-boundary.report.json
```

Expected run-bound artifacts:

```text
.ts-quality/runs/authorization-other-run/run.json
.ts-quality/runs/authorization-other-run/authorize.release-bot.merge.json
.ts-quality/runs/negative-governance-boundary/run.json
.ts-quality/runs/negative-governance-boundary/authorize.release-bot.merge.json
```

Expected failure outcomes:

- The authorization decision for `authorization-other-run` does not authorize `negative-governance-boundary`.
- The negative run's authorization artifact names `negative-governance-boundary` in its evidence context.
- Any approval, attestation, waiver, or override whose run id or artifact digest points at the other run is ignored or rejected for the negative run.
- The JSON report projection keeps `decisionContext` bound to the selected run and does not treat latest authorization sidecars as ambient approval.

Healthy result: a copied or stale authorization sidecar should be inert. The selected run id and evidence context are the authority boundary.

## Pilot C: insufficient grant or confidence floor

Use the same violating web slice, but make the authorization failure independent from the governance rule by testing a grant mismatch or excessive confidence floor.

Grant-mismatch variant:

```ts
// .ts-quality/agents.ts
export default [{
  id: 'release-bot',
  kind: 'automation',
  roles: ['ci'],
  grants: [{
    id: 'release-bot-api-only',
    actions: ['merge'],
    paths: ['packages/api/src/**'],
    minMergeConfidence: 65
  }]
}];
```

Confidence-floor variant:

```ts
// .ts-quality/agents.ts
export default [{
  id: 'release-bot',
  kind: 'automation',
  roles: ['ci'],
  grants: [{
    id: 'release-bot-web-high-confidence',
    actions: ['merge'],
    paths: ['packages/web/src/**'],
    minMergeConfidence: 99
  }]
}];
```

Commands:

```bash
RUN_ID=negative-insufficient-grant
npx ts-quality check \
  --config ts-quality.config.json \
  --changed packages/web/src/session.js \
  --run-id "$RUN_ID"
npx ts-quality authorize --agent release-bot --run-id "$RUN_ID"
```

Expected run-bound artifacts:

```text
.ts-quality/runs/negative-insufficient-grant/run.json
.ts-quality/runs/negative-insufficient-grant/authorize.release-bot.merge.json
.ts-quality/runs/negative-insufficient-grant/check-summary.txt
```

Expected failure outcomes:

- Grant mismatch: authorization refuses approval because no grant covers `packages/web/src/session.js` for the requested action.
- Confidence floor: authorization refuses approval with a non-approval outcome such as `require-human-approver` when the run confidence is below the grant minimum.
- The authorization artifact records the selected run id, requested agent/action, matched or missing grant, and explicit reason.
- The result does not mutate approvals, waivers, overrides, or attestations as a side effect.

## Validation checklist

For each pilot run, capture the command transcript and inspect artifacts rather than relying on prose alone.

Required checks:

- [ ] Every `report`, `explain`, `govern`, and `authorize` command uses an explicit `--run-id`.
- [ ] `run.json` exists for each run id and records the intended changed file.
- [ ] `govern.txt` names the blocking rule and affected path for the boundary violation.
- [ ] `next-evidence-action.json` uses `primaryAction.kind: "governance"` when governance is the selected closure obligation.
- [ ] `authorize.release-bot.merge.json` exists for the selected run and has a non-approval outcome.
- [ ] Wrong-run authorization artifacts do not change the selected run's authorization result.
- [ ] Grant mismatch or confidence-floor failure explains why automation is not approved.
- [ ] Unsupported or malformed control-plane snapshots, if introduced as an extra check, instruct the operator to rerun instead of projecting stale authority.
- [ ] No generated `.ts-quality/runs/**`, coverage output, private keys, or attestation scratch files are committed unless the release verifier intentionally snapshots a reviewed fixture.

## Pass/fail interpretation

This pilot passes when the negative result is specific, run-bound, and reproducible. A failing check is not a failed pilot if the artifacts explain the boundary violation or authorization gap precisely.

This pilot fails if any surface grants approval from ambient files, latest-run state, a different run id, an unmatched grant, or an unsupported control-plane snapshot.
