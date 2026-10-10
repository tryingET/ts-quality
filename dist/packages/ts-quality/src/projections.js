"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderLatestReport = renderLatestReport;
exports.renderLatestExplain = renderLatestExplain;
exports.renderNavigation = renderNavigation;
exports.writePackageIndexFile = writePackageIndexFile;
exports.inspectPackageIndexFile = inspectPackageIndexFile;
exports.renderPackageIndexInspectionFile = renderPackageIndexInspectionFile;
exports.renderGovernance = renderGovernance;
exports.renderPlan = renderPlan;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const navigation_1 = require("./navigation");
const package_index_1 = require("./package-index");
const index_2 = require("../../policy-engine/src/index");
const index_3 = require("../../governance/src/index");
const check_1 = require("./check");
const render_text_1 = require("./render-text");
const run_context_1 = require("./run-context");
/** Read-only projections of persisted runs: report, explain, navigation, plan, governance and the package index wrappers. */
function renderLatestReport(rootDir, format, options) {
    const context = (0, run_context_1.projectedRunForDecision)(rootDir, (0, run_context_1.selectedRun)(rootDir, options), options);
    if (format === 'json') {
        return `${(0, index_1.stableStringify)((0, run_context_1.buildReportJsonArtifact)(context.projectedRun, { projection: 'projected', drift: context.drift }))}\n`;
    }
    const body = (0, index_2.renderMarkdownReport)(context.projectedRun);
    const rendered = context.drift.length === 0
        ? body
        : (0, run_context_1.injectMarkdownNotice)(body, (0, run_context_1.renderRunDriftMarkdownNotice)(context.run, context.drift));
    return `${rendered}\n`;
}
function renderLatestExplain(rootDir, options) {
    const context = (0, run_context_1.projectedRunForDecision)(rootDir, (0, run_context_1.selectedRun)(rootDir, options), options);
    const body = (0, index_2.renderExplainText)(context.projectedRun);
    if (context.drift.length === 0) {
        return `${body}\n`;
    }
    return `${(0, run_context_1.renderRunDriftNotice)(context.run, context.drift)}\n${body}\n`;
}
function authorizationFacts(rootDir, runId) {
    const runDir = path_1.default.join(rootDir, '.ts-quality', 'runs', (0, index_1.assertSafeRunId)(runId));
    if (!fs_1.default.existsSync(runDir)) {
        return [];
    }
    return fs_1.default.readdirSync(runDir)
        .filter((name) => name.startsWith('authorize.') && name.endsWith('.json') && name.length > 'authorize..json'.length)
        .sort((left, right) => left.localeCompare(right))
        .flatMap((name) => {
        const record = (0, index_1.readJson)(path_1.default.join(runDir, name));
        return typeof record.outcome === 'string'
            ? [{ identity: name.replace(/\.json$/, ''), outcome: record.outcome, reasons: Array.isArray(record.reasons) ? record.reasons.filter((item) => typeof item === 'string') : [] }]
            : [];
    });
}
/**
 * Derived navigation for one run: a versioned blocking summary and action queue, optional intervention lineage
 * against an earlier run and optional Git facts pinned to a horizon. Read-only: it writes nothing and runs no test.
 */
function renderNavigation(rootDir, options) {
    const run = (0, run_context_1.assertSupportedRun)((0, run_context_1.selectedRun)(rootDir, options.runId ? { runId: options.runId } : undefined));
    (0, run_context_1.assertContainedRunFiles)(rootDir, run.runId);
    const context = (0, run_context_1.projectedRunForDecision)(rootDir, run);
    let lineage;
    if (options.interventionTests !== undefined && options.interventionFrom === undefined) {
        throw new Error('--intervention-tests requires --intervention-from: name the earlier run to compare with.');
    }
    if (options.interventionFrom !== undefined) {
        if (!options.interventionTests || options.interventionTests.length === 0) {
            throw new Error('--intervention-tests is required with --intervention-from: declare the test files you edited.');
        }
        const before = (0, run_context_1.loadContainedRun)(rootDir, options.interventionFrom);
        if (before.runId === run.runId || before.createdAt >= run.createdAt) {
            throw new Error(`--intervention-from must name a different earlier run than ${run.runId}.`);
        }
        const knownTests = new Set([...Object.keys(before.mutationContext?.testFileDigests ?? {}), ...Object.keys(run.mutationContext?.testFileDigests ?? {})]);
        const declared = options.interventionTests.map((entry) => {
            const relative = (0, index_1.resolveRepoLocalPath)(rootDir, entry, { allowMissing: true, kind: 'intervention test' }).relativePath;
            // Without recorded test digests in either run (older packets), lineage reports no-execution-context instead.
            if (knownTests.size > 0 && !knownTests.has(relative)) {
                throw new Error(`${entry} is not a test file in either run; declare only test files you edited.`);
            }
            return relative;
        });
        lineage = (0, navigation_1.compareInterventionLineage)(before, run, declared);
    }
    const git = options.gitHorizon !== undefined ? (0, navigation_1.collectGitContext)(rootDir, options.gitHorizon, run.changedFiles) : undefined;
    const navigation = (0, navigation_1.buildNavigation)({ run: context.projectedRun, drift: context.drift, authorizations: authorizationFacts(rootDir, run.runId), lineage, git });
    return options.json ? `${(0, index_1.stableStringify)(navigation)}\n` : (0, navigation_1.renderNavigationText)(navigation);
}
/** The files a run's verdict depends on with their check-time digests; the package index reads them contained. */
function runDriftSubjects(run) {
    const changed = run.changedFiles.map((item) => (0, index_1.normalizePath)(item)).map((filePath) => ({
        subject: `changed file ${filePath}`,
        path: filePath,
        expected: (0, run_context_1.expectedRunFileDigest)(run, filePath) ?? 'sha256:unrecorded'
    }));
    const plane = run.controlPlane;
    return plane
        ? [
            ...changed,
            { subject: 'control plane config', path: plane.configPath, expected: plane.configDigest },
            { subject: 'control plane constitution', path: plane.constitutionPath, expected: plane.constitutionDigest },
            { subject: 'control plane agents', path: plane.agentsPath, expected: plane.agentsDigest }
        ]
        : changed;
}
function packageIndexDeps() {
    return {
        loadRun: run_context_1.loadContainedRun,
        latestRunId: (rootDir) => (0, index_1.readLatestRun)(rootDir).runId,
        driftSubjects: runDriftSubjects,
        toolVersion: (0, check_1.tsQualityPackageVersion)()
    };
}
/**
 * Writes the package artifact-reference index: discovered packages, the runs holding evidence for them and digests
 * of their canonical run packet files. References only; it copies no verdict and claims no coverage.
 */
function writePackageIndexFile(rootDir, options) {
    const { index, indexPath } = (0, package_index_1.writePackageIndex)(rootDir, options, packageIndexDeps());
    return { index, indexPath, output: (0, package_index_1.renderPackageIndexWrite)(index, indexPath) };
}
/** Re-reads every reference of a package index and reports facts (fresh/changed/missing, source drift, findings). */
function inspectPackageIndexFile(rootDir, options) {
    return (0, package_index_1.inspectPackageIndex)(rootDir, options, packageIndexDeps());
}
function renderPackageIndexInspectionFile(rootDir, options) {
    const inspection = inspectPackageIndexFile(rootDir, options);
    return options.json ? `${(0, index_1.stableStringify)(inspection)}\n` : (0, package_index_1.renderPackageIndexInspection)(inspection);
}
function renderGovernance(rootDir, options) {
    const context = (0, run_context_1.projectedRunForDecision)(rootDir, (0, run_context_1.selectedRun)(rootDir, options), options);
    const plan = (0, index_3.generateGovernancePlan)(context.projectedRun, context.constitution, context.agents);
    const body = (0, render_text_1.renderGovernanceText)(context.projectedRun, plan);
    if (context.drift.length === 0) {
        return body;
    }
    return `${(0, run_context_1.renderRunDriftNotice)(context.run, context.drift)}\n${body}`;
}
function renderPlan(rootDir, options) {
    const context = (0, run_context_1.projectedRunForDecision)(rootDir, (0, run_context_1.selectedRun)(rootDir, options), options);
    const plan = (0, index_3.generateGovernancePlan)(context.projectedRun, context.constitution, context.agents);
    const body = (0, render_text_1.renderPlanText)(context.projectedRun, plan);
    if (context.drift.length === 0) {
        return body;
    }
    return `${(0, run_context_1.renderRunDriftNotice)(context.run, context.drift)}\n${body}`;
}
//# sourceMappingURL=projections.js.map