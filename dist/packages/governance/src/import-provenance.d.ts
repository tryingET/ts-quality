import ts = require('typescript');
type BindingNameNode = ts.BindingName | undefined;
type BindingTargetNode = ts.Expression;
export type RequireLikeState = 'never' | 'always' | 'maybe';
export interface ValueProvenance {
    state: RequireLikeState;
    objectProperties?: Map<string, ValueProvenance>;
    objectDynamic?: boolean;
    arrayElements?: ValueProvenance[];
    arrayDynamic?: boolean;
}
export interface BindingScope {
    bindings: Map<string, ValueProvenance>;
    parent?: BindingScope;
}
export declare function createBindingScope(parent?: BindingScope): BindingScope;
export declare function stringLikeModuleSpecifier(argument: ts.Node | undefined): string | undefined;
export declare function provenance(state: RequireLikeState, extra?: Omit<ValueProvenance, 'state'>): ValueProvenance;
export declare function expressionProvenance(expression: ts.Expression | undefined, scope: BindingScope): ValueProvenance;
export declare function expressionIsRequireLike(expression: ts.Expression | undefined, scope: BindingScope): boolean;
export declare function declareBindingName(name: BindingNameNode, value: ValueProvenance, scope: BindingScope): void;
export declare function assignBindingTarget(target: BindingTargetNode, value: ValueProvenance, scope: BindingScope): void;
export declare function declareImportBindings(node: ts.ImportDeclaration, scope: BindingScope): void;
export {};
