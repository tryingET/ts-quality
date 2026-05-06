---
summary: "Operator guide for writing the first useful invariant and focused execution witness without proof theater."
read_when:
  - "You are writing a target repo's first ts-quality invariant."
  - "You need to choose a focused witness command and interpret lexical vs execution-backed support."
type: "how-to"
---

# First invariant and witness authoring guide

Use this guide when a target repo has no useful `ts-quality` invariant yet and the next step is to write one reviewable behavior claim.
The goal is not to make the first run green. The goal is to make the first invariant small enough that its evidence is inspectable and honest.

For a complete file-by-file setup, pair this guide with `docs/adoption/minimal-external-walkthrough.md`. For canonical field semantics, use `docs/invariant-dsl.md` and `docs/config-reference.md`.

## The first useful invariant shape

A good first invariant binds one behavior-bearing source slice to one observable scenario and one focused witness command.

Choose:

1. **One behavior-bearing source path** — the file where the decision or transformation happens, not a facade barrel.
2. **One scenario** — a concrete happy path or failure path that a reviewer would ask about.
3. **One focused test file** — the test file that already proves, or should prove, that behavior.
4. **One witness command** — a repo-owned command that runs the focused proof and writes a witness artifact.
5. **One changed scope and run id** — the same reviewed slice for `doctor`, `witness`, `check`, `report`, and `explain`.

Prefer an invariant that is narrow but meaningful. A first invariant can cover a fail-closed branch, a validation boundary, an adapter mapping rule, or a deterministic parser decision. It should not cover an entire subsystem just because the subsystem has a convenient `npm test` command.

## Good first invariant

```ts
export default [{
  id: 'auth.refresh.validity',
  title: 'Refresh token validity',
  description: 'Expired refresh tokens must never authorize access.',
  severity: 'high',
  selectors: ['path:src/auth/token.js'],
  requiredTestPatterns: ['test/token.test.js'],
  scenarios: [{
    id: 'expired-boundary',
    description: 'exact expiry boundary denies access',
    keywords: ['active token before expiry allows access'],
    failurePathKeywords: ['exact expiry boundary denies access'],
    expected: 'deny'
  }]
}];
```

Why this is good:

- the selector names the behavior-bearing file;
- the scenario is one reviewable claim;
- focused test discovery is constrained by `requiredTestPatterns`;
- the keywords describe assertion-bearing test content, not broad project vocabulary;
- the invariant can be upgraded with one execution witness without changing the claim.

## Bad first invariant

```ts
export default [{
  id: 'auth.system.secure',
  title: 'Authentication is secure',
  description: 'The auth system is safe and all token behavior is correct.',
  severity: 'critical',
  selectors: ['path:src/**'],
  scenarios: [{
    id: 'all-auth-behavior',
    description: 'all authentication flows are secure',
    keywords: ['auth', 'secure', 'token'],
    expected: 'allow'
  }]
}];
```

Why this is bad:

- `path:src/**` turns one claim into repo-wide ambiguity;
- vague keywords can match prose or unrelated tests;
- the scenario cannot tell a reviewer which behavior was exercised;
- a repo-global test command could make the run look busy without proving this claim;
- any failure would be hard to route to a small follow-up slice.

## Choosing the witness command

Use `ts-quality witness test` after choosing the source path, test path, invariant id, and scenario id:

```bash
npx ts-quality witness test \
  --invariant auth.refresh.validity \
  --scenario expired-boundary \
  --source-files src/auth/token.js \
  --test-files test/token.test.js \
  --out .ts-quality/witnesses/auth-refresh-expired-boundary.json \
  -- node --test test/token.test.js
```

Choose the command after `--` by this order:

1. **Focused module or contract test**: `node --test test/token.test.js`, `vitest run test/token.test.ts`, or a repo-local equivalent.
2. **Repo-local npm wrapper for a focused proof**: `npm run test:auth-token --silent`, especially when TypeScript loaders, environment flags, or build steps make the raw command long.
3. **Build plus focused test**: run the target repo build first, then run the witness command, when the test imports built output.
4. **Repo-global baseline only when unavoidable**: use `npm test` only when the repo cannot target the behavior yet, and record that limitation as evidence debt. Do not call it execution proof of the invariant unless the witness still binds to the exact source and test files.

A witness command is repo-owned evidence. It should be something the target repo can keep running in CI or a review script without depending on a human's shell history.

## Support interpretation

| Reported support | What it means | What it does not mean | Next action |
|---|---|---|---|
| `unsupported` | No focused lexical support or matching pass witness was found. | The behavior is false. | Add or fix an assertion-bearing focused test or witness. |
| `lexically-supported` | A focused test case contains the configured happy-path or failure-path keywords and assertions. | Runtime behavior was executed and proven for this scenario. | Treat as deterministic lexical evidence; add a witness when runtime proof is needed. |
| `execution-backed` | A matching pass witness artifact bound the invariant id, scenario id, source files, and test files to a successful command. | The whole change is merge-ready. Coverage, mutation, governance, or authorization can still block. | Inspect remaining evidence pressure before widening. |

Lexical support is useful because it is deterministic and reviewable. It is still not semantic proof. Execution-backed support is stronger because a command ran and produced a receipt-backed witness, but it is still one evidence layer inside the full verdict.

## Avoid repo-global proof theater

Do not widen evidence just to get a greener story.

Bad habits:

- selecting `path:src/**` for the first invariant;
- using keywords such as `auth`, `valid`, or `success` that can match unrelated files;
- treating `npm test` as a focused witness when a module-level command exists;
- screening `src/index.ts` when the behavior lives in `src/auth/token.ts`;
- claiming an execution witness proves merge readiness while mutation survivors or coverage gaps remain.

Better habits:

- screen the implementation file or a tiny behavior cluster;
- use assertion-bearing keywords that appear in one focused test case;
- keep the witness command tied to the same source and test files;
- keep `--changed` and `--run-id` explicit in every command;
- write down remaining debt instead of hiding it behind a global test pass.

## Authoring checklist

Before running `check`, confirm:

- [ ] the invariant id is stable and behavior-specific;
- [ ] selectors point at behavior-bearing source paths;
- [ ] each scenario states one observable behavior;
- [ ] `requiredTestPatterns` or witness test files are focused;
- [ ] lexical keywords are assertion-bearing and not generic project vocabulary;
- [ ] the witness command can run from the repo root;
- [ ] witness `--source-files` matches the changed source scope;
- [ ] generated witness JSON and receipt sidecars are ignored or retained according to repo policy;
- [ ] the final report distinguishes `lexically-supported` from `execution-backed` and names any residual pressure.
