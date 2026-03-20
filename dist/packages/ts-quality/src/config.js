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
function validateConfig(raw) {
    const sourcePatterns = validateStringArray('sourcePatterns', raw.sourcePatterns) ?? [...index_1.DEFAULT_SOURCE_PATTERNS];
    const testPatterns = validateStringArray('testPatterns', raw.testPatterns) ?? [...index_1.DEFAULT_TEST_PATTERNS];
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
    const config = validateConfig(loadModuleFile(configPath));
    return { rootDir, configPath, config };
}
function loadOptionalRepoModule(rootDir, repoPath, kind) {
    const filePath = (0, index_1.resolveRepoLocalPath)(rootDir, repoPath, { allowMissing: true, kind }).absolutePath;
    return fs_1.default.existsSync(filePath) ? loadModuleFile(filePath) : [];
}
function loadInvariants(rootDir, relativePath) {
    return loadOptionalRepoModule(rootDir, relativePath, 'invariants path');
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