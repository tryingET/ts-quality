---
name: Release checklist
about: Prepare a public GitHub and npm-quality release of ts-quality
title: "release: prepare <version>"
labels: [release]
assignees: []
---

## Release target

- Version: <!-- e.g. 5.0.1 -->
- Type: <!-- patch / minor / major / prerelease -->
- Target date:

## Product framing

- [ ] README still matches shipped behavior
- [ ] CHANGELOG includes operator-relevant changes
- [ ] GitHub description/tagline still fits the release
- [ ] social preview image still feels current
- [ ] release notes draft is ready

## Repo truth

- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run sample-artifacts`
- [ ] `npm run smoke`
- [ ] `npm run verify`
- [ ] `node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict`

## Package staging proof

- [ ] `npm run pack:ts-quality`
- [ ] inspect staged package under `.ts-quality/npm/ts-quality/package`
- [ ] inspect tarball under `.ts-quality/npm/ts-quality/tarballs`
- [ ] install tarball into a fresh temp project
- [ ] `./node_modules/.bin/ts-quality --help` works from the installed tarball

## Public npm metadata

- [ ] package name/version are correct
- [ ] description is current
- [ ] repository/homepage/bugs links are correct
- [ ] keywords still match the product
- [ ] package file set is intentionally minimal

## Publish decision

- [ ] alpha/breaking notes are explicit
- [ ] first-time user quickstart was re-run from a fresh clone
- [ ] release notes call out who this is for
- [ ] publish path is deterministic, not a one-off shell ritual

## Publish steps

- [ ] publish staged package tarball/process
- [ ] create GitHub release
- [ ] paste release notes
- [ ] verify install from public npm after publish

## Post-release

- [ ] announce the release
- [ ] capture follow-up packaging debt or polish items
- [ ] link the final GitHub release here
