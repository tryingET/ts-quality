"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadModuleFile = loadModuleFile;
exports.findConfigPath = findConfigPath;
exports.loadContext = loadContext;
exports.loadInvariants = loadInvariants;
exports.loadConstitution = loadConstitution;
exports.loadAgents = loadAgents;
exports.loadWaivers = loadWaivers;
exports.loadApprovals = loadApprovals;
exports.loadOverrides = loadOverrides;
exports.loadChangedRegions = loadChangedRegions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
function parsePropertyName(name, sourceFile, bindings) {
    if (typescript_1.default.isIdentifier(name) || typescript_1.default.isStringLiteral(name) || typescript_1.default.isNumericLiteral(name)) {
        return name.text;
    }
    if (typescript_1.default.isComputedPropertyName(name)) {
        const computed = evaluateDataExpression(name.expression, sourceFile, bindings);
        if (typeof computed === 'string' || typeof computed === 'number') {
            return String(computed);
        }
    }
    throw new Error(`Unsupported property name in data-only module: ${name.getText(sourceFile)}`);
}
function evaluateDataExpression(expression, sourceFile, bindings) {
    if (typescript_1.default.isParenthesizedExpression(expression) || typescript_1.default.isAsExpression(expression) || typescript_1.default.isSatisfiesExpression(expression) || typescript_1.default.isTypeAssertionExpression(expression)) {
        return evaluateDataExpression(expression.expression, sourceFile, bindings);
    }
    if (typescript_1.default.isStringLiteral(expression) || typescript_1.default.isNoSubstitutionTemplateLiteral(expression)) {
        return expression.text;
    }
    if (typescript_1.default.isNumericLiteral(expression)) {
        return Number(expression.text);
    }
    if (expression.kind === typescript_1.default.SyntaxKind.TrueKeyword) {
        return true;
    }
    if (expression.kind === typescript_1.default.SyntaxKind.FalseKeyword) {
        return false;
    }
    if (expression.kind === typescript_1.default.SyntaxKind.NullKeyword) {
        return null;
    }
    if (typescript_1.default.isPrefixUnaryExpression(expression)) {
        const operand = evaluateDataExpression(expression.operand, sourceFile, bindings);
        if (typeof operand !== 'number') {
            throw new Error(`Unsupported unary operand in data-only module: ${expression.getText(sourceFile)}`);
        }
        if (expression.operator === typescript_1.default.SyntaxKind.MinusToken) {
            return -operand;
        }
        if (expression.operator === typescript_1.default.SyntaxKind.PlusToken) {
            return operand;
        }
    }
    if (typescript_1.default.isArrayLiteralExpression(expression)) {
        return expression.elements.map((element) => {
            if (typescript_1.default.isSpreadElement(element)) {
                const spreadValue = evaluateDataExpression(element.expression, sourceFile, bindings);
                if (!Array.isArray(spreadValue)) {
                    throw new Error(`Array spread must resolve to an array in data-only module: ${element.getText(sourceFile)}`);
                }
                return spreadValue;
            }
            return evaluateDataExpression(element, sourceFile, bindings);
        }).flat();
    }
    if (typescript_1.default.isObjectLiteralExpression(expression)) {
        const result = {};
        for (const property of expression.properties) {
            if (typescript_1.default.isPropertyAssignment(property)) {
                result[parsePropertyName(property.name, sourceFile, bindings)] = evaluateDataExpression(property.initializer, sourceFile, bindings);
                continue;
            }
            if (typescript_1.default.isShorthandPropertyAssignment(property)) {
                const binding = bindings.get(property.name.text);
                if (binding === undefined && !bindings.has(property.name.text)) {
                    throw new Error(`Unknown shorthand binding in data-only module: ${property.name.text}`);
                }
                result[property.name.text] = binding;
                continue;
            }
            if (typescript_1.default.isSpreadAssignment(property)) {
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
    if (typescript_1.default.isIdentifier(expression)) {
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
function exportsAssignment(statement, sourceFile) {
    if (!typescript_1.default.isExpressionStatement(statement) || !typescript_1.default.isBinaryExpression(statement.expression)) {
        return undefined;
    }
    const assignment = statement.expression;
    if (assignment.operatorToken.kind !== typescript_1.default.SyntaxKind.EqualsToken) {
        return undefined;
    }
    const left = assignment.left;
    if (typescript_1.default.isPropertyAccessExpression(left)) {
        if (left.expression.getText(sourceFile) === 'module' && left.name.text === 'exports') {
            return assignment.right;
        }
        if (left.expression.getText(sourceFile) === 'exports' && left.name.text === 'default') {
            return assignment.right;
        }
    }
    return undefined;
}
function parseDataModule(filePath) {
    const sourceText = fs_1.default.readFileSync(filePath, 'utf8');
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const bindings = new Map();
    let exportedValue;
    for (const statement of sourceFile.statements) {
        if (typescript_1.default.isVariableStatement(statement)) {
            const isConst = (statement.declarationList.flags & typescript_1.default.NodeFlags.Const) !== 0;
            if (!isConst) {
                throw new Error(`Only const declarations are supported in data-only modules: ${filePath}`);
            }
            for (const declaration of statement.declarationList.declarations) {
                if (!typescript_1.default.isIdentifier(declaration.name) || !declaration.initializer) {
                    throw new Error(`Unsupported declaration in data-only module: ${declaration.getText(sourceFile)}`);
                }
                bindings.set(declaration.name.text, evaluateDataExpression(declaration.initializer, sourceFile, bindings));
            }
            continue;
        }
        if (typescript_1.default.isExportAssignment(statement)) {
            exportedValue = evaluateDataExpression(statement.expression, sourceFile, bindings);
            continue;
        }
        const assignmentExport = exportsAssignment(statement, sourceFile);
        if (assignmentExport) {
            exportedValue = evaluateDataExpression(assignmentExport, sourceFile, bindings);
            continue;
        }
        if (typescript_1.default.isEmptyStatement(statement)) {
            continue;
        }
        throw new Error(`Unsupported statement in data-only module ${filePath}: ${statement.getText(sourceFile)}`);
    }
    if (exportedValue === undefined) {
        throw new Error(`Data-only module must export a literal value: ${filePath}`);
    }
    return exportedValue;
}
function loadModuleFile(filePath) {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`Required file not found: ${filePath}`);
    }
    if (filePath.endsWith('.json')) {
        return (0, index_1.readJson)(filePath);
    }
    if (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
        return parseDataModule(filePath);
    }
    throw new Error(`Unsupported file type for ${filePath}`);
}
function validateStringArray(name, value) {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`${name} must be an array of strings`);
    }
    return value;
}
function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        if (seen.has(value)) {
            continue;
        }
        seen.add(value);
        result.push(value);
    }
    return result;
}
function validateFiniteNumber(name, value, options = {}) {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${name} must be a finite number`);
    }
    if (typeof options.min === 'number' && value < options.min) {
        throw new Error(`${name} must be >= ${options.min}`);
    }
    if (typeof options.max === 'number' && value > options.max) {
        throw new Error(`${name} must be <= ${options.max}`);
    }
    return value;
}
function validateConfig(raw) {
    const sourcePatterns = validateStringArray('sourcePatterns', raw.sourcePatterns) ?? [...index_1.DEFAULT_SOURCE_PATTERNS];
    const testPatterns = validateStringArray('testPatterns', raw.testPatterns) ?? [...index_1.DEFAULT_TEST_PATTERNS];
    const changeFiles = validateStringArray('changeSet.files', raw.changeSet?.files) ?? [];
    const mutationCommand = validateStringArray('mutations.testCommand', raw.mutations?.testCommand) ?? ['node', '--test'];
    if (mutationCommand.length === 0) {
        throw new Error('mutations.testCommand must contain at least one executable argument');
    }
    const runtimeMirrorRoots = validateStringArray('mutations.runtimeMirrorRoots', raw.mutations?.runtimeMirrorRoots) ?? ['dist'];
    const maxChangedCrap = validateFiniteNumber('policy.maxChangedCrap', raw.policy?.maxChangedCrap, { min: 0 }) ?? 30;
    const minMutationScore = validateFiniteNumber('policy.minMutationScore', raw.policy?.minMutationScore, { min: 0, max: 1 }) ?? 0.8;
    const minMergeConfidence = validateFiniteNumber('policy.minMergeConfidence', raw.policy?.minMergeConfidence, { min: 0, max: 100 }) ?? 70;
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
            maxChangedCrap,
            minMutationScore,
            minMergeConfidence
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
function canonicalRepoPath(rootDir, candidate, kind) {
    return (0, index_1.resolveRepoLocalPath)(rootDir, candidate, { allowMissing: true, kind }).relativePath;
}
function canonicalRepoPathArray(rootDir, values, kind) {
    return values.map((value) => canonicalRepoPath(rootDir, value, kind));
}
function canonicalRepoPattern(candidate, kind) {
    const normalized = candidate.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    if (!normalized || normalized === '..' || normalized.startsWith('../') || path_1.default.isAbsolute(normalized)) {
        throw new Error(`${kind} must stay inside repository root: ${candidate}`);
    }
    return normalized;
}
function canonicalRepoPatternArray(values, kind) {
    return uniqueStrings(values.map((value) => canonicalRepoPattern(value, kind)));
}
function canonicalizeConfigPaths(rootDir, config) {
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
            runtimeMirrorRoots: uniqueStrings(canonicalRepoPathArray(rootDir, runtimeMirrorRoots, 'mutation runtime mirror root'))
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
function findConfigPath(rootDir) {
    for (const candidate of ['ts-quality.config.ts', 'ts-quality.config.js', 'ts-quality.config.mjs', 'ts-quality.config.cjs', 'ts-quality.config.json']) {
        const filePath = path_1.default.join(rootDir, candidate);
        if (fs_1.default.existsSync(filePath)) {
            return filePath;
        }
    }
    throw new Error(`No ts-quality config found in ${rootDir}`);
}
function loadContext(rootDir, explicitConfigPath) {
    const configPath = explicitConfigPath
        ? (0, index_1.resolveRepoLocalPath)(rootDir, explicitConfigPath, { kind: 'config path' }).absolutePath
        : findConfigPath(rootDir);
    const config = canonicalizeConfigPaths(rootDir, validateConfig(loadModuleFile(configPath)));
    return { rootDir, configPath, config };
}
function loadOptionalRepoModule(rootDir, repoPath, kind) {
    const filePath = (0, index_1.resolveRepoLocalPath)(rootDir, repoPath, { allowMissing: true, kind }).absolutePath;
    return fs_1.default.existsSync(filePath) ? loadModuleFile(filePath) : [];
}
function canonicalizeInvariantScenario(rootDir, invariantId, scenario, index) {
    const executionWitnessPatterns = validateStringArray(`invariants[${invariantId}].scenarios[${index}].executionWitnessPatterns`, scenario.executionWitnessPatterns) ?? [];
    const executionWitnessCommand = validateStringArray(`invariants[${invariantId}].scenarios[${index}].executionWitnessCommand`, scenario.executionWitnessCommand);
    if (executionWitnessCommand && executionWitnessCommand.length === 0) {
        throw new Error(`invariants[${invariantId}].scenarios[${index}].executionWitnessCommand must contain at least one executable argument`);
    }
    const executionWitnessTestFiles = validateStringArray(`invariants[${invariantId}].scenarios[${index}].executionWitnessTestFiles`, scenario.executionWitnessTestFiles);
    const executionWitnessTimeoutMs = validateFiniteNumber(`invariants[${invariantId}].scenarios[${index}].executionWitnessTimeoutMs`, scenario.executionWitnessTimeoutMs, { min: 0 });
    const executionWitnessOutput = typeof scenario.executionWitnessOutput === 'string'
        ? canonicalRepoPath(rootDir, scenario.executionWitnessOutput, `invariants[${invariantId}].scenarios[${index}].executionWitnessOutput`)
        : undefined;
    if (executionWitnessCommand && !executionWitnessOutput) {
        throw new Error(`invariants[${invariantId}].scenarios[${index}] requires executionWitnessOutput when executionWitnessCommand is set`);
    }
    const normalizedExecutionWitnessPatterns = executionWitnessPatterns.length > 0
        ? canonicalRepoPatternArray(executionWitnessPatterns, `invariants[${invariantId}].scenarios[${index}].executionWitnessPatterns`)
        : executionWitnessOutput ? [executionWitnessOutput] : [];
    return {
        ...scenario,
        ...(normalizedExecutionWitnessPatterns.length > 0 ? { executionWitnessPatterns: normalizedExecutionWitnessPatterns } : {}),
        ...(executionWitnessCommand ? { executionWitnessCommand } : {}),
        ...(executionWitnessOutput ? { executionWitnessOutput } : {}),
        ...(executionWitnessTestFiles ? { executionWitnessTestFiles: canonicalRepoPathArray(rootDir, executionWitnessTestFiles, `invariants[${invariantId}].scenarios[${index}].executionWitnessTestFiles`) } : {}),
        ...(executionWitnessTimeoutMs !== undefined ? { executionWitnessTimeoutMs } : {})
    };
}
function canonicalizeInvariantSpec(rootDir, invariant, index) {
    const invariantId = typeof invariant.id === 'string' && invariant.id.length > 0 ? invariant.id : String(index);
    return {
        ...invariant,
        scenarios: invariant.scenarios.map((scenario, scenarioIndex) => canonicalizeInvariantScenario(rootDir, invariantId, scenario, scenarioIndex))
    };
}
function loadInvariants(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'invariants path')
        .map((invariant, index) => canonicalizeInvariantSpec(rootDir, invariant, index));
}
function loadConstitution(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'constitution path');
}
function loadAgents(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'agents path');
}
function loadWaivers(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'waivers path');
}
function loadApprovals(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'approvals path');
}
function loadOverrides(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'overrides path');
}
function loadChangedRegions(rootDir, diffFileRelative) {
    if (!diffFileRelative) {
        return [];
    }
    const filePath = (0, index_1.resolveRepoLocalPath)(rootDir, diffFileRelative, { allowMissing: true, kind: 'diff file' }).absolutePath;
    if (!fs_1.default.existsSync(filePath)) {
        return [];
    }
    return (0, index_1.parseUnifiedDiff)(fs_1.default.readFileSync(filePath, 'utf8'));
}
//# sourceMappingURL=config.js.map