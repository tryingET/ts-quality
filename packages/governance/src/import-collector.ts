import ts = require('typescript');

type AstNode = ts.Node;
type AstNodeLike = ts.Node | undefined;
type AstNodeList = Iterable<ts.Node>;
type FunctionLikeTraversalNode =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration
  | ts.ConstructorDeclaration;

import {
  type BindingScope,
  assignBindingTarget,
  createBindingScope,
  declareBindingName,
  declareImportBindings,
  expressionIsRequireLike,
  expressionProvenance,
  provenance,
  stringLikeModuleSpecifier
} from './import-provenance';

export interface ImportReference {
  kind: 'static' | 'require' | 'dynamic-import';
  specifier?: string;
  expressionText: string;
  resolvable: boolean;
}

interface ImportCollectorState {
  sourceFile: ts.SourceFile;
  imports: ImportReference[];
}

interface ImportSyntaxCollector {
  applies(node: AstNode, scope: BindingScope): boolean;
  collect(node: AstNode, scope: BindingScope, state: ImportCollectorState): void;
}

type ImportVisitor = (node: AstNodeLike, scope: BindingScope) => void;

function isFunctionLikeTraversalNode(node: AstNode): node is FunctionLikeTraversalNode {
  return ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node)
    || ts.isConstructorDeclaration(node);
}

function recordImportReference(state: ImportCollectorState, kind: ImportReference['kind'], expressionNode: ts.Node, specifier?: string): void {
  state.imports.push({
    kind,
    ...(typeof specifier === 'string' ? { specifier } : {}),
    expressionText: expressionNode.getText(state.sourceFile),
    resolvable: typeof specifier === 'string'
  });
}

function recordStaticModuleReference(state: ImportCollectorState, moduleSpecifier: ts.Expression): void {
  const specifier = stringLikeModuleSpecifier(moduleSpecifier);
  if (typeof specifier === 'string') {
    state.imports.push({
      kind: 'static',
      specifier,
      expressionText: moduleSpecifier.getText(state.sourceFile),
      resolvable: true
    });
  }
}

function dispatchImportCollectors(node: AstNode, scope: BindingScope, state: ImportCollectorState, collectors: readonly ImportSyntaxCollector[]): boolean {
  for (const collector of collectors) {
    if (!collector.applies(node, scope)) {
      continue;
    }
    collector.collect(node, scope, state);
    return true;
  }
  return false;
}

const statementImportCollectors = [{
  applies(node: AstNode): boolean {
    return ts.isImportDeclaration(node);
  },
  collect(node: AstNode, scope: BindingScope, state: ImportCollectorState): void {
    if (!ts.isImportDeclaration(node)) {
      return;
    }
    recordStaticModuleReference(state, node.moduleSpecifier);
    declareImportBindings(node, scope);
  }
}, {
  applies(node: AstNode): boolean {
    return ts.isImportEqualsDeclaration(node);
  },
  collect(node: AstNode, scope: BindingScope, state: ImportCollectorState): void {
    if (!ts.isImportEqualsDeclaration(node)) {
      return;
    }
    scope.bindings.set(node.name.text, provenance('never'));
    if (ts.isExternalModuleReference(node.moduleReference)) {
      recordStaticModuleReference(state, node.moduleReference.expression);
    }
  }
}, {
  applies(node: AstNode): boolean {
    return ts.isExportDeclaration(node);
  },
  collect(node: AstNode, _scope: BindingScope, state: ImportCollectorState): void {
    if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) {
      return;
    }
    recordStaticModuleReference(state, node.moduleSpecifier);
  }
}] satisfies readonly ImportSyntaxCollector[];

const callImportCollectors = [{
  applies(node: AstNode, scope: BindingScope): boolean {
    return ts.isCallExpression(node) && node.arguments.length === 1 && expressionIsRequireLike(node.expression, scope);
  },
  collect(node: AstNode, _scope: BindingScope, state: ImportCollectorState): void {
    if (!ts.isCallExpression(node)) {
      return;
    }
    const argument = node.arguments[0];
    if (!argument) {
      return;
    }
    recordImportReference(state, 'require', argument, stringLikeModuleSpecifier(argument));
  }
}, {
  applies(node: AstNode): boolean {
    return ts.isCallExpression(node) && node.arguments.length === 1 && node.expression.kind === ts.SyntaxKind.ImportKeyword;
  },
  collect(node: AstNode, _scope: BindingScope, state: ImportCollectorState): void {
    if (!ts.isCallExpression(node)) {
      return;
    }
    const argument = node.arguments[0];
    if (!argument) {
      return;
    }
    recordImportReference(state, 'dynamic-import', argument, stringLikeModuleSpecifier(argument));
  }
}] satisfies readonly ImportSyntaxCollector[];

function visitStatements(statements: AstNodeList, scope: BindingScope, visit: ImportVisitor): void {
  for (const statement of statements) {
    visit(statement, scope);
  }
}

function visitFunctionLikeNode(node: FunctionLikeTraversalNode, scope: BindingScope, visit: ImportVisitor): void {
  const functionScope = createBindingScope(scope);
  if (node.name && ts.isIdentifier(node.name)) {
    functionScope.bindings.set(node.name.text, provenance('never'));
  }
  for (const parameter of node.parameters ?? []) {
    declareBindingName(parameter.name, provenance('never'), functionScope);
  }
  for (const parameter of node.parameters ?? []) {
    if (parameter.initializer) {
      visit(parameter.initializer, functionScope);
      declareBindingName(parameter.name, expressionProvenance(parameter.initializer, functionScope), functionScope);
    }
  }
  if (node.body) {
    visit(node.body, functionScope);
  }
}

function visitVariableDeclarationNode(node: ts.VariableDeclaration, scope: BindingScope, visit: ImportVisitor): void {
  if (node.initializer) {
    visit(node.initializer, scope);
  }
  declareBindingName(node.name, expressionProvenance(node.initializer, scope), scope);
}

function visitStatementContainerNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): boolean {
  if (ts.isSourceFile(node) || ts.isModuleBlock(node)) {
    visitStatements(node.statements, scope, visit);
    return true;
  }
  if (ts.isBlock(node)) {
    visitStatements(node.statements, createBindingScope(scope), visit);
    return true;
  }
  if (ts.isCaseBlock(node)) {
    const caseScope = createBindingScope(scope);
    for (const clause of node.clauses) {
      visit(clause, caseScope);
    }
    return true;
  }
  if (ts.isCaseClause(node)) {
    visit(node.expression, scope);
    visitStatements(node.statements, scope, visit);
    return true;
  }
  if (ts.isDefaultClause(node)) {
    visitStatements(node.statements, scope, visit);
    return true;
  }
  return false;
}

function visitLoopScopeNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): boolean {
  if (ts.isForStatement(node)) {
    const loopScope = createBindingScope(scope);
    visit(node.initializer, loopScope);
    visit(node.condition, loopScope);
    visit(node.statement, loopScope);
    visit(node.incrementor, loopScope);
    return true;
  }
  if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
    const loopScope = createBindingScope(scope);
    visit(node.initializer, loopScope);
    visit(node.expression, loopScope);
    visit(node.statement, loopScope);
    return true;
  }
  return false;
}

function visitCatchScopeNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): boolean {
  if (!ts.isCatchClause(node)) {
    return false;
  }
  const catchScope = createBindingScope(scope);
  if (node.variableDeclaration) {
    declareBindingName(node.variableDeclaration.name, provenance('never'), catchScope);
  }
  visit(node.block, catchScope);
  return true;
}

function visitScopedContainerNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): boolean {
  return visitStatementContainerNode(node, scope, visit)
    || visitLoopScopeNode(node, scope, visit)
    || visitCatchScopeNode(node, scope, visit);
}

interface DeclarationTraversalHandler {
  applies(node: AstNode): boolean;
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void;
}

function visitNamedFunctionDeclarationNode(node: ts.FunctionDeclaration, scope: BindingScope, visit: ImportVisitor): void {
  if (!ts.isFunctionDeclaration(node)) {
    return;
  }
  if (node.name) {
    scope.bindings.set(node.name.text, provenance('never'));
  }
  visitFunctionLikeNode(node, scope, visit);
}

function visitClassDeclarationNode(node: ts.ClassDeclaration, scope: BindingScope, visit: ImportVisitor): void {
  if (!ts.isClassDeclaration(node)) {
    return;
  }
  if (node.name) {
    scope.bindings.set(node.name.text, provenance('never'));
  }
  ts.forEachChild(node, (child: AstNode) => visit(child, scope));
}

function visitVariableDeclarationCarrierNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      visitVariableDeclarationNode(declaration, scope, visit);
    }
    return;
  }
  if (ts.isVariableDeclarationList(node)) {
    for (const declaration of node.declarations) {
      visitVariableDeclarationNode(declaration, scope, visit);
    }
    return;
  }
  if (ts.isVariableDeclaration(node)) {
    visitVariableDeclarationNode(node, scope, visit);
  }
}

const declarationTraversalHandlers = [{
  applies(node: AstNode): boolean {
    return ts.isFunctionDeclaration(node);
  },
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
    if (ts.isFunctionDeclaration(node)) {
      visitNamedFunctionDeclarationNode(node, scope, visit);
    }
  }
}, {
  applies(node: AstNode): boolean {
    return isFunctionLikeTraversalNode(node);
  },
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
    if (isFunctionLikeTraversalNode(node)) {
      visitFunctionLikeNode(node, scope, visit);
    }
  }
}, {
  applies(node: AstNode): boolean {
    return ts.isClassDeclaration(node);
  },
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
    if (ts.isClassDeclaration(node)) {
      visitClassDeclarationNode(node, scope, visit);
    }
  }
}, {
  applies(node: AstNode): boolean {
    return ts.isVariableStatement(node) || ts.isVariableDeclarationList(node) || ts.isVariableDeclaration(node);
  },
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
    visitVariableDeclarationCarrierNode(node, scope, visit);
  }
}] satisfies readonly DeclarationTraversalHandler[];

function visitDeclarationNode(node: AstNode, scope: BindingScope, state: ImportCollectorState, visit: ImportVisitor): boolean {
  if (dispatchImportCollectors(node, scope, state, statementImportCollectors)) {
    return true;
  }
  for (const handler of declarationTraversalHandlers) {
    if (!handler.applies(node)) {
      continue;
    }
    handler.visit(node, scope, visit);
    return true;
  }
  return false;
}

interface MutationTraversalHandler {
  applies(node: AstNode): boolean;
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void;
}

function visitSimpleAssignmentNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
    return;
  }
  visit(node.right, scope);
  assignBindingTarget(node.left, expressionProvenance(node.right, scope), scope);
}

const mutationTraversalHandlers = [{
  applies(node: AstNode): boolean {
    return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  },
  visit(node: AstNode, scope: BindingScope, visit: ImportVisitor): void {
    visitSimpleAssignmentNode(node, scope, visit);
  }
}] satisfies readonly MutationTraversalHandler[];

function visitMutationNode(node: AstNode, scope: BindingScope, visit: ImportVisitor): boolean {
  for (const handler of mutationTraversalHandlers) {
    if (!handler.applies(node)) {
      continue;
    }
    handler.visit(node, scope, visit);
    return true;
  }
  return false;
}

function visitCallExpressionImports(node: AstNode, scope: BindingScope, state: ImportCollectorState): void {
  dispatchImportCollectors(node, scope, state, callImportCollectors);
}

export function collectImportReferences(filePath: string, sourceText: string): ImportReference[] {
  const state: ImportCollectorState = {
    sourceFile: ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true),
    imports: []
  };

  const visit: ImportVisitor = (node: AstNodeLike, scope: BindingScope): void => {
    if (!node) {
      return;
    }
    if (visitScopedContainerNode(node, scope, visit)) {
      return;
    }
    if (visitDeclarationNode(node, scope, state, visit)) {
      return;
    }
    if (visitMutationNode(node, scope, visit)) {
      return;
    }
    visitCallExpressionImports(node, scope, state);
    ts.forEachChild(node, (child: AstNode) => visit(child, scope));
  };

  visit(state.sourceFile, createBindingScope());
  return state.imports;
}

