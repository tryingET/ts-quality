import { type Agent, type ConstitutionRule, type InvariantSpec, type OverrideRecord, type Waiver, type Approval, parseUnifiedDiff } from '../../evidence-model/src/index';
export interface TsQualityConfig {
    version?: string;
    sourcePatterns?: string[];
    testPatterns?: string[];
    coverage?: {
        lcovPath?: string;
        generateCommand?: string[];
        generateWhenMissing?: boolean;
        generateTimeoutMs?: number;
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
export declare function loadModuleFile<T>(filePath: string): T;
export declare function findConfigPath(rootDir: string): string;
export declare function loadContext(rootDir: string, explicitConfigPath?: string): LoadedContext;
export declare function loadInvariants(rootDir: string, relativePath: string): InvariantSpec[];
export declare function loadConstitution(rootDir: string, relativePath: string): ConstitutionRule[];
export declare function loadAgents(rootDir: string, relativePath: string): Agent[];
export declare function loadWaivers(rootDir: string, relativePath: string): Waiver[];
export declare function loadApprovals(rootDir: string, relativePath: string): Approval[];
export declare function loadOverrides(rootDir: string, relativePath: string): OverrideRecord[];
export declare function loadChangedRegions(rootDir: string, diffFileRelative: string): ReturnType<typeof parseUnifiedDiff>;
