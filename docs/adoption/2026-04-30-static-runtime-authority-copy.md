---
summary: "Adoption evidence: dep-viz explicitly labels static/runtime classifications as evidence context, not removal authority."
read_when:
  - "Reviewing dependency-intelligence corridor adoption evidence."
  - "Checking whether static/runtime dependency evidence is separated from removal authority."
type: "evidence"
---

# Static/runtime authority-boundary copy — 2026-04-30

## Purpose

This slice makes the dependency-intelligence boundary visible in the dep-viz operator surface:

```text
static importance != runtime observation != removal authority
```

Static centrality, runtime observation, declared-unobserved status, and runtime-only status remain evidence classifications. They do not automatically authorize prune/remove decisions.

## Repo changed

### dep-viz

- Repo: `/home/tryinget/ai-society/softwareco/owned/dep-viz`
- Commit: `6ec8dc8 feat: clarify static runtime evidence authority`
- Changed files:
  - `web/report/src/views/Overview.js`
  - `tests/report-model-loader.test.mjs`
  - `tests/static-runtime-corridor-fixture.test.mjs`
  - `docs/operations/static-runtime-operator-path.md`

## What changed

The overview's static/runtime evidence panel now renders an explicit authority-boundary note:

```text
Static importance, runtime observation, declared-unobserved, and runtime-only are evidence context, not removal authority.
```

Regression coverage asserts the note appears in both:

- the checked-in static/runtime corridor fixture render path;
- the dep-diet operator-output consumption render path.

The operator walkthrough was updated with the same copy so docs, tests, and UI agree.

## Verification

### dep-viz targeted UI/evidence tests

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
node --test tests/report-model-loader.test.mjs tests/static-runtime-corridor-fixture.test.mjs
```

Result:

```text
21 pass / 0 fail
```

### dep-viz requested repo verification

```bash
cd /home/tryinget/ai-society/softwareco/owned/dep-viz
bash scripts/ci/full.sh
npm test
git diff --check
git status --short --branch
```

Results:

```text
rocs validate: OK
86 pass / 0 fail
git diff --check: pass
## main
```

## Repos intentionally not changed

- `/home/tryinget/ai-society/softwareco/owned/runtime-trace-insights`
  - no mutation needed; runtime evidence contract is unchanged.
- `/home/tryinget/ai-society/softwareco/owned/dep-diet`
  - no mutation needed; depmodel evidence structure and CLI output are unchanged.

## Publication posture

No external push was performed. The dep-viz and ts-quality evidence commits remain local on `main`.

## Next recommended slice

Add package-row/detail-level dep-viz explanations for each static/runtime classification so operators can inspect why a package is `static-runtime-confirmed`, `runtime-only`, `declared-unobserved`, or `static-central-unobserved` without treating the classification as removal authority.
