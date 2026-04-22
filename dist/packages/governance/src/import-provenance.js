"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBindingScope = createBindingScope;
exports.stringLikeModuleSpecifier = stringLikeModuleSpecifier;
exports.provenance = provenance;
exports.expressionProvenance = expressionProvenance;
exports.expressionIsRequireLike = expressionIsRequireLike;
exports.declareBindingName = declareBindingName;
exports.assignBindingTarget = assignBindingTarget;
exports.declareImportBindings = declareImportBindings;
const ts = require("typescript");
function createBindingScope(parent) {
    return parent ? { bindings: new Map(), parent } : { bindings: new Map() };
}
function stringLikeModuleSpecifier(argument) {
    if (!argument) {
        return undefined;
    }
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
        return argument.text;
    }
    return undefined;
}
function unwrapExpression(expression) {
    let current = expression;
    while (current
        && (ts.isParenthesizedExpression(current)
            || ts.isAsExpression(current)
            || ts.isTypeAssertionExpression(current)
            || ts.isNonNullExpression(current))) {
        current = current.expression;
    }
    return current;
}
function provenance(state, extra = {}) {
    return { state, ...extra };
}
function joinRequireLikeState(left, right) {
    if (left === right) {
        return left;
    }
    if (left === 'maybe' || right === 'maybe') {
        return 'maybe';
    }
    return 'maybe';
}
function mergeProvenance(left, right) {
    const merged = {
        state: joinRequireLikeState(left.state, right.state)
    };
    if (left.objectProperties || right.objectProperties || left.objectDynamic || right.objectDynamic) {
        const objectProperties = new Map();
        const propertyNames = new Set([
            ...Array.from(left.objectProperties?.keys() ?? []),
            ...Array.from(right.objectProperties?.keys() ?? [])
        ]);
        for (const propertyName of propertyNames) {
            const leftProperty = left.objectProperties?.get(propertyName) ?? (left.objectDynamic ? provenance('maybe') : provenance('never'));
            const rightProperty = right.objectProperties?.get(propertyName) ?? (right.objectDynamic ? provenance('maybe') : provenance('never'));
            objectProperties.set(propertyName, mergeProvenance(leftProperty, rightProperty));
        }
        merged.objectProperties = objectProperties;
        if (left.objectDynamic || right.objectDynamic) {
            merged.objectDynamic = true;
        }
    }
    if (left.arrayElements || right.arrayElements || left.arrayDynamic || right.arrayDynamic) {
        const length = Math.max(left.arrayElements?.length ?? 0, right.arrayElements?.length ?? 0);
        merged.arrayElements = Array.from({ length }, (_, index) => mergeProvenance(left.arrayElements?.[index] ?? (left.arrayDynamic ? provenance('maybe') : provenance('never')), right.arrayElements?.[index] ?? (right.arrayDynamic ? provenance('maybe') : provenance('never'))));
        if (left.arrayDynamic || right.arrayDynamic) {
            merged.arrayDynamic = true;
        }
    }
    return merged;
}
function expressionValueFacts(truthiness, nullishness) {
    return { truthiness, nullishness };
}
function mergeTruthiness(left, right) {
    return left === right ? left : 'unknown';
}
function mergeNullishness(left, right) {
    return left === right ? left : 'unknown';
}
function mergeExpressionValueFacts(left, right) {
    return expressionValueFacts(mergeTruthiness(left.truthiness, right.truthiness), mergeNullishness(left.nullishness, right.nullishness));
}
function logicalExpressionValueFacts(operatorToken, left, right) {
    if (operatorToken === ts.SyntaxKind.BarBarToken) {
        if (left.truthiness === 'always-truthy') {
            return left;
        }
        if (left.truthiness === 'always-falsy') {
            return right;
        }
        return mergeExpressionValueFacts(left, right);
    }
    if (operatorToken === ts.SyntaxKind.AmpersandAmpersandToken) {
        if (left.truthiness === 'always-falsy') {
            return left;
        }
        if (left.truthiness === 'always-truthy') {
            return right;
        }
        return mergeExpressionValueFacts(left, right);
    }
    if (operatorToken === ts.SyntaxKind.QuestionQuestionToken) {
        if (left.nullishness === 'never-nullish') {
            return left;
        }
        if (left.nullishness === 'always-nullish') {
            return right;
        }
        return mergeExpressionValueFacts(left, right);
    }
    return expressionValueFacts('unknown', 'unknown');
}
function lookupBindingProvenance(scope, name) {
    let current = scope;
    while (current) {
        if (current.bindings.has(name)) {
            return current.bindings.get(name);
        }
        current = current.parent;
    }
    return name === 'require' ? provenance('always') : provenance('never');
}
function assignBinding(scope, name, value) {
    let current = scope;
    while (current) {
        if (current.bindings.has(name)) {
            current.bindings.set(name, value);
            return;
        }
        current = current.parent;
    }
    if (name !== 'require') {
        scope.bindings.set(name, value);
    }
}
function propertyNameText(name) {
    if (!name || ts.isComputedPropertyName(name)) {
        return undefined;
    }
    if (ts.isIdentifier(name)
        || ts.isStringLiteral(name)
        || ts.isNumericLiteral(name)
        || ts.isNoSubstitutionTemplateLiteral(name)) {
        return name.text;
    }
    return undefined;
}
function objectPropertyName(target) {
    if (ts.isBindingElement(target)) {
        return propertyNameText(target.propertyName ?? (ts.isIdentifier(target.name) ? target.name : undefined));
    }
    if (ts.isShorthandPropertyAssignment(target)) {
        return target.name.text;
    }
    if (ts.isPropertyAssignment(target)) {
        return propertyNameText(target.name);
    }
    return undefined;
}
function objectPropertyProvenance(value, propertyName) {
    if (value.objectProperties?.has(propertyName)) {
        return value.objectProperties.get(propertyName);
    }
    if (value.objectProperties || value.objectDynamic) {
        return value.objectDynamic ? provenance('maybe') : undefined;
    }
    return undefined;
}
function arrayElementProvenance(value, index) {
    if (value.arrayElements && index < value.arrayElements.length) {
        return value.arrayElements[index];
    }
    if (value.arrayElements || value.arrayDynamic) {
        return value.arrayDynamic ? provenance('maybe') : undefined;
    }
    return undefined;
}
function elementAccessKey(argumentExpression) {
    const candidate = unwrapExpression(argumentExpression);
    if (!candidate) {
        return undefined;
    }
    if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
        return candidate.text;
    }
    if (ts.isNumericLiteral(candidate)) {
        return Number(candidate.text);
    }
    return undefined;
}
function numericKeyFromText(text) {
    return /^(0|[1-9]\d*)$/u.test(text) ? Number(text) : undefined;
}
function arrayRestProvenance(value, startIndex) {
    return provenance('never', {
        ...(value.arrayElements ? { arrayElements: value.arrayElements.slice(startIndex) } : {}),
        ...(value.arrayDynamic ? { arrayDynamic: true } : {})
    });
}
function objectRestProvenance(value, excludedKeys) {
    const objectProperties = value.objectProperties
        ? new Map(Array.from(value.objectProperties.entries()).filter(([propertyName]) => !excludedKeys.has(propertyName)))
        : undefined;
    return provenance('never', {
        ...(objectProperties ? { objectProperties } : {}),
        ...(value.objectDynamic ? { objectDynamic: true } : {})
    });
}
function explicitObjectKeys(elements) {
    const keys = new Set();
    for (const element of elements) {
        if (ts.isBindingElement(element)) {
            if (element.dotDotDotToken) {
                continue;
            }
            const propertyName = objectPropertyName(element);
            if (typeof propertyName === 'string') {
                keys.add(propertyName);
            }
            continue;
        }
        if (ts.isShorthandPropertyAssignment(element)) {
            keys.add(element.name.text);
            continue;
        }
        if (ts.isPropertyAssignment(element)) {
            const propertyName = propertyNameText(element.name);
            if (typeof propertyName === 'string') {
                keys.add(propertyName);
            }
        }
    }
    return keys;
}
function propertyAccessProvenance(value, key) {
    if (typeof key === 'number') {
        return arrayElementProvenance(value, key)
            ?? objectPropertyProvenance(value, String(key));
    }
    const numericKey = numericKeyFromText(key);
    if (typeof numericKey === 'number') {
        return arrayElementProvenance(value, numericKey)
            ?? objectPropertyProvenance(value, key);
    }
    return objectPropertyProvenance(value, key);
}
function literalExpressionValueFacts(candidate) {
    if (candidate.kind === ts.SyntaxKind.NullKeyword) {
        return expressionValueFacts('always-falsy', 'always-nullish');
    }
    if (candidate.kind === ts.SyntaxKind.TrueKeyword) {
        return expressionValueFacts('always-truthy', 'never-nullish');
    }
    if (candidate.kind === ts.SyntaxKind.FalseKeyword) {
        return expressionValueFacts('always-falsy', 'never-nullish');
    }
    if (ts.isStringLiteral(candidate) || ts.isNoSubstitutionTemplateLiteral(candidate)) {
        return expressionValueFacts(candidate.text.length > 0 ? 'always-truthy' : 'always-falsy', 'never-nullish');
    }
    if (ts.isNumericLiteral(candidate)) {
        return expressionValueFacts(Number(candidate.text) === 0 ? 'always-falsy' : 'always-truthy', 'never-nullish');
    }
    if (ts.isBigIntLiteral(candidate)) {
        return expressionValueFacts(candidate.text === '0n' ? 'always-falsy' : 'always-truthy', 'never-nullish');
    }
    if (ts.isRegularExpressionLiteral(candidate)
        || ts.isObjectLiteralExpression(candidate)
        || ts.isArrayLiteralExpression(candidate)
        || ts.isFunctionExpression(candidate)
        || ts.isArrowFunction(candidate)
        || ts.isClassExpression(candidate)
        || ts.isNewExpression(candidate)) {
        return expressionValueFacts('always-truthy', 'never-nullish');
    }
    return undefined;
}
function conditionalExpressionValueFacts(node, scope) {
    const conditionFacts = expressionFacts(node.condition, scope);
    if (conditionFacts.truthiness === 'always-truthy') {
        return expressionFacts(node.whenTrue, scope);
    }
    if (conditionFacts.truthiness === 'always-falsy') {
        return expressionFacts(node.whenFalse, scope);
    }
    return mergeExpressionValueFacts(expressionFacts(node.whenTrue, scope), expressionFacts(node.whenFalse, scope));
}
function expressionFacts(expression, scope) {
    const candidate = unwrapExpression(expression);
    if (!candidate) {
        return expressionValueFacts('unknown', 'unknown');
    }
    const literalFacts = literalExpressionValueFacts(candidate);
    if (literalFacts) {
        return literalFacts;
    }
    if (ts.isIdentifier(candidate)) {
        if (candidate.text === 'undefined') {
            return expressionValueFacts('always-falsy', 'always-nullish');
        }
        const binding = lookupBindingProvenance(scope, candidate.text);
        if (binding.state === 'always') {
            return expressionValueFacts('always-truthy', 'never-nullish');
        }
        return expressionValueFacts('unknown', 'unknown');
    }
    if (ts.isBinaryExpression(candidate) && candidate.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return expressionFacts(candidate.right, scope);
    }
    if (ts.isBinaryExpression(candidate) && candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return expressionFacts(candidate.right, scope);
    }
    if (ts.isBinaryExpression(candidate) && (candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken
        || candidate.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || candidate.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
        return logicalExpressionValueFacts(candidate.operatorToken.kind, expressionFacts(candidate.left, scope), expressionFacts(candidate.right, scope));
    }
    if (ts.isConditionalExpression(candidate)) {
        return conditionalExpressionValueFacts(candidate, scope);
    }
    return expressionValueFacts('unknown', 'unknown');
}
function logicalExpressionProvenance(node, scope) {
    const leftFacts = expressionFacts(node.left, scope);
    const left = expressionProvenance(node.left, scope);
    const right = expressionProvenance(node.right, scope);
    if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
        if (leftFacts.truthiness === 'always-truthy') {
            return left;
        }
        if (leftFacts.truthiness === 'always-falsy') {
            return right;
        }
        return mergeProvenance(left, right);
    }
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        if (leftFacts.truthiness === 'always-falsy') {
            return left;
        }
        if (leftFacts.truthiness === 'always-truthy') {
            return right;
        }
        return mergeProvenance(left, right);
    }
    if (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
        if (leftFacts.nullishness === 'never-nullish') {
            return left;
        }
        if (leftFacts.nullishness === 'always-nullish') {
            return right;
        }
        return mergeProvenance(left, right);
    }
    return provenance('never');
}
function conditionalExpressionProvenance(node, scope) {
    const conditionFacts = expressionFacts(node.condition, scope);
    if (conditionFacts.truthiness === 'always-truthy') {
        return expressionProvenance(node.whenTrue, scope);
    }
    if (conditionFacts.truthiness === 'always-falsy') {
        return expressionProvenance(node.whenFalse, scope);
    }
    return mergeProvenance(expressionProvenance(node.whenTrue, scope), expressionProvenance(node.whenFalse, scope));
}
function expressionProvenance(expression, scope) {
    const candidate = unwrapExpression(expression);
    if (!candidate) {
        return provenance('never');
    }
    if (ts.isIdentifier(candidate)) {
        return lookupBindingProvenance(scope, candidate.text);
    }
    if (ts.isBinaryExpression(candidate) && candidate.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return expressionProvenance(candidate.right, scope);
    }
    if (ts.isBinaryExpression(candidate) && candidate.operatorToken.kind === ts.SyntaxKind.CommaToken) {
        return expressionProvenance(candidate.right, scope);
    }
    if (ts.isBinaryExpression(candidate) && (candidate.operatorToken.kind === ts.SyntaxKind.BarBarToken
        || candidate.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || candidate.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
        return logicalExpressionProvenance(candidate, scope);
    }
    if (ts.isConditionalExpression(candidate)) {
        return conditionalExpressionProvenance(candidate, scope);
    }
    if (ts.isPropertyAccessExpression(candidate)) {
        return propertyAccessProvenance(expressionProvenance(candidate.expression, scope), candidate.name.text) ?? provenance('never');
    }
    if (ts.isElementAccessExpression(candidate)) {
        const key = elementAccessKey(candidate.argumentExpression);
        return typeof key === 'undefined'
            ? provenance('never')
            : propertyAccessProvenance(expressionProvenance(candidate.expression, scope), key) ?? provenance('never');
    }
    if (ts.isObjectLiteralExpression(candidate)) {
        const objectProperties = new Map();
        let objectDynamic = false;
        for (const property of candidate.properties) {
            if (ts.isSpreadAssignment(property)) {
                objectDynamic = true;
                continue;
            }
            if (ts.isShorthandPropertyAssignment(property)) {
                objectProperties.set(property.name.text, expressionProvenance(property.name, scope));
                continue;
            }
            if (ts.isPropertyAssignment(property)) {
                const propertyName = propertyNameText(property.name);
                if (typeof propertyName === 'string') {
                    objectProperties.set(propertyName, expressionProvenance(property.initializer, scope));
                }
                else {
                    objectDynamic = true;
                }
                continue;
            }
            const propertyName = propertyNameText(property.name);
            if (typeof propertyName === 'string') {
                objectProperties.set(propertyName, provenance('never'));
            }
            else {
                objectDynamic = true;
            }
        }
        return provenance('never', {
            objectProperties,
            ...(objectDynamic ? { objectDynamic: true } : {})
        });
    }
    if (ts.isArrayLiteralExpression(candidate)) {
        const arrayElements = [];
        let arrayDynamic = false;
        for (const element of candidate.elements) {
            if (ts.isOmittedExpression(element)) {
                arrayElements.push(provenance('never'));
                continue;
            }
            if (ts.isSpreadElement(element)) {
                arrayDynamic = true;
                arrayElements.push(provenance('maybe'));
                continue;
            }
            arrayElements.push(expressionProvenance(element, scope));
        }
        return provenance('never', {
            arrayElements,
            ...(arrayDynamic ? { arrayDynamic: true } : {})
        });
    }
    return provenance('never');
}
function expressionIsRequireLike(expression, scope) {
    return expressionProvenance(expression, scope).state === 'always';
}
function declareBindingName(name, value, scope) {
    if (name && ts.isIdentifier(name)) {
        scope.bindings.set(name.text, value);
        return;
    }
    if (name && ts.isArrayBindingPattern(name)) {
        for (let index = 0; index < name.elements.length; index += 1) {
            const element = name.elements[index];
            if (!element || !ts.isBindingElement(element)) {
                continue;
            }
            const matchedValue = element.dotDotDotToken
                ? arrayRestProvenance(value, index)
                : arrayElementProvenance(value, index);
            declareBindingName(element.name, matchedValue ?? (element.initializer ? expressionProvenance(element.initializer, scope) : provenance('never')), scope);
        }
        return;
    }
    if (!name || !ts.isObjectBindingPattern(name)) {
        return;
    }
    const excludedKeys = explicitObjectKeys(name.elements);
    for (const element of name.elements) {
        if (ts.isBindingElement(element)) {
            const matchedValue = element.dotDotDotToken
                ? objectRestProvenance(value, excludedKeys)
                : (() => {
                    const propertyName = objectPropertyName(element);
                    return typeof propertyName === 'string' ? objectPropertyProvenance(value, propertyName) : undefined;
                })();
            declareBindingName(element.name, matchedValue ?? (element.initializer ? expressionProvenance(element.initializer, scope) : provenance('never')), scope);
        }
    }
}
function assignBindingTarget(target, value, scope) {
    if (ts.isIdentifier(target)) {
        assignBinding(scope, target.text, value);
        return;
    }
    if (ts.isArrayLiteralExpression(target)) {
        for (let index = 0; index < target.elements.length; index += 1) {
            const element = target.elements[index];
            if (!element || ts.isOmittedExpression(element)) {
                continue;
            }
            if (ts.isSpreadElement(element)) {
                assignBindingTarget(element.expression, arrayRestProvenance(value, index), scope);
                continue;
            }
            assignBindingTarget(element, arrayElementProvenance(value, index) ?? provenance('never'), scope);
        }
        return;
    }
    if (ts.isObjectLiteralExpression(target)) {
        const excludedKeys = explicitObjectKeys(target.properties);
        for (const property of target.properties) {
            if (ts.isShorthandPropertyAssignment(property)) {
                assignBindingTarget(property.name, objectPropertyProvenance(value, property.name.text) ?? provenance('never'), scope);
                continue;
            }
            if (ts.isPropertyAssignment(property)) {
                const propertyName = propertyNameText(property.name);
                assignBindingTarget(property.initializer, typeof propertyName === 'string' ? objectPropertyProvenance(value, propertyName) ?? provenance('never') : provenance('maybe'), scope);
                continue;
            }
            if (ts.isSpreadAssignment(property)) {
                assignBindingTarget(property.expression, objectRestProvenance(value, excludedKeys), scope);
            }
        }
    }
}
function declareImportBindings(node, scope) {
    const clause = node.importClause;
    if (!clause) {
        return;
    }
    if (clause.name) {
        scope.bindings.set(clause.name.text, provenance('never'));
    }
    if (!clause.namedBindings) {
        return;
    }
    if (ts.isNamespaceImport(clause.namedBindings)) {
        scope.bindings.set(clause.namedBindings.name.text, provenance('never'));
        return;
    }
    for (const specifier of clause.namedBindings.elements) {
        scope.bindings.set(specifier.name.text, provenance('never'));
    }
}
//# sourceMappingURL=import-provenance.js.map