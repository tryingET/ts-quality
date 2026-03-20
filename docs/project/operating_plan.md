---
summary: "Operating plan after AK #197: attestation-review outputs now share a canonical verification record across CLI/runtime/sample surfaces with a machine-readable escape hatch, and no follow-on repo-local SG2 slice is materialized yet."
read_when:
  - "When deciding the next bounded implementation slice in ts-quality"
  - "When translating the current tactical state into the repo-local queue"
type: "reference"
---

# Operating plan

## Active decomposition target
There is no active repo-local implementation slice materialized right now.
The SG2 authorization and attestation-review slices are complete through AK `#197`, and the next execution pass should materialize the follow-on SG2 slice before coding.

## Why the opening SG2 slice is now complete
Repo truth now shows legitimacy decisions carrying the same additive run-bound evidence discipline as the reviewed operator surfaces:
- `authorize.<agent>.<action>.json` projects exact run-bound artifact paths
- authorization outputs surface current blocking governance findings instead of only a compressed denial reason
- authorization outputs surface first risky-invariant provenance from `behaviorClaims[].evidenceSummary`
- reviewed sample artifacts and regression coverage now treat that authorization projection as contract-bearing

## Completed this session

### M3 — **AK `#192`** — surface run-boundary evidence in authorization decisions
State:
- completed 2026-03-18

Deliverable now true:
- `packages/ts-quality/src/index.ts` augments authorization decisions with additive `evidenceContext`
- authorization artifacts now cite exact run-relative paths for `run.json`, `verdict.json`, `govern.txt`, and the generated change bundle
- decision artifacts now project current blocking governance findings plus the first risky-invariant provenance summary without creating a second evidence authority
- reviewed sample authorization artifacts and targeted regression coverage now lock that contract

Primary files touched:
- `packages/evidence-model/src/index.ts`
- `packages/ts-quality/src/index.ts`
- `test/authorization-integration.test.mjs`
- `test/golden-output.test.mjs`
- `examples/artifacts/governed-app/authorize.release-bot.json`
- `examples/artifacts/governed-app/authorize.maintainer.json`
- `examples/artifacts/governed-app/authorize.maintainer-approved.json`
- `README.md`
- `docs/legitimacy-agent-licensing.md`
- `docs/project/strategic_goals.md`
- `docs/project/tactical_goals.md`
- `docs/project/operating_plan.md`
- `next_session_prompt.md`
- `governance/work-items.json`
- `diary/2026-03-18--feat-authorization-evidence-context.md`

### M4 — **AK `#193`** — harden config loading to eliminate executable TS/JS module evaluation
State:
- completed 2026-03-19

Deliverable now true:
- `packages/ts-quality/src/config.ts` parses `.ts` / `.js` / `.mjs` / `.cjs` config-like files as data-only modules instead of executing repo code through `vm`
- repo-local support files loaded through the same path (`.ts-quality/invariants.*`, `.ts-quality/constitution.*`, `.ts-quality/agents.*`, and similar) now obey the same data-only contract
- executable expressions such as function calls or runtime property access are rejected deterministically during load
- regression coverage now locks accepted data-only forms and rejected executable forms
- docs and ADRs now state clearly that this is an intentional alpha-stage breaking change

Primary files touched:
- `packages/ts-quality/src/config.ts`
- `test/config-loading.test.mjs`
- `README.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `docs/config-reference.md`
- `docs/decisions/2026-03-19-alpha-breaking-changes-allowed.md`
- `docs/decisions/2026-03-19-data-only-config-modules.md`
- `docs/project/strategic_goals.md`
- `docs/project/tactical_goals.md`
- `docs/project/operating_plan.md`
- `next_session_prompt.md`
- `governance/work-items.json`

### M5 — **AK `#194`** — materialize config/support modules into canonical runtime JSON artifacts
State:
- completed 2026-03-20

Deliverable now true:
- `ts-quality materialize` exports the currently loaded config/support data into `.ts-quality/materialized/`
- generated `ts-quality.config.json` rewrites support-file paths to exported JSON artifacts so later checks can run from boring materialized runtime inputs
- one end-to-end regression now proves `check --config .ts-quality/materialized/ts-quality.config.json` yields the same verdict as the source config on the governed fixture
- docs and example flow now show how to run from materialized runtime artifacts

Primary files touched:
- `packages/ts-quality/src/index.ts`
- `packages/ts-quality/src/cli.ts`
- `test/cli-integration.test.mjs`
- `README.md`
- `docs/config-reference.md`
- `examples/basic/README.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- `next_session_prompt.md`
- `docs/project/operating_plan.md`
- `governance/work-items.json`

### M6 — **AK `#195`** — surface run-bound subject context in attestation verification outputs
State:
- completed 2026-03-20

Deliverable now true:
- `attest verify` now projects the signed subject path alongside verification status/reason
- when the signed subject is a run-scoped artifact, verification output also surfaces the exact `runId` and artifact name
- reviewed sample artifacts now include attestation verification output with the same run-bound subject framing
- regression coverage now locks both successful and failed attestation verification against the emitted subject context

Primary files touched:
- `packages/ts-quality/src/index.ts`
- `scripts/generate-samples.mjs`
- `test/authorization-integration.test.mjs`
- `test/cli-integration.test.mjs`
- `test/golden-output.test.mjs`
- `examples/artifacts/governed-app/attestation.ci.verification.json`
- `examples/artifacts/governed-app/attestation.verify.txt`
- `docs/attestation-format.md`
- `docs/project/strategic_goals.md`
- `docs/project/tactical_goals.md`
- `docs/project/operating_plan.md`
- `next_session_prompt.md`
- `governance/work-items.json`
- `diary/2026-03-20--feat-attestation-verify-subject-context.md`

### M7 — **AK `#196`** — canonicalize attestation verification records and enforce signed subject parity
State:
- completed 2026-03-20

Deliverable now true:
- a shared structured attestation-verification record now drives CLI review, persisted `attestation-verify.txt`, and the reviewed `attestation.verify.txt` sample
- `check` no longer collapses attestation verification back down to issuer + reason while `attest verify` shows richer subject context
- verification now fails closed when signed `payload.artifactName` drifts from the signed `subjectFile` path
- run-scoped attestation handling now includes nested artifacts under `.ts-quality/runs/<run-id>/...`
- regression coverage now locks runtime/CLI/sample parity instead of only the CLI path

Primary files touched:
- `packages/evidence-model/src/index.ts`
- `packages/ts-quality/src/index.ts`
- `test/cli-integration.test.mjs`
- `test/golden-output.test.mjs`
- `scripts/generate-samples.mjs`
- `docs/attestation-format.md`
- `docs/project/strategic_goals.md`
- `docs/project/tactical_goals.md`
- `docs/project/operating_plan.md`
- `next_session_prompt.md`
- `governance/work-items.json`
- `diary/2026-03-20--feat-attestation-verification-record-parity.md`

### M8 — **AK `#197`** — add machine-readable attestation verification output and malformed-input parity
State:
- completed 2026-03-20

Deliverable now true:
- `attest verify --json` now returns the same canonical verification record that text output and `check` artifacts use
- malformed attestation files now report through that same canonical record instead of leaking raw parser errors to the operator
- CLI help and docs now advertise the machine-readable escape hatch explicitly
- regression coverage now locks JSON output shape plus malformed-input behavior

Primary files touched:
- `packages/ts-quality/src/cli.ts`
- `packages/ts-quality/src/index.ts`
- `test/cli-integration.test.mjs`
- `README.md`
- `docs/attestation-format.md`
- `docs/project/strategic_goals.md`
- `docs/project/tactical_goals.md`
- `docs/project/operating_plan.md`
- `next_session_prompt.md`
- `governance/work-items.json`
- `diary/2026-03-20--feat-attestation-verify-json-and-malformed-parity.md`

## Current ready queue
Ready now:
- none repo-local

Completed this session:
- `#178` — refresh direction cascade after #177 closeout and seed the next non-TUI SG2 wave
- `#192` — surface run-boundary evidence in authorization decisions
- `#193` — harden config loading by replacing executable module evaluation with a data-only parser
- `#194` — materialize config/support modules into canonical runtime JSON artifacts
- `#195` — surface run-bound subject context in attestation verification outputs
- `#196` — canonicalize attestation verification records and enforce signed subject parity
- `#197` — add machine-readable attestation verification output and malformed-input parity

Deferred this session (authority-bound in AK):
- `#190` — automate AK-to-handoff projection sync
- `#191` — stabilize or untrack volatile verification artifacts

## Planning refresh completed this session
AK `#178` materialized the attestation-review slice, and AK `#195` through `#197` have now landed.
Amendment-facing results remain the next candidate, but no follow-on repo-local SG2 task is materialized yet.

## Next implementation target
Before more implementation work, materialize the next **SG2** slice.
Candidate starting area: amendment-facing results that still compress proposal/rule context too far.

## HTN

```text
G0: Make decision-facing outputs stay honest about additive evidence provenance
  SG1: Close the remaining concise operator-surface gaps under behaviorClaims[].evidenceSummary [done]
    TG1: Finish concise run-status outputs so they still show risky-invariant context [done]
      P1: AK #184 -> project provenance into check-summary.txt [done]
      P2: AK #187 -> surface risky invariant context in trend output [done]
    TG2: Align generated sample artifacts and README with the concise output contract [done]
      P3: AK #185 -> add check-summary.txt to sample artifacts and README [done]
    TG3: Lock concise output parity with targeted regression coverage [done]
      O1: AK #186 -> add regression coverage for check-summary provenance output [done]
  SG2: Carry the same evidence truth into governance/legitimacy decision surfaces [active]
    TG5: Make authorization decisions cite exact run-bound evidence [done]
      P4: AK #192 -> project run-bound evidence context into authorize outputs [done]
    TG6: Make attestation verification outputs cite exact signed subject context [done]
      P5: AK #195 -> project run-bound subject context into attestation verification outputs [done]
      P6: AK #196 -> canonicalize attestation verification records and enforce subject-field parity [done]
      P7: AK #197 -> add machine-readable attestation verification output and malformed-input parity [done]
```

## Queue discipline
- do not invent a fake active AK slice when none exists
- start the next session by confirming repo-local readiness, then materialize the next SG2 task before coding
- keep `next_session_prompt.md` pointed at real queue truth: either a ready AK task or an explicit “none materialized yet” handoff
