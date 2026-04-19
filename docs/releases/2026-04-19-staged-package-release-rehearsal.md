---
summary: "Recorded rehearsal of the first staged-package release path from the aligned public surfaces."
read_when:
  - "When deciding whether the first public ts-quality package is ready to publish"
  - "When checking what the staged-package rehearsal actually proved"
type: "record"
---

# Staged-package release rehearsal — 2026-04-19

## Goal

Rehearse the first public `ts-quality` package path exactly as the aligned public surfaces now describe it:

1. build the repo-root workspace
2. prove the staged-package path with `npm run smoke:packaging`
3. publish from `.ts-quality/npm/ts-quality/package`

This rehearsal stops at `npm publish --dry-run --access public` so no real package is published.

## Preflight note

A pre-existing, unrelated local README working-tree diff was present during this task.
Because the staged package copies `README.md` from the working tree, that unrelated diff was temporarily stashed before the rehearsal commands ran, then restored afterward, so the rehearsal reflects the committed repo state rather than an accidental local variant.

## Commands run

```bash
npm run build
npm run smoke:packaging --silent
cd .ts-quality/npm/ts-quality/package
npm publish --dry-run --access public
```

## Observed outcomes

### Packaging proof

`npm run smoke:packaging --silent` succeeded and reported:

- package name: `ts-quality`
- version: `0.1.0`
- staged package dir: `.ts-quality/npm/ts-quality/package`
- tarball: `.ts-quality/npm/ts-quality/tarballs/ts-quality-0.1.0.tgz`
- packed tarball file count: `39`
- shipped CLI help text still includes: `ts-quality commands:`
- consumer type-resolution smoke: `passed`

The smoke path therefore re-proved all of the currently documented package contracts:

- staged manifest contract
- staged file-boundary contract
- packed tarball file-set contract
- fresh-temp-project install/load behavior
- shipped CLI/API/types surfaces

### Publish dry-run

`npm publish --dry-run --access public` from `.ts-quality/npm/ts-quality/package` succeeded.

Observed dry-run publish details:

- registry target: `https://registry.npmjs.org/`
- package tag: `latest`
- access: `public`
- filename: `ts-quality-0.1.0.tgz`
- package size: `92.6 kB`
- unpacked size: `495.9 kB`
- total files: `39`
- shasum: `9d289ba7d2e40a82d055c24cb9dfa29e10c85e99`

## Conclusion

The aligned staged-package operator path is now rehearsed successfully through a real npm publish dry-run from the staged package root.
No hidden extra operator step was needed beyond the current documented staged-package flow.

## Remaining step

This rehearsal does **not** itself decide whether to publish for real.
The next repo-local step is to record an explicit first-release decision from this rehearsal outcome rather than leaving the publish posture implicit.
