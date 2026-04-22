"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectImportReferences = collectImportReferences;
const ts = require("typescript");
const import_provenance_1 = require("./import-provenance");
function isFunctionLikeTraversalNode(node) {
    return ts.isFunctionExpression(node)
        || ts.isArrowFunction(node)
        || ts.isMethodDeclaration(node)
        || ts.isGetAccessorDeclaration(node)
        || ts.isSetAccessorDeclaration(node)
        || ts.isConstructorDeclaration(node);
}
function recordImportReference(state, kind, expressionNode, specifier) {
    state.imports.push({
        kind,
        ...(typeof specifier === 'string' ? { specifier } : {}),
        expressionText: expressionNode.getText(state.sourceFile),
        resolvable: typeof specifier === 'string'
    });
}
function recordStaticModuleReference(state, moduleSpecifier) {
    const specifier = (0, import_provenance_1.stringLikeModuleSpecifier)(moduleSpecifier);
    if (typeof specifier === 'string') {
        state.imports.push({
            kind: 'static',
            specifier,
            expressionText: moduleSpecifier.getText(state.sourceFile),
            resolvable: true
        });
    }
}
function dispatchImportCollectors(node, scope, state, collectors) {
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
        applies(node) {
            return ts.isImportDeclaration(node);
        },
        collect(node, scope, state) {
            if (!ts.isImportDeclaration(node)) {
                return;
            }
            recordStaticModuleReference(state, node.moduleSpecifier);
            (0, import_provenance_1.declareImportBindings)(node, scope);
        }
    }, {
        applies(node) {
            return ts.isImportEqualsDeclaration(node);
        },
        collect(node, scope, state) {
            if (!ts.isImportEqualsDeclaration(node)) {
                return;
            }
            scope.bindings.set(node.name.text, (0, import_provenance_1.provenance)('never'));
            if (ts.isExternalModuleReference(node.moduleReference)) {
                recordStaticModuleReference(state, node.moduleReference.expression);
            }
        }
    }, {
        applies(node) {
            return ts.isExportDeclaration(node);
        },
        collect(node, _scope, state) {
            if (!ts.isExportDeclaration(node) || !node.moduleSpecifier) {
                return;
            }
            recordStaticModuleReference(state, node.moduleSpecifier);
        }
    }];
const callImportCollectors = [{
        applies(node, scope) {
            return ts.isCallExpression(node) && node.arguments.length === 1 && (0, import_provenance_1.expressionIsRequireLike)(node.expression, scope);
        },
        collect(node, _scope, state) {
            if (!ts.isCallExpression(node)) {
                return;
            }
            const argument = node.arguments[0];
            if (!argument) {
                return;
            }
            recordImportReference(state, 'require', argument, (0, import_provenance_1.stringLikeModuleSpecifier)(argument));
        }
    }, {
        applies(node) {
            return ts.isCallExpression(node) && node.arguments.length === 1 && node.expression.kind === ts.SyntaxKind.ImportKeyword;
        },
        collect(node, _scope, state) {
            if (!ts.isCallExpression(node)) {
                return;
            }
            const argument = node.arguments[0];
            if (!argument) {
                return;
            }
            recordImportReference(state, 'dynamic-import', argument, (0, import_provenance_1.stringLikeModuleSpecifier)(argument));
        }
    }];
function visitStatements(statements, scope, visit) {
    for (const statement of statements) {
        visit(statement, scope);
    }
}
function visitFunctionLikeNode(node, scope, visit) {
    const functionScope = (0, import_provenance_1.createBindingScope)(scope);
    if (node.name && ts.isIdentifier(node.name)) {
        functionScope.bindings.set(node.name.text, (0, import_provenance_1.provenance)('never'));
    }
    for (const parameter of node.parameters ?? []) {
        (0, import_provenance_1.declareBindingName)(parameter.name, (0, import_provenance_1.provenance)('never'), functionScope);
    }
    for (const parameter of node.parameters ?? []) {
        if (parameter.initializer) {
            visit(parameter.initializer, functionScope);
            (0, import_provenance_1.declareBindingName)(parameter.name, (0, import_provenance_1.expressionProvenance)(parameter.initializer, functionScope), functionScope);
        }
    }
    if (node.body) {
        visit(node.body, functionScope);
    }
}
function visitVariableDeclarationNode(node, scope, visit) {
    if (node.initializer) {
        visit(node.initializer, scope);
    }
    (0, import_provenance_1.declareBindingName)(node.name, (0, import_provenance_1.expressionProvenance)(node.initializer, scope), scope);
}
function visitStatementContainerNode(node, scope, visit) {
    if (ts.isSourceFile(node) || ts.isModuleBlock(node)) {
        visitStatements(node.statements, scope, visit);
        return true;
    }
    if (ts.isBlock(node)) {
        visitStatements(node.statements, (0, import_provenance_1.createBindingScope)(scope), visit);
        return true;
    }
    if (ts.isCaseBlock(node)) {
        const caseScope = (0, import_provenance_1.createBindingScope)(scope);
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
function visitLoopScopeNode(node, scope, visit) {
    if (ts.isForStatement(node)) {
        const loopScope = (0, import_provenance_1.createBindingScope)(scope);
        visit(node.initializer, loopScope);
        visit(node.condition, loopScope);
        visit(node.statement, loopScope);
        visit(node.incrementor, loopScope);
        return true;
    }
    if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
        const loopScope = (0, import_provenance_1.createBindingScope)(scope);
        visit(node.initializer, loopScope);
        visit(node.expression, loopScope);
        visit(node.statement, loopScope);
        return true;
    }
    return false;
}
function visitCatchScopeNode(node, scope, visit) {
    if (!ts.isCatchClause(node)) {
        return false;
    }
    const catchScope = (0, import_provenance_1.createBindingScope)(scope);
    if (node.variableDeclaration) {
        (0, import_provenance_1.declareBindingName)(node.variableDeclaration.name, (0, import_provenance_1.provenance)('never'), catchScope);
    }
    visit(node.block, catchScope);
    return true;
}
function visitScopedContainerNode(node, scope, visit) {
    return visitStatementContainerNode(node, scope, visit)
        || visitLoopScopeNode(node, scope, visit)
        || visitCatchScopeNode(node, scope, visit);
}
function visitNamedFunctionDeclarationNode(node, scope, visit) {
    if (!ts.isFunctionDeclaration(node)) {
        return;
    }
    if (node.name) {
        scope.bindings.set(node.name.text, (0, import_provenance_1.provenance)('never'));
    }
    visitFunctionLikeNode(node, scope, visit);
}
function visitClassDeclarationNode(node, scope, visit) {
    if (!ts.isClassDeclaration(node)) {
        return;
    }
    if (node.name) {
        scope.bindings.set(node.name.text, (0, import_provenance_1.provenance)('never'));
    }
    ts.forEachChild(node, (child) => visit(child, scope));
}
function visitVariableDeclarationCarrierNode(node, scope, visit) {
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
        applies(node) {
            return ts.isFunctionDeclaration(node);
        },
        visit(node, scope, visit) {
            if (ts.isFunctionDeclaration(node)) {
                visitNamedFunctionDeclarationNode(node, scope, visit);
            }
        }
    }, {
        applies(node) {
            return isFunctionLikeTraversalNode(node);
        },
        visit(node, scope, visit) {
            if (isFunctionLikeTraversalNode(node)) {
                visitFunctionLikeNode(node, scope, visit);
            }
        }
    }, {
        applies(node) {
            return ts.isClassDeclaration(node);
        },
        visit(node, scope, visit) {
            if (ts.isClassDeclaration(node)) {
                visitClassDeclarationNode(node, scope, visit);
            }
        }
    }, {
        applies(node) {
            return ts.isVariableStatement(node) || ts.isVariableDeclarationList(node) || ts.isVariableDeclaration(node);
        },
        visit(node, scope, visit) {
            visitVariableDeclarationCarrierNode(node, scope, visit);
        }
    }];
function visitDeclarationNode(node, scope, state, visit) {
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
function visitSimpleAssignmentNode(node, scope, visit) {
    if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
        return;
    }
    visit(node.right, scope);
    (0, import_provenance_1.assignBindingTarget)(node.left, (0, import_provenance_1.expressionProvenance)(node.right, scope), scope);
}
const mutationTraversalHandlers = [{
        applies(node) {
            return ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken;
        },
        visit(node, scope, visit) {
            visitSimpleAssignmentNode(node, scope, visit);
        }
    }];
function visitMutationNode(node, scope, visit) {
    for (const handler of mutationTraversalHandlers) {
        if (!handler.applies(node)) {
            continue;
        }
        handler.visit(node, scope, visit);
        return true;
    }
    return false;
}
function visitCallExpressionImports(node, scope, state) {
    dispatchImportCollectors(node, scope, state, callImportCollectors);
}
function collectImportReferences(filePath, sourceText) {
    const state = {
        sourceFile: ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true),
        imports: []
    };
    const visit = (node, scope) => {
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
        ts.forEachChild(node, (child) => visit(child, scope));
    };
    visit(state.sourceFile, (0, import_provenance_1.createBindingScope)());
    return state.imports;
}
//# sourceMappingURL=import-collector.js.map