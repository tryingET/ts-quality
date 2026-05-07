---
summary: "Executable negative-path proof for governance boundary violations, wrong-run authorization artifacts, and insufficient grants."
read_when:
  - "When explaining authorization denial or governance boundary negative paths"
  - "When checking whether wrong-run approval artifacts can become ambient trust"
type: "evidence"
---

# Negative governance and authorization proof

This proof promotes the negative-path governance/authorization story from a plan into executable repo-local evidence.

Executable source:

```bash
node --test test/authorization-integration.test.mjs
```

Focused tests:

- `mini-monorepo negative pilot keeps boundary violations and wrong-run authorization run-bound`
- `mini-monorepo negative pilot refuses insufficient authorization grants`
- `authorize ignores attestations that target an older run`

## What the proof covers

### Governance boundary violation blocks authorization

Fixture: `fixtures/mini-monorepo`.

The negative run reviews:

```text
packages/api/src/consumer.js
```

That file violates the configured `api-cannot-import-identity` boundary. The test proves:

- `check --run-id negative-governance-boundary` writes the run packet and governance projection;
- `govern.txt` names `api-cannot-import-identity` and `packages/api/src/consumer.js`;
- `authorize --agent maintainer --run-id negative-governance-boundary` returns `deny`;
- the authorization reason includes `Governance violations block authorization`;
- `report --json --run-id negative-governance-boundary` remains bound to the selected run and does not mention the other run id.

### Wrong-run authorization artifacts stay inert

The same test first creates a clean run:

```text
authorization-other-run
```

That run receives an approval-like `authorize.maintainer.merge.json` artifact. The negative run remains denied anyway:

```text
negative-governance-boundary -> deny
authorization-other-run -> approve
```

This protects the core legitimacy boundary: an approval artifact under another run directory is not ambient trust for the selected run.

### Insufficient grants fail closed

The insufficient-grant test rewrites the fixture agent policy so `release-bot` only has a grant for:

```text
packages/identity/**
```

It then asks `release-bot` to authorize:

```text
packages/api/src/consumer.js
```

The expected outcome is `deny` with a reason matching:

```text
No authority grant covers the requested action and scope
```

### Older-run attestations are ignored

`authorize ignores attestations that target an older run` creates an attestation for one run, creates a second run, then authorizes the second run. The expected result is `request-more-proof` with the required claim still listed in `missingProof`.

## Product interpretation

These are successful negative paths. They show that `ts-quality` does not:

- use the latest approval sidecar as ambient authority;
- treat a matching agent id as a blanket grant;
- allow governance findings to become advisory when authorization is requested;
- reuse attestations from another run.

The selected run id and run-bound evidence context remain the authority boundary.
