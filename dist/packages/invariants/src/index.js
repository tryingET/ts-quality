"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectExecutionWitnessPlanSummary = collectExecutionWitnessPlanSummary;
exports.collectExecutionWitnessPlans = collectExecutionWitnessPlans;
exports.evaluateInvariants = evaluateInvariants;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
const INVARIANT_EVIDENCE_SEMANTICS = 'deterministic-lexical';
const INVARIANT_EVIDENCE_SEMANTICS_SUMMARY = 'deterministic lexical alignment over focused tests; not execution-backed behavioral proof';
const EXECUTION_BACKED_EVIDENCE_SEMANTICS_SUMMARY = 'execution-backed witness artifacts matched the invariant scenario scope';
const ASSERTION_MODULE_SPECIFIERS = new Set(['assert', 'assert/strict', 'node:assert', 'node:assert/strict']);
const TEST_CONTEXT_ASSERTION_METHOD_NAMES = new Set(['assert', 'deepEqual', 'deepStrictEqual', 'doesNotMatch', 'equal', 'fail', 'ifError', 'match', 'notDeepEqual', 'notEqual', 'notStrictEqual', 'ok', 'rejects', 'strictEqual', 'throws']);
function baselineInvariantStatus(evidenceSemantics) {
    return evidenceSemantics === 'execution-backed' ? 'supported' : 'lexically-supported';
}
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
    if (observedAt !== undefined && typeof observedAt !== 'string') {
        throw new Error(`Execution witness ${filePath} must declare observedAt as a string when present`);
    }
    return {
        version: '1',
        kind: 'execution-witness',
        invariantId,
        scenarioId,
        status,
        sourceFiles: sourceFiles.map((item) => (0, index_1.normalizePath)(item)),
        ...(testFiles ? { testFiles: testFiles.map((item) => (0, index_1.normalizePath)(item)) } : {}),
        ...(observedAt ? { observedAt } : {})
    };
}
function executionWitnessSelection(rootDir, invariant, scenario, files) {
    const patterns = unique(scenario.executionWitnessPatterns ?? []);
    if (patterns.length === 0) {
        return {
            configured: false,
            matched: false,
            witnessFiles: [],
            mode: 'missing',
            modeReason: 'no execution witness patterns configured for this scenario'
        };
    }
    const candidateFiles = (0, index_1.listFiles)(rootDir, { include: /\.json$/, excludeDirs: ['node_modules', 'dist', '.git'] }).filter((filePath) => patterns.some((pattern) => (0, index_1.matchPattern)(pattern, filePath)));
    if (candidateFiles.length === 0) {
        return {
            configured: true,
            matched: false,
            witnessFiles: [],
            mode: 'missing',
            modeReason: `executionWitnessPatterns matched no witness files (${patterns.join(', ')})`
        };
    }
    const witnessFiles = candidateFiles.filter((filePath) => {
        const record = parseExecutionWitnessRecord(rootDir, filePath);
        if (record.invariantId !== invariant.id || record.scenarioId !== scenario.id || record.status !== 'pass') {
            return false;
        }
        return files.every((impactedFile) => record.sourceFiles.includes(impactedFile));
    });
    return {
        configured: true,
        matched: witnessFiles.length > 0,
        witnessFiles,
        mode: witnessFiles.length > 0 ? 'explicit' : 'missing',
        modeReason: witnessFiles.length > 0
            ? 'execution witness artifacts matched invariant id, scenario id, pass status, and impacted source scope'
            : 'execution witness artifacts did not match invariant id, scenario id, pass status, and impacted source scope'
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
function requireSpecifier(node, sourceFile) {
    if (!typescript_1.default.isCallExpression(node) || node.expression.getText(sourceFile) !== 'require' || node.arguments.length !== 1) {
        return undefined;
    }
    const argument = node.arguments[0];
    if (!argument) {
        return undefined;
    }
    return typescript_1.default.isStringLiteral(argument) ? argument.text : undefined;
}
function importHintsForDocument(filePath, contents) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, contents, typescript_1.default.ScriptTarget.Latest, true);
    const hints = [];
    function pushSpecifier(specifier) {
        hints.push(...lexicalVariants(specifier));
    }
    function visit(node) {
        if ((typescript_1.default.isImportDeclaration(node) || typescript_1.default.isExportDeclaration(node)) && node.moduleSpecifier && typescript_1.default.isStringLiteral(node.moduleSpecifier)) {
            pushSpecifier(node.moduleSpecifier.text);
        }
        const specifier = requireSpecifier(node, sourceFile);
        if (specifier) {
            pushSpecifier(specifier);
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return unique(hints.map((hint) => hint.toLowerCase()));
}
function calleeChain(expression) {
    if (typescript_1.default.isCallExpression(expression)) {
        return calleeChain(expression.expression);
    }
    if (typescript_1.default.isIdentifier(expression)) {
        return [expression.text];
    }
    if (typescript_1.default.isPropertyAccessExpression(expression)) {
        return [...calleeChain(expression.expression), expression.name.text];
    }
    if (typescript_1.default.isElementAccessExpression(expression) && expression.argumentExpression && typescript_1.default.isStringLiteral(expression.argumentExpression)) {
        return [...calleeChain(expression.expression), expression.argumentExpression.text];
    }
    return [];
}
function collectAssertionAliases(sourceFile) {
    const objectAliases = new Set();
    const functionAliases = new Set(['expect']);
    function visit(node) {
        if (typescript_1.default.isImportDeclaration(node) && node.importClause && typescript_1.default.isStringLiteral(node.moduleSpecifier) && ASSERTION_MODULE_SPECIFIERS.has(node.moduleSpecifier.text)) {
            if (node.importClause.name) {
                objectAliases.add(node.importClause.name.text);
            }
            if (node.importClause.namedBindings) {
                if (typescript_1.default.isNamespaceImport(node.importClause.namedBindings)) {
                    objectAliases.add(node.importClause.namedBindings.name.text);
                }
                if (typescript_1.default.isNamedImports(node.importClause.namedBindings)) {
                    for (const element of node.importClause.namedBindings.elements) {
                        functionAliases.add(element.name.text);
                    }
                }
            }
        }
        if (typescript_1.default.isVariableDeclaration(node) && node.initializer) {
            const specifier = requireSpecifier(node.initializer, sourceFile);
            if (specifier && ASSERTION_MODULE_SPECIFIERS.has(specifier)) {
                if (typescript_1.default.isIdentifier(node.name)) {
                    objectAliases.add(node.name.text);
                }
                if (typescript_1.default.isObjectBindingPattern(node.name)) {
                    for (const element of node.name.elements) {
                        if (typescript_1.default.isIdentifier(element.name)) {
                            functionAliases.add(element.name.text);
                        }
                    }
                }
            }
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return { objectAliases, functionAliases };
}
function isTestCaseCall(expression) {
    const chain = calleeChain(expression);
    if (chain.length === 0) {
        return false;
    }
    const head = chain[0];
    return head === 'test' || head === 'it' || head === 'specify';
}
function testCaseLabel(node) {
    const candidate = node.arguments[0];
    if (candidate && (typescript_1.default.isStringLiteral(candidate) || typescript_1.default.isNoSubstitutionTemplateLiteral(candidate))) {
        return candidate.text;
    }
    return 'anonymous test case';
}
function testContextAliases(callback) {
    const aliases = new Set();
    for (const parameter of callback.parameters) {
        if (typescript_1.default.isIdentifier(parameter.name)) {
            aliases.add(parameter.name.text);
        }
    }
    return aliases;
}
function isAssertionLikeCall(expression, assertionAliases, contextAliases) {
    const chain = calleeChain(expression);
    const head = chain[0];
    if (!head) {
        return false;
    }
    if (assertionAliases.objectAliases.has(head) || assertionAliases.functionAliases.has(head)) {
        return true;
    }
    if (!contextAliases.has(head)) {
        return false;
    }
    const method = chain[1];
    if (!method) {
        return false;
    }
    return method === 'assert' || TEST_CONTEXT_ASSERTION_METHOD_NAMES.has(method);
}
function nodeHasAssertion(rootNode, assertionAliases, contextAliases = new Set()) {
    let found = false;
    function visit(node) {
        if (found) {
            return;
        }
        if (typescript_1.default.isCallExpression(node) && isAssertionLikeCall(node.expression, assertionAliases, contextAliases)) {
            found = true;
            return;
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(rootNode);
    return found;
}
function witnessScopesForDocument(filePath, contents) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, contents, typescript_1.default.ScriptTarget.Latest, true);
    const assertionAliases = collectAssertionAliases(sourceFile);
    const scopes = [];
    function visit(node) {
        if (typescript_1.default.isCallExpression(node) && isTestCaseCall(node.expression)) {
            const callback = node.arguments.find((argument) => typescript_1.default.isArrowFunction(argument) || typescript_1.default.isFunctionExpression(argument));
            if (callback) {
                const label = testCaseLabel(node);
                scopes.push({
                    label,
                    lowered: `${label} ${callback.body.getText(sourceFile)}`.toLowerCase(),
                    hasAssertion: nodeHasAssertion(callback.body, assertionAliases, testContextAliases(callback))
                });
            }
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return scopes.length > 0
        ? scopes
        : [{ label: 'document', lowered: contents.toLowerCase(), hasAssertion: nodeHasAssertion(sourceFile, assertionAliases) }];
}
function loadTestDocuments(rootDir, patterns) {
    const files = (0, index_1.collectSourceFiles)(rootDir, patterns);
    return files.map((filePath) => {
        const contents = fs_1.default.readFileSync(path_1.default.join(rootDir, filePath), 'utf8');
        return {
            filePath,
            importHints: importHintsForDocument(filePath, contents),
            witnessScopes: witnessScopesForDocument(filePath, contents)
        };
    });
}
function unique(values) {
    return [...new Set(values.filter((value) => value.length > 0))];
}
function lexicalVariants(value) {
    const normalized = (0, index_1.normalizePath)(value);
    const base = path_1.default.basename(normalized, path_1.default.extname(normalized));
    const dashed = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
    const underscored = dashed.replace(/-/g, '_');
    const spaced = dashed.replace(/-/g, ' ');
    const compact = base.replace(/[^a-zA-Z0-9]/g, '');
    return unique([
        normalized.toLowerCase(),
        base.toLowerCase(),
        dashed.toLowerCase(),
        underscored.toLowerCase(),
        spaced.toLowerCase(),
        compact.toLowerCase()
    ]);
}
function selectorHints(invariant) {
    const hints = [];
    for (const selector of invariant.selectors) {
        if (selector.startsWith('symbol:')) {
            hints.push(...lexicalVariants(selector.slice(7)));
        }
        if (selector.startsWith('domain:')) {
            hints.push(selector.slice(7).toLowerCase());
        }
    }
    return unique(hints);
}
function focusedTestDocuments(testDocuments, invariant, files) {
    if (invariant.requiredTestPatterns && invariant.requiredTestPatterns.length > 0) {
        const documents = testDocuments.filter((document) => invariant.requiredTestPatterns?.some((pattern) => (0, index_1.matchPattern)(pattern, document.filePath)));
        return {
            documents,
            mode: documents.length > 0 ? 'explicit' : 'missing',
            modeReason: documents.length > 0
                ? `matched explicit requiredTestPatterns (${invariant.requiredTestPatterns.join(', ')})`
                : `requiredTestPatterns matched no test files (${invariant.requiredTestPatterns.join(', ')})`
        };
    }
    const hints = unique([
        ...files.flatMap((filePath) => lexicalVariants(filePath)),
        ...selectorHints(invariant)
    ]).filter((hint) => hint.length >= 3);
    const documents = testDocuments.filter((document) => {
        const loweredPath = document.filePath.toLowerCase();
        return hints.some((hint) => loweredPath.includes(hint) || document.importHints.some((importHint) => importHint.includes(hint)));
    });
    return {
        documents,
        mode: documents.length > 0 ? 'inferred' : 'missing',
        modeReason: documents.length > 0
            ? 'matched focused tests via deterministic path/import/selector hints'
            : 'no focused tests matched deterministic path/import/selector hints'
    };
}
function scenarioHasCoverage(loweredText, keywords) {
    return keywords.every((keyword) => loweredText.includes(keyword.toLowerCase()));
}
function scenarioSupportAcrossDocuments(documents, scenario) {
    let keywordsMatched = false;
    let failurePathKeywordsMatched = scenario.failurePathKeywords ? false : true;
    let assertionMatched = false;
    let supported = false;
    let sameScopeKeywordsAndFailurePathWithoutAssertion = false;
    for (const document of documents) {
        for (const scope of document.witnessScopes) {
            const hasKeywords = scenarioHasCoverage(scope.lowered, scenario.keywords);
            const hasFailurePath = scenario.failurePathKeywords
                ? scenarioHasCoverage(scope.lowered, scenario.failurePathKeywords)
                : true;
            keywordsMatched = keywordsMatched || hasKeywords;
            failurePathKeywordsMatched = failurePathKeywordsMatched || hasFailurePath;
            assertionMatched = assertionMatched || scope.hasAssertion;
            if (hasKeywords && hasFailurePath) {
                if (scope.hasAssertion) {
                    supported = true;
                }
                else {
                    sameScopeKeywordsAndFailurePathWithoutAssertion = true;
                }
            }
        }
    }
    const supportGap = supported
        ? undefined
        : sameScopeKeywordsAndFailurePathWithoutAssertion
            ? 'missing-assertion'
            : keywordsMatched && failurePathKeywordsMatched
                ? 'split-focused-test-cases'
                : undefined;
    return { keywordsMatched, failurePathKeywordsMatched, assertionMatched, supported, supportGap };
}
function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
function describeChangedFunction(item) {
    return `${item.symbol} (${item.filePath}, coverage ${item.coveragePct}%, CRAP ${item.crap})`;
}
function summarizeScenarioSupport(result) {
    if (result.supported && result.supportKind === 'execution-witness') {
        return `${result.scenarioId}: execution-backed witness matched`;
    }
    if (result.supported) {
        return `${result.scenarioId}: deterministic lexical witness matched in one assertion-bearing focused test case`;
    }
    if (result.supportGap === 'missing-assertion') {
        return `${result.scenarioId}: matching keywords were present in one focused test case but no assertion-like check anchored them`;
    }
    if (result.supportGap === 'split-focused-test-cases') {
        return `${result.scenarioId}: happy-path and failure-path evidence was split across focused test cases`;
    }
    const missing = [];
    if (!result.keywordsMatched) {
        missing.push('keywords');
    }
    if (!result.failurePathKeywordsMatched) {
        missing.push('failure-path');
    }
    return `${result.scenarioId}: missing ${missing.join(' + ')} evidence`;
}
function withModeReason(modeReason, facts) {
    return [`mode reason: ${modeReason}`, ...facts];
}
function scenarioSupportGapReason(scenarioResults) {
    if (scenarioResults.some((item) => item.supportGap === 'missing-assertion')) {
        return 'matching keywords appeared in one focused test case, but no assertion-like check anchored them';
    }
    if (scenarioResults.some((item) => item.supportGap === 'split-focused-test-cases')) {
        return 'matching keywords were split across focused test cases instead of one focused test-case witness';
    }
    return undefined;
}
function scenarioEvidenceGapMessage(scenarioDescription, lexicalSupport, executionWitnessConfigured) {
    const prefix = executionWitnessConfigured
        ? `Missing execution-backed or deterministic lexical test evidence for scenario '${scenarioDescription}'`
        : `Missing deterministic lexical test evidence for scenario '${scenarioDescription}'`;
    if (lexicalSupport.supportGap === 'missing-assertion') {
        return `${prefix}; matching keywords were present in one focused test case but no assertion-like check anchored them`;
    }
    if (lexicalSupport.supportGap === 'split-focused-test-cases') {
        return `${prefix}; happy-path and failure-path keywords were split across focused test cases`;
    }
    return prefix;
}
function explicitArtifactMode(hasEvidence, options) {
    return hasEvidence
        ? { mode: 'explicit', modeReason: options.explicitReason }
        : { mode: 'missing', modeReason: options.missingReason };
}
function scenarioSupportMode(scenarioResults, focusedTestSelection) {
    if (scenarioResults.length === 0) {
        return 'missing';
    }
    const supportedCount = scenarioResults.filter((item) => item.supported).length;
    if (supportedCount === 0) {
        return 'missing';
    }
    if (scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness')) {
        return 'explicit';
    }
    return focusedTestSelection.mode === 'explicit' ? 'explicit' : 'inferred';
}
function scenarioSupportModeReason(scenarioResults, focusedTestSelection) {
    if (scenarioResults.length === 0) {
        return 'invariant declares no scenarios';
    }
    const supportedCount = scenarioResults.filter((item) => item.supported).length;
    const gapReason = scenarioSupportGapReason(scenarioResults);
    if (supportedCount === 0) {
        if (focusedTestSelection.mode === 'explicit') {
            if (focusedTestSelection.documents.length === 0) {
                return 'requiredTestPatterns matched no test files for deterministic lexical scenario evaluation';
            }
            return gapReason
                ? `requiredTestPatterns selected tests, but ${gapReason}`
                : 'requiredTestPatterns selected tests, but no scenario has full deterministic lexical support';
        }
        if (focusedTestSelection.mode === 'inferred') {
            return gapReason
                ? `heuristically aligned focused tests were evaluated, but ${gapReason}`
                : 'heuristically aligned focused tests were evaluated, but no scenario has full deterministic lexical support';
        }
        return 'no focused tests were available for deterministic lexical scenario evaluation';
    }
    if (scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness')) {
        return 'scenario support came from explicit execution witness artifacts';
    }
    if (focusedTestSelection.mode === 'explicit') {
        return 'deterministic lexical scenario support came from assertion-bearing tests matched by explicit requiredTestPatterns';
    }
    if (focusedTestSelection.mode === 'inferred') {
        return 'deterministic lexical scenario support came from assertion-bearing heuristically aligned focused tests';
    }
    return 'no focused tests were available for deterministic lexical scenario evaluation';
}
function buildSubSignals(options) {
    const focusedTestFiles = options.focusedTestSelection.documents.map((document) => document.filePath);
    const scenarioSupportedCount = options.scenarioResults.filter((item) => item.supported).length;
    const allScenarioSupportExecutionBacked = options.scenarioResults.length > 0 && options.scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness');
    const scenarioMode = scenarioSupportMode(options.scenarioResults, options.focusedTestSelection);
    const scenarioModeReason = scenarioSupportModeReason(options.scenarioResults, options.focusedTestSelection);
    const coverageMode = explicitArtifactMode(options.changedFunctions.length > 0, {
        explicitReason: 'coverage evidence came from LCOV for changed functions in invariant scope',
        missingReason: 'no changed functions were mapped into invariant scope for coverage evaluation'
    });
    const mutationMode = explicitArtifactMode(options.mutationSitesInScope > 0, {
        explicitReason: 'mutation evidence came from selected mutation sites in invariant scope',
        missingReason: 'no mutation sites were selected in invariant scope'
    });
    const changedFunctionMode = explicitArtifactMode(options.changedFunctions.length > 0, {
        explicitReason: 'changed-function evidence came from CRAP/changed-function mapping in invariant scope',
        missingReason: 'no changed functions were mapped into invariant scope'
    });
    const changedFunctionsSummary = options.changedFunctions.length > 0
        ? options.changedFunctions.map((item) => describeChangedFunction(item))
        : ['none'];
    const signals = [{
            signalId: 'focused-test-alignment',
            label: 'Focused test alignment',
            level: focusedTestFiles.length > 0 ? 'clear' : 'missing',
            mode: options.focusedTestSelection.mode,
            modeReason: options.focusedTestSelection.modeReason,
            summary: focusedTestFiles.length > 0
                ? `${pluralize(focusedTestFiles.length, 'focused test file')} aligned to invariant scope`
                : 'No focused test files aligned to invariant scope',
            facts: withModeReason(options.focusedTestSelection.modeReason, [
                `impacted files: ${options.files.join(', ') || 'none'}`,
                `focused tests: ${focusedTestFiles.join(', ') || 'none'}`
            ])
        }];
    if (options.executionWitnessConfigured) {
        signals.push({
            signalId: 'execution-witness',
            label: 'Execution witness',
            level: options.executionWitnessMatched ? 'clear' : 'missing',
            mode: options.executionWitnessMatched ? 'explicit' : 'missing',
            modeReason: options.executionWitnessMatched
                ? 'execution witness artifacts matched invariant id, scenario id, pass status, and impacted source scope'
                : 'execution witness artifacts did not match invariant id, scenario id, pass status, and impacted source scope',
            summary: options.executionWitnessMatched
                ? `${pluralize(options.executionWitnessFiles.length, 'execution witness file')} matched invariant scenario scope`
                : 'No execution witness artifacts matched invariant scenario scope',
            facts: withModeReason(options.executionWitnessMatched
                ? 'execution witness artifacts matched invariant id, scenario id, pass status, and impacted source scope'
                : 'execution witness artifacts did not match invariant id, scenario id, pass status, and impacted source scope', [
                `impacted files: ${options.files.join(', ') || 'none'}`,
                `execution witness files: ${options.executionWitnessFiles.join(', ') || 'none'}`
            ])
        });
    }
    signals.push({
        signalId: 'scenario-support',
        label: 'Scenario support',
        level: options.scenarioResults.length === 0
            ? 'info'
            : scenarioSupportedCount === options.scenarioResults.length
                ? 'clear'
                : scenarioSupportedCount === 0
                    ? 'missing'
                    : 'warning',
        mode: scenarioMode,
        modeReason: scenarioModeReason,
        summary: options.scenarioResults.length === 0
            ? 'Invariant declares no scenarios'
            : allScenarioSupportExecutionBacked
                ? `${scenarioSupportedCount}/${options.scenarioResults.length} scenario(s) have execution-backed support`
                : `${scenarioSupportedCount}/${options.scenarioResults.length} scenario(s) have deterministic lexical support`,
        facts: withModeReason(scenarioModeReason, options.scenarioResults.length > 0
            ? options.scenarioResults.map((item) => summarizeScenarioSupport(item))
            : ['none'])
    });
    signals.push({
        signalId: 'coverage-pressure',
        label: 'Coverage pressure',
        level: options.changedFunctions.length === 0
            ? 'missing'
            : options.lowCoverageChanged.length > 0
                ? 'warning'
                : 'clear',
        mode: coverageMode.mode,
        modeReason: coverageMode.modeReason,
        summary: options.changedFunctions.length === 0
            ? 'No changed functions were available for coverage evaluation in invariant scope'
            : options.lowCoverageChanged.length > 0
                ? `${pluralize(options.lowCoverageChanged.length, 'changed function')} under 80% coverage`
                : 'All changed functions in invariant scope are at or above 80% coverage',
        facts: withModeReason(coverageMode.modeReason, options.changedFunctions.length === 0
            ? ['changed functions in scope: 0']
            : options.lowCoverageChanged.length > 0
                ? options.lowCoverageChanged.map((item) => describeChangedFunction(item))
                : ['changed functions under 80% coverage: 0'])
    });
    signals.push({
        signalId: 'mutation-pressure',
        label: 'Mutation pressure',
        level: options.mutationSitesInScope === 0
            ? 'info'
            : options.survivingMutantsInScope > 0
                ? 'warning'
                : 'clear',
        mode: mutationMode.mode,
        modeReason: mutationMode.modeReason,
        summary: options.mutationSitesInScope === 0
            ? 'No mutation sites were selected in invariant scope'
            : options.survivingMutantsInScope > 0
                ? `${pluralize(options.survivingMutantsInScope, 'surviving mutant')} across ${pluralize(options.mutationSitesInScope, 'mutation site')}`
                : `${pluralize(options.killedMutantsInScope, 'killed mutant')} across ${pluralize(options.mutationSitesInScope, 'mutation site')} with no survivors`,
        facts: withModeReason(mutationMode.modeReason, [
            `mutation sites in scope: ${options.mutationSitesInScope}`,
            `killed mutants in scope: ${options.killedMutantsInScope}`,
            `surviving mutants in scope: ${options.survivingMutantsInScope}`
        ])
    });
    signals.push({
        signalId: 'changed-function-pressure',
        label: 'Changed function pressure',
        level: options.changedFunctions.length > 0 ? 'info' : 'missing',
        mode: changedFunctionMode.mode,
        modeReason: changedFunctionMode.modeReason,
        summary: options.changedFunctions.length > 0
            ? `${pluralize(options.changedFunctions.length, 'changed function')} in invariant scope; max changed CRAP ${options.changedFunctions.reduce((max, item) => Math.max(max, item.crap), 0)}`
            : 'No changed functions were mapped into invariant scope',
        facts: withModeReason(changedFunctionMode.modeReason, changedFunctionsSummary)
    });
    return signals;
}
function evaluateInvariants(options) {
    const testDocuments = loadTestDocuments(options.rootDir, options.testPatterns ?? ['test/**/*.js', 'test/**/*.mjs', 'test/**/*.cjs', 'test/**/*.ts', '**/*.test.js', '**/*.test.mjs', '**/*.test.cjs', '**/*.spec.ts']);
    const results = [];
    const changedByFile = new Set(options.changedFiles.map((item) => (0, index_1.normalizePath)(item)));
    for (const invariant of options.invariants) {
        const files = impactedFiles(invariant, options.changedFiles, options.changedRegions, options.complexity);
        if (files.length === 0) {
            continue;
        }
        const obligations = [];
        const evidence = [];
        let status = baselineInvariantStatus(INVARIANT_EVIDENCE_SEMANTICS);
        const fileMutations = options.mutationSites.filter((site) => files.includes(site.filePath));
        const mutationResults = options.mutations.filter((result) => files.includes(result.filePath));
        const survivingMutants = mutationResults.filter((result) => result.status === 'survived');
        const killedMutants = mutationResults.filter((result) => result.status === 'killed');
        const changedFunctions = options.complexity
            .filter((item) => files.includes(item.filePath) && item.changed)
            .map((item) => ({
            filePath: item.filePath,
            symbol: item.symbol,
            coveragePct: item.coveragePct,
            crap: item.crap
        }))
            .sort((left, right) => left.filePath.localeCompare(right.filePath) || left.symbol.localeCompare(right.symbol));
        const lowCoverageChanged = changedFunctions.filter((item) => item.coveragePct < 80);
        const maxChangedCrap = changedFunctions.reduce((max, item) => Math.max(max, item.crap), 0);
        const focusedTestSelection = focusedTestDocuments(testDocuments, invariant, files);
        const focusedTests = focusedTestSelection.documents;
        const scenarioResults = [];
        const executionWitnessFiles = new Set();
        let executionWitnessConfigured = false;
        let executionWitnessSupportedScenarioCount = 0;
        if (survivingMutants.length > 0) {
            status = 'at-risk';
            evidence.push(`${survivingMutants.length} surviving mutants in impacted invariant scope`);
        }
        if (lowCoverageChanged.length > 0) {
            status = status === 'at-risk' ? 'at-risk' : 'unsupported';
            evidence.push(`${lowCoverageChanged.length} changed functions under 80% coverage in invariant scope`);
        }
        for (const scenario of invariant.scenarios) {
            const lexicalSupport = focusedTests.length > 0
                ? scenarioSupportAcrossDocuments(focusedTests, scenario)
                : { keywordsMatched: false, failurePathKeywordsMatched: scenario.failurePathKeywords ? false : true, assertionMatched: false, supported: false };
            const executionWitness = executionWitnessSelection(options.rootDir, invariant, scenario, files);
            if (executionWitness.configured) {
                executionWitnessConfigured = true;
            }
            for (const witnessFile of executionWitness.witnessFiles) {
                executionWitnessFiles.add(witnessFile);
            }
            const supported = executionWitness.matched || lexicalSupport.supported;
            const supportKind = executionWitness.matched
                ? 'execution-witness'
                : lexicalSupport.supported
                    ? 'deterministic-lexical'
                    : 'missing';
            if (executionWitness.matched) {
                executionWitnessSupportedScenarioCount += 1;
            }
            scenarioResults.push({
                scenarioId: scenario.id,
                description: scenario.description,
                expected: scenario.expected,
                keywordsMatched: lexicalSupport.keywordsMatched,
                failurePathKeywordsMatched: lexicalSupport.failurePathKeywordsMatched,
                assertionMatched: lexicalSupport.assertionMatched,
                supported,
                ...(lexicalSupport.supportGap ? { supportGap: lexicalSupport.supportGap } : {}),
                supportKind
            });
            if (!supported) {
                obligations.push({
                    id: `${invariant.id}:${scenario.id}`,
                    invariantId: invariant.id,
                    priority: invariant.severity === 'critical' || invariant.severity === 'high' ? 'high' : 'medium',
                    description: `Add execution-backed witness artifacts or tighten an assertion-bearing focused test case for scenario '${scenario.description}' to preserve invariant '${invariant.title}'.`,
                    scenarioId: scenario.id,
                    fileHints: files
                });
                evidence.push(scenarioEvidenceGapMessage(scenario.description, lexicalSupport, executionWitness.configured));
                status = status === 'at-risk' ? 'at-risk' : 'unsupported';
            }
        }
        if (focusedTests.length === 0 && executionWitnessSupportedScenarioCount === 0) {
            status = status === 'at-risk' ? 'at-risk' : 'unsupported';
            evidence.push(invariant.requiredTestPatterns && invariant.requiredTestPatterns.length > 0
                ? `requiredTestPatterns matched no focused test files for ${files.join(', ')}; review the configured patterns.`
                : `No focused test files matched invariant scope for ${files.join(', ')}; align test names/imports or set requiredTestPatterns.`);
        }
        for (const region of options.changedRegions.filter((region) => files.includes((0, index_1.normalizePath)(region.filePath)))) {
            const regionMutations = fileMutations.filter((site) => {
                if (site.filePath !== (0, index_1.normalizePath)(region.filePath)) {
                    return false;
                }
                for (let line = region.span.startLine; line <= region.span.endLine; line += 1) {
                    if ((0, index_1.spanOverlaps)(line, site.span)) {
                        return true;
                    }
                }
                return false;
            });
            if (regionMutations.length === 0 && changedByFile.has((0, index_1.normalizePath)(region.filePath))) {
                evidence.push(`Changed region ${region.hunkId} in ${region.filePath} has no selected mutation sites; review test specificity manually.`);
            }
        }
        const evidenceSemantics = scenarioResults.length > 0 && scenarioResults.every((item) => item.supported && item.supportKind === 'execution-witness')
            ? 'execution-backed'
            : INVARIANT_EVIDENCE_SEMANTICS;
        const evidenceSemanticsSummary = evidenceSemantics === 'execution-backed'
            ? EXECUTION_BACKED_EVIDENCE_SEMANTICS_SUMMARY
            : INVARIANT_EVIDENCE_SEMANTICS_SUMMARY;
        if (status === 'lexically-supported' && evidenceSemantics === 'execution-backed') {
            status = 'supported';
        }
        const evidenceSummary = {
            invariantId: invariant.id,
            evidenceSemantics,
            evidenceSemanticsSummary,
            impactedFiles: files,
            focusedTests: focusedTests.map((document) => document.filePath),
            ...(executionWitnessFiles.size > 0 ? { executionWitnessFiles: [...executionWitnessFiles].sort() } : {}),
            changedFunctions,
            changedFunctionsUnder80Coverage: lowCoverageChanged.length,
            maxChangedCrap,
            mutationSitesInScope: fileMutations.length,
            killedMutantsInScope: killedMutants.length,
            survivingMutantsInScope: survivingMutants.length,
            scenarioResults,
            subSignals: buildSubSignals({
                files,
                focusedTestSelection,
                executionWitnessConfigured,
                executionWitnessMatched: executionWitnessSupportedScenarioCount === invariant.scenarios.length && executionWitnessSupportedScenarioCount > 0,
                executionWitnessFiles: [...executionWitnessFiles].sort(),
                changedFunctions,
                lowCoverageChanged,
                mutationSitesInScope: fileMutations.length,
                killedMutantsInScope: killedMutants.length,
                survivingMutantsInScope: survivingMutants.length,
                scenarioResults
            })
        };
        results.push({
            id: `${invariant.id}:claim`,
            invariantId: invariant.id,
            description: `${invariant.title} applies to ${files.join(', ')}`,
            status,
            evidence: evidence.length > 0
                ? evidence
                : executionWitnessFiles.size > 0
                    ? [`Execution witness artifacts: ${([...executionWitnessFiles].sort()).join(', ')}`]
                    : [`Focused tests with deterministic lexical alignment: ${focusedTests.map((document) => document.filePath).join(', ')}`],
            obligations,
            evidenceSummary
        });
    }
    return results;
}
//# sourceMappingURL=index.js.map