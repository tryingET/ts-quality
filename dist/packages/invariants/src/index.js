"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateInvariants = evaluateInvariants;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
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
        if (typescript_1.default.isCallExpression(node) && node.expression?.getText(sourceFile) === 'require' && node.arguments.length === 1) {
            const argument = node.arguments[0];
            if (typescript_1.default.isStringLiteral(argument)) {
                pushSpecifier(argument.text);
            }
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return unique(hints.map((hint) => hint.toLowerCase()));
}
function loadTestDocuments(rootDir, patterns) {
    const files = (0, index_1.collectSourceFiles)(rootDir, patterns);
    return files.map((filePath) => {
        const contents = fs_1.default.readFileSync(path_1.default.join(rootDir, filePath), 'utf8');
        return {
            filePath,
            contents,
            lowered: contents.toLowerCase(),
            importHints: importHintsForDocument(filePath, contents)
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
function scenarioHasCoverage(corpus, keywords) {
    const lowered = corpus.toLowerCase();
    return keywords.every((keyword) => lowered.includes(keyword.toLowerCase()));
}
function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}
function describeChangedFunction(item) {
    return `${item.symbol} (${item.filePath}, coverage ${item.coveragePct}%, CRAP ${item.crap})`;
}
function summarizeScenarioSupport(result) {
    if (result.supported) {
        return `${result.scenarioId}: keywords + failure-path evidence matched`;
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
    return focusedTestSelection.mode === 'explicit' ? 'explicit' : 'inferred';
}
function scenarioSupportModeReason(scenarioResults, focusedTestSelection) {
    if (scenarioResults.length === 0) {
        return 'invariant declares no scenarios';
    }
    const supportedCount = scenarioResults.filter((item) => item.supported).length;
    if (supportedCount === 0) {
        if (focusedTestSelection.mode === 'explicit') {
            return focusedTestSelection.documents.length > 0
                ? 'requiredTestPatterns selected tests, but no scenario has full deterministic support'
                : 'requiredTestPatterns matched no test files for deterministic scenario evaluation';
        }
        if (focusedTestSelection.mode === 'inferred') {
            return 'heuristically aligned focused tests were evaluated, but no scenario has full deterministic support';
        }
        return 'no focused tests were available for deterministic scenario evaluation';
    }
    if (focusedTestSelection.mode === 'explicit') {
        return 'scenario support came from tests matched by explicit requiredTestPatterns';
    }
    if (focusedTestSelection.mode === 'inferred') {
        return 'scenario support came from heuristically aligned focused tests';
    }
    return 'no focused tests were available for deterministic scenario evaluation';
}
function buildSubSignals(options) {
    const focusedTestFiles = options.focusedTestSelection.documents.map((document) => document.filePath);
    const scenarioSupportedCount = options.scenarioResults.filter((item) => item.supported).length;
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
    return [
        {
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
        },
        {
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
                : `${scenarioSupportedCount}/${options.scenarioResults.length} scenario(s) have deterministic support`,
            facts: withModeReason(scenarioModeReason, options.scenarioResults.length > 0
                ? options.scenarioResults.map((item) => summarizeScenarioSupport(item))
                : ['none'])
        },
        {
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
        },
        {
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
        },
        {
            signalId: 'changed-function-pressure',
            label: 'Changed function pressure',
            level: options.changedFunctions.length > 0 ? 'info' : 'missing',
            mode: changedFunctionMode.mode,
            modeReason: changedFunctionMode.modeReason,
            summary: options.changedFunctions.length > 0
                ? `${pluralize(options.changedFunctions.length, 'changed function')} in invariant scope; max changed CRAP ${options.changedFunctions.reduce((max, item) => Math.max(max, item.crap), 0)}`
                : 'No changed functions were mapped into invariant scope',
            facts: withModeReason(changedFunctionMode.modeReason, changedFunctionsSummary)
        }
    ];
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
        let status = 'supported';
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
        const focusedCorpus = focusedTests.map((document) => document.contents).join('\n');
        const scenarioResults = [];
        if (survivingMutants.length > 0) {
            status = 'at-risk';
            evidence.push(`${survivingMutants.length} surviving mutants in impacted invariant scope`);
        }
        if (lowCoverageChanged.length > 0) {
            status = status === 'at-risk' ? 'at-risk' : 'unsupported';
            evidence.push(`${lowCoverageChanged.length} changed functions under 80% coverage in invariant scope`);
        }
        if (focusedTests.length === 0) {
            status = status === 'at-risk' ? 'at-risk' : 'unsupported';
            evidence.push(invariant.requiredTestPatterns && invariant.requiredTestPatterns.length > 0
                ? `requiredTestPatterns matched no focused test files for ${files.join(', ')}; review the configured patterns.`
                : `No focused test files matched invariant scope for ${files.join(', ')}; align test names/imports or set requiredTestPatterns.`);
        }
        for (const scenario of invariant.scenarios) {
            const hasKeywords = focusedTests.length > 0 && scenarioHasCoverage(focusedCorpus, scenario.keywords);
            const hasFailurePath = scenario.failurePathKeywords ? focusedTests.length > 0 && scenarioHasCoverage(focusedCorpus, scenario.failurePathKeywords) : true;
            const supported = hasKeywords && hasFailurePath;
            scenarioResults.push({
                scenarioId: scenario.id,
                description: scenario.description,
                expected: scenario.expected,
                keywordsMatched: hasKeywords,
                failurePathKeywordsMatched: hasFailurePath,
                supported
            });
            if (!supported) {
                obligations.push({
                    id: `${invariant.id}:${scenario.id}`,
                    invariantId: invariant.id,
                    priority: invariant.severity === 'critical' || invariant.severity === 'high' ? 'high' : 'medium',
                    description: `Add or tighten a focused test for scenario '${scenario.description}' to preserve invariant '${invariant.title}'.`,
                    scenarioId: scenario.id,
                    fileHints: files
                });
                evidence.push(`Missing deterministic test evidence for scenario '${scenario.description}'`);
                status = status === 'at-risk' ? 'at-risk' : 'unsupported';
            }
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
        const evidenceSummary = {
            invariantId: invariant.id,
            impactedFiles: files,
            focusedTests: focusedTests.map((document) => document.filePath),
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
            evidence: evidence.length > 0 ? evidence : [`Focused tests: ${focusedTests.map((document) => document.filePath).join(', ')}`],
            obligations,
            evidenceSummary
        });
    }
    return results;
}
//# sourceMappingURL=index.js.map