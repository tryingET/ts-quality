import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { type Agent, type ConstitutionRule, type InvariantSpec, type OverrideRecord, type Waiver, type Approval, DEFAULT_SOURCE_PATTERNS, DEFAULT_TEST_PATTERNS, parseUnifiedDiff, readJson, resolveRepoLocalPath } from '../../evidence-model/src/index';

export interface TsQualityConfig {
  version?: string;
  sourcePatterns?: string[];
  testPatterns?: string[];
  coverage?: {
    lcovPath?: string;
  };
  mutations?: {
    testCommand: string[];
    coveredOnly?: boolean;
    timeoutMs?: number;
    maxSites?: number;
    runtimeMirrorRoots?: string[];
  };
  policy?: {
    maxChangedCrap?: number;
    minMutationScore?: number;
    minMergeConfidence?: number;
  };
  changeSet?: {
    files?: string[];
    diffFile?: string;
  };
  invariantsPath?: string;
  constitutionPath?: string;
  agentsPath?: string;
  approvalsPath?: string;
  waiversPath?: string;
  overridesPath?: string;
  attestationsDir?: string;
  trustedKeysDir?: string;
}

export interface LoadedContext {
  rootDir: string;
  configPath: string;
  config: Required<TsQualityConfig>;
}

function parsePropertyName(name: any, sourceFile: any, bindings: Map<string, unknown>): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const computed = evaluateDataExpression(name.expression, sourceFile, bindings);
    if (typeof computed === 'string' || typeof computed === 'number') {
      return String(computed);
    }
  }
  throw new Error(`Unsupported property name in data-only module: ${name.getText(sourceFile)}`);
}

function evaluateDataExpression(expression: any, sourceFile: any, bindings: Map<string, unknown>): unknown {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return evaluateDataExpression(expression.expression, sourceFile, bindings);
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }
  if (ts.isPrefixUnaryExpression(expression)) {
    const operand = evaluateDataExpression(expression.operand, sourceFile, bindings);
    if (typeof operand !== 'number') {
      throw new Error(`Unsupported unary operand in data-only module: ${expression.getText(sourceFile)}`);
    }
    if (expression.operator === ts.SyntaxKind.MinusToken) {
      return -operand;
    }
    if (expression.operator === ts.SyntaxKind.PlusToken) {
      return operand;
    }
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element: any) => {
      if (ts.isSpreadElement(element)) {
        const spreadValue = evaluateDataExpression(element.expression, sourceFile, bindings);
        if (!Array.isArray(spreadValue)) {
          throw new Error(`Array spread must resolve to an array in data-only module: ${element.getText(sourceFile)}`);
        }
        return spreadValue;
      }
      return evaluateDataExpression(element, sourceFile, bindings);
    }).flat();
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const result: Record<string, unknown> = {};
    for (const property of expression.properties) {
      if (ts.isPropertyAssignment(property)) {
        result[parsePropertyName(property.name, sourceFile, bindings)] = evaluateDataExpression(property.initializer, sourceFile, bindings);
        continue;
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        const binding = bindings.get(property.name.text);
        if (binding === undefined && !bindings.has(property.name.text)) {
          throw new Error(`Unknown shorthand binding in data-only module: ${property.name.text}`);
        }
        result[property.name.text] = binding;
        continue;
      }
      if (ts.isSpreadAssignment(property)) {
        const spreadValue = evaluateDataExpression(property.expression, sourceFile, bindings);
        if (!spreadValue || typeof spreadValue !== 'object' || Array.isArray(spreadValue)) {
          throw new Error(`Object spread must resolve to an object in data-only module: ${property.getText(sourceFile)}`);
        }
        Object.assign(result, spreadValue);
        continue;
      }
      throw new Error(`Unsupported object property in data-only module: ${property.getText(sourceFile)}`);
    }
    return result;
  }
  if (ts.isIdentifier(expression)) {
    if (expression.text === 'undefined') {
      return undefined;
    }
    if (bindings.has(expression.text)) {
      return bindings.get(expression.text);
    }
    throw new Error(`Unknown identifier in data-only module: ${expression.text}`);
  }
  throw new Error(`Unsupported expression in data-only module: ${expression.getText(sourceFile)}`);
}

function exportsAssignment(statement: any, sourceFile: any): any {
  if (!ts.isExpressionStatement(statement) || !ts.isBinaryExpression(statement.expression)) {
    return undefined;
  }
  const assignment = statement.expression;
  if (assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
    return undefined;
  }
  const left = assignment.left;
  if (ts.isPropertyAccessExpression(left)) {
    if (left.expression.getText(sourceFile) === 'module' && left.name.text === 'exports') {
      return assignment.right;
    }
    if (left.expression.getText(sourceFile) === 'exports' && left.name.text === 'default') {
      return assignment.right;
    }
  }
  return undefined;
}

function parseDataModule(filePath: string): unknown {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const bindings = new Map<string, unknown>();
  let exportedValue: unknown;

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
      if (!isConst) {
        throw new Error(`Only const declarations are supported in data-only modules: ${filePath}`);
      }
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          throw new Error(`Unsupported declaration in data-only module: ${declaration.getText(sourceFile)}`);
        }
        bindings.set(declaration.name.text, evaluateDataExpression(declaration.initializer, sourceFile, bindings));
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      exportedValue = evaluateDataExpression(statement.expression, sourceFile, bindings);
      continue;
    }
    const assignmentExport = exportsAssignment(statement, sourceFile);
    if (assignmentExport) {
      exportedValue = evaluateDataExpression(assignmentExport, sourceFile, bindings);
      continue;
    }
    if (ts.isEmptyStatement(statement)) {
      continue;
    }
    throw new Error(`Unsupported statement in data-only module ${filePath}: ${statement.getText(sourceFile)}`);
  }

  if (exportedValue === undefined) {
    throw new Error(`Data-only module must export a literal value: ${filePath}`);
  }

  return exportedValue;
}

export function loadModuleFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  if (filePath.endsWith('.json')) {
    return readJson<T>(filePath);
  }
  if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
    return parseDataModule(filePath) as T;
  }
  throw new Error(`Unsupported file type for ${filePath}`);
}

function validateStringArray(name: string, value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be an array of strings`);
  }
  return value as string[];
}

function validateConfig(raw: TsQualityConfig): Required<TsQualityConfig> {
  const sourcePatterns = validateStringArray('sourcePatterns', raw.sourcePatterns) ?? [...DEFAULT_SOURCE_PATTERNS];
  const testPatterns = validateStringArray('testPatterns', raw.testPatterns) ?? [...DEFAULT_TEST_PATTERNS];
  const changeFiles = validateStringArray('changeSet.files', raw.changeSet?.files) ?? [];
  const mutationCommand = validateStringArray('mutations.testCommand', raw.mutations?.testCommand) ?? ['node', '--test'];
  const runtimeMirrorRoots = validateStringArray('mutations.runtimeMirrorRoots', raw.mutations?.runtimeMirrorRoots) ?? ['dist'];
  return {
    version: raw.version ?? '5',
    sourcePatterns,
    testPatterns,
    coverage: {
      lcovPath: raw.coverage?.lcovPath ?? 'coverage/lcov.info'
    },
    mutations: {
      testCommand: mutationCommand,
      coveredOnly: raw.mutations?.coveredOnly ?? false,
      timeoutMs: raw.mutations?.timeoutMs ?? 15_000,
      maxSites: raw.mutations?.maxSites ?? 25,
      runtimeMirrorRoots
    },
    policy: {
      maxChangedCrap: raw.policy?.maxChangedCrap ?? 30,
      minMutationScore: raw.policy?.minMutationScore ?? 0.8,
      minMergeConfidence: raw.policy?.minMergeConfidence ?? 70
    },
    changeSet: {
      files: changeFiles,
      diffFile: raw.changeSet?.diffFile ?? ''
    },
    invariantsPath: raw.invariantsPath ?? '.ts-quality/invariants.ts',
    constitutionPath: raw.constitutionPath ?? '.ts-quality/constitution.ts',
    agentsPath: raw.agentsPath ?? '.ts-quality/agents.ts',
    approvalsPath: raw.approvalsPath ?? '.ts-quality/approvals.json',
    waiversPath: raw.waiversPath ?? '.ts-quality/waivers.json',
    overridesPath: raw.overridesPath ?? '.ts-quality/overrides.json',
    attestationsDir: raw.attestationsDir ?? '.ts-quality/attestations',
    trustedKeysDir: raw.trustedKeysDir ?? '.ts-quality/keys'
  };
}

function canonicalRepoPath(rootDir: string, candidate: string, kind: string): string {
  return resolveRepoLocalPath(rootDir, candidate, { allowMissing: true, kind }).relativePath;
}

function canonicalRepoPathArray(rootDir: string, values: string[], kind: string): string[] {
  return values.map((value) => canonicalRepoPath(rootDir, value, kind));
}

function canonicalizeConfigPaths(rootDir: string, config: Required<TsQualityConfig>): Required<TsQualityConfig> {
  const coverageLcovPath = config.coverage.lcovPath ?? 'coverage/lcov.info';
  const runtimeMirrorRoots = config.mutations.runtimeMirrorRoots ?? ['dist'];
  const changeSetFiles = config.changeSet.files ?? [];
  const diffFile = config.changeSet.diffFile ?? '';
  const invariantsPath = config.invariantsPath ?? '.ts-quality/invariants.ts';
  const constitutionPath = config.constitutionPath ?? '.ts-quality/constitution.ts';
  const agentsPath = config.agentsPath ?? '.ts-quality/agents.ts';
  const approvalsPath = config.approvalsPath ?? '.ts-quality/approvals.json';
  const waiversPath = config.waiversPath ?? '.ts-quality/waivers.json';
  const overridesPath = config.overridesPath ?? '.ts-quality/overrides.json';
  const attestationsDir = config.attestationsDir ?? '.ts-quality/attestations';
  const trustedKeysDir = config.trustedKeysDir ?? '.ts-quality/keys';

  return {
    ...config,
    coverage: {
      ...config.coverage,
      lcovPath: canonicalRepoPath(rootDir, coverageLcovPath, 'coverage lcovPath')
    },
    mutations: {
      ...config.mutations,
      runtimeMirrorRoots: canonicalRepoPathArray(rootDir, runtimeMirrorRoots, 'mutation runtime mirror root')
    },
    changeSet: {
      ...config.changeSet,
      files: canonicalRepoPathArray(rootDir, changeSetFiles, 'changeSet file'),
      diffFile: diffFile ? canonicalRepoPath(rootDir, diffFile, 'diff file') : ''
    },
    invariantsPath: canonicalRepoPath(rootDir, invariantsPath, 'invariants path'),
    constitutionPath: canonicalRepoPath(rootDir, constitutionPath, 'constitution path'),
    agentsPath: canonicalRepoPath(rootDir, agentsPath, 'agents path'),
    approvalsPath: canonicalRepoPath(rootDir, approvalsPath, 'approvals path'),
    waiversPath: canonicalRepoPath(rootDir, waiversPath, 'waivers path'),
    overridesPath: canonicalRepoPath(rootDir, overridesPath, 'overrides path'),
    attestationsDir: canonicalRepoPath(rootDir, attestationsDir, 'attestations dir'),
    trustedKeysDir: canonicalRepoPath(rootDir, trustedKeysDir, 'trusted keys dir')
  };
}

export function findConfigPath(rootDir: string): string {
  for (const candidate of ['ts-quality.config.ts', 'ts-quality.config.js', 'ts-quality.config.mjs', 'ts-quality.config.cjs', 'ts-quality.config.json']) {
    const filePath = path.join(rootDir, candidate);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  throw new Error(`No ts-quality config found in ${rootDir}`);
}

export function loadContext(rootDir: string, explicitConfigPath?: string): LoadedContext {
  const configPath = explicitConfigPath
    ? resolveRepoLocalPath(rootDir, explicitConfigPath, { kind: 'config path' }).absolutePath
    : findConfigPath(rootDir);
  const config = canonicalizeConfigPaths(rootDir, validateConfig(loadModuleFile<TsQualityConfig>(configPath)));
  return { rootDir, configPath, config };
}

function loadOptionalRepoModule<T>(rootDir: string, repoPath: string, kind: string): T[] {
  const filePath = resolveRepoLocalPath(rootDir, repoPath, { allowMissing: true, kind }).absolutePath;
  return fs.existsSync(filePath) ? loadModuleFile<T[]>(filePath) : [];
}

export function loadInvariants(rootDir: string, relativePath: string): InvariantSpec[] {
  return loadOptionalRepoModule<InvariantSpec>(rootDir, relativePath, 'invariants path');
}

export function loadConstitution(rootDir: string, relativePath: string): ConstitutionRule[] {
  return loadOptionalRepoModule<ConstitutionRule>(rootDir, relativePath, 'constitution path');
}

export function loadAgents(rootDir: string, relativePath: string): Agent[] {
  return loadOptionalRepoModule<Agent>(rootDir, relativePath, 'agents path');
}

export function loadWaivers(rootDir: string, relativePath: string): Waiver[] {
  return loadOptionalRepoModule<Waiver>(rootDir, relativePath, 'waivers path');
}

export function loadApprovals(rootDir: string, relativePath: string): Approval[] {
  return loadOptionalRepoModule<Approval>(rootDir, relativePath, 'approvals path');
}

export function loadOverrides(rootDir: string, relativePath: string): OverrideRecord[] {
  return loadOptionalRepoModule<OverrideRecord>(rootDir, relativePath, 'overrides path');
}

export function loadChangedRegions(rootDir: string, diffFileRelative: string): ReturnType<typeof parseUnifiedDiff> {
  if (!diffFileRelative) {
    return [];
  }
  const filePath = resolveRepoLocalPath(rootDir, diffFileRelative, { allowMissing: true, kind: 'diff file' }).absolutePath;
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return parseUnifiedDiff(fs.readFileSync(filePath, 'utf8'));
}
