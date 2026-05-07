---
summary: "Bounded Software Trust Remediation Corridor proof for the raw public-contract and authorization-outcome hardening slice."
read_when:
  - "When checking whether a review finding was closed with executable trust evidence"
  - "When reviewing the remediation corridor from bug finding to verified public contract proof"
type: "evidence"
---

# Software Trust Remediation Corridor proof

## Corridor slice

This proof captures one bounded remediation corridor in `ts-quality`:

```text
adversarial finding
-> scoped AK task
-> code/test/doc remediation
-> focused verification
-> ts-quality dogfood run
-> repo verification gate
-> committed evidence
```

Slice: raw public CLI contract and real target-shape authorization outcome truth.

- AK task: `#2604 Harden raw public contract and authorization fixture outcome proof`
- Commit: `7884459 fix: harden raw contract validation`
- Reviewed finding source: deep review found that raw `--version` output was being validated after trimming and that a real target-shape authorization projection asserted only run binding, not the actual authorization outcome.

## Remediation applied

### Raw public CLI contract

Files:

- `scripts/public-cli-contract.mjs`
- `scripts/packaging-smoke.mjs`
- `test/adoption-guidance.test.mjs`
- `test/packaging.test.mjs`

Change:

- `--version` validation now requires exact bare semver plus trailing newline.
- Packaging smoke validates public CLI contract cases against raw stdout via `runRaw(...)` instead of globally trimmed stdout.
- Adoption guidance tests reject `0.5.0` without a trailing newline and reject noisy `ts-quality 0.5.0\n` output.
- Packaging smoke continues using trimmed text for human/operator command checks that intentionally compare content rather than byte-level public contract output.

### Authorization outcome truth for real target-shape fixture

Files:

- `fixtures/artifact-compatibility/manifest.json`
- `test/artifact-compatibility-fixtures.test.mjs`
- `docs/adoption/2026-05-07-kinetic-caption-studio-vitest-esm-adoption.md`

Change:

- The real ESM/Vitest target-shape capture now records expected authorization outcome: `deny`.
- The expected reason is `Unknown agent release-bot` because the captured control-plane snapshot intentionally has no `release-bot` grant.
- The compatibility test now asserts the authorization outcome and reason, not just `evidenceContext.runId` / `runOutcome`.
- The adoption evidence doc now states that this proves selected-run authorization projection compatibility, not accepted automation approval.

## Verification evidence

Focused validation commands passed:

```bash
npm run build
node --test test/adoption-guidance.test.mjs
node --test test/packaging.test.mjs
node --test test/artifact-compatibility-fixtures.test.mjs
```

Dogfood evidence:

```text
run id: dogfood-raw-contract-outcome
outcome: pass
merge confidence: 90/100
mutation: 6 killed / 6 site(s), 0 survived
coverage generation: pass
next evidence action: none
```

Repository gates passed:

```bash
npm run verify:ci
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict
```

Generated dogfood run/tmp/witness/latest/mutation artifacts were removed before commit.

## Trust boundary preserved

This corridor intentionally separates four truths:

1. Public contract byte shape: exact raw stdout matters for machine-facing CLI checks.
2. Human/operator command text: trimmed comparisons are acceptable only where the contract is not byte-level.
3. Authorization projection compatibility: an authorization command can project a selected run and still deny.
4. Automation approval: requires a matching agent/grant/standing; it must not be inferred from projection success.

## Residual limitation

This corridor proves one bounded remediation slice. It does not claim full outside-repo production adoption or broad authorization acceptance. The next useful corridor should repeat the same pattern on another real target-shape finding or accepted repo-local adoption path.
