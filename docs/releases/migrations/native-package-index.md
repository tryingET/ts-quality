---
summary: "Unreleased migration for decision180 S4: package artifact-reference index, separate repo summary, offline release diagnostics and the CI upload roundtrip."
read_when:
  - "When replacing legacy quality:bundle, repo:readiness, repo:validation:summary or release:trust jobs"
  - "When parsing ts-quality index write/inspect output or uploading a package index from CI"
type: "guide"
---

# Native package index, separate summaries and release diagnostics — Unreleased migration

This describes current source, not a published release. Every legacy script is mapped in
`docs/adoption/legacy-parity/native-s4-crosswalk.md`. Old names and schemas stay G6 holds: no alias exists.

## 1. Package artifact-reference index (product CLI)

`ts-quality index write (--package <dir[,dir]> | --all) [--run-id <id[,id]>] [--out <file>] [--json]` writes
`.ts-quality/package-index.json` (kind `ts-quality-package-index`, `schemaVersion` 1):

- Packages are the directories that contain a `package.json`, outside `node_modules`, `dist`, `.git` and
  `.ts-quality` (the directories `check` skips). Name them with `--package` or take all of them with `--all`.
  A changed file belongs to the deepest enclosing package. Files of packages you did not select are listed under
  `outsideIndexedPackages`.
- For each run (explicit ids, or the latest pointer, labeled `latest-pointer`), the index records the canonical
  packet files listed in `publication.json` with SHA-256 digests and byte counts. It copies no verdict and computes
  no plan.
- `completeness` counts packages with and without run evidence. `executedCoverageClaim` is always `none`.
- `upload.paths` lists exactly what to upload: the index, the packet files and the package manifests.
- The index is a generated artifact: `ts-quality retention` lists `.ts-quality/package-index.json` to keep out of
  commits. Add it to `.gitignore` if your repo ignores `.ts-quality/` entries one by one, or write it elsewhere with
  `--out` (a lint or format gate over an unignored index fails).
- Identical repository state and run selection give a byte-identical index in any locale, because ordering is
  by code unit.

`ts-quality index inspect [--index <file>] [--package <dir[,dir]>] [--json]` re-reads every reference and reports
facts. It always exits 0 for facts:

- each reference is `fresh`, `changed` or `missing`;
- each run's source is `current`, `drifted` or `unavailable`. `unavailable` means every evaluated file is absent,
  as in an uploaded copy; a single deleted file is `drifted`. Changed files and control-plane files are read
  without following symbolic links, and a run that records one of them outside the root is refused;
- each package is `current`, `source-unavailable`, `stale` or `no-run-evidence`;
- the `--all` enumeration is `current` or `changed`;
- findings in a package are counted from the run verdict's findings whose scope names that package's changed files.

Quality facts are withheld when a run's packet changed after indexing. Inspect refuses (exit 1):

- an unknown kind or schema version;
- paths outside the root and symbolic links;
- inconsistent completeness;
- evidence that does not partition each run's changed files exactly once between the deepest enclosing indexed
  package and `outsideIndexedPackages`;
- a run packet whose changed files differ from the index.

## 2. Separate repo summary (repo scripts)

`npm run repo:summary -- [--package-index <file>] [--package <dir>] [--verification-log <file>] [--release-report <file>]`
writes a `ts-quality-repo-summary` (`schemaVersion` 1) with three separately sourced sections:

- **quality** comes from the index inspection.
- **verification** comes from a recorded `verify.mjs` log. Its mode is `full` (every command `verify.mjs` runs
  exited 0), `smoke`, `failed` or `partial`. `failed` covers a non-zero exit, `exit=null` (a signal or a spawn
  failure) and a command with no exit line. It is a recorded log, not live CI.
- **release** comes from a release diagnostics report.

There is no combined status. `npm run repo:summary:compare -- --baseline <a> --candidate <b>` compares a section
only when both sides are comparable: the same package filter and set, the same verification mode, the same release
target package. Otherwise it gives the reason. It reports differences, never improvement. It also reports:

- both sides' reference, enumeration and release-report states;
- a release check one side did not record, as `not-recorded` rather than a pass.

Equivalent filter spellings (`./packages/api/` and `packages/api`) are normalized.

## 3. Offline release diagnostics (repo scripts)

`npm run release:diagnostics -- [--tag v<x.y.z>] [--out <file>] [--json]` runs 19 offline checks over local files:

- target manifest, name, version, workspace version and bin;
- tag format and version match;
- the publish workflow: the release trigger must be the only trigger and only `published`; the OIDC permission;
  the environment; the intent check and the proof step must each run in a step before publishing; the
  `--provenance` publish; the publish step's working directory. These checks read the run lines of each step with
  comments stripped, so a comment or an `echo` does not count;
- repository provenance and the expected trusted publisher;
- release notes and the changelog section.

It runs no Git, npm, network or GitHub command and executes nothing. Exit codes:

- 0 when every check passes;
- 1 when a check fails;
- 2 for a usage error, a missing root or a refused input.

The report does not guess the npm dist-tag: `publish.yml` chooses it from the GitHub Release prerelease flag, and the
report records only whether the tag has a prerelease suffix (`prereleaseTag`).

`npm run release:diagnostics:inspect -- --report <file>` reloads a written report. A report must record each of
the 19 checks exactly once, in order; otherwise it is refused. Inspect re-digests the inputs, including the ones
that were missing or refused at preview time and the release-notes directory listing, and reports `current` or
`stale`.

A passing preview is not release permission.

## 4. CI upload roundtrip

On its node 24 leg, `ci.yml` installs the proven tarball, runs
`node scripts/native-package-index-ci.mjs produce --cli <installed bin> --out-dir <dir>` and uploads exactly the
index's `upload.paths` as `ts-quality-package-index`, with `include-hidden-files: true` for `.ts-quality/`. The
`package-index-reader` job downloads it, installs the same tarball and runs `read`. `read` requires:

- fresh references and a current enumeration;
- `source-unavailable` for every package with evidence (the sources are not uploaded);
- no file outside `upload.paths`.

## Verification

```bash
npm run verify
node --test test/native-package-index.test.mjs test/native-package-index-ci.test.mjs test/release-diagnostics.test.mjs test/release-diagnostics-summary.test.mjs
```

Not changed: `check`, verdicts, `primaryAction`, CLI exit codes of existing commands, the publish workflow. G11
aggregate LCOV and G7 topology stay held.
