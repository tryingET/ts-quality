import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import {
  type Agent,
  type Approval,
  type ApprovalRule,
  type ChangedRegion,
  type ConstitutionRule,
  type GovernanceFinding,
  type OwnershipRule,
  type RiskBudgetRule,
  type RollbackRule,
  type RunArtifact,
  matchPattern,
  matchesAny,
  normalizePath,
  resolveRepoImport,
  summarizeMutationScore
} from '../../evidence-model/src/index';

export interface GovernanceEvaluationOptions {
  rootDir: string;
  constitution: ConstitutionRule[];
  changedFiles: string[];
  changedRegions: ChangedRegion[];
  approvals?: Approval[];
  attestationsClaims?: string[];
  run?: Pick<RunArtifact, 'complexity' | 'mutations' | 'verdict'>;
  runId?: string;
}

export interface GovernancePlan {
  summary: string;
  steps: Array<{
    type: 'test' | 'approval' | 'rollback' | 'boundary' | 'risk' | 'ownership';
    title: string;
    rationale: string;
    evidence: string[];
    tradeoffs: string[];
  }>;
}

interface ImportReference {
  kind: 'static' | 'require' | 'dynamic-import';
  specifier?: string;
  expressionText: string;
  resolvable: boolean;
}

interface BindingScope {
  bindings: Map<string, boolean>;
  parent?: BindingScope;
}

function createBindingScope(parent?: BindingScope): BindingScope {
  return parent ? { bindings: new Map(), parent } : { bindings: new Map() };
}

function stringLikeModuleSpecifier(argument: any): string | undefined {
  if (!argument) {
    return undefined;
  }
  if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
    return argument.text;
  }
  return undefined;
}

function unwrapExpression(expression: any): any {
  let current = expression;
  while (
    current
    && (ts.isParenthesizedExpression(current)
      || ts.isAsExpression(current)
      || ts.isTypeAssertionExpression(current)
      || ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function lookupRequireLike(scope: BindingScope, name: string): boolean {
  let current: BindingScope | undefined = scope;
  while (current) {
    if (current.bindings.has(name)) {
      return current.bindings.get(name)!;
    }
    current = current.parent;
  }
  return name === 'require';
}

function assignBinding(scope: BindingScope, name: string, requireLike: boolean): void {
  let current: BindingScope | undefined = scope;
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

function declareBindingName(name: any, requireLike: boolean, scope: BindingScope): void {
  if (ts.isIdentifier(name)) {
    scope.bindings.set(name.text, requireLike);
    return;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      declareBindingName(element.name, false, scope);
    }
  }
}

function declareImportBindings(node: any, scope: BindingScope): void {
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
  if (ts.isNamespaceImport(clause.namedBindings)) {
    scope.bindings.set(clause.namedBindings.name.text, false);
    return;
  }
  for (const specifier of clause.namedBindings.elements) {
    scope.bindings.set(specifier.name.text, false);
  }
}

function expressionIsRequireLike(expression: any, scope: BindingScope): boolean {
  const candidate = unwrapExpression(expression);
  return ts.isIdentifier(candidate) && lookupRequireLike(scope, candidate.text);
}

function importsForFile(filePath: string, sourceText: string): ImportReference[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const imports: ImportReference[] = [];

  function visitStatements(statements: any, scope: BindingScope): void {
    for (const statement of statements) {
      visit(statement, scope);
    }
  }

  function visitFunctionLike(node: any, scope: BindingScope): void {
    const functionScope = createBindingScope(scope);
    if (node.name && ts.isIdentifier(node.name)) {
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

  function visitVariableDeclaration(node: any, scope: BindingScope): void {
    if (node.initializer) {
      visit(node.initializer, scope);
    }
    if (ts.isIdentifier(node.name)) {
      scope.bindings.set(node.name.text, node.initializer ? expressionIsRequireLike(node.initializer, scope) : false);
      return;
    }
    declareBindingName(node.name, false, scope);
  }

  function visit(node: any, scope: BindingScope): void {
    if (!node) {
      return;
    }
    if (ts.isSourceFile(node) || ts.isModuleBlock(node)) {
      visitStatements(node.statements, scope);
      return;
    }
    if (ts.isBlock(node)) {
      visitStatements(node.statements, createBindingScope(scope));
      return;
    }
    if (ts.isCaseBlock(node)) {
      const caseScope = createBindingScope(scope);
      for (const clause of node.clauses) {
        visit(clause, caseScope);
      }
      return;
    }
    if (ts.isCaseClause(node)) {
      visit(node.expression, scope);
      visitStatements(node.statements, scope);
      return;
    }
    if (ts.isDefaultClause(node)) {
      visitStatements(node.statements, scope);
      return;
    }
    if (ts.isImportDeclaration(node)) {
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
    if (ts.isImportEqualsDeclaration(node)) {
      scope.bindings.set(node.name.text, false);
      if (ts.isExternalModuleReference(node.moduleReference)) {
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
    if (ts.isExportDeclaration(node)) {
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
    if (ts.isFunctionDeclaration(node)) {
      if (node.name) {
        scope.bindings.set(node.name.text, false);
      }
      visitFunctionLike(node, scope);
      return;
    }
    if (
      ts.isFunctionExpression(node)
      || ts.isArrowFunction(node)
      || ts.isMethodDeclaration(node)
      || ts.isGetAccessorDeclaration(node)
      || ts.isSetAccessorDeclaration(node)
      || ts.isConstructorDeclaration(node)
    ) {
      visitFunctionLike(node, scope);
      return;
    }
    if (ts.isClassDeclaration(node)) {
      if (node.name) {
        scope.bindings.set(node.name.text, false);
      }
      ts.forEachChild(node, (child: any) => visit(child, scope));
      return;
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        visitVariableDeclaration(declaration, scope);
      }
      return;
    }
    if (ts.isVariableDeclaration(node)) {
      visitVariableDeclaration(node, scope);
      return;
    }
    if (ts.isForStatement(node)) {
      const loopScope = createBindingScope(scope);
      visit(node.initializer, loopScope);
      visit(node.condition, loopScope);
      visit(node.incrementor, loopScope);
      visit(node.statement, loopScope);
      return;
    }
    if (ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      const loopScope = createBindingScope(scope);
      visit(node.initializer, loopScope);
      visit(node.expression, loopScope);
      visit(node.statement, loopScope);
      return;
    }
    if (ts.isCatchClause(node)) {
      const catchScope = createBindingScope(scope);
      if (node.variableDeclaration) {
        declareBindingName(node.variableDeclaration.name, false, catchScope);
      }
      visit(node.block, catchScope);
      return;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      visit(node.right, scope);
      if (ts.isIdentifier(node.left)) {
        assignBinding(scope, node.left.text, expressionIsRequireLike(node.right, scope));
      } else {
        visit(node.left, scope);
      }
      return;
    }
    if (ts.isCallExpression(node)) {
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
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1) {
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
    ts.forEachChild(node, (child: any) => visit(child, scope));
  }

  visit(sourceFile, createBindingScope());
  return imports;
}

function resolveImport(importerPath: string, specifier: string, rootDir: string): string | undefined {
  return resolveRepoImport(rootDir, importerPath, specifier);
}

function evaluateBoundaryRule(rootDir: string, rule: ConstitutionRule, changedFiles: string[]): GovernanceFinding[] {
  if (rule.kind !== 'boundary') {
    return [];
  }
  const findings: GovernanceFinding[] = [];
  for (const filePath of changedFiles) {
    if (!matchesAny(rule.from, filePath)) {
      continue;
    }
    const absolutePath = path.join(rootDir, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    const imports = importsForFile(filePath, fs.readFileSync(absolutePath, 'utf8'));
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
      const resolved = resolveImport(filePath, reference.specifier!, rootDir);
      if (resolved && matchesAny(rule.to, resolved)) {
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

function evaluateRiskRule(rule: RiskBudgetRule, options: GovernanceEvaluationOptions): GovernanceFinding[] {
  const findings: GovernanceFinding[] = [];
  const files = options.changedFiles.filter((filePath) => matchesAny(rule.paths, filePath));
  if (files.length === 0 || !options.run) {
    return findings;
  }
  const changedComplexity = options.run.complexity.filter((item) => files.includes(item.filePath) && item.changed);
  const maxCrap = changedComplexity.reduce((max, item) => Math.max(max, item.crap), 0);
  const mutationSummary = summarizeMutationScore(options.run.mutations.filter((item) => files.includes(item.filePath)));
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
  } else if (typeof rule.minMutationScore === 'number' && mutationScore < rule.minMutationScore) {
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

function approvalTargetsRuleOrRun(approval: Approval, ruleId: string, runId?: string): boolean {
  return approval.targetId === ruleId || (runId ? approval.targetId === runId || approval.targetId === `${runId}:${ruleId}` : false);
}

function evaluateApprovalRule(rule: ApprovalRule, options: GovernanceEvaluationOptions): GovernanceFinding[] {
  const files = options.changedFiles.filter((filePath) => matchesAny(rule.paths, filePath));
  if (files.length === 0) {
    return [];
  }
  const runId = options.runId;
  const approvals = options.approvals ?? [];
  const accepted = new Map<string, Approval>();
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

function evaluateOwnershipRule(rule: OwnershipRule, options: GovernanceEvaluationOptions): GovernanceFinding[] {
  const files = options.changedFiles.filter((filePath) => matchesAny(rule.paths, filePath));
  if (files.length === 0) {
    return [];
  }
  const approvals = options.approvals ?? [];
  const accepted = new Map<string, Approval>();
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

function evaluateRollbackRule(rule: RollbackRule, options: GovernanceEvaluationOptions): GovernanceFinding[] {
  const files = options.changedFiles.filter((filePath) => matchesAny(rule.paths, filePath));
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

export function evaluateGovernance(options: GovernanceEvaluationOptions): GovernanceFinding[] {
  const changedFiles = options.changedFiles.map((item) => normalizePath(item));
  const findings: GovernanceFinding[] = [];
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

export function generateGovernancePlan(run: RunArtifact, constitution: ConstitutionRule[], agents: Agent[]): GovernancePlan {
  const steps: GovernancePlan['steps'] = [];
  const approvalsRequired = constitution.filter((rule) => rule.kind === 'approval' && run.changedFiles.some((filePath) => matchesAny(rule.paths, filePath))) as ApprovalRule[];
  const rollbackRules = constitution.filter((rule) => rule.kind === 'rollback' && run.changedFiles.some((filePath) => matchesAny(rule.paths, filePath))) as RollbackRule[];
  const riskRules = constitution.filter((rule) => rule.kind === 'risk' && run.changedFiles.some((filePath) => matchesAny(rule.paths, filePath))) as RiskBudgetRule[];
  const ownershipRules = constitution.filter((rule) => rule.kind === 'ownership' && run.changedFiles.some((filePath) => matchesAny(rule.paths, filePath))) as OwnershipRule[];

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
