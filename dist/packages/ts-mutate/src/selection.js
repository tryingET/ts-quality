"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMutationTarget = parseMutationTarget;
exports.selectMutationSites = selectMutationSites;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typescript_1 = __importDefault(require("typescript"));
const index_1 = require("../../evidence-model/src/index");
const catalog_1 = require("./catalog");
const DEFAULT_MUTATION_SOURCE_PATTERNS = ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx', 'src/**/*.mjs', 'src/**/*.cjs'];
function targetError(spec, why) {
    return new Error(`Invalid mutation target "${spec}": ${why}. Use file:<path>, span:<path>:<start>-<end>, symbol:<path>#<kind:name>[@<start>-<end>] or site:<id>.`);
}
function lineRange(spec, text) {
    const match = /^([1-9]\d*)-([1-9]\d*)$/.exec(text);
    if (!match || Number(match[1]) > Number(match[2])) {
        throw targetError(spec, 'expected a line range <start>-<end> with start <= end');
    }
    return { startLine: Number(match[1]), endLine: Number(match[2]) };
}
function parseMutationTarget(spec) {
    const colon = spec.indexOf(':');
    const kind = colon > 0 ? spec.slice(0, colon) : '';
    const rest = colon > 0 ? spec.slice(colon + 1) : '';
    if (!rest) {
        throw targetError(spec, 'missing kind or value');
    }
    if (kind === 'file') {
        return { kind, filePath: (0, index_1.normalizePath)(rest) };
    }
    if (kind === 'site') {
        return { kind, siteId: rest };
    }
    if (kind === 'span') {
        const separator = rest.lastIndexOf(':');
        if (separator <= 0) {
            throw targetError(spec, 'expected span:<path>:<start>-<end>');
        }
        return { kind, filePath: (0, index_1.normalizePath)(rest.slice(0, separator)), ...lineRange(spec, rest.slice(separator + 1)) };
    }
    if (kind === 'symbol') {
        const hash = rest.indexOf('#');
        if (hash <= 0 || hash === rest.length - 1) {
            throw targetError(spec, 'expected symbol:<path>#<kind:name>');
        }
        const filePath = (0, index_1.normalizePath)(rest.slice(0, hash));
        const symbolText = rest.slice(hash + 1);
        // Only a trailing @<start>-<end> is a span; names such as arrow:<anonymous@6> keep their @.
        const at = /@(\d+-\d+)$/.exec(symbolText);
        return at && at.index > 0
            ? { kind, filePath, symbol: symbolText.slice(0, at.index), ...lineRange(spec, at[1]) }
            : { kind, filePath, symbol: symbolText };
    }
    throw targetError(spec, `unknown kind "${kind}"`);
}
function spanContains(outer, inner) {
    return outer.startLine <= inner.startLine && inner.endLine <= outer.endLine;
}
function functionKind(node) {
    if (typescript_1.default.isFunctionDeclaration(node))
        return 'function';
    if (typescript_1.default.isMethodDeclaration(node))
        return 'method';
    if (typescript_1.default.isConstructorDeclaration(node))
        return 'constructor';
    if (typescript_1.default.isGetAccessorDeclaration(node))
        return 'get';
    if (typescript_1.default.isSetAccessorDeclaration(node))
        return 'set';
    if (typescript_1.default.isArrowFunction(node))
        return 'arrow';
    if (typescript_1.default.isFunctionExpression(node))
        return 'function-expression';
    return undefined;
}
/** Executable function bodies with their character ranges, so ownership is decided by offsets, not shared lines. */
function functionNodeRanges(sourceText, filePath) {
    const sourceFile = typescript_1.default.createSourceFile(filePath, sourceText, typescript_1.default.ScriptTarget.Latest, true);
    const ranges = [];
    const visit = (node) => {
        if ((0, catalog_1.isAmbientDeclaration)(node)) {
            return;
        }
        const kind = functionKind(node);
        if (kind && node.body) {
            const start = node.getStart(sourceFile);
            ranges.push({
                kind,
                start,
                end: node.end,
                span: { startLine: sourceFile.getLineAndCharacterOfPosition(start).line + 1, endLine: sourceFile.getLineAndCharacterOfPosition(node.end).line + 1 }
            });
        }
        typescript_1.default.forEachChild(node, visit);
    };
    visit(sourceFile);
    return ranges;
}
function innermostFunction(ranges, offset) {
    return ranges
        .filter((range) => range.start <= offset && offset < range.end)
        .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
}
function siteExistsOutsideScope(target, context) {
    for (const filePath of context.sourceFiles) {
        if ((0, catalog_1.inChangedScope)(filePath, context.changed)) {
            continue;
        }
        const text = fs_1.default.readFileSync(path_1.default.join(context.repoRoot, filePath), 'utf8');
        if ((0, catalog_1.candidateMutationSites)(text, filePath).some((site) => site.id === target.siteId)) {
            return true;
        }
    }
    return false;
}
function resolveTarget(target, context) {
    const none = { matches: () => false, nested: () => false };
    const unresolved = (reason) => ({ resolution: { target, status: 'unresolved', reason, matchedSites: 0, selectedSites: 0 }, ...none });
    const resolved = (matches, nested = () => false) => ({ resolution: { target, status: 'resolved', matchedSites: 0, selectedSites: 0 }, matches, nested });
    if (target.kind === 'site') {
        if (context.discovered.some((site) => site.id === target.siteId)) {
            return resolved((site) => site.id === target.siteId);
        }
        return unresolved(siteExistsOutsideScope(target, context) ? 'outside-changed-scope' : 'stale-site');
    }
    const filePath = (0, index_1.normalizePath)(target.filePath);
    if (!context.sourceFiles.has(filePath)) {
        return unresolved('not-a-source-file');
    }
    if (!(0, catalog_1.inChangedScope)(filePath, context.changed)) {
        return unresolved('outside-changed-scope');
    }
    if (target.kind === 'file') {
        return resolved((site) => site.filePath === filePath);
    }
    if (target.kind === 'span') {
        return resolved((site) => site.filePath === filePath && spanContains(target, site.span));
    }
    const candidates = context.functions.filter((item) => (0, index_1.normalizePath)(item.filePath) === filePath && item.symbol === target.symbol);
    if (candidates.length === 0) {
        return unresolved('not-found');
    }
    const startLine = target.startLine;
    const endLine = target.endLine;
    const exact = startLine !== undefined && endLine !== undefined
        ? candidates.filter((item) => item.span.startLine === startLine && item.span.endLine === endLine)
        : candidates;
    if (exact.length === 0) {
        return unresolved('stale-span');
    }
    if (exact.length > 1) {
        return unresolved('ambiguous');
    }
    const owner = exact[0];
    const kind = target.symbol.slice(0, target.symbol.indexOf(':'));
    const ranges = functionNodeRanges(context.sourceTexts.get(filePath) ?? '', filePath);
    const ownerRanges = ranges.filter((range) => range.kind === kind && range.span.startLine === owner.span.startLine && range.span.endLine === owner.span.endLine);
    if (ownerRanges.length !== 1) {
        // Two functions of the same kind on identical lines cannot be told apart by the inventory.
        return unresolved(ownerRanges.length === 0 ? 'not-found' : 'ambiguous');
    }
    const ownerRange = ownerRanges[0];
    // A site belongs to the function whose body most tightly encloses it; nested and sibling functions own their own sites.
    const ownedBy = (site) => (site.filePath === filePath ? innermostFunction(ranges, site.startOffset) : undefined);
    return resolved((site) => ownedBy(site) === ownerRange, (site) => site.filePath === filePath && ownerRange.start <= site.startOffset && site.startOffset < ownerRange.end && ownedBy(site) !== ownerRange);
}
/**
 * Inert mutation selection: discovers, filters and budgets sites and records why each was or was not selected.
 * Runs no command and writes nothing.
 */
function selectMutationSites(options) {
    const sourceFiles = (options.sourceFiles ?? (0, index_1.collectSourceFiles)(options.repoRoot, DEFAULT_MUTATION_SOURCE_PATTERNS))
        .filter((filePath) => !(0, index_1.matchPattern)('**/*.d.ts', filePath))
        .map((filePath) => (0, index_1.normalizePath)(filePath));
    const changedRegions = options.changedRegions ?? [];
    const context = {
        changed: (0, index_1.changedFileSet)(options.changedFiles ?? [], changedRegions),
        changedRegions,
        coverage: options.coverage ?? [],
        coveredOnly: options.coveredOnly ?? false
    };
    const sourceTexts = new Map();
    const discovered = sourceFiles
        .filter((filePath) => (0, catalog_1.inChangedScope)(filePath, context.changed))
        .flatMap((filePath) => {
        const text = fs_1.default.readFileSync(path_1.default.join(options.repoRoot, filePath), 'utf8');
        sourceTexts.set(filePath, text);
        return (0, catalog_1.candidateMutationSites)(text, filePath);
    });
    const excluded = [];
    const exclude = (site, reason) => {
        excluded.push({ siteId: site.id, filePath: site.filePath, line: site.span.startLine, reason });
    };
    const eligible = discovered.filter((site) => {
        const reason = (0, catalog_1.eligibilityExclusion)(site, context);
        if (reason) {
            exclude(site, reason);
        }
        return reason === undefined;
    });
    const targets = options.targets ?? [];
    const resolvedTargets = targets.map((target) => resolveTarget(target, { repoRoot: options.repoRoot, sourceFiles: new Set(sourceFiles), changed: context.changed, functions: options.functions ?? [], discovered, sourceTexts }));
    let matched = eligible;
    if (targets.length > 0) {
        matched = eligible.filter((site) => {
            if (resolvedTargets.some((item) => item.matches(site))) {
                return true;
            }
            exclude(site, resolvedTargets.some((item) => item.nested(site)) ? 'nested-function' : 'not-targeted');
            return false;
        });
    }
    const maxSites = typeof options.maxSites === 'number' ? options.maxSites : undefined;
    const sites = maxSites === undefined ? matched : matched.slice(0, maxSites);
    for (const site of matched.slice(sites.length)) {
        exclude(site, 'budget-sites');
    }
    for (const item of resolvedTargets) {
        if (item.resolution.status !== 'resolved') {
            continue;
        }
        item.resolution.matchedSites = matched.filter((site) => item.matches(site)).length;
        item.resolution.selectedSites = sites.filter((site) => item.matches(site)).length;
        if (item.resolution.matchedSites === 0) {
            // The identity exists, but nothing in it is eligible (outside the changed hunks, uncovered or nested only).
            item.resolution.status = 'unresolved';
            item.resolution.reason = 'no-eligible-sites';
        }
    }
    const order = new Map(discovered.map((site, index) => [site.id, index]));
    excluded.sort((left, right) => (order.get(left.siteId) ?? 0) - (order.get(right.siteId) ?? 0));
    return {
        sites,
        ledger: {
            version: '1',
            policy: { coveredOnly: context.coveredOnly, maxSites: maxSites ?? null, maxDurationMs: options.maxDurationMs ?? null, targets },
            counts: { discovered: discovered.length, eligible: eligible.length, selected: sites.length, excluded: excluded.length, executed: 0, cached: 0, unobserved: 0 },
            targets: resolvedTargets.map((item) => item.resolution),
            excluded,
            complete: false
        }
    };
}
//# sourceMappingURL=selection.js.map