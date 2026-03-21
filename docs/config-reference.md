---
summary: "Configuration reference for ts-quality.config.* inputs and defaults."
read_when:
  - "When editing ts-quality configuration"
  - "When checking supported config keys and defaults"
type: "reference"
---

# Config reference

`ts-quality.config.*` may be `.ts`, `.js`, `.mjs`, `.cjs`, or `.json`.
For code-like file types (`.ts`, `.js`, `.mjs`, `.cjs`), the module must stay **data-only**: export a literal object/array shape built from literals, arrays, objects, spreads, computed property names backed by top-level `const` bindings, and top-level `const` bindings that resolve to data. Executable expressions such as function calls, property access into runtime objects, or imperative module bodies are rejected.

> `ts-quality` is still in alpha. Config semantics may change before 1.0 when needed to improve deterministic evidence, safety, trust-boundary correctness, or contract clarity. When that happens, the break should be called out in `CHANGELOG.md` and reflected here.

```ts
export default {
  sourcePatterns: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'],
  testPatterns: [
    'test/**/*.js', 'test/**/*.mjs', 'test/**/*.cjs', 'test/**/*.ts', 'test/**/*.tsx',
    'tests/**/*.js', 'tests/**/*.mjs', 'tests/**/*.cjs', 'tests/**/*.ts', 'tests/**/*.tsx',
    '**/*.test.js', '**/*.test.mjs', '**/*.test.cjs', '**/*.test.ts', '**/*.test.tsx',
    '**/*.spec.js', '**/*.spec.mjs', '**/*.spec.cjs', '**/*.spec.ts', '**/*.spec.tsx'
  ],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: {
    testCommand: ['node', '--test'],
    coveredOnly: true,
    timeoutMs: 15000,
    maxSites: 25,
    runtimeMirrorRoots: ['dist']
  },
  policy: {
    maxChangedCrap: 30,
    minMutationScore: 0.8,
    minMergeConfidence: 70
  },
  changeSet: {
    files: ['src/auth/token.js'],
    diffFile: 'changes.diff'
  },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json',
  attestationsDir: '.ts-quality/attestations',
  trustedKeysDir: '.ts-quality/keys'
};
```

## Materialized runtime config

`ts-quality materialize` exports the currently loaded config/support data into canonical JSON runtime artifacts under `.ts-quality/materialized/` by default.
The generated `ts-quality.config.json` rewrites support-file paths (for example invariants, constitution, agents, approvals, waivers, overrides) to point at the exported JSON so later commands can run from materialized runtime inputs.
If a diff file is configured, it is copied into a reserved `.ts-quality/materialized/inputs/` subtree so user-supplied filenames cannot overwrite canonical materialized artifacts:

```bash
npx ts-quality materialize
npx ts-quality check --config .ts-quality/materialized/ts-quality.config.json
```

## Notes

- `changeSet.files` scopes merge confidence to changed code. When it is absent or an empty array, `check` falls back to all discovered source files instead of analyzing an empty scope.
- `changeSet.diffFile` adds diff-hunk precision and now narrows scope within a changed file instead of widening back to whole-file analysis.
- `mutations.testCommand` must pass on the unmutated baseline before mutation pressure is trusted, and it must contain at least one executable argument.
- For `.ts` / `.js` / `.mjs` / `.cjs` config and repo-local support files, only data-only module syntax is supported. If you need dynamic values, compute them outside the config file and write the resolved data into the config explicitly.
- Mutation cache reuse is keyed by a deterministic execution fingerprint that includes the effective execution environment after inherited nested test-runner recursion context is stripped, so test-corpus drift or runner-context leakage invalidates stale manifest entries.
- `mutations.coveredOnly` focuses on covered lines. When a file or line has no LCOV evidence, it is treated as uncovered rather than mutated optimistically.
- `mutations.runtimeMirrorRoots` tells mutant runs which built-runtime roots should mirror mutated sources into executable runtime trees (default: `['dist']`). JS sources are copied directly; TS/TSX sources are transpiled before being written into matching runtime mirror files. Use this when tests execute built output from `dist/`, `lib/`, `build/`, or another runtime tree. Root-level source files are also mirrored into matching built roots such as `dist/index.js`.
- `policy` defines default merge gates before constitutional rules add domain-specific constraints. Values are range-checked when config is loaded: `maxChangedCrap >= 0`, `0 <= minMutationScore <= 1`, and `0 <= minMergeConfidence <= 100`.
- Path-bearing analysis inputs (`coverage.lcovPath`, `changeSet.files`, `changeSet.diffFile`, `mutations.runtimeMirrorRoots`) and config/support artifact paths (`invariantsPath`, `constitutionPath`, `agentsPath`, `approvalsPath`, `waiversPath`, `overridesPath`, `attestationsDir`, `trustedKeysDir`) are canonicalized to repo-local paths. Paths that escape `--root`, including symlink escapes, are rejected.
- The default `testPatterns` intentionally include both `test/**` and `tests/**` trees plus colocated `*.test.*` / `*.spec.*` files for JS and TS variants.
- CLI commands that load config (`check`, `plan`, `govern`, `authorize`, `amend`) accept `--config <file>` when you need a nonstandard config filename.
- Downstream decision commands (`plan`, `govern`, `authorize`) project from the latest evaluated run plus exact run-bound approvals/attestations. `check` snapshots the decision control plane (schema version, config digest, policy defaults, constitution rules, agent grants, and support-path bindings), so later decision surfaces keep using that run-bound snapshot, reject unsupported or malformed snapshot schemas with a re-run instruction, and refuse the request if the analyzed changed files or snapped config / constitution / agents drift after `check`.
