"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateGovernance = evaluateGovernance;
exports.generateGovernancePlan = generateGovernancePlan;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
function createBindingScope(parent) {
    return parent ? { bindings: new Map(), parent } : { bindings: new Map() };
}
function stringLikeModuleSpecifier(argument) {
    if (!argument) {
        return undefined;
    }
    if (typescript_1.default.isStringLiteral(argument) || typescript_1.default.isNoSubstitutionTemplateLiteral(argument)) {
        return argument.text;
    }
    return undefined;
}
function unwrapExpression(expression) {
    let current = expression;
    while (current
        && (typescript_1.default.isParenthesizedExpression(current)
            || typescript_1.default.isAsExpression(current)
            || typescript_1.default.isTypeAssertionExpression(current)
            || typescript_1.default.isNonNullExpression(current))) {
        current = current.expression;
    }
    return current;
}
function lookupRequireLike(scope, name) {
    let current = scope;
    while (current) {
        if (current.bindings.has(name)) {
            return current.bindings.get(name);
        }
        current = current.parent;
    }
    return name === 'require';
}
function assignBinding(scope, name, requireLike) {
    let current = scope;
    while (current) {
        if (current.bindings.has(name)) {
            current.bindings.set(name, requireLike);
            return;
        }
        current = current.parent;
    }
    if (name !== 'require') {
        scope.bindings.set(name, requireLike);
    }
}
function declareBindingName(name, requireLike, scope) {
    if (typescript_1.default.isIdentifier(name)) {
        scope.bindings.set(name.text, requireLike);
        return;
    }
    for (const element of name.elements) {
        if (typescript_1.default.isBindingElement(element)) {
            declareBindingName(element.name, false, scope);
        }
    }
}
function declareImportBindings(node, scope) {
    const clause = node.importClause;
    if (!clause) {
        return;
    }
    if (clause.name) {
        scope.bindings.set(clause.name.text, false);
    }
    if (!clause.namedBindings) {
        return;
    }
    if (typescript_1.default.isNamespaceImport(clause.namedBindings)) {
        scope.bindings.set(clause.namedBindings.name.text, false);
        return;
    }
    for (const specifier of clause.namedBindings.elements) {
        scope.bindings.set(specifier.name.text, false);
    }
}
function expressionIsRequireLike(expression, scope) {
    const candidate = unwrapExpression(expression);
    return typescript_1.default.isIdentifier(candidate) && lookupRequireLike(scope, candidate.text);
}
function importsForFile(filePath, sourceText) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const imports = [];
    function visitStatements(statements, scope) {
        for (const statement of statements) {
            visit(statement, scope);
        }
    }
    function visitFunctionLike(node, scope) {
        const functionScope = createBindingScope(scope);
        if (node.name && typescript_1.default.isIdentifier(node.name)) {
            functionScope.bindings.set(node.name.text, false);
        }
        for (const parameter of node.parameters ?? []) {
            declareBindingName(parameter.name, false, functionScope);
        }
        for (const parameter of node.parameters ?? []) {
            if (parameter.initializer) {
                visit(parameter.initializer, functionScope);
            }
        }
        if (node.body) {
            visit(node.body, functionScope);
        }
    }
    function visitVariableDeclaration(node, scope) {
        if (node.initializer) {
            visit(node.initializer, scope);
        }
        if (typescript_1.default.isIdentifier(node.name)) {
            scope.bindings.set(node.name.text, node.initializer ? expressionIsRequireLike(node.initializer, scope) : false);
            return;
        }
        declareBindingName(node.name, false, scope);
    }
    function visit(node, scope) {
        if (!node) {
            return;
        }
        if (typescript_1.default.isSourceFile(node) || typescript_1.default.isModuleBlock(node)) {
            visitStatements(node.statements, scope);
            return;
        }
        if (typescript_1.default.isBlock(node)) {
            visitStatements(node.statements, createBindingScope(scope));
            return;
        }
        if (typescript_1.default.isCaseBlock(node)) {
            const caseScope = createBindingScope(scope);
            for (const clause of node.clauses) {
                visit(clause, caseScope);
            }
            return;
        }
        if (typescript_1.default.isCaseClause(node)) {
            visit(node.expression, scope);
            visitStatements(node.statements, scope);
            return;
        }
        if (typescript_1.default.isDefaultClause(node)) {
            visitStatements(node.statements, scope);
            return;
        }
        if (typescript_1.default.isImportDeclaration(node)) {
            const specifier = stringLikeModuleSpecifier(node.moduleSpecifier);
            if (typeof specifier === 'string') {
                imports.push({
                    kind: 'static',
                    specifier,
                    expressionText: node.moduleSpecifier.getText(sourceFile),
                    resolvable: true
                });
            }
            declareImportBindings(node, scope);
            return;
        }
        if (typescript_1.default.isImportEqualsDeclaration(node)) {
            scope.bindings.set(node.name.text, false);
            if (typescript_1.default.isExternalModuleReference(node.moduleReference)) {
                const specifier = stringLikeModuleSpecifier(node.moduleReference.expression);
                if (typeof specifier === 'string') {
                    imports.push({
                        kind: 'static',
                        specifier,
                        expressionText: node.moduleReference.expression.getText(sourceFile),
                        resolvable: true
                    });
                }
            }
            return;
        }
        if (typescript_1.default.isExportDeclaration(node)) {
            const specifier = stringLikeModuleSpecifier(node.moduleSpecifier);
            if (typeof specifier === 'string') {
                imports.push({
                    kind: 'static',
                    specifier,
                    expressionText: node.moduleSpecifier.getText(sourceFile),
                    resolvable: true
                });
            }
            return;
        }
        if (typescript_1.default.isFunctionDeclaration(node)) {
            if (node.name) {
                scope.bindings.set(node.name.text, false);
            }
            visitFunctionLike(node, scope);
            return;
        }
        if (typescript_1.default.isFunctionExpression(node)
            || typescript_1.default.isArrowFunction(node)
            || typescript_1.default.isMethodDeclaration(node)
            || typescript_1.default.isGetAccessorDeclaration(node)
            || typescript_1.default.isSetAccessorDeclaration(node)
            || typescript_1.default.isConstructorDeclaration(node)) {
            visitFunctionLike(node, scope);
            return;
        }
        if (typescript_1.default.isClassDeclaration(node)) {
            if (node.name) {
                scope.bindings.set(node.name.text, false);
            }
            typescript_1.default.forEachChild(node, (child) => visit(child, scope));
            return;
        }
        if (typescript_1.default.isVariableStatement(node)) {
            for (const declaration of node.declarationList.declarations) {
                visitVariableDeclaration(declaration, scope);
            }
            return;
        }
        if (typescript_1.default.isVariableDeclaration(node)) {
            visitVariableDeclaration(node, scope);
            return;
        }
        if (typescript_1.default.isForStatement(node)) {
            const loopScope = createBindingScope(scope);
            visit(node.initializer, loopScope);
            visit(node.condition, loopScope);
            visit(node.incrementor, loopScope);
            visit(node.statement, loopScope);
            return;
        }
        if (typescript_1.default.isForInStatement(node) || typescript_1.default.isForOfStatement(node)) {
            const loopScope = createBindingScope(scope);
            visit(node.initializer, loopScope);
            visit(node.expression, loopScope);
            visit(node.statement, loopScope);
            return;
        }
        if (typescript_1.default.isCatchClause(node)) {
            const catchScope = createBindingScope(scope);
            if (node.variableDeclaration) {
                declareBindingName(node.variableDeclaration.name, false, catchScope);
            }
            visit(node.block, catchScope);
            return;
        }
        if (typescript_1.default.isBinaryExpression(node) && node.operatorToken.kind === typescript_1.default.SyntaxKind.EqualsToken) {
            visit(node.right, scope);
            if (typescript_1.default.isIdentifier(node.left)) {
                assignBinding(scope, node.left.text, expressionIsRequireLike(node.right, scope));
            }
            else {
                visit(node.left, scope);
            }
            return;
        }
        if (typescript_1.default.isCallExpression(node)) {
            if (node.arguments.length === 1 && expressionIsRequireLike(node.expression, scope)) {
                const argument = node.arguments[0];
                const specifier = stringLikeModuleSpecifier(argument);
                imports.push({
                    kind: 'require',
                    ...(typeof specifier === 'string' ? { specifier } : {}),
                    expressionText: argument.getText(sourceFile),
                    resolvable: typeof specifier === 'string'
                });
            }
            if (node.expression.kind === typescript_1.default.SyntaxKind.ImportKeyword && node.arguments.length === 1) {
                const argument = node.arguments[0];
                const specifier = stringLikeModuleSpecifier(argument);
                imports.push({
                    kind: 'dynamic-import',
                    ...(typeof specifier === 'string' ? { specifier } : {}),
                    expressionText: argument.getText(sourceFile),
                    resolvable: typeof specifier === 'string'
                });
            }
        }
        typescript_1.default.forEachChild(node, (child) => visit(child, scope));
    }
    visit(sourceFile, createBindingScope());
    return imports;
}
function resolveImport(importerPath, specifier, rootDir) {
    return (0, index_1.resolveRepoImport)(rootDir, importerPath, specifier);
}
function evaluateBoundaryRule(rootDir, rule, changedFiles) {
    if (rule.kind !== 'boundary') {
        return [];
    }
    const findings = [];
    for (const filePath of changedFiles) {
        if (!(0, index_1.matchesAny)(rule.from, filePath)) {
            continue;
        }
        const absolutePath = path_1.default.join(rootDir, filePath);
        if (!fs_1.default.existsSync(absolutePath)) {
            continue;
        }
        const imports = importsForFile(filePath, fs_1.default.readFileSync(absolutePath, 'utf8'));
        for (const reference of imports) {
            if (!reference.resolvable) {
                findings.push({
                    id: `${rule.id}:${filePath}:opaque:${reference.kind}:${reference.expressionText}`,
                    ruleId: rule.id,
                    level: rule.severity ?? 'error',
                    message: rule.message,
                    evidence: [`${filePath} uses ${reference.kind} with non-literal specifier ${reference.expressionText}; governance cannot prove the target stays outside ${rule.to.join(', ')}.`],
                    scope: [filePath]
                });
                continue;
            }
            const resolved = resolveImport(filePath, reference.specifier, rootDir);
            if (resolved && (0, index_1.matchesAny)(rule.to, resolved)) {
                findings.push({
                    id: `${rule.id}:${filePath}:${resolved}`,
                    ruleId: rule.id,
                    level: rule.severity ?? 'error',
                    message: rule.message,
                    evidence: [`${filePath} imports ${reference.specifier} -> ${resolved}`],
                    scope: [filePath, resolved]
                });
            }
        }
    }
    return findings;
}
function evaluateRiskRule(rule, options) {
    const findings = [];
    const files = options.changedFiles.filter((filePath) => (0, index_1.matchesAny)(rule.paths, filePath));
    if (files.length === 0 || !options.run) {
        return findings;
    }
    const changedComplexity = options.run.complexity.filter((item) => files.includes(item.filePath) && item.changed);
    const maxCrap = changedComplexity.reduce((max, item) => Math.max(max, item.crap), 0);
    const mutationSummary = (0, index_1.summarizeMutationScore)(options.run.mutations.filter((item) => files.includes(item.filePath)));
    const mutationScore = mutationSummary.score;
    if (typeof rule.maxCrap === 'number' && maxCrap > rule.maxCrap) {
        findings.push({
            id: `${rule.id}:crap`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: [`Max changed CRAP ${maxCrap} exceeded budget ${rule.maxCrap}`],
            scope: files
        });
    }
    if (typeof rule.minMutationScore === 'number' && !mutationSummary.measured) {
        findings.push({
            id: `${rule.id}:mutation-missing`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: ['Mutation score unavailable because no killed or surviving mutants were measured for the scoped files.'],
            scope: files
        });
    }
    else if (typeof rule.minMutationScore === 'number' && mutationScore < rule.minMutationScore) {
        findings.push({
            id: `${rule.id}:mutation`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: [`Mutation score ${mutationScore.toFixed(2)} below budget ${rule.minMutationScore.toFixed(2)}`],
            scope: files
        });
    }
    if (typeof rule.minMergeConfidence === 'number' && options.run.verdict.mergeConfidence < rule.minMergeConfidence) {
        findings.push({
            id: `${rule.id}:confidence`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: [`Merge confidence ${options.run.verdict.mergeConfidence} below minimum ${rule.minMergeConfidence}`],
            scope: files
        });
    }
    return findings;
}
function approvalTargetsRuleOrRun(approval, ruleId, runId) {
    return approval.targetId === ruleId || (runId ? approval.targetId === runId || approval.targetId === `${runId}:${ruleId}` : false);
}
function evaluateApprovalRule(rule, options) {
    const files = options.changedFiles.filter((filePath) => (0, index_1.matchesAny)(rule.paths, filePath));
    if (files.length === 0) {
        return [];
    }
    const runId = options.runId;
    const approvals = options.approvals ?? [];
    const accepted = new Map();
    for (const approval of approvals) {
        const roleMatches = rule.roles.length === 0 || rule.roles.includes(approval.role ?? '');
        const targetMatches = approvalTargetsRuleOrRun(approval, rule.id, runId);
        if (!roleMatches || !targetMatches || accepted.has(approval.by)) {
            continue;
        }
        accepted.set(approval.by, approval);
    }
    if (accepted.size >= rule.minApprovals) {
        return [];
    }
    return [{
            id: `${rule.id}:approval`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: [`Approvals present ${accepted.size}/${rule.minApprovals}; roles required: ${rule.roles.join(', ') || 'any'}; target must match ${rule.id}${runId ? ` or ${runId}` : ''}`],
            scope: files
        }];
}
function evaluateOwnershipRule(rule, options) {
    const files = options.changedFiles.filter((filePath) => (0, index_1.matchesAny)(rule.paths, filePath));
    if (files.length === 0) {
        return [];
    }
    const approvals = options.approvals ?? [];
    const accepted = new Map();
    for (const approval of approvals) {
        const targetMatches = approvalTargetsRuleOrRun(approval, rule.id, options.runId);
        const approvedByOwner = approval.by === rule.owner || approval.role === rule.owner || approval.standing === rule.owner;
        const approvedByAllowedAgent = (rule.allowedAgents ?? []).includes(approval.by);
        if (!targetMatches || (!approvedByOwner && !approvedByAllowedAgent) || accepted.has(approval.by)) {
            continue;
        }
        accepted.set(approval.by, approval);
    }
    if (accepted.size > 0) {
        return [];
    }
    return [{
            id: `${rule.id}:ownership`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: [`No ownership approval recorded for owner ${rule.owner}${(rule.allowedAgents ?? []).length > 0 ? ` or allowed agents ${rule.allowedAgents?.join(', ')}` : ''}; target must match ${rule.id}${options.runId ? ` or ${options.runId}` : ''}`],
            scope: files
        }];
}
function evaluateRollbackRule(rule, options) {
    const files = options.changedFiles.filter((filePath) => (0, index_1.matchesAny)(rule.paths, filePath));
    if (files.length === 0) {
        return [];
    }
    const claims = new Set(options.attestationsClaims ?? []);
    const missing = rule.requireEvidence.filter((claim) => !claims.has(claim));
    if (missing.length === 0) {
        return [];
    }
    return [{
            id: `${rule.id}:rollback`,
            ruleId: rule.id,
            level: rule.severity ?? 'error',
            message: rule.message,
            evidence: [`Missing required evidence claims: ${missing.join(', ')}`],
            scope: files
        }];
}
function evaluateGovernance(options) {
    const changedFiles = options.changedFiles.map((item) => (0, index_1.normalizePath)(item));
    const findings = [];
    for (const rule of options.constitution) {
        if (rule.kind === 'boundary') {
            findings.push(...evaluateBoundaryRule(options.rootDir, rule, changedFiles));
        }
        if (rule.kind === 'risk') {
            findings.push(...evaluateRiskRule(rule, { ...options, changedFiles }));
        }
        if (rule.kind === 'approval') {
            findings.push(...evaluateApprovalRule(rule, { ...options, changedFiles }));
        }
        if (rule.kind === 'rollback') {
            findings.push(...evaluateRollbackRule(rule, { ...options, changedFiles }));
        }
        if (rule.kind === 'ownership') {
            findings.push(...evaluateOwnershipRule(rule, { ...options, changedFiles }));
        }
    }
    return findings;
}
function generateGovernancePlan(run, constitution, agents) {
    const steps = [];
    const approvalsRequired = constitution.filter((rule) => rule.kind === 'approval' && run.changedFiles.some((filePath) => (0, index_1.matchesAny)(rule.paths, filePath)));
    const rollbackRules = constitution.filter((rule) => rule.kind === 'rollback' && run.changedFiles.some((filePath) => (0, index_1.matchesAny)(rule.paths, filePath)));
    const riskRules = constitution.filter((rule) => rule.kind === 'risk' && run.changedFiles.some((filePath) => (0, index_1.matchesAny)(rule.paths, filePath)));
    const ownershipRules = constitution.filter((rule) => rule.kind === 'ownership' && run.changedFiles.some((filePath) => (0, index_1.matchesAny)(rule.paths, filePath)));
    const survivingMutants = run.mutations.filter((result) => result.status === 'survived');
    if (survivingMutants.length > 0) {
        steps.push({
            type: 'test',
            title: 'Tighten tests around surviving mutants',
            rationale: 'Surviving mutants show behavior that current tests do not constrain.',
            evidence: survivingMutants.map((result) => `${result.filePath}:${result.siteId}`),
            tradeoffs: ['Improves merge confidence', 'May increase test runtime slightly']
        });
    }
    for (const rule of approvalsRequired) {
        const approvers = agents.filter((agent) => agent.kind === 'human' && agent.roles.some((role) => rule.roles.includes(role))).map((agent) => agent.id);
        steps.push({
            type: 'approval',
            title: `Obtain ${rule.minApprovals} approval(s) for ${rule.id}`,
            rationale: rule.message,
            evidence: [`Eligible approvers: ${approvers.join(', ') || 'none configured'}`],
            tradeoffs: ['Slows merge velocity', 'Protects high-sensitivity domains']
        });
    }
    for (const rule of rollbackRules) {
        steps.push({
            type: 'rollback',
            title: `Attach rollback evidence for ${rule.id}`,
            rationale: rule.message,
            evidence: rule.requireEvidence,
            tradeoffs: ['Adds CI or operational work', 'Preserves safe rollback authority']
        });
    }
    for (const rule of riskRules) {
        steps.push({
            type: 'risk',
            title: `Reduce risk budget pressure for ${rule.id}`,
            rationale: rule.message,
            evidence: [
                `Current merge confidence: ${run.verdict.mergeConfidence}`,
                `Current outcome: ${run.verdict.outcome}`
            ],
            tradeoffs: ['May require refactoring or more tests', 'Reduces policy exceptions later']
        });
    }
    for (const rule of ownershipRules) {
        steps.push({
            type: 'ownership',
            title: `Obtain owner approval for ${rule.id}`,
            rationale: rule.message,
            evidence: [`Owner: ${rule.owner}`, ...(rule.allowedAgents ?? []).map((agentId) => `Allowed agent: ${agentId}`)],
            tradeoffs: ['May require owner coordination', 'Preserves path-level accountability']
        });
    }
    const boundaryFindings = run.governance.filter((finding) => constitution.some((rule) => rule.kind === 'boundary' && rule.id === finding.ruleId));
    if (boundaryFindings.length > 0) {
        steps.push({
            type: 'boundary',
            title: 'Remove or isolate forbidden boundary crossings',
            rationale: 'Architectural drift weakens constitutional guarantees over time.',
            evidence: boundaryFindings.flatMap((finding) => finding.evidence),
            tradeoffs: ['May require adapter layers', 'Prevents hidden coupling growth']
        });
    }
    return {
        summary: `Generated ${steps.length} governance step(s) from ${run.governance.length} finding(s) and ${run.mutations.length} mutation result(s).`,
        steps
    };
}
//# sourceMappingURL=index.js.map