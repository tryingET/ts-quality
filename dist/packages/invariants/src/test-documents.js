"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTestDocuments = loadTestDocuments;
exports.unique = unique;
exports.focusedTestDocuments = focusedTestDocuments;
exports.scenarioSupportAcrossDocuments = scenarioSupportAcrossDocuments;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
const ASSERTION_MODULE_SPECIFIERS = new Set(['assert', 'assert/strict', 'node:assert', 'node:assert/strict']);
const TEST_CONTEXT_ASSERTION_METHOD_NAMES = new Set(['assert', 'deepEqual', 'deepStrictEqual', 'doesNotMatch', 'equal', 'fail', 'ifError', 'match', 'notDeepEqual', 'notEqual', 'notStrictEqual', 'ok', 'rejects', 'strictEqual', 'throws']);
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
function importSpecifiersForDocument(filePath, contents) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, contents, typescript_1.default.ScriptTarget.Latest, true);
    const specifiers = [];
    function visit(node) {
        if ((typescript_1.default.isImportDeclaration(node) || typescript_1.default.isExportDeclaration(node)) && node.moduleSpecifier && typescript_1.default.isStringLiteral(node.moduleSpecifier)) {
            specifiers.push(node.moduleSpecifier.text);
        }
        const specifier = requireSpecifier(node, sourceFile);
        if (specifier) {
            specifiers.push(specifier);
        }
        typescript_1.default.forEachChild(node, visit);
    }
    visit(sourceFile);
    return unique(specifiers.map((specifier) => specifier.toLowerCase()));
}
function importHintsForSpecifiers(specifiers) {
    return unique(specifiers.flatMap((specifier) => lexicalVariants(specifier)).map((hint) => hint.toLowerCase()));
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
        const importSpecifiers = importSpecifiersForDocument(filePath, contents);
        return {
            filePath,
            importSpecifiers,
            importHints: importHintsForSpecifiers(importSpecifiers),
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
/**
 * Resolves the npm name of the nearest workspace package that contains a repo-relative source file.
 * The repo-root package is deliberately excluded: a self-import of the root package does not identify one source file.
 */
function workspacePackageName(rootDir, filePath) {
    let directory = path_1.default.posix.dirname((0, index_1.normalizePath)(filePath));
    while (directory !== '.' && directory !== '/' && directory !== '' && !directory.startsWith('..')) {
        const manifestPath = path_1.default.join(rootDir, directory, 'package.json');
        if (fs_1.default.existsSync(manifestPath)) {
            try {
                const name = (0, index_1.readJson)(manifestPath)['name'];
                if (typeof name === 'string' && name.length > 0) {
                    return name.toLowerCase();
                }
                // Nameless manifests (for example a nested {"type":"module"} marker) are not package roots; keep walking.
            }
            catch {
                return undefined;
            }
        }
        directory = path_1.default.posix.dirname(directory);
    }
    return undefined;
}
function importsWorkspacePackage(document, packageNames) {
    return packageNames.some((name) => document.importSpecifiers.some((specifier) => specifier === name || specifier.startsWith(`${name}/`)));
}
function focusedTestDocuments(rootDir, testDocuments, invariant, files) {
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
    const packageNames = unique(files.map((filePath) => workspacePackageName(rootDir, filePath) ?? ''));
    const matchesLexically = (document) => {
        const loweredPath = document.filePath.toLowerCase();
        return hints.some((hint) => loweredPath.includes(hint) || document.importHints.some((importHint) => importHint.includes(hint)));
    };
    const documents = testDocuments.filter((document) => matchesLexically(document) || importsWorkspacePackage(document, packageNames));
    const packageOnlyMatch = documents.some((document) => !matchesLexically(document));
    return {
        documents,
        mode: documents.length > 0 ? 'inferred' : 'missing',
        modeReason: documents.length > 0
            ? packageOnlyMatch
                ? `matched focused tests via deterministic path/import/selector hints and workspace package imports (${packageNames.join(', ')})`
                : 'matched focused tests via deterministic path/import/selector hints'
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
//# sourceMappingURL=test-documents.js.map