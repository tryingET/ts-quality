---
summary: "Evidence-linked ts-quality reality-to-vision posture: trust-safety, release, acceptance, and compatibility horizons."
read_when:
  - "When assessing current reality against the product vision or selecting the next readiness horizon"
  - "When distinguishing shipped code, installed-package proof, public releases, scratch pilots, and accepted live adoption"
type: "reference"
---

# Product Posture: ts-quality

## Posture in one sentence

The deterministic trust layers and actionable evidence surfaces exist, but release-grade trust is **not closed**: current source fixes exceed the recorded `0.6.0` release, witness support still lacks content-freshness binding, and scratch/compatibility pilots do not establish owner-accepted normal-checkout adoption.

This is a product-level evidence snapshot assessed on **2026-10-03**, not the live queue. AK owns execution, direction, decisions, and acceptance authority. Durable ambition stays in `vision.md`; runtime truth stays in source, tests, README, and public contracts.

## Evidence stages — do not collapse them

| Stage | Observed evidence | Limit |
|---|---|---|
| Source tree | Root/public manifests identify `0.6.0`; `CHANGELOG.md` separates that release from **Unreleased** fixes and additions. | A local tarball labelled `0.6.0` can contain newer code than the public tag. Pin the commit/tarball digest, not just the version string. |
| Local verification / packaging | The root `npm run verify` contract builds, typechecks, tests, regenerates samples twice, and exercises the installed tarball. | Fixture-backed package proof is not fresh public-registry proof or exhaustive real-target compatibility. |
| Recorded public package use | September Jest/Yarn4 and Bun pilot records identify npm `ts-quality@0.6.0`; the release and migration records describe the Node 22 floor and license rider. | Registry state/provenance was not independently refreshed in this assessment. Do not claim Unreleased safeguards are public. |
| Real-shape scratch pilots | JS, TypeScript/dist, monorepo, ESM/Vitest, TSX/pnpm/jsdom, Jest/SWC/Yarn4, and Bun targets have captures. | Archived/copied targets are not accepted live adoption. Some captures intentionally demonstrate denial or drift. |
| Repo-local live setup | The central test-capabilities proof records five live slices. | Acceptance fields remain pending in that proof; no fresh target-checkout rerun or acceptance date is asserted here. |

Evidence links: `../../CHANGELOG.md`, `../adoption/2026-09-26-appmap-node-jest-yarn4-adoption.md`, `../adoption/2026-09-26-semantic-code-intelligence-bun-scale-adoption.md`, `../adoption/2026-05-06-test-capabilities-accepted-repo-local-proof.md`.

## Reality against the trust ladder

| Vision layer | Current reality | Remaining obligation |
|---|---|---|
| Scoped change truth | Explicit CLI/config/diff scope; canonical repo-local inputs; changed-hunk narrowing. Current source snapshots every changed file independently of source discovery, including missing paths. | Historical packets lacking a changed-path digest must not silently authorize that path. Recheck them with a new run id. |
| Structural evidence | LCOV, configured generation, complexity, changed functions, package attribution, source-map warnings. | Test actual target build/coverage commands; high coverage is not behavioral proof. |
| Behavioral pressure | Baseline checks, isolated workspaces, runtime mirrors, fingerprints and survivor obligations. | The Unreleased workspace-baseline correction prevents infrastructure failures being scored as kills. Public consumers need that correction and affected-run migration. |
| Invariant alignment | Focused assertion-bearing lexical evidence, explicit/inferred/missing sub-signals and obligations. | Keep lexical alignment distinct from execution-backed support. |
| Execution witnesses | Manual/configured commands, artifacts, sidecar receipts, narrow id/scenario/source-scope matching. | **Safety gap:** old matching pass artifacts can still count after source/test changes, even alongside a fresh failure. Bind support to content and execution context before claiming freshness. |
| Governance fit | Boundaries, approvals, waivers, rollback, ownership and risk budgets; negative-path tests. | Real-target negative cases and explicit CI artifact assertions, not process exit alone. |
| Legitimacy | Run-targeted agents/grants, attestations, overrides and amendments; drift denial. Current source rejects occupied/reserved run ids before commands and prevents storage overwrite. | Propagate immutable-id/new-review habits into release migration and consumers. Approvals must never transfer to replacement evidence. |
| Release-grade reproducibility | Installed CLI/API/types and representative operator paths; public-contract and artifact compatibility checks. | Publish safety fixes through owner authorization, expand installed real-capture coverage, and obtain accepted normal-checkout proof. |

Current source improvements are not a claim of public availability. `run.json` remains the check-time packet; later projections may consume targeted post-check approvals/attestations without replacing it.

## Horizons and closure evidence

### Horizon 1 — trustworthy evidence boundaries

Prioritize safety before feature breadth:

- Reject run-id reuse, including concurrent producers and interrupted reservations.
- Bind drift checking to **all declared changed paths**, including config, tests, excluded files and missing-to-created transitions.
- Bind witness support to current source/test bytes and the relevant execution context; define fail-closed legacy and contradictory-witness behavior.
- Make CI enforce a matching, drift-free projected verdict and exact-run authorization where required. Successful command execution is not an approving decision.

The first two are implemented in current source with adversarial regressions. CI guidance includes executable decision assertions. **Witness freshness remains unresolved**; refresh focused witnesses immediately before review as a temporary practice, not as an enforced product guarantee.

Closure: negative regressions refuse these false-trust cases, the protected manual/auto witness contract remains truthful, and the public package contains the safeguards.

### Horizon 2 — released and accepted operator experience

- Deliver a safety follow-up through the repository's authorized release process; document which old evidence must be regenerated.
- Prove the public installed-package path with exact version/commit/tarball provenance.
- Obtain target-owner acceptance and a fresh normal-checkout bounded flow: doctor → focused witness → check → report/explain → required governance/authorization → retention.
- Record acceptance owner/date, reusable control plane, rollback and residual evidence obligations.

Closure: an outside operator follows the flow without hidden maintainer narration. The central `repo-local-live` proof and additional scratch pilots alone cannot close this horizon.

### Horizon 3 — compatibility and sustainable breadth

- Exercise real historical/current captures through the installed tarball, not only repository `dist`.
- Preserve Jest's missing-source drift-denial case as negative proof, not drift-free compatibility.
- Keep Bun's roughly 170-source scale capture distinct from its one-source compatibility fixture; pin a reproducible scale procedure.
- Refactor oversized trust modules/tests behind behavior-preserving verification and public artifact/API checks.
- Establish the lane-standard command surface without replacing native npm verification.

Closure: concise summaries and machine packets tell the same story across supported real shapes; optional/future fields remain compatible while unsupported trust schemas fail closed.

### Longer horizon — release-grade daily trust

Do not infer 1.0 readiness from feature count or a green fixture suite. Require accepted adoption, content-bound fresh evidence, repeatable public packaging/CI, documented migration/rollback, and compatibility obligations supported by actual receiver evidence. The product should remain an evidence debugger, not a task tracker, dependency owner, general workflow engine or natural-language proof system.

## Direction health is not product maturity

The assessment found no pre-existing open repo tasks, but `ak direction check` reported **nine** execution-state mismatches: OP1–3 and SF1–6 refer to completed tasks while still active/next. Legacy metadata also references retired markdown direction files; the active SG8/TG21 wording still targets the public `0.2.0` pilot wave.

That is stale sequencing, not proof that the corresponding product obligations are complete. Reconcile through owner-authorized AK-native changes, never routine markdown re-import. `handoff:sync` now checks/exports read-only and continues to fail closed until canonical direction state is reconciled.

## Hard rules for status language

- Say “core trust layers exist,” not “fully mature.”
- Say “recorded public release” when the registry was not freshly verified.
- Separate local unreleased source, installed fixture proof, public package, scratch pilot and accepted adoption.
- Say “execution evidence exists” without implying stale records prove current behavior.
- Treat a denial or drift finding as useful negative proof, not failed adoption.
- Keep summary projections downstream of `run.json`; keep live task/direction/decision truth in AK.

## Authority map

- Durable ambition: `vision.md`
- Product posture: this file
- Shipped behavior: `../../README.md`, `../../ARCHITECTURE.md`, runtime docs/source/tests
- CI receiver policy: `../ci-integration.md`
- Live execution and sequencing: AK
- Raw assessment/reproduction record: `../../diary/2026-10-03-reality-to-vision-assessment.md`
- Durable engineering learning: `../learnings/2026-10-03-run-identity-and-complete-scope-drift.md`
