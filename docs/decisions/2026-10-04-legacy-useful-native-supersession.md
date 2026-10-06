---
summary: "Decision180 accepted 2026-10-06: native utility wave with explicit holds; S1 first, held S2-S8; not runtime supersession or retirement."
read_when:
  - "Implementing an exact task in the native useful-quality wave."
  - "Checking whether a legacy interface or settlement effect is actually accepted."
type: "reference"
---

# Useful-native quality wave — decision180 accepted

**Status: accepted by the Holding Owner on the 2026-10-06 owner docket
(`d180-ts-quality-wave = A`, AK evidence 13977). AK decision180 records the
accepted outcome. This ADR projects that decision; it is not a state store.**

## Status and authoritative record

The owner selected every G1-G11 choice in the completed 2026-10-04
questionnaire. On 2026-10-06 the owner accepted decision180 on the owner docket
(AK evidence 13977 on AK6585: "Accept (owner docket 2026-10-06,
d180-ts-quality-wave = A)"). AK decision180 moved `decision_pending ->
adr_required` with outcome `accepted`, citing that evidence as its authority.

The typed consent/authorization record still needs AK schema47. The live DB is
at schema46, so `ak decision authorize` cannot write a grant record. The owner's
acceptance is carried by evidence 13977 and the decision's transition receipt,
not by a typed grant. AK6367/AK6471 still own the schema migration; this repo
does not migrate the DB. Unknown receiver/interface losses stay held. The
authored S1-S8 tasks keep their own guardrails and deferrals.

RFC: `2026-10-04-legacy-useful-native-supersession-rfc.md`.
Evidence: `../adoption/legacy-parity/caller-inventory-2026-10-04.md`;
independent inspection: `../adoption/legacy-parity/contract-inspection-2026-10-04.md`;
verbatim selection: `../adoption/legacy-parity/owner-selection-2026-10-04.json`.
The independent bootstrap architecture track returned `ready_for_adr` after the
G1/G10/G11 completeness and receiver-admission sequencing defects were corrected.
That inspection establishes design readiness, not owner or runtime acceptance.

## Accepted design

Adopt the native correctness -> bounded experiment -> affirmative outcome ->
package/CI navigation design. Preserve useful legacy operator jobs through native
interfaces, not a wholesale old barrel/CLI/schema clone. Complete literal parity
remains disproved. Accepted useful design is not accepted supersession execution.

| Group | Owner-selected disposition | Carried obligation |
|---|---|---|
| G1 | Native U1-U7/U9-U13/U16 design selected, with all separate holds intact | S1-S4 executable/installed/negative proofs still required |
| G2 | Retain valid runtime loose-equality probes with AST/type safety | S1 must prove runtime validity and type-only exclusion |
| G3 | Serial first | Parallelism held pending measured need/isolation and separate scope |
| G4 | Explicit fixed timeouts first | Relative factor policy held pending measured need |
| G5 | Generate/discover target-owned coverage and record explicit input | No ambiguous fallback or absent-coverage-as-covered semantics |
| G6 | Native interfaces and exact confirmed-caller adapters | Every unknown old CLI/API/type/deep-import/JSON/exit/root alias loss held, not discontinued |
| G7 | One native staged package as destination | Legacy package/tag/private receiver/public discontinuation held; no publishing authorization |
| G8 | Retain read-only offline release diagnostics outside quality authority | S4 proof, separate source facts, no publication permission |
| G9 | Held admission obligations; preserve checkout and unknown receivers | No archive destination/custody/retirement/removal effect authorized |
| G10 | Hold automatic declaration-level incremental selection | Actual job and fresh binding specification needed; cache reuse/explicit targeting remain retained |
| G11 | Hold workspace-wide aggregate LCOV | Multi-package job/provenance needed; package index is not execution coverage |

### All U rows, including interface/utility holds

| Row | Native selected result | Outstanding acceptance |
|---|---|---|
| U1 | Executable constructor/accessor/method/callback identities, ambient/overload exclusion | S1; old names/types G6 hold |
| U2 | Own-body complexity, explicit percent/rounding and stable ties | S1; old fraction facade G6 hold |
| U3 | Instrumented coverage, duplicate merge, unknown evidence, safe exact/unique mapping | S1; explicit coverage convenience G5, old facade G6 hold |
| U4 | Valid arithmetic/equality/boundary/numeric/increment/condition/logical/boolean probes, no type-only sites | S1, including selected G2 |
| U5 | Bound file/hunk/symbol/span/site experiments and inert selection/budget preview | S2; old flags/warning-only receivers G6 hold |
| U6 | Fingerprinted cache and explicit selection/result lineage | S2; automatic declaration utility G10 and old sidecar/manual acceptance G6 held separately |
| U7 | Pristine baseline/reset/mirrors and explicit timeout/error/invalid outcomes | S2; G3/G4 holds, no unsafe shell/Jest defaults |
| U8 | Documented native public API/CLI/types and installed proofs, exact receiver adapters | S2/S5; every unknown old public/deep import/exit/output interface G6 hold |
| U9 | Optional scoped Git context; never evidence or veto erasure | S3 |
| U10 | Explainable queue/blocking summary/experiments, protected primaryAction unchanged | S3; old planner schema G6 hold |
| U11 | Fresh affirmative site movement, separate cache/trend/intervention comparisons | S3; old memory schema G6 hold |
| U12 | Package artifact-reference index with reload/inspect/upload proof | S4; old bundle schema G6 hold |
| U13 | Separate quality/verification/release facts and bounded comparisons | S4; old joined summary schemas G6 hold |
| U14 | One staged native target | G7 loss/private/registry/tag actions held; existing6548 owns release |
| U15 | Read-only offline release preview/inspect jobs | S4, selected G8; diagnostic pass is not permission |
| U16 | Reuse verify/build/test/target LCOV/public manifest/Justfile owner | S4 + existing6553; aggregate utility G11 and old aliases G6 held |
| U17 | Preserve old task/evidence/registration/decision lineage | Held S7 admission; direction portion remains6549/decision171 |
| U18 | Preserve unique refs/branches/dirt/result memory and recoverable custody | Held S6 admission; actual archive/restore acceptance absent |

The original wave's exhaustive CLI/API/types/root33/extra Justfile crosswalk is
normative input to task handback. Every listed old spelling, type, symbol and
schema is G6 compatibility-held unless a named receiver later accepts migration
or an explicit owner decision accepts discontinuation. A selected native job does
not implicitly accept its old interface loss. G3/G4/G10/G11 are utility holds,
not merely spelling/compatibility holds. No blanket family-label waiver exists.

## Non-negotiable implementation requirements

- Focused evidence, immutable runs, complete changed-path drift, current bound
  witnesses, isolated mutation baseline/reset/mirrors and explicit missing/error
  evidence are preserved. No thresholds/scopes are widened for greener results.
- Keep protected primaryAction selection and its JSON/text/prompt/task projections;
  add a separately labeled navigation headline rather than silently replacing it.
- Distinguish exact fingerprint cache reuse, comparable aggregate trend and
  declared intervention lineage. Only fresh affirmative selected/executed site
  outcomes can clear a mutation obligation. Filtered, removed, truncated,
  interrupted, ambiguous or unexecuted sites stay unknown/unresolved.
- Index/summary references require schema and realpath/symlink containment checks;
  commands are inert argv-safe suggestions with explicit cwd, never autoexecuted.
- Keep quality/verification/release/authorization facts separate. Native check
  exit0 is not approving verdict; preserve its public exit contract and teach
  exact-run assertions/adapters for actual callers.
- Source changes require root verify, installed public-contract tests, focused
  negative fixtures and independent inspection; generated dist/samples intentional.
  Broad behavior-preserving refactoring stays with6552, not hidden in this wave.

## Implementation plan

The exact plan is `../adoption/legacy-parity/follow-up-contract-plan.json`. Its
canonical form is the AK tasks, scopes and contracts below. Read them back from
AK before you execute one.

| Slice | AK task | State after acceptance |
|---|---|---|
| S1 | 6700 | Executable next: correctness/catalog only (U1-U4, G2, G5) |
| S2 | 6701 | Deferred until decision180 and completed S1 |
| S3 | 6702 | Deferred; also needs S2 and existing6557 |
| S4 | 6703 | Deferred; also needs S3 and existing6553 |
| S5 | 6704 | Needs receiver-owner screening permission |
| S6 | 6705 | Admission planning only |
| S7 | 6706 | Admission only; deferred until settlement evidence |
| S8 | 6707 | Removal admission checklist only |

Acceptance releases the decision hold. It does not release the other
dependencies and deferrals. Each slice still needs its exact-task claim and its
own proof. G3/G4/G10/G11 stay held, and no slice may implement them.

## Validation, rollout and rollback

- **Validation per source slice:** focused positive and negative fixtures for
  the slice, root `npm run verify`, installed public-contract tests,
  intentionally rebuilt dist/samples, strict docs, `git diff --check` and an
  independent work-product inspection.
- **Rollout:** one slice at a time, in order S1 -> S2 -> S3 -> S4, on main.
  Each slice lands as bounded commits. No slice publishes, pushes, tags or
  repins packages. A slice reaches users only through a later release task
  (existing6548 owns the 0.7.0 safety release, which does not contain S1-S4).
- **Rollback:** revert the slice's bounded commits and rebuild dist/samples.
  Immutable evidence and run ids are never rewritten. If a confirmed caller
  needs an untested old interface, stop and reframe the slice; do not clone the
  old interface to get parity.

## Execution and settlement boundaries

S1-S4 native contracts are accepted designs, executed one exact task at a time.
S5 local receiver evidence needs
receiver-owner permission before screening; acceptance of results/rollback is an
output. Preserve6550->6548: local source evidence cannot satisfy public adoption.
S6-S8 are held **admission-planning** tasks, not archival/retirement/deletion
execution. Completing a checklist does not satisfy the intended later effect.
S7 requires accepted preservation-effect/restore evidence, not completed S6
planning. Exact archive destination/access/retention/custody and any removal
permission require standalone owner decisions and separately bounded effect tasks.

Reuse6548/6550/6552/6553/6557;6551 is already done. Reuse6549/decision171 only for
existing direction reconciliation, not retirement. No old tasks/registrations,
lane maps, remotes or public packages are changed by this adjudication.

## Reversal and closeout

Stop/reframe an implementation task if a confirmed caller needs an untested old
interface, ordering cannot be explained, comparison identity is guessed, safety
is weakened, or archive/restore cannot preserve unique state. Revert bounded
implementation commits/configuration; never rewrite immutable evidence/run ids.

AK6585 closes as adjudication and task authoring only. The product wave,
accepted receiver migration, published availability, preservation, formal
retirement and physical removal all remain open until their own proof/authority.
