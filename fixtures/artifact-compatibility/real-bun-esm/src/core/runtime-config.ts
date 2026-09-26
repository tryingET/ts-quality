import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { AnalyzerFactory } from './analyzer-factory.js';
import { type CoreConfig, CoreError } from './types.js';

export const SCI_CONFIG_FILE = '.semantic-code-intelligence-config.yaml';

export type RuntimeConfigFile = {
    path: string;
    dir: string;
    data: Record<string, any>;
};

export function findRuntimeConfigPath(startDir = process.cwd()): string | null {
    let current = path.resolve(startDir || process.cwd());
    while (true) {
        const candidate = path.join(current, SCI_CONFIG_FILE);
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

export function loadRuntimeConfig(startDir = process.cwd()): RuntimeConfigFile | null {
    const configPath = findRuntimeConfigPath(startDir);
    if (!configPath) return null;

    const stat = fs.lstatSync(configPath);
    if (stat.isSymbolicLink()) {
        throw new CoreError('Runtime configuration path must not be a symlink', 'CONFIG_ERROR', undefined, undefined, {
            configPath,
        });
    }
    if (!stat.isFile()) {
        throw new CoreError('Runtime configuration path must be a file', 'CONFIG_ERROR', undefined, undefined, {
            configPath,
        });
    }

    const parsed = yaml.load(fs.readFileSync(configPath, 'utf8'));
    if (parsed == null) return { path: configPath, dir: path.dirname(configPath), data: {} };
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new CoreError('Runtime configuration must be a YAML mapping', 'CONFIG_ERROR', undefined, undefined, {
            configPath,
        });
    }
    return { path: configPath, dir: path.dirname(configPath), data: parsed as Record<string, any> };
}

export function resolveRuntimeWorkspaceRoot(explicit?: string, fallback?: string, startDir = process.cwd()): string {
    if (explicit && explicit.trim()) return path.resolve(explicit);

    const envRoot = process.env.SEMANTIC_CODE_WORKSPACE || process.env.WORKSPACE_ROOT;
    if (envRoot && envRoot.trim()) return path.resolve(envRoot);

    const runtime = loadRuntimeConfig(startDir);
    const configuredRoot = runtime?.data?.workspaceRoot;
    if (runtime && typeof configuredRoot === 'string' && configuredRoot.trim()) {
        return resolveConfigWorkspaceRoot(runtime, configuredRoot);
    }

    return path.resolve(fallback || process.cwd());
}

export function createRuntimeCoreConfig(startDir = process.cwd()): CoreConfig {
    const config = AnalyzerFactory.createDefaultConfig();
    applyRuntimeConfig(config, startDir);
    return config;
}

export function applyRuntimeConfig(config: CoreConfig, startDir = process.cwd()): CoreConfig {
    const runtime = loadRuntimeConfig(startDir);
    if (!runtime) return config;

    const data = runtime.data;
    const runtimeLayers = normalizeLayerConfig(data.layers || {});
    config.layers = mergeObjects(config.layers as any, runtimeLayers) as any;
    config.performance = mergeObjects(config.performance as any, data.performance || {}) as any;
    config.monitoring = mergeObjects(config.monitoring as any, data.monitoring || {}) as any;

    if (data.cache && typeof data.cache === 'object') {
        config.cache = mergeCacheConfig(config.cache, data.cache);
    }

    const databasePath = pickString(data.database?.path);
    const layerDbPaths = {
        layer3: pickString(runtimeLayers?.layer3?.dbPath),
        layer4: pickString(runtimeLayers?.layer4?.dbPath),
        layer5: pickString(runtimeLayers?.layer5?.dbPath),
    };
    const databaseFallbackPath = pickString(
        databasePath,
        layerDbPaths.layer4,
        layerDbPaths.layer5,
        layerDbPaths.layer3
    );
    const databaseFallbackField = databasePath
        ? 'database.path'
        : layerDbPaths.layer4
          ? 'layers.layer4.dbPath'
          : layerDbPaths.layer5
            ? 'layers.layer5.dbPath'
            : 'layers.layer3.dbPath';
    const resolvedDatabasePath = databaseFallbackPath
        ? resolveConfigContainedPath(runtime, databaseFallbackPath, databaseFallbackField)
        : null;
    if (resolvedDatabasePath) {
        config.database = {
            path: resolvedDatabasePath,
            maxConnections: Number(data.database?.maxConnections || config.database?.maxConnections || 10),
        };
    }

    const configLayers = config.layers as unknown as Record<string, any>;
    for (const layerName of ['layer3', 'layer4', 'layer5'] as const) {
        const rawLayerPath = layerDbPaths[layerName];
        if (rawLayerPath) {
            configLayers[layerName] = {
                ...configLayers[layerName],
                dbPath: resolveConfigContainedPath(runtime, rawLayerPath, `layers.${layerName}.dbPath`),
            };
        } else if (databasePath && resolvedDatabasePath) {
            configLayers[layerName] = { ...configLayers[layerName], dbPath: resolvedDatabasePath };
        }
    }

    const workspaceRoot = data.workspaceRoot;
    if (typeof workspaceRoot === 'string' && workspaceRoot.trim()) {
        config.workspaceRoot = resolveConfigWorkspaceRoot(runtime, workspaceRoot);
    }

    return config;
}

function isPathWithinOrEqual(candidate: string, root: string): boolean {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveConfigWorkspaceRoot(runtime: RuntimeConfigFile, rawWorkspaceRoot: string): string {
    const resolved = path.resolve(runtime.dir, rawWorkspaceRoot);
    if (!isPathWithinOrEqual(resolved, runtime.dir)) {
        throw new CoreError(
            'Configured workspaceRoot must stay within the config directory',
            'CONFIG_ERROR',
            undefined,
            undefined,
            {
                configPath: runtime.path,
                workspaceRoot: rawWorkspaceRoot,
            }
        );
    }
    if (fs.existsSync(resolved)) {
        const realConfigDir = fs.realpathSync(runtime.dir);
        const realWorkspaceRoot = fs.realpathSync(resolved);
        if (!isPathWithinOrEqual(realWorkspaceRoot, realConfigDir)) {
            throw new CoreError(
                'Configured workspaceRoot realpath must stay within the config directory',
                'CONFIG_ERROR',
                undefined,
                undefined,
                {
                    configPath: runtime.path,
                    workspaceRoot: rawWorkspaceRoot,
                }
            );
        }
    }
    return resolved;
}

function nearestExistingPath(candidate: string): string {
    let current = candidate;
    while (!fs.existsSync(current)) {
        const parent = path.dirname(current);
        if (parent === current) return current;
        current = parent;
    }
    return current;
}

function resolveConfigContainedPath(runtime: RuntimeConfigFile, rawPath: string, field: string): string {
    if (rawPath === ':memory:') return rawPath;

    const resolved = resolveConfigPath(runtime.dir, rawPath);
    if (!isPathWithinOrEqual(resolved, runtime.dir)) {
        throw new CoreError(
            `Configured ${field} must stay within the config directory`,
            'CONFIG_ERROR',
            undefined,
            undefined,
            { configPath: runtime.path, [field]: rawPath }
        );
    }

    const realConfigDir = fs.realpathSync(runtime.dir);
    const existing = nearestExistingPath(resolved);
    if (fs.existsSync(existing)) {
        const realExisting = fs.realpathSync(existing);
        if (!isPathWithinOrEqual(realExisting, realConfigDir)) {
            throw new CoreError(
                `Configured ${field} realpath must stay within the config directory`,
                'CONFIG_ERROR',
                undefined,
                undefined,
                { configPath: runtime.path, [field]: rawPath }
            );
        }
    }

    return resolved;
}

function normalizeLayerConfig(raw: Record<string, any>): Record<string, any> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const normalized: Record<string, any> = { ...raw };
    const aliases: Array<[string, string]> = [
        ['layer1_fast', 'layer1'],
        ['tree_sitter', 'layer2'],
        ['planner', 'layer3'],
        ['ontology', 'layer4'],
        ['semantic_graph', 'layer4'],
        ['patterns', 'layer5'],
        ['propagation', 'layer5'],
    ];
    for (const [alias, canonical] of aliases) {
        const value = raw[alias];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            normalized[canonical] = mergeObjects(value, normalized[canonical] || {});
        }
        delete normalized[alias];
    }
    return normalized;
}

function mergeCacheConfig(current: CoreConfig['cache'], raw: Record<string, any>): CoreConfig['cache'] {
    const memory = raw.memory && typeof raw.memory === 'object' ? raw.memory : raw;
    const ttl = Number(memory.ttl ?? (typeof memory.ttlMs === 'number' ? memory.ttlMs / 1000 : undefined));
    return {
        ...current,
        ...pickKnown(raw, ['enabled', 'strategy']),
        memory: {
            ...current.memory,
            maxSize: Number(memory.maxSize ?? current.memory.maxSize),
            ttl: Number.isFinite(ttl) && ttl > 0 ? ttl : current.memory.ttl,
        },
        redis: raw.redis ?? current.redis,
    };
}

function mergeObjects<T extends Record<string, any>>(base: T, override: Record<string, any>): T {
    const out: Record<string, any> = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            base?.[key] &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
        ) {
            out[key] = mergeObjects(base[key], value);
        } else if (value !== undefined) {
            out[key] = value;
        }
    }
    return out as T;
}

function pickKnown(raw: Record<string, any>, keys: string[]): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of keys) {
        if (raw[key] !== undefined) out[key] = raw[key];
    }
    return out;
}

function pickString(...values: unknown[]): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value;
    }
    return null;
}

function resolveConfigPath(configDir: string, value: string): string {
    return path.isAbsolute(value) ? path.resolve(value) : path.resolve(configDir, value);
}
