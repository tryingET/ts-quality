"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPackageManager = readPackageManager;
exports.packageManagerExec = packageManagerExec;
exports.renderDoctor = renderDoctor;
exports.machineValue = machineValue;
exports.renderDoctorMachine = renderDoctorMachine;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const config_1 = require("./config");
const analysis_1 = require("./analysis");
/** Read-only adoption diagnostics: package scripts, runners, coverage commands and setup recommendations. */
function readPackageScripts(rootDir) {
    const packagePath = path_1.default.join(rootDir, 'package.json');
    if (!fs_1.default.existsSync(packagePath)) {
        return {};
    }
    try {
        const parsed = JSON.parse(fs_1.default.readFileSync(packagePath, 'utf8'));
        return parsed.scripts ?? {};
    }
    catch {
        return {};
    }
}
function readPackageManager(rootDir) {
    const packagePath = path_1.default.join(rootDir, 'package.json');
    if (fs_1.default.existsSync(packagePath)) {
        try {
            const declared = JSON.parse(fs_1.default.readFileSync(packagePath, 'utf8')).packageManager;
            const name = typeof declared === 'string' ? declared.split('@')[0] : undefined;
            if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') {
                return name;
            }
        }
        catch {
            // Fall through to lockfile detection.
        }
    }
    if (fs_1.default.existsSync(path_1.default.join(rootDir, 'pnpm-lock.yaml')) || fs_1.default.existsSync(path_1.default.join(rootDir, 'pnpm-workspace.yaml'))) {
        return 'pnpm';
    }
    if (fs_1.default.existsSync(path_1.default.join(rootDir, 'yarn.lock'))) {
        return 'yarn';
    }
    if (fs_1.default.existsSync(path_1.default.join(rootDir, 'bun.lockb')) || fs_1.default.existsSync(path_1.default.join(rootDir, 'bun.lock'))) {
        return 'bun';
    }
    return 'npm';
}
const DESTRUCTIVE_SCRIPT_PATTERN = /\b(?:rimraf|del-cli|trash)\b|\brm\s+-[a-z]*r/u;
const COVERAGE_PRODUCING_COMMAND_PATTERN = /--coverage\b|--experimental-test-coverage\b|\bc8\b|\bnyc\b|\blcov\b|--test-reporter=lcov\b/u;
const MAX_WRAPPER_SCRIPT_BYTES = 64 * 1024;
/**
 * Text a package script really runs: the script plus the contents of repo-local shell wrappers it invokes
 * (`scripts/run-tests.sh`, `bash ./ci/test.sh`). Script names and wrapper paths say nothing about the runner or the
 * coverage format, so advice must come from what the commands do. Read-only and one level deep; wrappers that
 * resolve (including through symlinks) outside the repository, non-files, and oversized files are never read.
 */
function resolvedScriptText(rootDir, command) {
    let realRoot;
    try {
        realRoot = fs_1.default.realpathSync(rootDir);
    }
    catch {
        return command;
    }
    const wrapperTexts = [];
    for (const token of command.split(/\s+/u)) {
        if (!/\.(?:sh|bash)$/u.test(token)) {
            continue;
        }
        try {
            const realWrapper = fs_1.default.realpathSync(path_1.default.resolve(rootDir, token));
            const relative = path_1.default.relative(realRoot, realWrapper);
            if (relative.startsWith('..') || path_1.default.isAbsolute(relative)) {
                continue;
            }
            const stat = fs_1.default.statSync(realWrapper);
            if (stat.isFile() && stat.size <= MAX_WRAPPER_SCRIPT_BYTES) {
                wrapperTexts.push(fs_1.default.readFileSync(realWrapper, 'utf8'));
            }
        }
        catch {
            continue;
        }
    }
    return [command, ...wrapperTexts].join('\n');
}
/**
 * Positive evidence that a coverage command writes no LCOV. Jest's default coverage reporters include LCOV; Bun,
 * Vitest, node:test, c8, and nyc need an explicit LCOV reporter. Unknown commands (for example `make coverage`) are
 * not evidence either way.
 */
function coverageWritesNoLcov(text) {
    const mentionsLcov = /lcov/u.test(text);
    if (/\bbun\s+test\b[^\n]*--coverage\b/u.test(text)) {
        return !/--coverage-reporter[= ]\S*lcov/u.test(text);
    }
    if (/\bjest\b[^\n]*--coverage\b/u.test(text)) {
        return /--coverageReporters[= ]/u.test(text) && !mentionsLcov;
    }
    if (/\bvitest\b[^\n]*--coverage\b/u.test(text) || /--experimental-test-coverage\b/u.test(text) || /\b(?:c8|nyc)\b/u.test(text)) {
        return !mentionsLcov;
    }
    return false;
}
/**
 * Scripts that plausibly produce coverage: named for coverage/LCOV or running a coverage tool, never destructive
 * cleanup, and never a script whose resolved command demonstrably writes no LCOV (reported separately).
 */
function coverageScriptNames(scripts, rootDir) {
    const withoutLcov = [];
    const candidates = Object.keys(scripts)
        .map((name) => {
        const command = scripts[name] ?? '';
        if (DESTRUCTIVE_SCRIPT_PATTERN.test(command) || /(?:^|:)clean(?:$|:)/u.test(name)) {
            return null;
        }
        const nameMatches = /coverage|lcov/u.test(name);
        const resolved = resolvedScriptText(rootDir, command);
        if (!nameMatches && !COVERAGE_PRODUCING_COMMAND_PATTERN.test(resolved)) {
            return null;
        }
        if (coverageWritesNoLcov(resolved)) {
            withoutLcov.push(name);
            return null;
        }
        return { name, rank: nameMatches ? 0 : 1 };
    })
        .filter((item) => item !== null)
        .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name))
        .map((item) => item.name);
    return { candidates, withoutLcov: withoutLcov.sort() };
}
/** Scripts that plausibly run tests: never npm pre/post lifecycle hooks or destructive/clean scripts; exact `test` first. */
function testScriptNames(scripts) {
    return likelyScriptNames(scripts, ['test'])
        .filter((name) => !/^(?:pre|post)/u.test(name) && !/(?:^|:)clean(?:$|:)/u.test(name) && !DESTRUCTIVE_SCRIPT_PATTERN.test(scripts[name] ?? ''))
        .sort((left, right) => Number(right === 'test') - Number(left === 'test'));
}
const SOURCE_CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/u;
function testRunnerOfCommand(command) {
    if (/\bjest\b/u.test(command)) {
        return 'jest';
    }
    if (/\bvitest\b/u.test(command)) {
        return 'vitest';
    }
    if (/\bmocha\b/u.test(command)) {
        return 'mocha';
    }
    if (/\bbun\s+test\b/u.test(command)) {
        return 'bun';
    }
    return /\bnode\b[^&|;]*\s--test\b/u.test(command) ? 'node:test' : undefined;
}
/** Runner behind a command, resolving `npm test` / `<pm> run <script>` through package scripts and repo-local wrappers. */
function testRunnerOf(command, scripts, rootDir) {
    const [executable, first, second] = command;
    // `bun test ...` is the Bun runner itself, not a package script named test.
    const isBunRunner = executable === 'bun' && first === 'test';
    if (executable && ['npm', 'pnpm', 'yarn', 'bun'].includes(executable) && !isBunRunner) {
        const scriptName = first === 'run' ? second : first;
        const script = scriptName ? scripts[scriptName] : undefined;
        if (script !== undefined) {
            return testRunnerOfCommand(resolvedScriptText(rootDir, script));
        }
    }
    return testRunnerOfCommand(resolvedScriptText(rootDir, command.join(' ')));
}
/** Command that runs a package binary through the repository's package manager. */
function packageManagerExec(packageManager, binary) {
    switch (packageManager) {
        case 'pnpm':
            return ['pnpm', 'exec', binary];
        case 'yarn':
            return ['yarn', 'run', binary];
        case 'bun':
            return ['bunx', binary];
        default:
            return ['npx', binary];
    }
}
function likelyScriptNames(scripts, tokens) {
    return Object.keys(scripts)
        .map((name) => {
        const command = scripts[name] ?? '';
        const nameMatches = tokens.some((token) => name.includes(token));
        const commandMatches = tokens.some((token) => command.includes(token));
        if (!nameMatches && !commandMatches) {
            return null;
        }
        return { name, rank: nameMatches ? 0 : 1 };
    })
        .filter((item) => item !== null)
        .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name))
        .map((item) => item.name);
}
function focusedTestRecommendation(scriptName, scriptCommand, packageManager = 'npm') {
    const command = scriptCommand ?? '';
    if (/\bjest\b/u.test(command)) {
        // npm needs `--` to forward flags to the script; pnpm, yarn, and bun forward trailing flags directly.
        const forwarded = packageManager === 'npm' ? ['--', '--runInBand'] : ['--runInBand'];
        return {
            summary: `Candidate focused test command: ${[packageManager, 'run', scriptName, ...forwarded].join(' ')} (adjust to the smallest trustworthy slice).`,
            command: [packageManager, 'run', scriptName, ...forwarded]
        };
    }
    return {
        summary: `Candidate focused test command: ${packageManager} run ${scriptName} (adjust to the smallest trustworthy slice).`,
        command: [packageManager, 'run', scriptName]
    };
}
function runnerCoverageRecommendation(runner, packageManager, scriptName, scriptInvokesRunnerDirectly) {
    const forward = packageManager === 'npm' ? ['--'] : [];
    // Flags can be forwarded only when the script itself invokes the runner; a wrapper may not pass them through.
    const viaScript = (flags) => (scriptName && scriptInvokesRunnerDirectly ? [packageManager, 'run', scriptName, ...forward, ...flags] : undefined);
    if (runner === 'jest') {
        const flags = ['--coverage', '--coverageReporters=lcov', '--coverageDirectory=coverage'];
        const command = viaScript(flags) ?? [...packageManagerExec(packageManager, 'jest'), ...flags];
        return { id: 'coverage-generate-command', kind: 'coverage', summary: `Configure coverage.generateCommand to run Jest with LCOV output, narrowed to the changed slice's tests: ${command.join(' ')}.`, command };
    }
    if (runner === 'vitest') {
        const flags = ['--coverage.enabled', '--coverage.reporter=lcov', '--coverage.reportsDirectory=coverage'];
        const command = viaScript(flags) ?? [...packageManagerExec(packageManager, 'vitest'), 'run', ...flags];
        return { id: 'coverage-generate-command', kind: 'coverage', summary: `Configure coverage.generateCommand to run Vitest with LCOV output (requires a coverage provider such as @vitest/coverage-v8), narrowed to the changed slice's tests: ${command.join(' ')}.`, command };
    }
    if (runner === 'bun') {
        const command = ['bun', 'test', '--coverage', '--coverage-reporter=lcov', '--coverage-dir=coverage'];
        return { id: 'coverage-generate-command', kind: 'coverage', summary: `Configure coverage.generateCommand to run Bun with LCOV output, narrowed to the changed slice's tests: ${command.join(' ')}.`, command };
    }
    return { id: 'coverage-generate-command', kind: 'coverage', summary: 'Configure coverage.generateCommand to create coverage/lcov.info.', command: ['node', '--test', '--experimental-test-coverage', '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info'] };
}
function buildDoctorDiagnostic(rootDir, options) {
    const scripts = readPackageScripts(rootDir);
    let loaded;
    let configError;
    try {
        loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    }
    catch (error) {
        configError = error instanceof Error ? error.message : String(error);
    }
    const config = loaded?.config;
    const sourcePatterns = config?.sourcePatterns ?? [...index_1.DEFAULT_SOURCE_PATTERNS];
    const testPatterns = config?.testPatterns ?? [...index_1.DEFAULT_TEST_PATTERNS];
    const sources = (0, analysis_1.sourceFilesExcludingTests)(rootDir, sourcePatterns, testPatterns);
    const tests = (0, index_1.listFiles)(rootDir).filter((filePath) => testPatterns.some((pattern) => (0, index_1.matchesDiscoveryPattern)(pattern, filePath)));
    const changed = (0, analysis_1.uniquePaths)([...(options?.changedFiles ?? []), ...(config?.changeSet.files ?? [])]);
    const lcovPath = config?.coverage.lcovPath ?? 'coverage/lcov.info';
    const lcovExists = fs_1.default.existsSync(path_1.default.join(rootDir, lcovPath));
    const generateCommand = config?.coverage.generateCommand ?? [];
    const runtimeMirrorRoots = config?.mutations.runtimeMirrorRoots ?? ['dist'];
    const sourceDistRisk = changed.some(analysis_1.isSourceTsFile) && (0, analysis_1.builtOutputRoots)(runtimeMirrorRoots).some((root) => fs_1.default.existsSync(path_1.default.join(rootDir, root)));
    const packageManager = readPackageManager(rootDir);
    const { candidates: coverageScripts, withoutLcov: coverageScriptsWithoutLcov } = coverageScriptNames(scripts, rootDir);
    const testScripts = testScriptNames(scripts);
    const testScriptCommand = testScripts[0] ? scripts[testScripts[0]] ?? '' : '';
    const repoTestRunner = testScripts[0] ? testRunnerOfCommand(resolvedScriptText(rootDir, testScriptCommand)) : undefined;
    const testScriptInvokesRunnerDirectly = repoTestRunner !== undefined && testRunnerOfCommand(testScriptCommand) === repoTestRunner;
    const mutationTestRunner = config?.mutations.testCommand ? testRunnerOf(config.mutations.testCommand, scripts, rootDir) : undefined;
    // Only source code can be attributed coverage/mutation evidence; tests, docs, and manifests are expected outside sourcePatterns.
    const changedOutsideSources = changed.filter((filePath) => SOURCE_CODE_FILE_PATTERN.test(filePath)
        && !filePath.endsWith('.d.ts')
        && !testPatterns.some((pattern) => (0, index_1.matchPattern)(pattern, filePath))
        && !sourcePatterns.some((pattern) => (0, index_1.matchPattern)(pattern, filePath)));
    const recommendations = [];
    const risks = [];
    if (changed.length === 0) {
        recommendations.push({ id: 'changed-scope', kind: 'changed-scope', summary: 'Add changed scope with --changed <a,b,c>, changeSet.files, or changeSet.diffFile before check.' });
        risks.push({ code: 'changed-scope-missing', level: 'error', message: 'Changed scope is missing.', hint: 'Provide --changed <a,b,c> or configure changeSet.files / changeSet.diffFile.', evidence: [] });
    }
    if (!lcovExists && generateCommand.length === 0) {
        recommendations.push(coverageScripts.length > 0
            ? { id: 'coverage-generate-command', kind: 'coverage', summary: `Configure coverage.generateCommand to run an existing script such as ${packageManager} run ${coverageScripts[0]}.`, command: [packageManager, 'run', coverageScripts[0] ?? 'coverage'] }
            : runnerCoverageRecommendation(repoTestRunner, packageManager, testScripts[0], testScriptInvokesRunnerDirectly));
        risks.push({ code: 'coverage-missing-without-generator', level: 'warn', message: 'LCOV is missing and coverage.generateCommand is not configured.', hint: 'Configure a deterministic coverage command or create the LCOV before check.', evidence: [`lcovPath=${lcovPath}`] });
    }
    for (const scriptName of coverageScriptsWithoutLcov) {
        risks.push({
            code: 'coverage-script-without-lcov',
            level: 'warn',
            message: `Script ${scriptName} runs coverage but writes no LCOV.`,
            hint: 'check reads LCOV only; add an LCOV reporter to that script or use the recommended coverage command.',
            evidence: [`script=${scriptName}`]
        });
    }
    if (changedOutsideSources.length > 0) {
        risks.push({
            code: 'changed-outside-source-patterns',
            level: 'warn',
            message: `Changed files are outside sourcePatterns: ${changedOutsideSources.join(', ')}.`,
            hint: 'check cannot attribute coverage, complexity, or mutation evidence to them; extend sourcePatterns (for workspaces, for example packages/*/src/**/*.ts) or point it at the changed files.',
            evidence: changedOutsideSources.map((filePath) => `changed=${filePath}`)
        });
    }
    if (repoTestRunner && mutationTestRunner && repoTestRunner !== mutationTestRunner) {
        risks.push({
            code: 'mutation-test-runner-mismatch',
            level: 'warn',
            message: `mutations.testCommand runs ${mutationTestRunner} but the repository test script runs ${repoTestRunner}.`,
            hint: `Point mutations.testCommand at a focused ${repoTestRunner} command; otherwise the mutation baseline fails or mutants run against no tests.`,
            evidence: [`testCommand=${(config?.mutations.testCommand ?? []).join(' ')}`, `testScript=${testScripts[0] ?? ''}`]
        });
    }
    if (sourceDistRisk) {
        recommendations.push({ id: 'source-map-coverage', kind: 'source-map', summary: 'Enable source-map coverage mapping, for example NODE_OPTIONS=--enable-source-maps, or configure coverage to map back to src/**.' });
        risks.push({ code: 'source-dist-coverage-risk', level: 'warn', message: 'Changed TypeScript source and built runtime roots are present.', hint: 'Ensure LCOV maps back to changed src/**/*.ts files rather than only built output.', evidence: [`changed=${changed.join(', ')}`, `runtimeMirrorRoots=${runtimeMirrorRoots.join(', ')}`] });
    }
    if (testScripts.length > 0) {
        const scriptName = testScripts[0] ?? 'test';
        recommendations.push({ id: 'focused-test-command', kind: 'focused-test', ...focusedTestRecommendation(scriptName, scripts[scriptName], packageManager) });
    }
    else if (tests.length > 0) {
        recommendations.push({ id: 'focused-test-command', kind: 'focused-test', summary: `Candidate focused test command: node --test ${tests[0]}.`, command: ['node', '--test', tests[0] ?? 'test'] });
    }
    recommendations.push({
        id: 'witness-command-shape',
        kind: 'witness',
        summary: 'Candidate witness command shape: ts-quality witness test --invariant <id> --scenario <id> --source-files <src> --test-files <test> --out .ts-quality/witnesses/<id>.json -- <focused command>',
        command: ['ts-quality', 'witness', 'test', '--invariant', '<id>', '--scenario', '<id>', '--source-files', '<src>', '--test-files', '<test>', '--out', '.ts-quality/witnesses/<id>.json', '--', '<focused command>']
    });
    recommendations.push({
        id: 'artifact-retention-policy',
        kind: 'artifact-retention',
        summary: 'Commit reusable ts-quality config/control-plane/witness files; keep generated run artifacts, latest.json, mutation-manifest.json, package-index.json, and coverage outputs ephemeral or gitignored unless your repo deliberately snapshots reviewed samples.'
    });
    recommendations.push({ id: 'script-snippets', kind: 'script-snippet', summary: 'Suggested package.json snippets are advisory only: coverage:<slice>, witness:<slice>, quality:<slice>.' });
    return {
        surface: 'ts-quality.doctor',
        schemaVersion: 1,
        rootDir,
        config: loaded ? { loaded: true, path: (0, index_1.normalizePath)(path_1.default.relative(rootDir, loaded.configPath)) } : { loaded: false, ...(configError ? { error: configError } : {}) },
        changedScope: { present: changed.length > 0, files: changed, source: 'cli-or-config' },
        files: { sourceCount: sources.length, testCount: tests.length },
        packageScripts: { names: Object.keys(scripts).sort(), coverageCandidates: coverageScripts, testCandidates: testScripts },
        coverage: { lcovPath, lcovExists, generateCommandConfigured: generateCommand.length > 0, generateCommand },
        mutations: { testCommand: config?.mutations.testCommand ?? [], runtimeMirrorRoots },
        risks,
        recommendations
    };
}
function renderDoctor(rootDir, options) {
    const diagnostic = buildDoctorDiagnostic(rootDir, options);
    const lines = [
        'ts-quality doctor',
        `root: ${diagnostic.rootDir}`,
        `config: ${diagnostic.config.loaded ? diagnostic.config.path : `not loaded (${diagnostic.config.error ?? 'missing'})`}`,
        `changed scope: ${diagnostic.changedScope.present ? diagnostic.changedScope.files.join(', ') : 'missing'}`,
        `source files: ${diagnostic.files.sourceCount}`,
        `test files: ${diagnostic.files.testCount}`,
        `package scripts: ${diagnostic.packageScripts.names.length > 0 ? diagnostic.packageScripts.names.join(', ') : 'none'}`,
        `coverage lcovPath: ${diagnostic.coverage.lcovPath} (${diagnostic.coverage.lcovExists ? 'exists' : 'missing'})`,
        `coverage.generateCommand: ${diagnostic.coverage.generateCommandConfigured ? diagnostic.coverage.generateCommand.join(' ') : 'not configured'}`,
        `mutation testCommand: ${diagnostic.mutations.testCommand.length > 0 ? diagnostic.mutations.testCommand.join(' ') : 'not configured'}`,
        `runtimeMirrorRoots: ${diagnostic.mutations.runtimeMirrorRoots.join(', ')}`,
        ...(diagnostic.risks.length > 0 ? ['', 'Risks:', ...diagnostic.risks.map((risk) => `- ${risk.message} ${risk.hint}`)] : []),
        '',
        'Recommendations:',
        ...diagnostic.recommendations.map((item) => `- ${item.summary}`)
    ];
    return `${lines.join('\n')}\n`;
}
function machineValue(value) {
    return value.replace(/[\t\r\n]/gu, ' ').trim();
}
function machineList(values) {
    return values.map(machineValue).join(',');
}
function renderDoctorMachine(rootDir, options) {
    const diagnostic = buildDoctorDiagnostic(rootDir, options);
    const lines = [
        'TSQ_DOCTOR_MACHINE_V1',
        `root\t${machineValue(diagnostic.rootDir)}`,
        diagnostic.config.loaded
            ? `config\tok\tpath=${machineValue(diagnostic.config.path ?? '')}`
            : `config\terror\tmessage=${machineValue(diagnostic.config.error ?? 'missing')}`,
        `changed\t${diagnostic.changedScope.present ? 'ok' : 'missing'}\tfiles=${machineList(diagnostic.changedScope.files)}`,
        `files\tsources=${diagnostic.files.sourceCount}\ttests=${diagnostic.files.testCount}`,
        `scripts\tnames=${machineList(diagnostic.packageScripts.names)}\tcoverage=${machineList(diagnostic.packageScripts.coverageCandidates)}\ttests=${machineList(diagnostic.packageScripts.testCandidates)}`,
        `coverage\t${diagnostic.coverage.lcovExists ? 'ok' : 'missing'}\tlcovPath=${machineValue(diagnostic.coverage.lcovPath)}\tgenerateCommand=${diagnostic.coverage.generateCommandConfigured ? machineList(diagnostic.coverage.generateCommand) : 'none'}`,
        `mutation\ttestCommand=${machineList(diagnostic.mutations.testCommand)}\truntimeMirrorRoots=${machineList(diagnostic.mutations.runtimeMirrorRoots)}`,
        ...diagnostic.risks.map((risk) => `risk\t${risk.level}\t${risk.code}\t${machineValue(risk.message)}\thint=${machineValue(risk.hint)}`),
        ...diagnostic.recommendations.map((recommendation) => [
            `recommend\t${recommendation.kind}\t${recommendation.id}\t${machineValue(recommendation.summary)}`,
            ...(recommendation.command ? recommendation.command.map((arg) => `command_arg=${machineValue(arg)}`) : [])
        ].join('\t'))
    ];
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=doctor.js.map