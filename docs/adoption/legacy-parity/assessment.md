---
summary: "AK6581: source-backed legacy feature inventory, executable non-parity evidence, and unaccepted retirement prerequisites."
read_when:
  - "Assessing whether infra/ts-quality-tools can be retired in favor of ts-quality."
type: "reference"
---

# Legacy parity and retirement assessment — AK6581

## Verdict and authority boundary

**Complete feature parity is not established; concrete non-parity is reproduced.
Formal retirement is not accepted. The old checkout must not be removed yet.**

This is an assessment, not a supersession decision, release approval, consumer
acceptance, registration deletion, remote archive receipt, or deletion permit.
AK owns live tasks/decisions/evidence; this document and its JSON are evidence
artifacts. Audit-task completion does not complete the operator's retirement goal.

Audited Git commits (not npm release assertions):

| Source | Exact commit | Tree |
|---|---|---|
| `softwareco/infra/ts-quality-tools` (L) | `c5c726e61f0783c473650dbfd25a59bced7d9c7f` | `8978ca6a0d06a3733da4889ce48ec693ab0db643` |
| `softwareco/owned/ts-quality` (A) | `07f3529a714f63157d6e66d2866d6254c97a3259` | `29454d4d9dfc7e3a0a29ff2df341176917a00b6d` |

Citations below are repo-relative to L/A at those commits. Checked-in tests were
inspected; that is not a claim that their whole suites were rerun.

## Reproduce the executable findings

From the active repository with its already installed TypeScript compiler:

```bash
node test/legacy-parity-probe.mjs > "$TMPDIR/ak6581-parity.json"
jq '{outcome,runtime,fixtureChecks,equivalentFixtures,differingFixtures}' \
  "$TMPDIR/ak6581-parity.json"
```

Optional `LEGACY_TS_QUALITY_REPO` points to another preserved clone containing the
exact old commit. The probe reads **Git objects**, not dirty checkout source or
prebuilt `dist`. It transpiles both pins with the same installed TypeScript into
private TMPDIR scratch, executes API/CRAP CLI fixtures, hashes the source inputs,
and removes only its own scratch. This is not a typecheck, production build,
installed-package proof, security audit, or complete behavioral conformance suite.
It never invokes mutation test commands against either real repository.

Recorded runtime: Node `v26.9.0`, TypeScript `5.9.3`, Linux x64. Two consecutive
runs produced identical JSON after private scratch-path normalization. The
retained `observations.json` contains 19 assertions: **16 differences and three
bounded equivalents**. Probe success means the assessment's counterexamples were
reproduced; it emphatically does not mean parity passed.

| Executed fixture | Legacy | Active | Meaning |
|---|---|---|---|
| Root runtime exports | 17 CRAP / 46 mutation exports | 6 / 3 exports | API contract incompatible; shared names also have changed signatures |
| Parent complexity with nested `if` | 1 | 2 | Different risk semantics |
| Class constructor/getter/setter/method | Four named functions | Only method | Missing analysis of constructor/accessors |
| Ambient `declare function` | No executable function | One function | Active inventory includes non-runtime declaration |
| LCOV line-range denominator | Instrumented lines only: 100% | Text lines incl. comment/declaration: 33.33% | Different coverage/CRAP semantics |
| Repeated LCOV `SF` records | Merge into one map, two lines | Two separate evidence entries | Different duplicate record handling |
| `*`, loose `==`, `++`, literal `0`, `if (a)` | Mutation sites present | Corresponding sites absent | Missing legacy mutation capabilities |
| Boolean in a type alias | Excluded | Mutation site emitted | Active type-only traversal is an adverse difference, not restored capability |
| `+`, strict `===`, runtime `true` | Same spans/replacements | Same spans/replacements | Only these isolated discovery/splice fixtures match |
| Missing LCOV | Unknown/null CRAP | Numeric CRAP (2 in fixture) | Different absence-of-evidence contract |
| Unknown CRAP CLI option | Exit 1 with usage/error | Exit 0 with report | No compatible rejection contract |
| CRAP CLI JSON | Flat entry array | Aggregate report object | Output schema incompatible |

## Complete source/interface inventory

`observations.json` enumerates the exported values, exported declarations/types
by source file, exact package manifests, all 33 legacy root npm scripts, and
SHA-256 inventories of the selected package source plus root scripts/tests,
workflows, Justfile, lock/manifest and release-please inputs. This makes omissions
inspectable instead of identifying parity from overlapping directory names.

The declaration inventory includes export lists and re-export edges; it does not
prove TypeScript signature assignability. An inventory is not behavioral proof.
Rows below account for legacy capability
families and distinguish a missing feature from a potentially intentional change.
Every unmatched row remains **unaccepted**, even if active behavior is safer.

### CRAP API and analysis

| Legacy inventory | Active mapping / unresolved difference | Source |
|---|---|---|
| `buildEntries`, `parseArgs`, `run`, `USAGE` | No compatibility exports; top-level CLI replacement | L `packages/crap4ts/src/cli.ts:98-156`; A `packages/crap4ts/src/cli.ts:6-24` |
| `computeCyclomaticComplexity` | Private helper; nested-body counts differ | L `complexity.ts:14-44`; A `index.ts:124-156` under CRAP source |
| `calculateCrapScore` | `crapScore`: fraction becomes percent; rounding/clamping introduced | L CRAP `crap.ts:1-4`; A CRAP `index.ts:119-122` |
| `discoverSourceFiles`, `filterFilesByFragments` | Shared pattern-based collection, not roots/fragments API | L CRAP `files.ts:49-94`; A evidence-model `index.ts:1129-1132` |
| `extractFunctionsFromSourceFile`, `extractFunctionsFromFile` | `analyzeSource`/`analyzeCrap`: changed identities, anonymous/ambient inclusion, constructor/accessor omission | L CRAP `function-extractor.ts:117-214`; A CRAP `index.ts:176-260` |
| `parseLcov`, `loadLcov`, `autoDetectLcovPath`, `coverageForSource`, `computeRangeCoverage` | Array evidence instead of nested Maps; explicit input vs auto-detection; unique matching vs permissive basename/suffix; different range denominator and unknown handling | L CRAP `lcov.ts:51-142`; A CRAP `index.ts:43-117`; A evidence-model `index.ts:1181-1189` |
| `sortEntries`, `formatReport` | Aggregate report, different tie order/text; active text limits hotspots to ten | L CRAP `report.ts:31-60`; A CRAP `index.ts:247-272` |
| Types `DiscoveredFunction`, `RangeCoverage`, `CrapEntry`, `CliOptions`, `LcovMap` | Incompatible replacement types `CrapOptions`, `CrapAnalysis`, shared `ComplexityEvidence`/`CoverageEvidence` | L CRAP `types.ts:1-30`; A CRAP `index.ts:16-38`; A evidence-model `index.ts:55-64` |
| Deep util imports: normalization, relative path, file/read/cwd, padding | Not root exports in L; deep consumers need separate migration | L CRAP `util.ts:7-39`, `index.ts:1-8` |

CRAP CLI legacy flags: `--src` (repeatable/comma-separated, default `src`),
`--lcov`, `--filter` (repeatable/comma-separated), `--cwd`, `--json`, `--help/-h`.
Missing values/unknown options fail with exit 1; help/success exit 0; explicit
missing LCOV fails. A uses `--root`, `--lcov`, `--changed`, `--json`, with no
legacy roots/fragments/help/error parser; source behavior is authoritative.
See L CRAP `cli.ts:19-96,126-156`, A CRAP `cli.ts:6-24`.

### Mutation API, operators, selection and execution

| Legacy capability family (all exports retained in JSON) | Active mapping / unresolved difference | Source |
|---|---|---|
| AST parse, top-level declarations/module hashes/change indices | No declaration-based incremental API | L mutation `ast.ts:101-138`; A mutation `index.ts:301-326,629-705` |
| CLI `USAGE`, `parseArgs`, `run` | No parser/run compatibility exports | L mutation `cli.ts:15-261`; A mutation `cli.ts:7-25` |
| LCOV load/detection/partition exports | CRAP parser/shared matching, different missing-coverage semantics | L mutation `coverage.ts:49-133`; A mutation `index.ts:105-111` |
| `MANIFEST_VERSION`, build/read/write/relative-source manifest exports | Declaration sidecar replaced by private v2 result cache | L mutation `manifest.ts:9-67`; A mutation `index.ts:321-334` |
| `discoverMutationSites`, `applyMutation` | Same exact-splice idea, incompatible signature/site schema; narrower operator catalog | L mutation `mutations.ts:51-249`, `mutate-text.ts:3-5`; A mutation `index.ts:117-191` |
| Default command/baseline/run command exports | Async shell-string runner becomes private synchronous argv receipt runner | L mutation `runner.ts:9-75`; A mutation `index.ts:239-265` |
| Worker create/cleanup/root exports and parallel execution | Serial snapshot/reset workspace; private helpers; safer writes but no parallel worker controls | L mutation `workers.ts:62-85`, `workflow.ts:353-414`; A mutation `index.ts:482-522,667-707` |
| Scan, manifest-only update, function missions, line selection, since-last-run, mutate-all | No compatible workflow/CLI modes; changed files/hunks and maxSites API are different selections | L mutation `workflow.ts:55-583`; A mutation `index.ts:117-187,629-723` |
| Warnings/context/count/result/mission builders | No compatible `MutationMissionResult` artifact | L mutation `workflow.ts`, `types.ts:85-128`; A mutation `index.ts:46-54` |
| Utils: normalization, path, text/hash/file/directory/cwd/time/name | Some helpers in evidence-model; no leaf compatibility barrel | L mutation `util.ts:9-52`; A mutation `index.ts:5-25` |

Legacy exported mutation types: `MutationCategory`, `MutationResultStatus`,
`MutationMissionResultStatus`, `MutationSelectionMode`, `MutationSite`,
`DeclarationManifestEntry`, `MutationManifest`, `FunctionTarget`,
`MutationResult`, `MutationMissionResultEntry`, `MutationMissionResult`,
`CommandRunResult`, `CliOptions`, `RunContext`, `MutationCounts` and
`LcovCoverageMap`. JSON names each defining file. Active `MutationOptions`,
`MutationRun`, v2 `MutationManifest` and shared evidence types do not preserve
those contracts. In particular legacy timeout is a first-class mutant result;
active mutant status also distinguishes invalid/error/skipped and does not have
that same timeout status. This is not authority to weaken active fail-closed rules.

Legacy operator set: `+ -> -`, `- -> +`, `* -> /`; `< <=>`, `> >=>` boundary
pairs; strict and loose equality/inequality inversions; `&& <-> ||`; runtime
`true <-> false`; `++ <-> --`; `0 <-> 1`; condition inversion in if/ternary/
while/do/for. Type nodes/interfaces/aliases/type parameters/import types are
excluded. Active retains addition/subtraction, relational boundaries, strict
equality, logical pairs and booleans, but omits multiplication, loose equality,
increments, numeric constants and condition inversion. Active traversal does not
retain the same type-node exclusion. L `mutations.ts:51-234`; A `index.ts:147-181`.

Legacy CLI requires one source file and supports `--scan`, `--update-manifest`,
`--lines`, the joint `--function-id/--start-line/--end-line` mission,
`--since-last-run`, `--mutate-all`, `--lcov`, `--timeout-factor` (10),
`--test-command` (shell string, default `npm test -- --runInBand`), `--max-workers`,
`--mutation-warning` (50), `--result-json-out`, `--cwd`, `--help/-h`.
Invalid/incompatible combinations fail; baseline/survivor/timeout failures exit 1;
clean/no-selection success exits 0. Timeout budget is max(1000ms, baseline x
factor); partial/function/dirty outcomes do not advance clean differential state.
A leaf CLI instead uses `--root/--lcov/--changed/--test-command` (comma-separated
argv, default `node,--test`), `--covered-only`, always JSON, and a result cache.
No same survivor-based CLI exit contract. Sources: L `cli.ts:15-261`,
`workflow.ts:100-173,540-608`, `runner.ts:9` (leaf default). The root wrapper
instead chooses workspace build plus symlink-preserving Node tests; do not
conflate these defaults. A `cli.ts:7-25`, `index.ts:629-723`.

**Potentially stronger active behavior, not a parity substitute:** green baseline
requirement, workspace snapshot/reset and runtime mirrors/transpilation,
execution-environment/test-corpus fingerprinting, hermetic recursion context,
fail-closed ambiguous coverage matching. Baseline policy exists in both. These
protections must not be regressed when filling legacy feature gaps. Full runner,
timeout, cache, platform and installed integration differentials remain unexecuted.

### Root operator/workflow inventory: all 33 npm scripts

| Explicit old script(s) | Active counterpart / unresolved contract |
|---|---|
| `build` | Root `tsc` instead of workspace builds |
| `test:root`, `test:workspaces`, `test` | Central test runner instead of separate root/workspace suites |
| `check` | Native root `verify`; not product CLI `check` |
| `coverage:workspaces`, `coverage` | Configured LCOV generation exists; no workspace aggregate entrypoint |
| `quality`, `quality:loop`, `quality:plan` | Native check/report/remediation overlaps; no old ranked FunctionRisk/MutationMission queue. Active `plan` is governance planning, not a legacy quality-plan alias |
| `quality:bundle`, `quality:bundle:inspect`, `quality:bundle:smoke` | No multi-package plan/report/delta bundle producer/reader contract |
| `repo:readiness`, `repo:readiness:snapshot`, `repo:readiness:inspect`, `repo:readiness:smoke` | No joined quality/release-readiness artifact; `doctor` and `verify` have different jobs |
| `repo:validation:summary`, `repo:validation:summary:inspect`, `repo:validation:summary:compare`, `repo:validation:summary:smoke` | Verification log is not old summary/compare schema; native trend compares product runs |
| `ci:quality-bundle`, `ci:repo-readiness` | No matching old artifact CI producers/uploads |
| `mutate:target` | No package/file/function-mission wrapper/result-memory contract |
| `release:targets:list`, `release:targets:check` | One staged public package rather than two component targets |
| `release:trust:report`, `release:trust:preview`, `release:trust:inspect`, `release:trust:smoke` | Native publish prerequisites/intent/package proof; no reloadable offline diagnostic report/preview contract |
| `release:check:all` | Native staged/tarball/installed-package proof changes publication-content workflow |
| `ci:smoke`, `ci:full` | Native verify/CI; old joined artifact ladder absent |

The old Justfile adds `coverage <package>`, `quality-all`, and `mutate <package>
<file>` convenience recipes; other recipes delegate to the enumerated scripts.
No active Justfile at A; existing task6553 owns its standardized surface.
The similarly named A `scripts/ci/smoke.sh` and `full.sh` check protected paths/
ROCS respectively; they are **not** old artifact-ladder implementations.

| Old runtime artifact/algorithm | Precise unresolved feature | Source |
|---|---|---|
| `FunctionRisk`, `MutationMission`, `QualityPlan` | CRAP/coverage plus git churn, recency and ownership fan-out ranking and exact mission command | L `scripts/quality-loop.mjs:185-207,308-377`, `git-risk-signals.mjs`, `quality-plan-contract.mjs`; A `packages/ts-quality/src/index.ts` native orchestration |
| Executor memory -> intervention queue | Persist result/deltas; derive retained/new/cleared survivor and timeout pressure; reshape action/payoff and reorder queue across runs | L `scripts/mutation-result-history.mjs`, `quality-history.mjs`, `intervention-report.mjs`, repeated-run fixtures; no equivalent A history-driven planner |
| Quality bundle | Stable per-package plan/report/delta paths and checked release-target scope; generate/reload/inspect/smoke | L `scripts/quality-bundle.mjs:445-535`, `quality-bundle-inspect.mjs:71-127`, `quality-bundle-smoke.mjs:93-118` |
| Readiness snapshot | Join quality and release-trust artifacts with cross-package highest payoff, filtered consumer and smoke | L `scripts/repo-readiness-snapshot.mjs:384-436,676-745`, `repo-readiness-inspect.mjs:107-247` |
| Validation summary / compare | Smoke/full source contracts; per-package actions, statuses, target deltas; CLI/markdown consumer/compare | L `scripts/repo-validation-summary.mjs:273-415`, `repo-validation-summary-compare.mjs:161-342`; A `scripts/verify.mjs:243-340` is a different artifact |
| Target mutation wrapper | Source/dist-aware symlink-preserving command defaults, coverage auto-wiring, result persistence and selection flags | L `scripts/ts-mutate-target.sh:65-90,213-247,273-333`; A mutation CLI/API changes scope |

The new platform's extra invariants, governance, legitimacy and authorization
features do not erase these old-feature obligations. Replacing their purpose may
be acceptable, but needs an explicit owner disposition, not a parity claim.

### Publishing and integration boundaries

L package manifests describe independently publishable `@tryinget/ts-mutate` and
`@tryinget/crap4ts`, component release-please tags, trusted-publish diagnostics,
bootstrap publishing and provenance. A internal package directories are not proof
of scoped public interfaces: the staged public `ts-quality` package and its OIDC
release workflow have a different exported/package/install contract.
L `scripts/release-targets.mjs:41-189`, `release-trust-report.mjs:82-144,532-564`,
`release-trust-preview.mjs:135-166,234-241`, `release-trust-inspect.mjs:104-218`;
A `scripts/pack-ts-quality.mjs:447-543`, `test/packaging.test.mjs:461`,
`.github/workflows/publish.yml`.

Component release organization need not be cloned mechanically. However separate
CLI/library consumers, offline release diagnostics and old artifact parsers must
be migrated, preserved or explicitly discontinued. No public-publishing action
was performed or authorized by this audit. Existing task6548 owns release work;
6550/6551 own adoption/installed compatibility; do not create duplicate release
claims. Active README explicitly calls 0.7.0 locally prepared only.

## Bounded consumer and retirement audit

Read-only installed gated AK readback on 2026-10-03:

- Both repositories remain separately registered.
- Old pending tasks: **83, 171, 172, 173, 6142**. Note task171 is unrelated to
  **decision171**; do not confuse their identifier namespaces.
- Old snapshot task6566 is done/local-only accepted, not whole-repo retirement.
- No accepted ts-quality-tools retirement decision found among 171 inspected
  decision records. Decision171 is active direction reconciliation,
  `review_pending`, with no ADR/accepted outcome; do not borrow its authority.
- Old native direction query returned zero nodes; old markdown still describes
  work. A has 22 direction nodes; reconciliation task6549 is deferred, not owned
  by this audit. Projection updates are out of scope, explicitly deferred.

The bounded scan covered both repos, tracked lane-root routing/config/docs, and
the explicitly discovered `owned/test-capabilities` consumer after its applicable
instructions were loaded. Infra capability map still routes mutation/CRAP work
to the old repository; owned map understates the active platform as adoption/docs.
These lane-owned routing changes need their own authorized acceptance/commit.

`test-capabilities/scripts/screening/ts-quality-common.sh:6-29` resolves override,
local install, sibling active `dist`, then PATH. No tracked old scoped package/
checkout dependency found there. That is static evidence, **not** an observed
currently running binary/version or migrated-consumer proof. Its owner docs list
four live slices while the central catalog lists five. Other inspected adoption
records include scratch pilots, not normal-checkout acceptance.

Read-only anonymous HTTP observations from the retirement scout: old GitHub
repository and both scoped npm package names returned 404; active GitHub returned
200, public `ts-quality` latest was 0.6.0, gitHead
`57cae5e67dd04d4ccf5682806ce0c1c129acec39`. A 404 establishes anonymous visibility
only, not formal deletion, historical nonpublication, private consumer absence,
registry-wide reverse dependency absence, or retirement acceptance.

**Coverage limit:** no full workspace/registry/private consumer census, runtime
consumer rerun, live binary resolution trace, deprecation, release publication,
remote archive operation or source-owner migration acceptance was performed.
Consumer completeness remains unresolved and cannot be inferred from this scan.

## Unique-data preservation blockers

Read-only scout Git inventory found:

- 61 ref-reachable legacy commits, none present in active Git object storage.
- Three local main commits beyond cached origin/main: c0461ba, a503748, c5c726e.
- Two cached release branches each retain unique unmerged commits:
  `afcc71806a53e7efc586740aa7a4c35ae499a053` (CRAP),
  `eb24ae4c2e486fc52130612b45e74fdcf1f0970a` (mutation).
- Main and `work/task-6566-snapshot-retirement` share old tip; extra task6566
  scratch worktree remains registered. No tags/stashes observed.
- Tracked dirt: AGENTS.md and next_session_prompt.md modified; scripts/ak-v2.sh,
  scripts/ak.sh and scripts/cargo-operator.sh deleted. Ownership/disposition not
  resolved. No staging or overwrite performed.
- Ignored `.tmp` includes meaningful planner/result/bundle history, not merely
  disposable caches. Active untracked `.ontology/` is preserved.
- 384 reflog-only commits (also present in active object storage), plus fsck
  reports of unreachable blobs/trees. Reflog records a temporary forced update
  to unrelated active history and subsequent restoration; not a migration proof.

A refs-only bundle omits dirt, ignored artifacts and unreferenced objects.
A future preservation operation must record exact refs/object and worktree
inventories, archive all unique necessary data without secrets leakage, verify
hashes and restore into isolated scratch, then obtain owner acceptance of the
retention/recovery location. No archive or restore proof exists from this audit.
Do not gc/delete the old repository or combine/push unrelated Git histories.

## Required next work and acceptance ledger

All entries below remain unresolved; none are implicitly waived by this report.

| Obligation | Required next evidence / authority |
|---|---|
| Missing mutation capabilities and type-only mutation hazard | Bounded runtime correction/extension preserving current isolation/fingerprint safety; differential catalogs, runners and installed proofs |
| CRAP analysis/coverage/identity differences | Owner-confirmed functional requirements; implement missing executable-function support; disposition incorrect/different semantics explicitly rather than blindly restoring old behavior |
| Public API/CLI/install compatibility | Inventory actual callers; compatibility layer or accepted migration/discontinuation for each contract; installed-consumer tests |
| Planner/history/mission/bundle/readiness/summary | Implement native complete functionality or obtain specific accepted discontinuations; repeated-run/action queue and producer-reader tests |
| Root release-specific contracts | Explicit separate-package/diagnostic/tag disposition; reuse6548 for authorized release work |
| Consumers | Bounded expansion from discovered refs, package and filesystem caller census, each owner's observed active binary/version/acceptance and rollback |
| Old task/direction/registration/routing state | Source-owner dispositions for83/171/172/173/6142 and both lane maps; audit-preserving identity treatment, not cascading repo deletion |
| Unique history/dirt/results | Independently authorized restorable preservation with owner acceptance |
| Retirement decision | Named owner accepts explicit supersession and each unmatched contract disposition; canonical AK decision plus owning surfaces |
| Physical removal | Separate exact-path authorization only after all acceptance and preservation checks; unavailable remote is not authorization |

Complete functional parity requires restoring all old capabilities (while retaining
active safety). Intentional owner-approved discontinuation can support **accepted
supersession with documented losses**, but cannot truthfully be called complete
feature parity. Exact old API/CLI compatibility is a separate acceptance dimension.

### Operator's next-wave selection (2026-10-03 interview)

The operator selected native active interfaces with explicit old-caller migration,
asked to preserve capabilities **only when useful**, allowed re-envisioning them
to feel alien-like, and selected full-wave design before runtime edits. That is
permission to design utility-based dispositions, not acceptance of any specific
loss, release, retirement decision or deletion. The original complete-parity claim
remains disproved at these pins. The next design must distinguish complete useful
capability coverage from accepted supersession with intentionally discontinued
features; it must not relabel losses as parity.

This audit deliberately does not mutate AK direction, existing deferred decisions,
source packages, release state, repo registrations, lane routing, or unique legacy
data. Those boundaries protect the next wave; they do not close its obligations.
