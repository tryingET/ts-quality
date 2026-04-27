---
summary: "How-to guide for agents bootstrapping ts-quality in a greenfield target repository without creating brownfield debt."
read_when:
  - "You are starting a new repo and want ts-quality from day one."
  - "You want a greenfield bootstrap path instead of a brownfield rollout recipe."
type: "how-to"
---

# Greenfield bootstrap how-to

This guide is for agents and operators bootstrapping `ts-quality` in a **new** target repository.

Use it when the repo is still flexible enough that you can choose behavior boundaries, test shape, artifact ignores, and screening wrappers up front. Use `docs/adoption/agent-integration-how-to.md` instead when the target repo already has meaningful structure, tests, facades, or built-runtime drift. Use `docs/harnessed-llm-operator-guide.md` instead when maintaining or reviewing the `ts-quality` repo itself.

Canonical product semantics still live in:
- `README.md`
- `docs/invariant-dsl.md`
- `docs/config-reference.md`
- `docs/ci-integration.md`

For a concrete one-slice target-repo example, use `docs/adoption/minimal-external-walkthrough.md` after this guide.

This guide is about **greenfield setup choices**, not replacing those contracts.

## Greenfield goal

A good greenfield integration avoids the brownfield recovery work later.

That means:
- start with behavior-bearing boundaries, not facade barrels
- keep screening on authored source from day one
- keep witnesses focused
- make repo-local truth explicit early
- register the repo in the central catalog once the first truthful slice lands

## One-slice bootstrap loop

Do not bootstrap a broad quality theater. Start with one behavior-bearing slice and make its evidence path boring.

For the first slice:

1. **Design** an implementation boundary before adding facade barrels.
2. **Bind** one invariant, one focused test or witness, explicit changed scope, and one run id.
3. **Run** the repo's normal quality command, then witness/check wrappers with explicit `--changed` and `--run-id` values.
4. **Classify** the evidence honestly: pass, warn, fail, unsupported, lexically-supported, or execution-backed.
5. **Route debt** before widening: fix blocking in-scope gaps now, defer out-of-scope gaps with reason and trigger, or name the next slice ceiling.
6. **Record** current-vs-target truth locally before updating the central catalog.

The greenfield advantage is assumption deletion: do not create facade drift, built-runtime ambiguity, repo-global witnesses, or ambient latest-pointer workflows that brownfield integrations later have to unwind.

## Bootstrap recipe

### 1) Separate facade surfaces from implementation surfaces early

If the repo wants public entrypoints such as `src/index.ts` or `src/feature.ts`, keep them thin.
Put real behavior into implementation files such as:
- `src/feature/dispatch-core.ts`
- `src/feature/runtime-core.ts`
- `src/feature/config-core.ts`

That gives screening real mutation targets and keeps facade aliases small.

### 2) Choose one first invariant before the repo gets wide

Pick a first slice that is:
- behavior-bearing
- narrow
- already covered by one focused contract test
- likely to stay stable while the repo grows

Good first greenfield slices look like:
- fail-closed dispatch behavior
- error-surface helpers
- bounded filesystem helpers
- deterministic config-shaping logic

### 3) Screen `src/**` from day one

Default greenfield rule:
- authored source is the screening surface
- tests should align to that source surface whenever possible

If the repo later chooses dist-backed runtime tests, document that explicitly and add a real source-map remap story at the same time.
Do not defer that decision into hidden repo drift.

### 4) Add the repo-local control plane immediately

Typical starting files:
- `ts-quality.config.json`
- `.ts-quality/invariants.ts`
- `.ts-quality/constitution.ts`
- `.ts-quality/agents.ts`
- `.ts-quality/approvals.json`
- `.ts-quality/waivers.json`
- `.ts-quality/overrides.json`
- `.ts-quality/witnesses/README.md`

If the repo needs wrappers, add repo-local scripts such as `scripts/screening/*`.

### 5) Keep the witness path focused

For each live slice:
- one invariant
- one focused witness command
- one witness artifact
- one sibling `.receipt.json` sidecar

Do not make the first witness repo-global just because the repo is small.
It is easier to widen a focused witness later than to recover from a noisy first contract.

### 6) Add repo-local rollout truth immediately

Create:
- `docs/dev/ts-quality-current-vs-target.md`

In a greenfield repo this file can start very small.
It should still answer:
- what is live now
- what is next
- what is later
- what the target screening shape is

### 7) Ignore runtime artifacts from the start

Ignore generated artifacts such as:
- coverage output
- `.ts-quality/runs/`
- `.ts-quality/materialized/`
- `.ts-quality/attestations/`
- `.ts-quality/keys/`
- generated witness and receipt JSON

Keep only control-plane files and the witness-directory README committed.

### 8) Verify the first slice truthfully

Typical first verification:

```bash
# target repo's existing normal quality gate; name varies by repo
npm run check

# docs strictness when the target repo uses this docs contract
node ~/ai-society/core/agent-scripts/scripts/docs-list.mjs --docs . --strict

# target repo wrapper commands around ts-quality
npm run screening:witness-refresh -- --changed <repo-local-path>
npm run screening:check -- --changed <repo-local-path> --run-id <repo-slice-id>
```

Always pass explicit changed scope and run id in harnessed automation. Do not teach a new repo to depend on ambient `.ts-quality/latest.json` selection.

If that run fails, keep the truth.
The goal is not early green theater; it is a trustworthy first slice.

### 9) Register the repo in the central catalog once the first truthful slice lands

Use:
- `docs/adoption/repo-screening-entry.template.json`
- `node scripts/register-screening-catalog.mjs --entry docs/adoption/entries/<repo>.json`

The central catalog is downstream overview only.
Repo-local truth stays in the integrated repo.

## Greenfield anti-patterns

Avoid these:
- building only facade barrels and hiding real behavior behind them
- waiting until the repo is large before adding screening
- deciding to run tests from built runtime without also deciding how coverage maps back to source
- making the first invariant too broad
- skipping the repo-local current-vs-target file because "the repo is still small"

## Definition of a good greenfield start

A greenfield repo is in good shape when:
- at least one slice has a truthful run with explicit evidence status; do not require fake-green support before recording reality
- implementation boundaries are clearer than facade barrels
- screening targets authored source such as `src/**`
- witness refresh works when execution witnesses are configured
- screening check works from natural repo-facing paths
- runtime artifacts are ignored correctly
- repo-local rollout truth exists
- the repo is registered in the central catalog after repo-local truth is stable
