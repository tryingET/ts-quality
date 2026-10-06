---
summary: "Owner-accepted repo-local adoption of published ts-quality@0.7.0 in softwareco/owned/test-capabilities, rerun from its normal checkout."
read_when:
  - "You need the evidence behind the test-capabilities accepted-repo-local catalog entry"
  - "You need an example of accepted adoption on a published package rather than a scratch pilot"
type: "evidence"
---

# test-capabilities: accepted adoption on npm ts-quality@0.7.0

## Status

- targetRepo: `softwareco/owned/test-capabilities`, commit `db984a08174978ae1fb00fc0286845b5e2eeb831`
- adoptionStatus: `accepted-repo-local` for four live slices
- acceptedBy / acceptedAt: Holding Owner, 2026-10-06 (owner decision recorded on ts-quality AK #6550, evidence 14172)
- packageSource: npm `ts-quality@0.7.0`, pinned exactly as a devDependency (target AK #6759)
- sourceOfTruth: the target's `docs/dev/ts-quality-current-vs-target.md`; this central note and the catalog are downstream

## What changed in the target and why

1. **Published package.** The target had no local install, so its resolver fell back to the sibling `../ts-quality/dist`, which now carries unreleased source. Pinning `ts-quality@0.7.0` makes normal-checkout runs use the published package.
2. **Mutation timeout 15000 -> 60000 ms.** With public 0.7.0 and the old budget, the quantum slice failed closed: the baseline (the full runtime suite, about 29 s under load) timed out, so no mutant could be scored (`tc-quantum-operation-v070-20261006`, 15/100, fail). The April 0.1.0-era pass for the same slice predates both the in-workspace baseline and the larger suite.
3. **Four slices, not five.** The target removed the command-runner slice together with its dead command runner; the catalog entry still listed it.

## Evidence (normal checkout, 2026-10-06)

The target's own `npm run check` passed with the change. `screening:witness-refresh` regenerated all four witnesses with 0.7.0 content bindings (`binding.version: "1"`).

| Slice | Run id | Outcome | Mutation | Witness |
|---|---|---|---|---|
| `operation.kernel.fail-closed` | `tc-operation-kernel-accept-20261006` | pass, 90/100 | 6/6 killed | execution-backed |
| `healing.collect-files.boundary` | `tc-collect-files-accept-20261006` | pass, 90/100 | 10/10 killed | execution-backed |
| `operation.quantum.input-envelope.contract` | `tc-quantum-operation-accept-20261006` | pass, 90/100 | 3/3 killed | execution-backed |
| `operation.test.config-override.contract` | `tc-config-overrides-accept-20261006` | pass, 90/100 | 16/16 killed | execution-backed |

Each run carries `changedFileDigests` for its declared paths. Run artifacts stay in the target and are gitignored there.

## Known gaps

- Every slice keeps coverage pressure: some changed functions are under 80% line coverage, the lowest at 0% in `dispatch-execution.ts`.
- Mutation runs execute the whole runtime suite per mutant, so one slice takes minutes.
- The April runs `tc-config-overrides-screen` and `tc-quantum-operation-screen` (unbound witnesses, no changed-path digests) are history, not current evidence.
- Accepted adoption is about the live setup, not a quality verdict on the target.

## Rollback

Uninstall `ts-quality`, revert `mutations.timeoutMs`, and mark the target doc `paused`; keep the doc and witness README as history.
