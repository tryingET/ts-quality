import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  collectSourceFiles,
  type InvariantEvidenceMode,
  type InvariantScenarioResult,
  type InvariantSpec,
  matchPattern,
  normalizePath,
  readJson
} from '../../evidence-model/src/index';

/** Lexical test analysis: focused test documents, assertion aliases, test-case scopes and scenario support across documents. */

interface TestWitnessScope {
  label: string;
  lowered: string;
  hasAssertion: boolean;
}
interface TestDocument {
  filePath: string;
  /** Raw module specifiers, lowercased; package matching must not use lexical variants. */
  importSpecifiers: string[];
  importHints: string[];
  witnessScopes: TestWitnessScope[];
}
export interface FocusedTestSelection {
  documents: TestDocument[];
  mode: InvariantEvidenceMode;
  modeReason: string;
}
interface AssertionAliasSet {
  objectAliases: Set<string>;
  functionAliases: Set<string>;
}
export interface ScenarioLexicalSupport {
  keywordsMatched: boolean;
  failurePathKeywordsMatched: boolean;
  assertionMatched: boolean;
  supported: boolean;
  supportGap?: InvariantScenarioResult['supportGap'];
}
type TestCaseCallback = ts.FunctionExpression | ts.ArrowFunction;
const ASSERTION_MODULE_SPECIFIERS = new Set(['assert', 'assert/strict', 'node:assert', 'node:assert/strict']);
const TEST_CONTEXT_ASSERTION_METHOD_NAMES = new Set(['assert', 'deepEqual', 'deepStrictEqual', 'doesNotMatch', 'equal', 'fail', 'ifError', 'match', 'notDeepEqual', 'notEqual', 'notStrictEqual', 'ok', 'rejects', 'strictEqual', 'throws']);
function requireSpecifier(node: ts.Node, sourceFile: ts.SourceFile): string | undefined {
  if (!ts.isCallExpression(node) || node.expression.getText(sourceFile) !== 'require' || node.arguments.length !== 1) {
    return undefined;
  }
  const argument = node.arguments[0];
  if (!argument) {
    return undefined;
  }
  return ts.isStringLiteral(argument) ? argument.text : undefined;
}
function importSpecifiersForDocument(filePath: string, contents: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  function visit(node: ts.Node): void {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    const specifier = requireSpecifier(node, sourceFile);
    if (specifier) {
      specifiers.push(specifier);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return unique(specifiers.map((specifier) => specifier.toLowerCase()));
}
function importHintsForSpecifiers(specifiers: string[]): string[] {
  return unique(specifiers.flatMap((specifier) => lexicalVariants(specifier)).map((hint) => hint.toLowerCase()));
}
function calleeChain(expression: ts.Expression): string[] {
  if (ts.isCallExpression(expression)) {
    return calleeChain(expression.expression);
  }
  if (ts.isIdentifier(expression)) {
    return [expression.text];
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return [...calleeChain(expression.expression), expression.name.text];
  }
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression && ts.isStringLiteral(expression.argumentExpression)) {
    return [...calleeChain(expression.expression), expression.argumentExpression.text];
  }
  return [];
}
function collectAssertionAliases(sourceFile: ts.SourceFile): AssertionAliasSet {
  const objectAliases = new Set<string>();
  const functionAliases = new Set<string>(['expect']);

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause && ts.isStringLiteral(node.moduleSpecifier) && ASSERTION_MODULE_SPECIFIERS.has(node.moduleSpecifier.text)) {
      if (node.importClause.name) {
        objectAliases.add(node.importClause.name.text);
      }
      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          objectAliases.add(node.importClause.namedBindings.name.text);
        }
        if (ts.isNamedImports(node.importClause.namedBindings)) {
          for (const element of node.importClause.namedBindings.elements) {
            functionAliases.add(element.name.text);
          }
        }
      }
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const specifier = requireSpecifier(node.initializer, sourceFile);
      if (specifier && ASSERTION_MODULE_SPECIFIERS.has(specifier)) {
        if (ts.isIdentifier(node.name)) {
          objectAliases.add(node.name.text);
        }
        if (ts.isObjectBindingPattern(node.name)) {
          for (const element of node.name.elements) {
            if (ts.isIdentifier(element.name)) {
              functionAliases.add(element.name.text);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { objectAliases, functionAliases };
}
function isTestCaseCall(expression: ts.Expression): boolean {
  const chain = calleeChain(expression);
  if (chain.length === 0) {
    return false;
  }
  const head = chain[0];
  return head === 'test' || head === 'it' || head === 'specify';
}
function testCaseLabel(node: ts.CallExpression): string {
  const candidate = node.arguments[0];
  if (candidate && (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate))) {
    return candidate.text;
  }
  return 'anonymous test case';
}
function testContextAliases(callback: TestCaseCallback): Set<string> {
  const aliases = new Set<string>();
  for (const parameter of callback.parameters) {
    if (ts.isIdentifier(parameter.name)) {
      aliases.add(parameter.name.text);
    }
  }
  return aliases;
}
function isAssertionLikeCall(expression: ts.Expression, assertionAliases: AssertionAliasSet, contextAliases: Set<string>): boolean {
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
function nodeHasAssertion(rootNode: ts.Node, assertionAliases: AssertionAliasSet, contextAliases: Set<string> = new Set<string>()): boolean {
  let found = false;

  function visit(node: ts.Node): void {
    if (found) {
      return;
    }
    if (ts.isCallExpression(node) && isAssertionLikeCall(node.expression, assertionAliases, contextAliases)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(rootNode);
  return found;
}
function witnessScopesForDocument(filePath: string, contents: string): TestWitnessScope[] {
  const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true);
  const assertionAliases = collectAssertionAliases(sourceFile);
  const scopes: TestWitnessScope[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isTestCaseCall(node.expression)) {
      const callback = node.arguments.find((argument): argument is TestCaseCallback => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
      if (callback) {
        const label = testCaseLabel(node);
        scopes.push({
          label,
          lowered: `${label} ${callback.body.getText(sourceFile)}`.toLowerCase(),
          hasAssertion: nodeHasAssertion(callback.body, assertionAliases, testContextAliases(callback))
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return scopes.length > 0
    ? scopes
    : [{ label: 'document', lowered: contents.toLowerCase(), hasAssertion: nodeHasAssertion(sourceFile, assertionAliases) }];
}
export function loadTestDocuments(rootDir: string, patterns: string[]): TestDocument[] {
  const files = collectSourceFiles(rootDir, patterns);
  return files.map((filePath) => {
    const contents = fs.readFileSync(path.join(rootDir, filePath), 'utf8');
    const importSpecifiers = importSpecifiersForDocument(filePath, contents);
    return {
      filePath,
      importSpecifiers,
      importHints: importHintsForSpecifiers(importSpecifiers),
      witnessScopes: witnessScopesForDocument(filePath, contents)
    } satisfies TestDocument;
  });
}
export function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
function lexicalVariants(value: string): string[] {
  const normalized = normalizePath(value);
  const base = path.basename(normalized, path.extname(normalized));
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
function selectorHints(invariant: InvariantSpec): string[] {
  const hints: string[] = [];
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
function workspacePackageName(rootDir: string, filePath: string): string | undefined {
  let directory = path.posix.dirname(normalizePath(filePath));
  while (directory !== '.' && directory !== '/' && directory !== '' && !directory.startsWith('..')) {
    const manifestPath = path.join(rootDir, directory, 'package.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const name = readJson<Record<string, unknown>>(manifestPath)['name'];
        if (typeof name === 'string' && name.length > 0) {
          return name.toLowerCase();
        }
        // Nameless manifests (for example a nested {"type":"module"} marker) are not package roots; keep walking.
      } catch {
        return undefined;
      }
    }
    directory = path.posix.dirname(directory);
  }
  return undefined;
}
function importsWorkspacePackage(document: TestDocument, packageNames: string[]): boolean {
  return packageNames.some((name) => document.importSpecifiers.some((specifier) => specifier === name || specifier.startsWith(`${name}/`)));
}
export function focusedTestDocuments(rootDir: string, testDocuments: TestDocument[], invariant: InvariantSpec, files: string[]): FocusedTestSelection {
  if (invariant.requiredTestPatterns && invariant.requiredTestPatterns.length > 0) {
    const documents = testDocuments.filter((document) => invariant.requiredTestPatterns?.some((pattern) => matchPattern(pattern, document.filePath)));
    return {
      documents,
      mode: documents.length > 0 ? 'explicit' : 'missing',
      modeReason: documents.length > 0
        ? `matched explicit requiredTestPatterns (${invariant.requiredTestPatterns.join(', ')})`
        : `requiredTestPatterns matched no test files (${invariant.requiredTestPatterns.join(', ')})`
    } satisfies FocusedTestSelection;
  }

  const hints = unique([
    ...files.flatMap((filePath) => lexicalVariants(filePath)),
    ...selectorHints(invariant)
  ]).filter((hint) => hint.length >= 3);

  const packageNames = unique(files.map((filePath) => workspacePackageName(rootDir, filePath) ?? ''));
  const matchesLexically = (document: TestDocument): boolean => {
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
  } satisfies FocusedTestSelection;
}
function scenarioHasCoverage(loweredText: string, keywords: string[]): boolean {
  return keywords.every((keyword) => loweredText.includes(keyword.toLowerCase()));
}
export function scenarioSupportAcrossDocuments(documents: TestDocument[], scenario: InvariantSpec['scenarios'][number]): ScenarioLexicalSupport {
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
        } else {
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
