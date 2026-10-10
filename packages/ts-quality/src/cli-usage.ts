import fs from 'fs';
import path from 'path';

/** The CLI's help text and packaged version. */

interface PackageManifest {
  version?: unknown;
}
function readPackageVersion(packageJsonPath: string): string | undefined {
  try {
    const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageManifest;
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}
export function cliVersion(): string {
  return readPackageVersion(path.resolve(__dirname, '../../../../packages/ts-quality/package.json'))
    ?? readPackageVersion(path.resolve(__dirname, '../../../../package.json'))
    ?? '0.0.0';
}
export function usage(command?: string, subcommand?: string): string {
  if (!command) {
    return `ts-quality commands:

First bounded review:
  ts-quality init
  # configure ts-quality.config.* for coverage, changed scope, invariants, governance, and agents
  ts-quality check --changed src/file.ts --run-id review-001
  ts-quality explain --run-id review-001
  ts-quality report --run-id review-001

First focused witness:
  # Pick a target-repo proof command before writing the witness: prefer a module-level test or a repo-local npm script over a broad npm test when the broad command cannot target the changed slice.
  ts-quality witness test --invariant auth.refresh.validity --scenario expired-boundary --source-files src/auth/token.ts --test-files test/auth/token.test.ts --out .ts-quality/witnesses/auth-refresh-expired-boundary.json -- npm run test:auth-refresh --silent
  # For dist-based TypeScript witnesses, run the target repo build first; for source-mode loaders/env flags, hide the long command behind an npm script.
  ts-quality check --changed src/auth/token.ts --run-id review-001

Core commands:
- --version                                print the packaged CLI version
- init [--preset <name>]                   create starter control-plane files
- doctor [--machine]                       inspect adoption readiness without running tests
- materialize [--out-dir <dir>]            write boring runtime JSON from config/support files
- adopt --from-run <run-dir>               copy reusable config/control-plane/witness files from a pilot run
- retention [--machine]                    project commit-vs-ephemeral artifact retention guidance
- check [--changed <a,b>] [--run-id <id>]  write the immutable evidence run bundle
- explain|report|plan|govern --run-id <id> project a persisted run without re-checking
- authorize --agent <id> [--action merge] --run-id <id>
- witness test|refresh                     create or refresh execution witnesses
- mutations preview [--json]               inert preview of the sites check would mutate
- attest sign|verify|keygen                bind or verify run artifacts
- trend                                    compare the nearest comparable prior run
- navigate --run-id <id> [--json]         read-only blocking queue, intervention lineage and Git facts
- index write|inspect                      package artifact-reference index and its read-only inspection
- amend --proposal <file> [--apply]        evaluate a governance amendment

Trust contract:
- check requires explicit changed scope from --changed, config changeSet.files, or a diff file.
- Prefer --run-id in automation; latest.json fallback is only for selected read/projection commands.
- Run coverage and your target repo quality gate before check when coverage/mutation evidence matters.
- Machine truth is under .ts-quality/runs/<run-id>/; stdout and Markdown are projections.

Use: ts-quality <command> --help
`;
  }
  if (command === 'init') {
    return `Usage: ts-quality init [--root <dir>] [--preset default|node-test|node-test-ts-dist|vitest|jest]

Creates starter control-plane files. Presets only change generated starter config guidance; existing files are preserved.
- node-test: Node's built-in test runner with LCOV generation.
- node-test-ts-dist: built-output TypeScript repos; includes source-map coverage guidance and dist/lib/build runtime mirrors.
- vitest: advisory npm run coverage / npm test starter shape.
- jest: Jest through the repository's package manager, with LCOV coverage and in-band mutation runs.
`;
  }
  if (command === 'doctor') {
    return `Usage: ts-quality doctor [--root <dir>] [--changed <a,b,c>] [--config <file>] [--machine]

Inspects package scripts, config, changed scope, LCOV presence, coverage.generateCommand, runtime mirror roots, and likely source-vs-dist coverage risk.
Read-only: doctor does not run tests or mutate package.json.
Use --machine for the compact harnessed-LLM / agent diagnostic line protocol; reserve --json on other commands for CI-style generic JSON projections.
`;
  }
  if (command === 'materialize') {
    return `Usage: ts-quality materialize [--root <dir>] [--config <file>] [--out-dir <dir>]

Exports author-authored config/support data into canonical runtime JSON.
Reads: ts-quality.config.* and configured support files.
Writes: .ts-quality/materialized/ts-quality.config.json and related support JSON.
Use this before check when CI or agents should consume generated data instead of source config.
`;
  }
  if (command === 'adopt') {
    return `Usage: ts-quality adopt --from-run <run-dir-or-run.json> [--root <dir>]

Copies reusable ts-quality config/control-plane/witness files from a pilot run into this repo without copying ephemeral run artifacts.
Reads: <source>/.ts-quality/runs/<run-id>/run.json plus referenced config/control-plane/witness files.
Writes missing target files only; existing target files are skipped rather than overwritten.
Copies trusted public keys (*.pub.pem) only; private key material is never adopted.
Omits: .ts-quality/runs/, .ts-quality/latest.json, .ts-quality/mutation-manifest.json, coverage output, private keys, and witness receipt sidecars.
`;
  }
  if (command === 'retention') {
    return `Usage: ts-quality retention [--root <dir>] [--config <file>] [--machine]

Projects a read-only artifact retention plan for adoption and review.
Commit/review: reusable config, control-plane files, witness JSON records, and trusted public keys (*.pub.pem).
Keep ephemeral or gitignored: .ts-quality/runs/, latest.json, mutation-manifest.json, coverage output, witness receipt sidecars, and private keys.
Use --machine for the compact TSQ_RETENTION_PLAN_V1 line protocol.
`;
  }
  if (command === 'check') {
    return `Usage: ts-quality check [--root <dir>] [--config <file>] [--changed <a,b,c>] [--run-id <id>] [--mutation-targets <spec;spec>]

Runs the evidence, mutation, invariant, governance, and verdict pipeline.
Required trust precondition: explicit changed scope from --changed, config changeSet.files, or a configured diff file.
Recommended precondition: run the target repo's tests/coverage first, or configure coverage.generateCommand so check can create missing LCOV before analysis.
Writes: .ts-quality/runs/<run-id>/{run.json,verdict.json,report.json,report.md,pr-summary.md,check-summary.txt,explain.txt,plan.txt,govern.txt} and .ts-quality/latest.json.
Automation: pass --run-id so explain/report/plan/govern/authorize stay bound to this exact run.
Mutation targets (--mutation-targets or config mutations.targets) narrow mutation to file:<path>, span:<path>:<a>-<b>, symbol:<path>#<kind:name>[@<a>-<b>] or site:<id>; separate several with ';'. check refuses unresolved targets.
`;
  }
  if (command === 'navigate') {
    return `Usage: ts-quality navigate [--root <dir>] [--run-id <id>] [--intervention-from <earlier-run-id> --intervention-tests <a,b>] [--git-horizon <commit>] [--json]

Derived, read-only navigation for one run: a versioned blocking summary and action queue ordered by class, severity, scope and identity, with inert argv experiments.
The protected nextEvidenceAction.primaryAction is reported unchanged; the navigation headline is separate.
--intervention-from/--intervention-tests: per-site lineage "observed survivor before; observed kill after declared test edit", reported only for the same site identity, a fresh green execution and an otherwise unchanged context; anything else stays unknown or is labeled with the context that changed.
--git-horizon: optional Git facts (churn, recency, authors, uncommitted, renames) since a pinned commit; facts, not evidence.
Writes nothing and runs no test command.
`;
  }
  if (command === 'mutations') {
    return `Usage: ts-quality mutations preview [--root <dir>] [--config <file>] [--changed <a,b,c>] [--mutation-targets <spec;spec>] [--json]

Inert preview of the mutation sites check would run for this changed scope, targets and budget.
Lists discovered, eligible, selected and excluded sites with reasons and resolves every target against current source.
Runs no command (not even coverage generation) and writes nothing.
Target specs: file:<path>, span:<path>:<a>-<b>, symbol:<path>#<kind:name>[@<a>-<b>], site:<id>; separate several with ';'.
`;
  }
  if (command === 'index') {
    return `Usage: ts-quality index write [--root <dir>] (--package <dir[,dir]> | --all) [--run-id <id[,id]>] [--out <file>] [--json]
       ts-quality index inspect [--root <dir>] [--index <file>] [--package <dir[,dir]>] [--json]

write: references the canonical run packet files (digests) of the named runs (default: the latest pointer) and the
packages they touch. Packages are the directories with a package.json, discovered as check discovers them (--all),
or named with --package. Default output: .ts-quality/package-index.json. Copies no verdict and claims no coverage:
a package without a changed file in the runs is listed as no-run-evidence.
inspect: re-reads every reference (fresh, changed or missing), checks source drift and package enumeration, and
reports findings per package. Refuses an unknown schema, paths outside the root and symbolic links. Writes nothing.
Upload the index with every path in its upload.paths list, keeping their layout; inspect the copy with --root.
`;
  }
  if (command === 'explain') {
    return `Usage: ts-quality explain [--root <dir>] [--run-id <id>]

Renders the explanation trail for a persisted run. Prefer --run-id; when omitted this command reads .ts-quality/latest.json.
Writes no artifacts; stdout is a projection of run.json and snapped decision context.
`;
  }
  if (command === 'report') {
    return `Usage: ts-quality report [--root <dir>] [--run-id <id>] [--json]

Renders a Markdown or JSON report for a persisted run. Prefer --run-id; when omitted this command reads .ts-quality/latest.json.
Use --json for machine consumers; report JSON includes additive decisionContext metadata.
`;
  }
  if (command === 'trend') {
    return `Usage: ts-quality trend [--root <dir>]

Compares the latest run with the nearest earlier comparable run.
Fails closed instead of comparing unrelated changed scopes or changed evidence baselines.
`;
  }
  if (command === 'plan') {
    return `Usage: ts-quality plan [--root <dir>] [--config <file>] [--run-id <id>]

Renders governance implementation guidance for a persisted run or current config context.
Prefer --run-id for review/release decisions so drift and snapped control-plane truth stay visible.
`;
  }
  if (command === 'govern') {
    return `Usage: ts-quality govern [--root <dir>] [--config <file>] [--run-id <id>]

Renders governance findings for a persisted run or current config context.
Prefer --run-id; findings are downstream of the exact run evidence, not a separate authority.
`;
  }
  if (command === 'authorize') {
    return `Usage: ts-quality authorize --agent <id> [--action merge] [--root <dir>] [--config <file>] [--run-id <id>]

Evaluates whether an agent/human has standing to perform an action against a selected run.
Prefer --run-id; authorization rechecks drift and writes run-bound authorization and bundle JSON.
Writes: .ts-quality/runs/<run-id>/authorize.<agent>.<action>.json and bundle.<agent>.<action>.json.
`;
  }
  if (command === 'attest' && subcommand === 'sign') {
    return `Usage: ts-quality attest sign --issuer <id> --key-id <id> --private-key <file> --subject <file> --out <file> [--claims <a,b>] [--root <dir>]

Signs a repo-local subject artifact. Subject paths must stay inside --root and run-scoped payload metadata must match the subject path when present.
Do not commit private keys.
`;
  }
  if (command === 'attest' && subcommand === 'verify') {
    return `Usage: ts-quality attest verify --attestation <file> [--trusted-keys <dir>] [--json] [--root <dir>]

Verifies a signed attestation against trusted public keys. Use --json for machine consumers.
`;
  }
  if (command === 'attest' && subcommand === 'keygen') {
    return `Usage: ts-quality attest keygen [--out-dir <dir>] [--key-id <id>] [--root <dir>]

Generates an Ed25519 keypair for local attestation workflows. Do not commit private keys.
`;
  }
  if (command === 'witness' && subcommand === 'test') {
    return `Usage: ts-quality witness test --invariant <id> --scenario <id> --source-files <a,b> [--test-files <a,b>] --out <file> [--timeout-ms <ms>] [--observed-at <iso>] [--root <dir>] -- <command...>

Runs one explicit proof command and writes an execution witness plus receipt sidecar.
Use this when a lexical invariant match should graduate to execution-backed support for one scenario.

Choosing the command after --:
1. Start from the changed source file and the focused test file you would trust in code review.
2. Prefer a module-level target-repo command, for example: -- npm run test:auth-refresh --silent or -- node --test test/auth/token.test.js.
3. Use a repo-global npm test only as baseline evidence when it cannot target the changed behavior or leaves long-lived handles.
4. For dist-based TypeScript witnesses, run the target repo build first. For source-mode loaders, env flags, or long inline assertions, put the exact proof command in package.json and invoke that script after --.

Keep commands narrow: one invariant, one scenario, one changed behavior, and one focused test command are stronger product evidence than a repo-global green test run.
`;
  }
  if (command === 'witness' && subcommand === 'refresh') {
    return `Usage: ts-quality witness refresh [--root <dir>] [--config <file>] [--changed <a,b,c>]

Runs configured execution witness commands impacted by the current changed scope.
Use this before check when your invariant scenarios already declare witness commands and you want witness artifact churn to be an explicit stage.
Pass --changed in automation unless config changeSet.files or a diff file supplies scope.
`;
  }
  if (command === 'amend') {
    return `Usage: ts-quality amend --proposal <file> [--apply] [--root <dir>] [--config <file>]

Evaluates a constitutional amendment proposal and writes amendment result JSON/text.
Omit --apply for review-only evaluation.
`;
  }
  return `Usage: ts-quality ${command} [--root <dir>]\n`;
}
