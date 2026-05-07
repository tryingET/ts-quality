---
summary: "Repo-local dogfood run for the accepted-adoption catalog guardrail slice."
read_when:
  - "You are reviewing dogfood evidence for accepted-adoption catalog guardrails."
  - "You need an example where dogfood mutation survivors drove an immediate test hardening pass."
type: "evidence"
---

# ts-quality catalog guardrail dogfood — 2026-05-07

## Scope

- repo: `softwareco/owned/ts-quality`
- changed scope: `scripts/register-screening-catalog.mjs`
- focused test: `test/screening-catalog-script.test.mjs`
- dogfood config: temporary `.ts-quality/tmp/dogfood/ts-quality.config.ts`
- run id: `dogfood-catalog-guardrail`
- witness: `.ts-quality/witnesses/dogfood-catalog-guardrail.json` (ephemeral during this dogfood)

This dogfood checked the catalog guardrail that prevents `accepted-repo-local` catalog claims without accepted evidence fields.

## First dogfood result

The first `ts-quality check` found real remaining evidence debt:

```json
{
  "outcome": "fail",
  "confidence": 66,
  "changedFiles": ["scripts/register-screening-catalog.mjs"],
  "witness": "execution-witness",
  "mutation": { "killed": 4, "survived": 2, "sites": 6 },
  "next": "mutation-survivors"
}
```

The survivor remediation pointed at `scripts/register-screening-catalog.mjs` line 145 in `normalizeStringArray`: tests did not distinguish a non-array value from an array containing an empty string after `||` was mutated to `&&`.

## Fix applied before closure

`test/screening-catalog-script.test.mjs` now asserts both validation branches for accepted evidence arrays:

- `acceptedEvidence.latestEvidence` must be an array;
- `acceptedEvidence.commands` must not contain empty strings.

## Final dogfood result

After the test hardening, the same dogfood run passed:

```json
{
  "outcome": "pass",
  "confidence": 90,
  "changedFiles": ["scripts/register-screening-catalog.mjs"],
  "witness": "execution-witness",
  "coverage": [
    { "filePath": "scripts/register-screening-catalog.mjs", "pct": 89.14 }
  ],
  "mutation": { "killed": 6, "survived": 0, "sites": 6 },
  "next": "none"
}
```

Commands used:

```bash
node dist/packages/ts-quality/src/cli.js witness test \
  --invariant adoption.catalog.accepted-evidence \
  --scenario accepted-stage-requires-evidence \
  --source-files scripts/register-screening-catalog.mjs \
  --test-files test/screening-catalog-script.test.mjs \
  --out .ts-quality/witnesses/dogfood-catalog-guardrail.json \
  -- node --test test/screening-catalog-script.test.mjs

node dist/packages/ts-quality/src/cli.js check \
  --config .ts-quality/tmp/dogfood/ts-quality.config.ts \
  --changed scripts/register-screening-catalog.mjs \
  --run-id dogfood-catalog-guardrail

node dist/packages/ts-quality/src/cli.js report --run-id dogfood-catalog-guardrail
node dist/packages/ts-quality/src/cli.js explain --run-id dogfood-catalog-guardrail
node dist/packages/ts-quality/src/cli.js retention --config .ts-quality/tmp/dogfood/ts-quality.config.ts --machine
```

Generated dogfood artifacts under `.ts-quality/runs/`, `.ts-quality/latest.json`, `.ts-quality/mutation-manifest.json`, `.ts-quality/tmp/dogfood/`, and `.ts-quality/witnesses/dogfood-catalog-guardrail.*` are ephemeral and should not be committed.
