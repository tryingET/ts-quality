---
summary: "Checklist and evidence fields for distinguishing accepted repo-local ts-quality adoption from temp-copy pilots or candidate dogfood."
read_when:
  - "You need to decide whether a target repo has accepted repo-local/live ts-quality adoption."
  - "You are recording target-repo rollout evidence after a pilot, temp copy, or candidate dogfood run."
type: "reference"
---

# Accepted repo-local adoption

This guide defines what counts as **accepted repo-local/live adoption** of `ts-quality` in a target repo.
It prevents temp-copy pilots, candidate worktrees, and one-off dogfood runs from being reported as production adoption.

Use it with:
- `docs/adoption/agent-integration-how-to.md` for brownfield target repos
- `docs/adoption/greenfield-bootstrap-how-to.md` for new repos
- `docs/adoption/minimal-external-walkthrough.md` for a tiny first slice
- `docs/adoption/negative-path-examples.md` for truthful non-green outcomes
- `docs/adoption/repo-screening-entry.template.json` when repo-local truth is stable enough to register centrally

## Terms

### Accepted repo-local/live adoption

A target repo has accepted repo-local/live adoption only when the repo owner has accepted a reviewable `ts-quality` setup that lives in that repo and can be rerun from that repo's normal checkout.

Accepted adoption is compatible with red, warning, or partial screening results. The claim is not "the repo is good"; the claim is "the repo has accepted `ts-quality` as a live local evidence surface for the recorded slice(s)."

### Temp-copy proof

A temp-copy proof runs `ts-quality` against a copied checkout, scratch directory, fixture, or generated sample outside the target repo's accepted state. It can prove feasibility or expose blockers, but it is not adoption until the reusable setup is accepted into the target repo.

### Candidate dogfood proof

A candidate dogfood proof runs in a branch, fork, isolated worktree, or unmerged candidate patch. It can be strong evidence for review, but it remains candidate evidence until the target repo accepts the setup into its live branch or other owner-approved live surface.

## Accepted-adoption checklist

Record accepted adoption only when all applicable items are true:

- **Owner surface:** the target repo owner, maintainer, or accepted repo process has approved the adoption state; do not treat a `ts-quality` maintainer's candidate patch as owner acceptance.
- **Repo-local source of truth:** the target repo has a repo-local current-vs-target note, usually `docs/dev/ts-quality-current-vs-target.md`, that states what is live now, next, later, and target shape.
- **Reusable control plane:** committed repo-local setup exists for the accepted slice, such as `ts-quality.config.json`, `.ts-quality/invariants.*`, `.ts-quality/constitution.*`, `.ts-quality/agents.*`, `.ts-quality/approvals.json`, `.ts-quality/waivers.json`, `.ts-quality/overrides.json`, `.ts-quality/witnesses/README.md`, or wrapper scripts.
- **Artifact hygiene:** generated runs, latest pointers, coverage output, generated witness receipts, private keys, materialized output, and transient attestations are ignored or otherwise intentionally retained according to the repo's policy.
- **Focused slice evidence:** each accepted live slice names behavior-bearing screened paths, facade/runtime aliases when needed, focused witness tests or scripts, and a truthful status such as `unsupported`, `lexically-supported`, `execution-backed`, `supported`, `warning`, or `blocked`.
- **Rerunnable commands:** the repo-local doc records the command sequence used to regenerate the evidence from a normal checkout, including explicit `--changed` and `--run-id` values where applicable.
- **Run-bound artifacts:** at least one reviewed run, witness, report, explain, plan/govern, or authorization artifact is named with its path or run id, or the doc explicitly states why the current accepted state is pre-run/planning only.
- **Temp/candidate boundary:** any temp-copy, isolated worktree, fork, or unmerged branch evidence is labeled as such and is not counted as live adoption by itself.
- **Central overview is downstream:** `docs/adoption/repo-screening-catalog.json` and `.md` are updated only after repo-local truth is stable; the catalog does not replace target-repo authority.
- **Rollback is named:** the repo-local doc states how to remove or pause the setup without deleting historical review context.

## Target-repo evidence fields

The target repo's current-vs-target note should include these fields or equivalent headings. Keep values concise and link to local artifacts instead of copying large reports.

| Field | Meaning |
|---|---|
| `adoptionStatus` | One of `not-started`, `temp-copy-proof`, `candidate-dogfood`, `accepted-repo-local`, `paused`, or `retired`. |
| `acceptedBy` | Person, team, maintainer role, decision id, or repo process that accepted the live setup. Leave blank or `n/a` for temp/candidate evidence. |
| `acceptedAt` | Date or review event for accepted live setup. Use `n/a` for temp/candidate evidence. |
| `packageSource` | How `ts-quality` was run: npm version, local package tarball, workspace path, or candidate branch/worktree. |
| `repoLocalControlPlane` | Committed paths that define the reusable setup. |
| `artifactRetentionPolicy` | Which `.ts-quality/**`, coverage, key, attestation, materialized, and run artifacts are ignored, committed, or intentionally retained. |
| `acceptedSlices` | Live slices with id, screened paths, aliases, witness tests/scripts, status, and latest reviewed run id. |
| `latestEvidence` | Paths or run ids for the latest reviewed witness, check, report, explain, plan/govern, authorization, or negative-path artifact. |
| `commands` | Rerunnable commands, including explicit changed scope and run id. |
| `knownGaps` | Honest blockers, unsupported claims, mutation/coverage/governance failures, and why they do not invalidate the adoption-status claim. |
| `centralCatalogStatus` | Whether the downstream catalog entry exists, is pending, or is intentionally skipped. |
| `rollback` | Paths or commands to remove/pause the setup and the historical docs/artifacts to preserve. |

A compact target-repo section can look like:

```markdown
## ts-quality adoption state

- adoptionStatus: accepted-repo-local
- acceptedBy: repo maintainer review on 2026-05-06
- acceptedAt: 2026-05-06
- packageSource: npm `ts-quality@0.3.1`
- repoLocalControlPlane: `ts-quality.config.json`, `.ts-quality/invariants.ts`, `.ts-quality/witnesses/README.md`, `scripts/screening/check.mjs`
- artifactRetentionPolicy: commit config/docs/witness README; ignore `.ts-quality/runs/`, `.ts-quality/latest.json`, coverage, generated witness receipts, private keys, materialized output
- acceptedSlices:
  - id: `auth.refresh.validity`
    screenedPaths: `src/auth/token.ts`
    witnessTests: `test/auth/token.test.ts`
    status: execution-backed
    latestReviewedRunId: `auth-refresh-2026-05-06`
- latestEvidence: `.ts-quality/runs/auth-refresh-2026-05-06/report.md`, `.ts-quality/witnesses/auth-refresh-expired-boundary.json`
- commands: `npm run test:auth-refresh --silent`; `npx ts-quality check --changed src/auth/token.ts --run-id auth-refresh-2026-05-06`
- knownGaps: mutation pressure remains warning-only for later slices
- centralCatalogStatus: registered in `docs/adoption/repo-screening-catalog.json`
- rollback: remove wrapper scripts/config and keep this note plus historical run ids for audit
```

## Central catalog fields

After accepted repo-local truth is stable, project the target repo into `docs/adoption/repo-screening-catalog.json` with the existing catalog fields:

- `repoId`
- `repoPath`
- `sourceOfTruth`
- `adoptionStage`
- `currentSlices[].id`
- `currentSlices[].screenedPaths`
- `currentSlices[].facadeAliases` when natural paths differ from screened implementation paths
- `currentSlices[].witnessTests`
- `currentSlices[].status`
- `currentSlices[].notes`
- `readyNextSlices[]`
- `candidateLaterSlices[]`
- `targetState[]`

Use `docs/adoption/repo-screening-entry.template.json` and `node scripts/register-screening-catalog.mjs --entry ...` for registration. Do not add temp-copy proofs or unmerged candidate dogfood runs to `currentSlices` unless the target repo has accepted them as repo-local/live state.

Catalog guardrail: if `adoptionStage` claims `accepted-repo-local`, the registration script requires an `acceptedEvidence` object with `acceptedBy`, `acceptedAt`, `artifactRetentionPolicy`, `latestEvidence`, `commands`, and `rollback`. If those fields are not yet present in the target repo source-of-truth, use a stage such as `repo-local-live-...-accepted-fields-pending` instead of overclaiming accepted adoption.
