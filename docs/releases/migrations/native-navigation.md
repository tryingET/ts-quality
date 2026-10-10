---
summary: "v0.8.0 migration for decision180 S3: derived navigation queue, intervention lineage, Git facts and the run.json mutationContext."
read_when:
  - "When replacing legacy quality/loop/plan, survivor-memory or trend-as-progress jobs"
  - "When parsing run.json mutationContext or ts-quality navigate --json"
type: "guide"
---

# Native navigation — v0.8.0 migration

Part of v0.8.0; [`v0.8.0.md`](v0.8.0.md) is the release-level map. It applies to agents and operators who used the legacy planner/loop jobs or read mutation score movement as progress.

## 1. New additive run field

`check` records `run.json` `mutationContext` (version `1`): test command, timeout, runtime, the ts-quality version, a digest of the sanitized environment, per-file digests of the test files (files matching `testPatterns` under the usual discovery rules, so hidden directories only when a pattern names them), one digest over every other repository file outside hidden directories and `node_modules`/`dist` (sources, fixtures, config), and digests of the root package manifest and lockfiles. Older packets lack it; lineage then reports `no-execution-context` instead of guessing.

## 2. Read the navigation, keep using primaryAction

`ts-quality navigate --run-id <id> [--json]` is derived and read-only. It lists blocking facts in a versioned queue: evidence invalidity (drift, baseline, incomplete mutation evidence), governance vetoes, legitimacy denials, behavioral counterexamples, coverage or witness insufficiency, policy burden, then optional Git context suggestions. Each item says why it is open and, where useful, an inert experiment (`argv`, `cwd: "."`, `inputs`, stop criteria) that nothing runs. Ties sort by class rank, severity, scope and identity, and every item carries its `orderKey`.

The protected `nextEvidenceAction.primaryAction` is unchanged and reported as is; the navigation headline is a separate label. Keep CI and prompts bound to `primaryAction` and the exact-run assertions in `docs/ci-integration.md`.

## 3. Intervention lineage replaces survivor memory

`navigate --run-id <after> --intervention-from <before> --intervention-tests <files>` compares observed survivors in the earlier run with the same site later. A site is reported as `observed-kill-after-declared-intervention` only when its identity is unchanged, it was freshly executed and killed behind a green baseline, and nothing but the declared test files changed: no source file, no other repository file, no config, policy, command, timeout, runtime, environment, dependency or ts-quality version. Otherwise it is `killed-with-context-change` with labels (`test-deleted`, `undeclared-test-change`, `declared-test-unchanged`, `source-changed`, `support-file-changed`, `config-changed`, `tool-changed`, `command-changed`, `timeout-changed`, `runtime-changed`, `environment-changed`, `dependency-changed`, `policy-changed`), `still-survived`, or `unknown` (`outside-after-scope`, `site-identity-missing`, `not-selected-after`, `no-verdict-after`, `cached-after`, `baseline-not-green-after`, `no-execution-context`). Clearing a site never clears an invariant obligation. The environment comparison covers the whole sanitized environment, so compare runs made in the same job or shell; CI run identifiers alone produce `environment-changed`. `--intervention-tests` paths resolve against `--root`.

Three comparisons stay separate: cache reuse (exact fingerprint, `origin: "cached"`), aggregate trend (`ts-quality trend`, comparability only) and intervention lineage. A trend improvement is not a repair, and a cached result is not a new observation.

## 4. Optional Git facts

`--git-horizon <commit>` adds per-file commits since that commit, last commit time (UTC), author count, uncommitted and untracked state, and earlier names after renames. Without the flag no Git command runs. With it, Git runs read-only with optional locks off, fsmonitor off, literal pathspecs and pinned log/status settings, so it neither refreshes the index nor depends on user configuration. A missing `git`, a non-repository, a horizon missing from history (for example in shallow clones) and a horizon that is not an ancestor of `HEAD` report `available: false` with a reason (`git-unavailable`, `not-a-git-repository`, `horizon-not-in-history`, `horizon-not-ancestor`). Hints from these facts are `context-suggestion` items that never add, remove or outrank blocking facts.

## Verification

```bash
npm run verify
node --test test/native-navigation-lineage.test.mjs test/native-navigation-queue.test.mjs
```

Not changed: primaryAction selection, verdicts, CLI exit codes. Legacy planner schemas and memory files stay held (decision180 G6).
