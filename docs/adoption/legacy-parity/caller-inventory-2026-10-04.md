---
summary: "AK6585: bounded caller evidence separates active resolution, legacy self-use, routing, and unknown private receivers."
read_when:
  - "Adjudicating useful-native supersession and actual receiver migration."
type: "evidence"
---

# Caller inventory — AK6585, 2026-10-04

## Findings and limits

One external executable receiver is confirmed in the inspected set:
`softwareco/owned/test-capabilities`, already using native `ts-quality` commands.
Its existing resolver selected sibling active compiled CLI; inspected `--version`
returned `0.7.0`, exit 0. This is normal-checkout **resolution proof only**, not
installed-package proof, a screening execution, accepted adoption or publication.

No external legacy package, deep-import or artifact-parser receiver was found
in this bounded scan. This does not prove global/private absence or accept any
interface loss. Legacy executable self-use establishes concrete historical jobs,
not recent remote execution or permission to remove them.

No installs, network requests, builds, product checks, witnesses, source changes,
consumer acceptance or legacy state changes were performed by this inventory.
Parent reran the existing pinned parity probe: 19 checks, 16 differences, three
bounded equivalents; outcome remains `complete_parity_disproved_at_audited_pins`.
There is no package-source difference between the old active audit pin
`07f3529a714f63157d6e66d2866d6254c97a3259` and current active HEAD.

## Source identities and scan denominator

Paths below resolve under `/home/tryinget/ai-society/softwareco/`.

| Prefix | Repository | Observed HEAD | Tracked / primary scanned entries |
|---|---|---|---|
| A | `owned/ts-quality` | `63ea703de8dcf13dfe453daa574cfbdff4dcb9ee` | 516 / 284 |
| L | `infra/ts-quality-tools` | `c5c726e61f0783c473650dbfd25a59bced7d9c7f` | 198 / 194 |
| C | `owned/test-capabilities` | `9bb568c27ec1d9e741b12513c54ce07b71c46ff6` | 417 / 415 |
| O | `owned` lane root | `9934d5b1e9cf294f2e612088c3effee57af94e22` | 99 / 98 |
| I | `infra` lane root | `1e5d0e58abc425f87e1133fffcc647525350ce4e` | 45 / 43 |

Primary scan: 1,034 selected files from 1,275 tracked entries. Git-tracked lane-root
files only; no recursive scan of child repositories. Searches covered scoped
package/checkout names, source/dist CLI paths, import/require edges, public API
names and result/planner/bundle/readiness/validation/release-trust families.
Executable receivers were separated from docs and test-only references.

Omitted: generated dist/artifacts, fixtures, `_core` snapshots, binary/sensitive
state, deleted wrappers and infra gitlink. Supplementary exact reads covered the
compiled version path and 13 dependency modules. No ignored result/history state
or archives were inspected. No registry/private reverse-dependency census exists.

Pre-existing state preserved: A `.ontology/`; L modified `AGENTS.md` and
`next_session_prompt.md`, three deleted AK/operator wrappers; I issue-tracker
Git link. Initial/final scout state matched. Those paths are not this task's work.

## Receiver and historical-job ledger

All rows are static source evidence unless explicitly marked observed.

| Receiver / class | Evidence | Required disposition / proof |
|---|---|---|
| C native CLI resolution, observed | `scripts/screening/ts-quality-common.sh:6-40`: override, local install, sibling active dist, PATH; existing `run_ts_quality --version` selected A `dist/packages/ts-quality/src/cli.js`, returned 0.7.0/0 | Preserve resolution precedence; later S5 must execute a scoped screening and obtain named receiver acceptance/rollback. Compiled CLI SHA-256: `8e5f0d160f09f5757f7cbb3bc4516acfaefb03097026da4fd68e8a72b59b8973` |
| C native screening commands | `package.json:83-84`; `scripts/screening/ts-quality-check.sh:19-26`, witness wrapper `:21-24`, common helper `:313-454`; `ts-quality.config.json:3-17` | Native `check`/`witness refresh`, explicit scope, generated/remapped LCOV, runtime mirrors, covered-only mutations, 15,000ms/64-site budgets. No old import/parser found. CLI exit success is not verdict approval |
| L root CRAP receiver | `scripts/quality-plan.mjs:159-183`; `quality-plan-contract.mjs:145-165`; CRAP `src/cli.ts:98-156` | Historical root consumes flat entry array and `--cwd/--json` output; migrate job to native schemas, not an implicit compatible alias |
| L mutation wrapper/result receiver | `scripts/ts-mutate-target.sh:238-333`; mutation `src/workflow.ts:543-564` | Historical mission/result JSON and baseline/survivor/timeout nonzero semantics; native migration needs explicit artifact assertions or a tested receiver adapter |
| L planner/history parsers | `scripts/persist-mutation-result.mjs:78-109`; `quality-loop.mjs:308-373` | Preserve useful survivor/intervention navigation with fresh affirmative site outcomes; old schema itself is not required absent a receiver |
| L bundle/readiness/summary parsers | `scripts/quality-bundle.mjs:281-358,498-535`; readiness snapshot `:676-745`; validation summary inspect `:223-245`, compare `:845-909` | Native package index and separately labeled quality/verification/release facts; producer-reader roundtrip, missing/stale/reference failures |
| L root CI and Justfile | `package.json:18-51` (33 scripts); `justfile:19-29,82-84`; `.github/workflows/validation.yml:37-142` | Historical command/artifact-upload coupling, not observed recent CI. Native root reuses verify and existing Justfile task6553; all old jobs require explicit mapping |
| L component release and offline diagnostics | scoped manifests `packages/{crap4ts,ts-mutate}/package.json:2-31`; `.release-please-config.json:4-15`; `.github/workflows/publish.yml:40-74`; preview `:135-168`, inspect `:198-218,249-272` | Separate component topology is configured, not proven published/private demand. Native target/diagnostics preference is a design choice; registry/remote discontinuation remains separately held |
| L library/deep-import tests | CRAP `src/index.ts:1-8`, mutation `src/index.ts:1-11`; internal `__tests__/lcov.test.ts:5`, `__tests__/manifest.test.ts:7-8` | Public and deep-import compatibility is possible, but external receiver not found. Do not reproduce wholesale barrels or declare absent private users |
| A audit consumer | `test/legacy-parity-probe.mjs:13-15` | Git-object audit only, not a production legacy consumer; preserve probe/archive retrieval when legacy custody changes |
| O/I routing | O `docs/project/repo-capability-map.md:82`; I same relative path `:43` | Infra still routes CRAP/mutation to legacy; owned understates active runtime. Lane-owner correction is separate work and explains the observed wrong-repo Ripwire attempt |

## Optional controls: evidence for individual decisions

| Control | Actual historical use and current receiver evidence | Candidate native choice |
|---|---|---|
| Loose equality | L mutation `src/mutations.ts:72-75,96-121` discovers runtime `==/!=`; active visitor lacks it. No external need found | Retain valid runtime probes as operator completeness, never mutate type-only syntax |
| Relative timeout factor | L CLI `:109-116`, workflow `:543-544,577`: default factor10/minimum1000ms. Wrapper forwards supplied flags but synthesizes no factor. C uses fixed15000ms | Keep explicit fixed budget; hold relative policy pending measured need |
| Parallel workers | L workflow `:463-466,579` can use CPU/site-bounded workers; wrapper forwards caps. Planner `quality-plan-contract.mjs:168-205` defaults missions to one | Serial first; hold parallelism pending timing and isolation proof |
| Implicit LCOV | L planner calls CRAP without `--lcov` after generation; CRAP CLI `:98-105` searches defaults. Mutation wrapper `:261-267` adds package LCOV if present; leaf fallback remains | Retain convenience via explicit discovered/recorded inputs; no missing-LCOV-as-covered assumption |
| Warning-only threshold | Legacy CLI exposes mutation warning; wrapper can forward it. No external warning-only receiver found | Native inert site/budget preview; old flag compatibility held pending an actual receiver |
| Manual declaration acceptance | Legacy manifest-update API exists; no external need found | Fingerprinted result cache and explicit selection lineage; old declaration-sidecar interface held |
| Release preview | Legacy publication workflow calls preview, and inspector reads persisted output | Retain useful offline diagnostics outside quality semantics; publication remains separately authorized |

## Owner-surface and current task corrections

- AK6551 is now **done**, commit `ce57c0c`, with retained installed captured-artifact
  and pinned Bun full-scope proof. Its quality result is fail, authorization deny;
  this is not adopted live use or public0.7. Do not reopen it from older wave prose.
- Preserve existing6548 release,6550 adoption,6552 refactor,6553 Justfile,6557
  packet-publication and6549/decision171 direction ownership. Existing decision171
  does not accept native supersession or retirement.
- C's owner doc lists four slices (`docs/dev/ts-quality-current-vs-target.md:19-28`);
  A's catalog still names a removed fifth command-runner slice
  (`docs/adoption/entries/test-capabilities.json:23-35`). S5 should reconcile the
  exact receiver record under its owner's authority, not count stale rows as use.
- Preservation still lacks accepted durable destination/custody freeze and restore
  proof. Private/historical interface disposition, AK identity/tasks, lane routing,
  remote/package actions, formal retirement and exact-path removal remain held.

## Evidence custody

Read-only scout: `dispatch-1791137508468` (initial inventory and bounded follow-up).
Parent independently inspected the receiver resolver, lane routing and canonical
AK task6551 and reran the existing parity probe. Scout output is evidence, not
caller acceptance or authority. This tracked inventory preserves the inspectable
facts; AK6585 records their canonical task/evidence relationship separately.
