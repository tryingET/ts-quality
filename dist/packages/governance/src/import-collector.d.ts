export interface ImportReference {
    kind: 'static' | 'require' | 'dynamic-import';
    specifier?: string;
    expressionText: string;
    resolvable: boolean;
}
export declare function collectImportReferences(filePath: string, sourceText: string): ImportReference[];
