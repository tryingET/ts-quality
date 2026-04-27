---
summary: "Tiny target-repo walkthrough for one ts-quality slice with one invariant, one witness, and one run."
read_when:
  - "You want the smallest external adoption example before wiring a real repo."
  - "You need to see the one-slice adoption loop as concrete files and commands."
type: "tutorial"
---

# Minimal external adoption walkthrough

This walkthrough shows the smallest useful shape for adopting `ts-quality` in a target repository. It is intentionally one-slice: one implementation file, one invariant, one focused witness command, and one run id.

Use this after reading:

- `docs/adoption/agent-integration-how-to.md` for brownfield targets, or
- `docs/adoption/greenfield-bootstrap-how-to.md` for new targets.

Canonical product semantics still live in `README.md`, `docs/config-reference.md`, `docs/invariant-dsl.md`, and `docs/ci-integration.md`.

## Starting point

Assume the target repo has this behavior-bearing file and focused test:

```text
src/auth/token.js
test/token.test.js
coverage/lcov.info
```

The first slice is `src/auth/token.js`. Do not screen a facade barrel such as `src/index.js` when the behavior lives in `src/auth/token.js`.

## 1) Add repo-local control-plane files

Create `ts-quality.config.json`:

```json
{
  "sourcePatterns": ["src/**/*.js"],
  "testPatterns": ["test/**/*.js"],
  "coverage": { "lcovPath": "coverage/lcov.info" },
  "mutations": {
    "testCommand": ["node", "--test", "test/token.test.js"],
    "coveredOnly": true,
    "timeoutMs": 10000,
    "maxSites": 8
  },
  "policy": {
    "maxChangedCrap": 15,
    "minMutationScore": 0.75,
    "minMergeConfidence": 65
  },
  "changeSet": { "files": ["src/auth/token.js"] },
  "invariantsPath": ".ts-quality/invariants.ts",
  "constitutionPath": ".ts-quality/constitution.ts",
  "agentsPath": ".ts-quality/agents.ts",
  "approvalsPath": ".ts-quality/approvals.json",
  "waiversPath": ".ts-quality/waivers.json",
  "overridesPath": ".ts-quality/overrides.json",
  "attestationsDir": ".ts-quality/attestations",
  "trustedKeysDir": ".ts-quality/keys"
}
```

Create `.ts-quality/invariants.ts`:

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
    executionWitnessCommand: ['node', '--test', 'test/token.test.js'],
    executionWitnessOutput: '.ts-quality/witnesses/auth-refresh-expired-boundary.json',
    executionWitnessTestFiles: ['test/token.test.js'],
    expected: 'deny'
  }]
}];
```

Create `.ts-quality/constitution.ts`:

```ts
export default [];
```

Create `.ts-quality/agents.ts`:

```ts
export default [{
  id: 'release-bot',
  kind: 'automation',
  roles: ['ci'],
  grants: [{
    id: 'release-bot-merge',
    actions: ['merge'],
    paths: ['src/auth/**'],
    minMergeConfidence: 65
  }]
}];
```

Create empty JSON arrays for optional support files:

```bash
mkdir -p .ts-quality/witnesses
printf '[]\n' > .ts-quality/approvals.json
printf '[]\n' > .ts-quality/waivers.json
printf '[]\n' > .ts-quality/overrides.json
printf '# Witness artifacts\n\nGenerated witness JSON and receipt sidecars are ignored.\n' > .ts-quality/witnesses/README.md
```

## 2) Ignore runtime artifacts

Add generated runtime outputs to `.gitignore`:

```gitignore
coverage/
.ts-quality/runs/
.ts-quality/materialized/
.ts-quality/attestations/
.ts-quality/keys/
.ts-quality/witnesses/*.json
.ts-quality/witnesses/*.receipt.json
```

Keep the control-plane files and `.ts-quality/witnesses/README.md` committed.

## 3) Add thin wrapper scripts

In the target repo's `package.json`, add scripts that make the run boundary boring:

```json
{
  "scripts": {
    "quality": "node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info",
    "screening:witness-refresh": "ts-quality witness refresh --config ts-quality.config.json",
    "screening:check": "ts-quality check --config ts-quality.config.json"
  }
}
```

Use whatever normal quality command the target repo already has; the important part is that coverage exists before `ts-quality check`.

## 4) Run one truthful slice

```bash
npm run quality
npm run screening:witness-refresh -- --changed src/auth/token.js
npm run screening:check -- --changed src/auth/token.js --run-id auth-token-first-slice
npx ts-quality report --run-id auth-token-first-slice
npx ts-quality explain --run-id auth-token-first-slice
```

If the result fails on mutation pressure, coverage, invariant evidence, or governance, keep that truth. Fix the target repo evidence or route the debt before widening to another file.

## 5) Record local rollout truth

Create `docs/dev/ts-quality-current-vs-target.md` in the target repo:

```md
# ts-quality current vs target

## Live now

- Slice: `src/auth/token.js`
- Run id: `auth-token-first-slice`
- Evidence status: <pass/warn/fail/unsupported/lexically-supported/execution-backed>
- Witness: `.ts-quality/witnesses/auth-refresh-expired-boundary.json`

## Next

- <next smallest behavior-bearing slice, or why no next slice is ready>

## Later

- <candidate wider slices>

## Target shape

- Keep screening on authored source.
- Keep witnesses focused.
- Keep runtime artifacts ignored.
```

Only after this repo-local truth is stable should you update the central catalog with `docs/adoption/repo-screening-entry.template.json` and `node scripts/register-screening-catalog.mjs --entry ...` from this repo.

## Closure check

A minimal adoption slice is done when:

- the screened path is behavior-bearing, not a facade barrel,
- changed scope and run id are explicit,
- coverage exists before `check`,
- witness refresh works when execution witnesses are configured,
- generated runtime artifacts are ignored,
- the result is classified truthfully, and
- any blocking evidence debt is resolved or routed before widening.
