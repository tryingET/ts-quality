---
summary: "AK6584 proposal: useful-first native quality navigation and preservation-first legacy supersession; no runtime implementation or retirement acceptance."
read_when:
  - "Designing native replacement of useful ts-quality-tools capabilities."
  - "Selecting implementation or retirement acceptance for the legacy repository."
type: "reference"
---

# Useful-first legacy supersession wave — AK6584

**Status: proposal with 2026-10-04 owner input recorded; canonical design settlement
is blocked on AK authorization storage. Runtime execution, accepted supersession,
release and retirement remain unperformed. See the AK6585 readback below.**

## Intent and governing evidence

The operator's 2026-10-03 interview selected native active interfaces, explicit
caller migration, usefulness rather than blind cloning, re-envisioned/alien-like
experience, and the complete wave design **before runtime edits**.

AK6581's `../adoption/legacy-parity/assessment.md` and pinned executable evidence
show that complete old feature parity is false today. The comparison denominator
is the old repository's actual capability set, not the shared package names.
That audit is the source-backed crosswalk for this proposal; its 19 assertions
include 16 differences, not 16 equally valuable missing features.

The proposed destination is **accepted native supersession of useful capabilities
with explicitly accepted discontinuations**, not literal complete parity with
losses hidden. If the owner ultimately requires complete old feature parity,
every discontinuation below must instead be restored and proven.

Current README/ARCHITECTURE/source and exact public contracts win over stale
product-posture prose. In particular the posture document's witness-freshness and
0.6.0-source statements predate source fixes/local0.7 preparation; they must not
be used to reopen completed safety work or claim public0.7 availability.

## Experience: the shortest justified path to the next trustworthy change

Instead of recreating 33 root commands and layers of historical report wrappers,
make the existing next-evidence-action surface a precise navigator:

1. Show the most consequential **unresolved evidence obligation in the exact
   evaluated scope**: what is known, what is missing, what would falsify it.
2. Offer one bounded experiment with exact inputs, executable command, expected
   distinguishing outcome, artifact to inspect, and explicit stop conditions.
3. After executing that experiment, compare only compatible evidence: what was
   retained, newly exposed, cleared, or is no longer comparable.
4. Reorder the scoped obligation queue using versioned inspectable rules, while
   preserving the old trail. The tool does not silently broaden mutation scope,
   generate unearned approvals, launch agents, or lower policy thresholds.
5. Expand to a repository/package overview only when explicitly requested. Keep
   release diagnostics adjacent but independent of software-quality verdicts.

“Alien-like” means radically less manual inference and glue: one inspectable
cause-to-experiment-to-outcome loop, not decorative UI, opaque confidence,
autonomous mutation, or a speculative promise that tests prove semantics.

Example **proposed** projection (not a command that exists today):

```text
run: review-042   scope: auth/token.ts:18-31   freshness: bound
obligation: refresh-token-expiry boundary has a surviving mutant
basis: exact survivor; 100% LCOV is not sufficient; focused witness not current
experiment: rerun existing test:token-expiry against this one site
success criterion: kill that site; current focused witness passes; no scope drift
movement: one survivor retained; one cleared; comparison basis unchanged
next: [repo-owned focused command]   inspect: [exact existing run/sidecar paths]
```

No estimated score improvement is represented as an observed result. A recommended
experiment is not execution authority and does not replace the target's AK task.

## Usefulness test and complete disposition ledger

Evaluate each audit family against four tests:

- A real caller/operator job needs it, or a concrete source-backed blind spot
  requires it (constructor/accessor discovery and type-only mutation are examples).
- Native implementation adds information/action rather than duplicating an
  existing check/report/retention/authorization surface.
- Its result can be reproduced and explained with bounded deterministic inputs.
- It does not regress run identity, drift, workspace baseline, context-bound
  witnesses, isolation, cancellation/timeout truth, or source-owner boundaries.

Every row below is a **proposed** disposition. The final owner decision must name
all rows and each actual caller. “No caller found in a bounded scan” is not proof
of global absence. No loss is accepted merely by this ledger.

| ID / legacy audit family | Proposed useful native disposition | Acceptance experiment |
|---|---|---|
| U1 CRAP executable function inventory | Correct constructor/accessor handling and stable readable variable/member/assignment identities. Exclude ambient/overload-only bodies. Preserve anonymous functions deliberately rather than dropping them to match old naming limitations | Constructor/get/set/method, callbacks, object/field/assigned arrows, overload/ambient, TSX/JS fixtures; inspect stable identities and spans |
| U2 Complexity and CRAP arithmetic | Specify own-body complexity excluding nested bodies; retain explicit percentage units/rounding. Correctness beats reproducing old arithmetic/clamping quirks | Known decision-count corpus including nested functions; fraction-to-percent adapters only where real consumers require; deterministic ties |
| U3 Coverage input and meaning | Preserve instrumented-line coverage, explicit unknown evidence, repeat-record merge and safe exact/unique path resolution. Comment/declaration text is not missing executed-line coverage. Never restore ambiguous basename guessing | Sparse/duplicate/malformed LCOV, zero instrumented lines, missing evidence, source maps, duplicate basenames, scoped risk verdicts |
| U4 Mutation operator breadth and AST safety | Exclude type-only syntax. Restore useful multiplication, numeric/increment/boundary/condition probes where valid. Decide loose equality from actual JS/legacy callers rather than reflexively suppressing it | Full audited catalog crosswalk; parse/runtime validity; equivalent-target cases; type alias/interface/import-type absence; negative baseline and infrastructure cases |
| U5 Target selection and missions | Native changed-file/hunk plus explicit symbol/span/site targeting, dry-run selection summary and budget. Keep mission identity run-bound. Do not trust a stale function name/span | Function A never mutates B; stale/overlapping/renamed symbols refuse or report unresolved; covered-only/missing evidence policy; explicit full-scope acceptance |
| U6 Incremental state/manifests | Keep stronger execution-fingerprint result cache. Replace old declaration-sidecar semantics with a documented native incremental selection/result lineage contract; do not copy unsafe partial clean advancement | Unchanged, source/test/env/runtime drift, partial/failed runs and interruption; no stale reuse; deterministic isolated results |
| U7 Runner/isolation/timeouts/parallel controls | Preserve pristine workspace baseline/reset and mirrors. Explicit timeout/error/invalid outcomes, artifact/CLI decision assertions. Serial first; parallelism only if measured useful and safe | Green/failed baseline, timeout vs assertion kill, missing executable, worktree byte preservation, worker output races, strict pnpm and TSX/runtime mirrors |
| U8 Public library/CLI/install callers | Migrate to documented native public API and command manifest. Thin adapters only for confirmed receivers; no wholesale barrel/shell-string/default-Jest clone | Actual caller inventory, exact args/output/exit assertions, installed CLI/API/types, old artifact input handling or clear rejection/migration |
| U9 Git-enriched hotspot risk | Add optional scoped evidence for churn/recency/ownership fan-out as context, not proof or automatic obligation. Keep measured facts separate from priority hints | No-Git/shallow/rename/uncommitted fixtures, pinned history horizon, deterministic ties, stable identities; no risk inflation across incomparable scopes |
| U10 Planner/action queue/mission commands | Add an explainable navigation queue without silently changing protected primaryAction selection; show safety blockers separately until a versioned contract change is accepted | All old jobs mapped to native action classes; protected primaryAction remains consistent across JSON/text/prompt/task views; mixed governance/survivor/freshness cases; exact focused commands |
| U11 Executor memory/survivor navigation/trend | Keep immutable runs; distinguish cache equivalence, aggregate trend and intervention lineage; report affirmative outcome changes only on executed comparable sites | Survivor -> assertion added -> site killed with declared intervention; removed test, changed command/runtime/source/policy and excluded/unexecuted site cases; ambiguous lineage means unknown |
| U12 Quality bundle and package overview | One native package-scoped index over canonical run/action artifacts, not a second planner. Explicit multi-package enumeration, stable paths and checked consumers | Generate -> reload -> scoped inspect -> CI upload; completeness/ref freshness; bounded one-package and all-package views |
| U13 Joined readiness/validation summaries/compare | One downstream navigation summary links quality obligations, verification execution and release prerequisites. Preserve separate statuses/authorities. Do not collapse diagnostic pass into merge/publish permission | Smoke/full source distinction; filtered package/target readback; compare changes in actions, outcome and release status; missing inputs fail explicitly |
| U14 Independent package releases/targets | Candidate discontinuation of old scoped package topology/component tags/release-please/manual bootstrap in favor of one native staged package, **subject to actual callers and owner acceptance** | Registry/private/filesystem receiver census, migration notes; exact package install proof; no unsupported claim based on anonymous404 |
| U15 Offline trusted-publish diagnostics | Keep useful read-only preview/inspect diagnostics in native release tooling if operators need them; never let quality core operate npm/GitHub | Negative workflow/tag/version/target/provenance fixtures, emit/reload preview; publication still separately authorized through existing process |
| U16 Coverage/build/test/root wrappers/Justfile/CI | Reuse verify, target-owned LCOV commands, public manifest and standardized Justfile. Remove aliases only after caller migration; U10-U13 absorb old workflow jobs | Whole33-script audit crosswalk, all extra Justfile entrypoints accounted for; real root workflow and installed consumer tests |
| U17 Old coordination/direction/queue/routing identity | Explicit task/direction/registration/routing dispositions, not migration into tool-core JSON | AK readback, lane-owner routing checks and independent receiver acceptance; never cascade-delete audit history |
| U18 Unique repository/history/dirt/result memory | Preserve externally with recoverable receipts before stopping custody, let alone removing files | Hash-verified archive + isolated restore of refs/unmerged branches/dirt/selected retained data; secret handling and exact owner acceptance |

This ledger accounts for the audit's CRAP, mutation, root33-script/Justfile,
publishing/integration, consumer/coordination and preservation families. Existing
native invariants/governance/legitimacy features are constraints and integration
surfaces, not a reason to drop old useful quality jobs.

## Exhaustive audit-item design crosswalk

Evidence labels: **E** = defect/difference reproduced by AK6581; **J** = useful
historical operator job implemented in old source/tests, not proven live demand;
**F** = existing active function meets a job; **C** = caller/usefulness question
still unresolved. Recommendations are not approvals. S0 design approval does not
settle C rows by implication: unresolved utility means hold that slice, neither
restore blindly nor remove. Receiver/discontinuation acceptance is a later,
separately recorded act after actual caller evidence.

### Old CLI modes/controls -> native jobs and proof

| Explicit audited item | Utility/disposition recommendation | Native job and proof / unresolved question |
|---|---|---|
| CRAP `--src`, repeatable/comma list; default src | J/C: preserve explicit bounded source selection, not old spelling | U1/U8: paths/patterns in native config/API; multi-root and filter interaction fixtures; confirm callers |
| CRAP `--filter` | J/C: preserve scoped filtering where needed | U1/U8: contained path patterns; exact include/exclude and no accidental scope expansion |
| CRAP `--lcov`; auto-detection | J: preserve explicit input; C: implicit lookup candidate removal | U3: recorded provenance, missing/path ambiguity fixtures; ask whether callers need fallback lookup |
| CRAP `--cwd`, `--json`, `--help/-h`, unknown/missing option handling | J/E: native root/output/help/errors; C: adapter spelling | U8: exact public parser/output/exit and installed receiver checks |
| Mutation source-file positional and `--cwd` | J/C: native explicit file/root selection | U5/U8: never implicit whole-repo widening; migrate confirmed callers |
| `--scan` | J: retain job, redesign as inert selection preview | U5: counts/sites/exclusions/budget without command execution or manifest writes |
| `--update-manifest` | C: candidate discontinuation of manual declaration acceptance | U6: explicit cache invalidate/reset only, no fabricated mutation evidence; ask if any receiver needs old declaration metadata |
| `--lines` | J: retain explicit line targeting safely | U5: exact span/site selection, crossing boundaries and empty selection cases |
| `--function-id`, `--start-line`, `--end-line` joint mission | J: retain function-bounded experiment with current binding | U5/U10: stale span/identity refusal, A-never-B proof; migrate old mission JSON |
| `--since-last-run`; default differential mode | J/C: native cached-result reuse and declared incremental selection | U6: source/test/command/environment drift fixtures; decide declaration-level selection need separately from cache reuse |
| `--mutate-all` | J: explicit bounded full eligible scope, no ambient override | U5: supersedes incremental filtering only by explicit acceptance; coverage/budget still disclosed |
| Mutation `--lcov`; no LCOV treated as covered | J/E: retain coverage filtering; candidate remove missing-evidence-as-covered default | U3/U5: missing/uncovered/ambiguous cases fail or explicitly label full selection; owner accepts semantic difference |
| `--timeout-factor` (baseline x10, >=1000ms) | C: native explicit timeout budget already useful; factor is optional policy | U7: bounded timeouts, distinct failure/infrastructure outcomes; benchmark before recommending factor vs fixed budget |
| `--test-command` shell string/default runInBand | J/F: native target-owned argv command; candidate remove unsafe/default-runner assumptions | U7/U8: shell/argv migration, argument quoting and installed receiver tests |
| `--max-workers` | C: preserve performance job only if measured needed; serial-first proposal | U7: measured speed/cost plus output race/context isolation; explicit defer/discontinue decision if no need |
| `--mutation-warning` | J/C: preview explicit budget/scope pressure rather than incidental warning | U5: count/threshold/overflow fixtures; ask whether legacy warning-only consumers exist |
| `--result-json-out` and mission status/counts/survivor/timeouts | J: native run-bound artifact interchange | U10/U11: named schema adapter/migration and producer-reader fixtures; no dropping timeout/not-observed counts |
| `--help/-h`, rejection/combinations, baseline/survivor/timeout exit codes | J/C: strict native parser and explicit decision assertion | U8: old exit consumers need adapter or accepted migration; never silently pass an old option |

All legacy root API values listed in the audit JSON map to the jobs above. For
receiver-level accountability, the specific exported symbols are grouped here;
**every group has C until public/deep-import callers are inventoried**:

| Exact legacy export inventory | Native mapping and receiver proof |
|---|---|
| CRAP `buildEntries`, `parseArgs`, `run`, `USAGE`, `discoverSourceFiles`, `filterFilesByFragments` | U1/U8 bounded analysis/CLI; parser/selection/installed adapter fixtures |
| CRAP `computeCyclomaticComplexity`, `calculateCrapScore`, `extractFunctionsFromSourceFile`, `extractFunctionsFromFile` | U1/U2 native function analysis and units; constructor/nested/known-score fixtures |
| CRAP `parseLcov`, `loadLcov`, `autoDetectLcovPath`, `coverageForSource`, `computeRangeCoverage` | U3 explicit coverage job; sparse/duplicate/ambiguous/missing fixtures |
| CRAP `sortEntries`, `formatReport` | U10/U12 native ordering/rendering; all entries machine-visible, deterministic ties/text limits disclosed |
| Mutation `parseSourceFile`, `topLevelDeclarations`, `moduleHash`, `changedDeclarationIndices` | U5/U6 targeting/selection; declaration API need C, source drift fixtures |
| Mutation `parseArgs`, `run`, `USAGE`, `DEFAULT_TEST_COMMAND`, `defaultOptions` | U7/U8 native parser/argv defaults; exact receiver command and exit tests |
| Mutation `parseLcov`, `loadLcov`, `autoDetectLcovPath`, `coveredLinesForSource`, `partitionByCoverage` | U3/U5 safe coverage eligibility; no implicit absence-as-proof |
| Mutation `MANIFEST_VERSION`, `buildManifest`, `readManifest`, `writeManifest`, `relativeSourcePath`, `defaultSinceLastRun` | U6 cache/selection lineage; candidate old declaration API discontinuation requires caller acceptance |
| Mutation `discoverMutationSites`, `applyMutation`, `selectSites` | U4/U5 native catalog/splice/selection; exact operator/scope/type-node fixtures |
| Mutation `runCommand`, `runBaseline`, `workerRoot`, `createWorkerDirectories`, `cleanupWorkerDirectories`, `runMutationsInParallel` | U7 safe execution/isolation; callers cannot need unsafe old workspace leakage; parallel utility C |
| Mutation `MUTATION_MISSION_RESULT_VERSION`, `printMutationWarning`, `buildRunContext`, `buildMutationMissionResult`, `scanMutationSites`, `updateManifestOnly`, `runMutationTesting` | U5/U6/U10/U11 preview/results/lineage; old mode/schema receiver tests or accepted migration |
| Mutation `normalizePath`, `toPosixRelative`, `hashText`, `ensureDirectory`, `readText`, `writeText`, `fileExists`, `resolveCwd`, `nowIsoString`, `safeFileName` | U8 documented API facade only if consumers need it; path/hash/encoding compatibility fixtures |

CRAP types (`DiscoveredFunction`, `RangeCoverage`, `CrapEntry`, `CliOptions`,
`LcovMap`) and mutation types (`MutationCategory`, `MutationResultStatus`,
`MutationMissionResultStatus`, `MutationSelectionMode`, `MutationSite`,
`DeclarationManifestEntry`, `MutationManifest`, `FunctionTarget`, `MutationResult`,
`MutationMissionResultEntry`, `MutationMissionResult`, `CommandRunResult`,
`CliOptions`, `RunContext`, `MutationCounts`, `LcovCoverageMap`) map to U1-U8/U11.
Type signatures and deep CRAP util imports are C, not guaranteed by runtime
export spelling. Compile actual receiver snippets against native installed types;
no fictional compatibility merely because an adapter returns similar JSON.

### All33 root scripts plus extra Justfile jobs -> proposed interface

Each grouped alias is explicit. These jobs have J evidence from historical
implementation; exact old entrypoint/schema compatibility is C until receiver
migration. Names below describe jobs, **not newly shipped command names**.

| Exact old scripts | Disposition / native job / proof |
|---|---|
| `build` | F/U16 root build; compiled/runtime API proof |
| `test:root`, `test:workspaces`, `test`, `check` | F/U16 verify/test suite, not product check alias; root CI proof |
| `coverage:workspaces`, `coverage` | J/U3/U16 target-owned coverage orchestration, aggregate package coverage need C; multi-package provenance fixture |
| `quality`, `quality:loop`, `quality:plan` | J/U9-U11 new navigation/action queue; old `QualityPlan` schema C; repeated-run scoped action fixture |
| `quality:bundle`, `quality:bundle:inspect`, `quality:bundle:smoke` | J/U12 run-reference index generate/read/inspect; exact schema C; producer-reader roundtrip |
| `repo:readiness`, `repo:readiness:snapshot`, `repo:readiness:inspect`, `repo:readiness:smoke` | J/U13 derived overview/readback; old join schema C; separate source status proof |
| `repo:validation:summary`, `repo:validation:summary:inspect`, `repo:validation:summary:compare`, `repo:validation:summary:smoke` | J/U13 verified source-specific compare; old summary schema C; smoke/full/selection/context fixtures |
| `ci:quality-bundle`, `ci:repo-readiness` | J/U12/U13 source-owned CI uploads same canonical projections; reload uploaded fixtures |
| `mutate:target` | J/U5/U7/U10 bounded experiment; mission/result adapter C; actual target process/source preservation proof |
| `release:targets:list`, `release:targets:check` | F/U14 native staged release target check; old two-component topology candidate discontinuation C; actual public receivers |
| `release:trust:report`, `release:trust:preview`, `release:trust:inspect`, `release:trust:smoke` | J/C/U15 proposed offline release diagnose/readback; owner-use question; negative tag/workflow/provenance fixtures |
| `release:check:all` | F/U14 native staged/tarball installed checks; old component release semantics C |
| `ci:smoke`, `ci:full` | F/U16 native verification ladders plus U12/U13 artifact contracts; CI source/upload/readback proof |
| Extra Justfile `coverage <package>`, `quality-all`, `mutate <package> <file>` | J/U16 delegating ergonomics, no second runtime; reuse6553 and targeted/all-package fixtures |

Utility evidence is sufficient to **recommend** S1 correctness and a coherent
S2-S4 navigation design, not to approve every optional control or legacy facade.
Explicit unresolved S0 questions: caller-required interfaces/types/sidecars;
parallel performance need; timeout-factor need; implicit LCOV lookup; warning-only
receivers; old scoped release topology; offline release-preview demand. These are
not silent implementation decisions. Ownership/caller/retention/discontinuation
acceptance remains separate from design work-product inspection.

## Native contract sketch (proposal, not schema authority)

Use existing canonical `run.json` and next-evidence-action fields as inputs. Any
new navigation sidecar is a versioned **derived projection**, with additive public
contract changes reviewed and tested before use. It must carry:

- Exact run id and source/control-plane/coverage/execution bindings, declared
  scope, comparison basis and projection origin.
- Obligation identity, evidence links, why it is unresolved, missing facts and
  proposed experiment. Keep explicit/inferred/missing modes.
- Ranked actions with a versioned ordering explanation, not opaque weights.
- Per-site selection ledger: policy/version, discovered/eligible/selected identities,
  excluded reasons, budget, execution/completion state and affirmative outcomes.
  Unselected, filtered, truncated, interrupted or missing sites remain unresolved/
  not-observed; absence from a later list is never evidence of clearance.
- Result movement only over explicit comparison types and defensible one-to-one
  site/obligation identity; ambiguous correspondence reports unknown.
- Package index as references to the same canonical artifacts, not copied mutable
  truth. Release prerequisite/verification receipts stay separate labeled facts.

### Comparison rules: three different claims

1. **Cache reuse:** requires exact effective execution fingerprint/source/site
   equivalence; changed tests always invalidate cached outcomes.
2. **Aggregate trend:** retain current public scope/invariant/policy/constitution
   comparability and explicitly expose test/command/runtime differences. Do not
   promote existing comparable-score output into causal behavioral improvement.
   Changing this public rule requires a versioned accepted contract change.
3. **Intervention lineage:** may compare an explicitly declared assertion-addition
   experiment across changed test bytes when source/operator/site identity, scope,
   command/runtime/environment/dependency-install state/timeout controls and
   relevant policy remain fixed, except explicitly declared test-edit bytes.
   Require fresh green baseline
   and fresh affirmative outcome for that same selected/executed site. Report
   'observed survivor before; observed kill after declared test edit', not proof
   that the test edit alone caused it. Test deletion, command/runtime changes or
   source edits are separately labeled context changes, not clean causal repair.

Test fixtures must distinguish assertion-added -> killed, test-deleted,
command-changed, runtime-changed, environment-only change, dependency/timeout
change, policy-changed and source/site-changed flows;
and smaller budget, covered-only exclusion, incremental skip and interruption.
An individual mutation obligation can be cleared by an observed same-site kill;
the broader invariant obligation still requires its own current focused witness
and governance/legitimacy requirements. No cache equivalence is implied.

### Blocking classes and compatibility precedence

The navigation view always includes invalid input/freshness/infrastructure,
behavioral survivor/timeout/error, coverage/witness insufficiency, governance
boundary/approval/rollback/reservation/risk-budget, confidence-policy, and
legitimacy/authorization denial facts. Do not omit governance because mutation
also fails, or treat a successful command exit as approval.

For a *new proposed navigation headline*: evidence-invalidity/freshness first,
then explicit standing/governance vetoes, behavioral counterexamples, coverage/
witness insufficiency and remaining policy burden, then nonblocking structure/git
suggestions. Stable class/severity/scope/identity ties are explained, never hidden.
This does **not** change the existing protected nextEvidenceAction.primaryAction
survivor-selection contract. Preserve that field and its JSON/text/prompt/task
projections; add a separate labeled blocking summary/navigation ordering. If the
owner wants headline/primaryAction unified, accept and version that breaking
selection change before implementation. Test governance-only, governance+survivor,
freshness+survivor, legitimacy denial and no-blocker cases on every projection.
Git hints cannot erase a veto, outrank invalid evidence, or create support.

All index/summary references must be schema-checked and contained within the
accepted repository/artifact roots (including realpath/symlink checks). Commands
are inert argv-safe suggestions with explicit target cwd, never autoexecuted or
constructed from unchecked shell fragments. Add traversal, symlink-escape,
untrusted artifact version and shell-metacharacter fixtures.

Proposed budgets are operator-supplied maximum sites/time and deterministic
selection. Execution cost may use measured comparable timing, clearly separated
from estimates. Budget exhaustion is incomplete evidence, not success. No command
is run by a read-only projection. Parallel workers are a later optional execution
optimization, not necessary for the navigation architecture.

Extend public API/CLI through the existing public contract/command manifest and
installed tarball tests. Do not repurpose existing `plan` (governance) as a hidden
old planner alias or silently change unrelated CLI exit semantics. Old exit-based
callers need explicit adapters/migration; new CI uses explicit exact-run assertions.

## Coherent implementation wave and proof boundaries

These are **candidate execution slices**, not created/claimed tasks or execution
authority. Author exact AK tasks/contracts only after owner design acceptance and
fresh source readback. Keep one full-wave acceptance ledger across slices.

| Slice | Mutation owner / bounded surfaces | Required proof and dependency |
|---|---|---|
| S0 Adopt design/utility dispositions | Active repo owner + each affected caller; record accepted decision and exact crosswalk, not this prose alone | Accept design architecture; record each U1-U18 subitem's utility choice/hold explicitly, never blanket-accept C rows; receiver/discontinuation acceptance later; no deletion/release included |
| S1 Evidence correctness | Active CRAP/mutation/evidence-model source, tests, rebuilt dist, affected docs/samples | U1-U4 independent catalog/analysis checks; verify + installed public API fixtures. Preserve modern trust safeguards |
| S2 Bounded native execution | Active mutation selection/cache/runner/config/public interfaces | U5-U8 adversarial isolation/timeout/interruption/selection; actual caller mapping. Depends S1 |
| S3 Navigation and outcome lineage | Active next-action orchestration/evidence contracts, deterministic projections, fixtures | U9-U11 repeated-run differential jobs and negative comparability/identity fixtures. Depends S1/S2 |
| S4 Package/operator/CI projection | Active derived index/summary/release diagnostics, installed readers, manifests/docs | U12-U16 producer-reader-CI roundtrip; separate quality/release/verification facts. Reuse existing validation/public contract surfaces |
| S5 Target-owner migration | Each actually identified consumer repo, separately scoped tasks | Observed exact implementation/version; focused runtime proof; accepted receiver/date and rollback. May parallel S3/S4 only when interfaces stable |
| S6 Legacy preservation | Legacy repo and owner-approved durable archival destination, not active source | U18 complete inventory/custody freeze/hash/restore/acceptance. Can proceed early only with separate preservation authorization |
| S7 Formal retirement settlement | AK decision/task/direction/registration owner, infra/owned routing owners, package/remote owners | U17 exact dispositions + accepted useful coverage + all migration/preservation proof; no physical removal yet |
| S8 Physical removal, if requested | Owner-authorized exact legacy checkout path | Fresh standalone authorization, completed restore/retirement checklist; no unowned processes/worktrees/dirty data loss |

Runtime changes in active repo require root `npm run verify`, exact public
packaging/projection/CLI regressions and intentional rebuilt `dist`/sample updates.
Docs-only design checks do not satisfy S1-S5. AK checkout code changes, if truly
needed, require that owner's exact clean-commit validation/ak-dev/publication
process; no AK code or schema change is proposed here.

### Existing tasks and decision boundaries

Reuse, do not duplicate or quietly finish:

- 6548: safety release/public migration. Local0.7 prep is not public release.
- 6550: accepted normal-checkout adoption.
- 6551: now **done** at `ce57c0c`, with installed captured-artifact matrix and
  reproducible pinned Bun full-scope proof; its quality-fail/authorization-deny
  result is not accepted live adoption or public0.7 availability. Do not reopen
  completed scale work from the earlier partial-capture account.
- 6552: behavior-preserving oversized module/test refactor if required.
- 6553: standardized Justfile rather than invented second root command surface.
- 6557: crash-safe immutable packet publication; optional nav sidecars cannot
  bypass this storage obligation.
- 6549 / decision171 / deferral548: direction reconciliation remains under
  its existing AK-owner rollout/schema boundary, not part of this wave's code.
  Prior direction-worker effects are indeterminate per retained owner readback;
  do not relaunch or infer success.
- Legacy tasks83/171/172/173/6142: propose explicit ownership/cancel/move/retain
  dispositions. Preserve task/evidence lineage; task171 is not decision171.

Main source is locally ahead of remote. A public proof cannot be inferred from
source, compiled dist, successful probe, or a copied pilot. Publishing exact
ranges remains separately authorized; no dependency installs/repins follow.

## Retirement decision and preservation protocol

Retirement is a separate source-owner acceptance, not the last implementation
commit. Record a decision with the full accepted capability/discontinuation ledger,
receiver evidence, recovery location and remaining obligations. Distinguish:

1. End old maintenance/launch routing.
2. Disposition old work and source identity without deleting coordination history.
3. Preserve old source/history/dirt/results and prove recovery.
4. Deprecate/archive public interfaces or remotes only where they exist and their
   owner explicitly authorizes the action.
5. Physically remove the checkout only after exact-path authorization.

Pre-existing dirty context/wrapper removals require owner disposition. Capture
Git refs, unmerged release branches, reflogs/unreachable necessary objects and
worktree state, not only main or a refs-only bundle. Include selected ignored
planner/result memories with an explicit retention basis. Inventory symlinks and
linked worktrees; obtain custody freeze before taking a stable archive.

Keep sensitive material out of Git/public archives. A protected durable archive
requires declared destination, access/retention policy, checksums and isolated
restore evidence. Credentials are handled through their owner rather than copied
into public artifacts. Any exclusions must have explicit owner disposition and
alternative preservation where needed; never silently discard unique content.
A quarantine/removable local folder is not, by itself, a durable recovery proof.

Consumer coverage must expand through exact discovered callers: source/config/
CI/filesystem and package interfaces separately. Include scripts using sibling
`dist`, PATH overrides and npm installs. Inspect consumers' instructions before
mutation. Anonymous404 of old names/remote does not prove no private/historical
callers. Receiver acceptance requires an observed correct implementation and
version/commit, migration result and rollback, not static grep alone.

AK stores accepted decisions/tasks/evidence/lineage; lane routing projects the
accepted destination; Git owns source; release/registry/runtime owners retain
their own facts. Do not recreate these stores as a tool-owned retirement JSON.

## Full-wave completion and reversal checks

The owner can accept supersession only when:

- Every U1-U18 row has accepted disposition and evidence, every retained useful
  job has executable installed/runtime proof, and every lost interface has a
  named accepted receiver migration or explicit owner discontinuation.
- A real operator can follow one narrow obligation through experiment and outcome
  without hidden maintainer narration, unbounded scope or fake-green semantics.
- All current safety/negative-path/public contracts remain truthful and verified.
- Actual consumers use the accepted active implementation; package/remote/AK/
  routing obligations are settled on their owning surfaces.
- Unique legacy data is safely recoverable; remaining work is explicitly owned,
  not dangling; physical deletion authorization remains separate.

Reverse/rework the design if the new queue cannot explain its ordering, if stable
site lineage is guessed across ambiguous edits, if a scoped failure is outweighed
by coverage/git signals, if composite summaries become authority, if a confirmed
consumer requires an old interface without a tested adapter, or if preservation
cannot recover unique data. Roll back bounded code changes/consumer configuration
through exact known commits and retained control-plane backups; never repair
immutable evidence by rewriting an old run id. Keep the old checkout until formal
retirement and recovery acceptance makes removal lawful.

**Design completion is not wave execution.** Source-backed design inspection can
close AK6584, but the original operator goal remains open until implementation,
receiver/discontinuation acceptance, preservation and formal retirement are proven.

## AK6585 readback — 2026-10-04

The caller inventory and explicit G1-G11 owner selections are recorded in
`../adoption/legacy-parity/caller-inventory-2026-10-04.md` and
`../adoption/legacy-parity/owner-selection-2026-10-04.json`. Owner selected native
correctness/selection/navigation/package summaries, runtime loose-equality probes,
explicit coverage-path convenience and independent read-only release diagnostics.
Parallelism, relative timeouts, automatic declaration-level selection, aggregate
LCOV and unknown old-interface/private/public losses are held, not discontinued.

Prospective S1-S8 tasks are **6700-6707**, with exact source-owner scopes, done
contracts, guardrails, dependencies and active deferrals. All are unclaimed and
unexecuted. S6-S8 are explicitly **admission planning only**, not archive,
retirement or deletion execution tasks. Native decision180 links only tasks in
its own repo; foreign receiver/legacy tasks require separate owner admission.
Canonical transcription proof: `../adoption/legacy-parity/task-transcription-proof-2026-10-04.md`.

**Canonical settlement is blocked.** Decision180 remains `decision_pending`,
outcome null. Typed authorization refused `AK_DECISION_RECORDS_NEED_SCHEMA_47`
on live schema46. Completed questionnaire input is not a recorded grant; no
accepted-outcome fallback or migration was attempted. Existing AK6367 owns the
operator-run amended47 apply and AK6471 prerequisites. This wave does not migrate
AK, broaden decision scope, borrow another claim or reopen completed5991.

AK6585 therefore remains open for canonical adjudication after that owner-surface
blocker resolves. Draft owner-choice projection:
`../decisions/2026-10-04-legacy-useful-native-supersession.md`; it is not a recorded
accepted ADR. Existing release/adoption/direction task ownership remains intact.
No task-authoring or planning completion proves useful supersession, receiver
acceptance, public release, recoverable preservation, retirement or removal.
