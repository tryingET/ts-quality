"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionWitnessSelection = executionWitnessSelection;
exports.impactedFiles = impactedFiles;
exports.collectExecutionWitnessPlanSummary = collectExecutionWitnessPlanSummary;
exports.collectExecutionWitnessPlans = collectExecutionWitnessPlans;
const path_1 = __importDefault(require("path"));
const witness_1 = require("../../evidence-model/src/witness");
const index_1 = require("../../evidence-model/src/index");
const test_documents_1 = require("./test-documents");
const DEFAULT_EXECUTION_WITNESS_PATTERNS = ['.ts-quality/witnesses/**/*.json'];
function parseExecutionWitnessRecord(rootDir, filePath) {
    const absolutePath = path_1.default.join(rootDir, filePath);
    const raw = (0, index_1.readJson)(absolutePath);
    const version = raw['version'];
    const kind = raw['kind'];
    const invariantId = raw['invariantId'];
    const scenarioId = raw['scenarioId'];
    const status = raw['status'];
    const sourceFiles = raw['sourceFiles'];
    const testFiles = raw['testFiles'];
    const observedAt = raw['observedAt'];
    if (version !== '1') {
        throw new Error(`Execution witness ${filePath} must declare version '1'`);
    }
    if (kind !== 'execution-witness') {
        throw new Error(`Execution witness ${filePath} must declare kind 'execution-witness'`);
    }
    if (typeof invariantId !== 'string' || invariantId.length === 0) {
        throw new Error(`Execution witness ${filePath} must declare a non-empty invariantId`);
    }
    if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
        throw new Error(`Execution witness ${filePath} must declare a non-empty scenarioId`);
    }
    if (status !== 'pass' && status !== 'fail') {
        throw new Error(`Execution witness ${filePath} must declare status 'pass' or 'fail'`);
    }
    if (!Array.isArray(sourceFiles) || sourceFiles.some((item) => typeof item !== 'string')) {
        throw new Error(`Execution witness ${filePath} must declare sourceFiles as an array of strings`);
    }
    if (testFiles !== undefined && (!Array.isArray(testFiles) || testFiles.some((item) => typeof item !== 'string'))) {
        throw new Error(`Execution witness ${filePath} must declare testFiles as an array of strings when present`);
    }
    // Observation metadata has no bearing on safety/selection. Malformed metadata
    // cannot hide a current failure in default discovery.
    return {
        version: '1',
        kind: 'execution-witness',
        ...(raw['binding'] !== undefined ? { binding: raw['binding'] } : {}),
        invariantId,
        scenarioId,
        status,
        sourceFiles: sourceFiles.map((item) => (0, index_1.normalizePath)(item)),
        ...(testFiles ? { testFiles: testFiles.map((item) => (0, index_1.normalizePath)(item)) } : {}),
        ...(typeof observedAt === 'string' ? { observedAt } : {})
    };
}
function executionWitnessSelection(rootDir, invariant, scenario, files) {
    const configuredPatterns = (0, test_documents_1.unique)(scenario.executionWitnessPatterns ?? []);
    const patterns = configuredPatterns.length > 0 ? configuredPatterns : DEFAULT_EXECUTION_WITNESS_PATTERNS;
    const usingDefaultDiscovery = configuredPatterns.length === 0;
    const candidateFiles = (0, index_1.listFiles)(rootDir, { include: /\.json$/, excludeDirs: ['node_modules', 'dist', '.git'] })
        .filter((filePath) => !filePath.endsWith('.receipt.json'))
        .filter((filePath) => patterns.some((pattern) => (0, index_1.matchPattern)(pattern, filePath)));
    if (candidateFiles.length === 0) {
        return {
            configured: !usingDefaultDiscovery,
            matched: false,
            witnessFiles: [],
            mode: 'missing',
            modeReason: usingDefaultDiscovery
                ? `no default execution witness artifacts discovered (${DEFAULT_EXECUTION_WITNESS_PATTERNS.join(', ')})`
                : `executionWitnessPatterns matched no witness files (${patterns.join(', ')})`
        };
    }
    const candidateRecords = candidateFiles.flatMap((filePath) => {
        try {
            return [{ filePath, record: parseExecutionWitnessRecord(rootDir, filePath) }];
        }
        catch (error) {
            if (usingDefaultDiscovery) {
                return [];
            }
            throw error;
        }
    });
    const relevantRecords = candidateRecords.filter(({ record }) => record.invariantId === invariant.id && record.scenarioId === scenario.id);
    if (usingDefaultDiscovery && relevantRecords.length === 0) {
        return {
            configured: false,
            matched: false,
            witnessFiles: [],
            mode: 'missing',
            modeReason: `no default execution witness artifacts discovered for ${invariant.id}:${scenario.id}`
        };
    }
    const rejected = [];
    const currentRecords = relevantRecords.filter(({ filePath, record }) => {
        const scopeMatches = record.status === 'fail'
            ? files.some(file => record.sourceFiles.includes(file))
            : files.every(file => record.sourceFiles.includes(file));
        if (!scopeMatches) {
            rejected.push(`${filePath}: source scope mismatch`);
            return false;
        }
        const issue = (0, witness_1.executionWitnessBindingIssue)(rootDir, record);
        if (issue) {
            rejected.push(`${filePath}: ${issue}`);
            return false;
        }
        return true;
    });
    // A current failure for this invariant/scenario/scope vetoes all current passes,
    // including those produced by different commands. Time never selects a winner.
    const contradicted = currentRecords.some(({ record }) => record.status === 'fail');
    const witnessFiles = contradicted ? [] : currentRecords
        .filter(({ record }) => record.status === 'pass')
        .filter(({ filePath, record }) => {
        const binding = record.binding;
        if (scenario.executionWitnessCommand && JSON.stringify(binding?.command) !== JSON.stringify(scenario.executionWitnessCommand)
            || scenario.executionWitnessTestFiles?.some(file => !record.testFiles?.includes((0, index_1.normalizePath)(file)))
            || scenario.executionWitnessTimeoutMs !== undefined && binding?.timeoutMs !== scenario.executionWitnessTimeoutMs) {
            rejected.push(`${filePath}: configured execution context mismatch`);
            return false;
        }
        return true;
    })
        .map(({ filePath }) => filePath)
        .sort();
    return {
        configured: true,
        matched: witnessFiles.length > 0,
        witnessFiles,
        mode: witnessFiles.length > 0 ? 'explicit' : 'missing',
        modeReason: witnessFiles.length > 0
            ? 'content-bound execution witness artifacts matched invariant/scenario, current digests, execution context and impacted source scope'
            : contradicted
                ? 'current failing execution witness contradicts passing support; rerun after repairing the failure and retire obsolete contradictory records explicitly'
                : `no current bound passing execution witness: ${rejected.sort().join('; ') || 'no matching pass'}`
    };
}
function selectorMatchesInvariant(selector, filePath, symbols) {
    if (selector.startsWith('path:')) {
        return (0, index_1.matchPattern)(selector.slice(5), filePath);
    }
    if (selector.startsWith('symbol:')) {
        const symbolFragment = selector.slice(7);
        return symbols.some((symbol) => symbol.filePath === filePath && symbol.symbol.includes(symbolFragment));
    }
    if (selector.startsWith('domain:')) {
        const fragment = selector.slice(7);
        return filePath.includes(`/${fragment}/`) || filePath.startsWith(`${fragment}/`) || filePath.includes(fragment);
    }
    return (0, index_1.matchPattern)(selector, filePath);
}
function impactedFiles(invariant, changedFiles, changedRegions, complexity) {
    const output = new Set();
    for (const filePath of changedFiles.map((item) => (0, index_1.normalizePath)(item))) {
        if (invariant.selectors.some((selector) => selectorMatchesInvariant(selector, filePath, complexity))) {
            output.add(filePath);
        }
    }
    for (const region of changedRegions) {
        const filePath = (0, index_1.normalizePath)(region.filePath);
        if (invariant.selectors.some((selector) => selectorMatchesInvariant(selector, filePath, complexity))) {
            output.add(filePath);
        }
    }
    return [...output].sort();
}
function collectExecutionWitnessPlanSummary(options) {
    const autoRun = [];
    const skipped = [];
    for (const invariant of options.invariants) {
        const files = impactedFiles(invariant, options.changedFiles, options.changedRegions, options.complexity);
        for (const scenario of invariant.scenarios) {
            if (!scenario.executionWitnessCommand || scenario.executionWitnessCommand.length === 0 || !scenario.executionWitnessOutput) {
                continue;
            }
            if (files.length === 0) {
                skipped.push({
                    invariantId: invariant.id,
                    scenarioId: scenario.id,
                    outputPath: scenario.executionWitnessOutput,
                    command: [...scenario.executionWitnessCommand],
                    testFiles: [...(scenario.executionWitnessTestFiles ?? [])],
                    reason: 'invariant-not-impacted'
                });
                continue;
            }
            autoRun.push({
                invariantId: invariant.id,
                scenarioId: scenario.id,
                sourceFiles: [...files],
                testFiles: [...(scenario.executionWitnessTestFiles ?? [])],
                outputPath: scenario.executionWitnessOutput,
                command: [...scenario.executionWitnessCommand],
                ...(typeof scenario.executionWitnessTimeoutMs === 'number' ? { timeoutMs: scenario.executionWitnessTimeoutMs } : {})
            });
        }
    }
    return { autoRun, skipped };
}
function collectExecutionWitnessPlans(options) {
    return collectExecutionWitnessPlanSummary(options).autoRun;
}
//# sourceMappingURL=witness-plans.js.map