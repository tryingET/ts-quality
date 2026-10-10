"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestComparableRunOrUndefined = latestComparableRunOrUndefined;
exports.renderTrend = renderTrend;
const index_1 = require("../../evidence-model/src/index");
const render_text_1 = require("./render-text");
function orderedRuns(rootDir) {
    return (0, index_1.listRunIds)(rootDir)
        .flatMap((runId) => {
        try {
            return [(0, index_1.loadRun)(rootDir, runId)];
        }
        catch (error) {
            // An incomplete packet is never a comparison candidate; explicit projections of it still fail closed.
            if (error instanceof index_1.IncompleteRunPacketError) {
                return [];
            }
            throw error;
        }
    })
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.runId.localeCompare(right.runId));
}
function sortedUniqueNormalized(values) {
    return [...new Set(values.map((item) => (0, index_1.normalizePath)(item)).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
function changedRegionSignatures(regions) {
    return [...new Set(regions.map((region) => `${(0, index_1.normalizePath)(region.filePath)}:${region.span.startLine}-${region.span.endLine}`))]
        .sort((left, right) => left.localeCompare(right));
}
function equalStringLists(left, right) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
}
function assessTrendComparability(current, previous) {
    const reasons = [];
    if (!equalStringLists(sortedUniqueNormalized(current.changedFiles), sortedUniqueNormalized(previous.changedFiles))) {
        reasons.push('changed file scope differs');
    }
    const currentRegions = changedRegionSignatures(current.changedRegions);
    const previousRegions = changedRegionSignatures(previous.changedRegions);
    if ((currentRegions.length > 0 || previousRegions.length > 0) && !equalStringLists(currentRegions, previousRegions)) {
        reasons.push('changed hunk scope differs');
    }
    if ((0, index_1.stableStringify)(current.invariants) !== (0, index_1.stableStringify)(previous.invariants)) {
        reasons.push('invariant baseline differs');
    }
    const currentSelection = current.mutationSelection?.policy;
    const previousSelection = previous.mutationSelection?.policy;
    if (currentSelection && previousSelection
        ? (0, index_1.stableStringify)(currentSelection) !== (0, index_1.stableStringify)(previousSelection)
        : [currentSelection, previousSelection].some((policy) => policy !== undefined && (policy.targets.length > 0 || policy.maxDurationMs !== null))) {
        // Scores from different mutation selections (targets, budgets) measure different experiments.
        reasons.push('mutation selection differs');
    }
    if (current.controlPlane && previous.controlPlane) {
        if ((0, index_1.stableStringify)(current.controlPlane.policy) !== (0, index_1.stableStringify)(previous.controlPlane.policy)) {
            reasons.push('policy baseline differs');
        }
        if (current.controlPlane.constitutionDigest !== previous.controlPlane.constitutionDigest) {
            reasons.push('constitution baseline differs');
        }
    }
    else if (Boolean(current.controlPlane) !== Boolean(previous.controlPlane)) {
        reasons.push('control-plane snapshot availability differs');
    }
    return {
        comparable: reasons.length === 0,
        reasons
    };
}
function latestComparableRunOrUndefined(rootDir, current) {
    const runs = orderedRuns(rootDir);
    for (let index = runs.length - 1; index >= 0; index -= 1) {
        const candidate = runs[index];
        if (candidate && assessTrendComparability(current, candidate).comparable) {
            return candidate;
        }
    }
    return undefined;
}
function renderTrend(rootDir) {
    const runs = orderedRuns(rootDir);
    if (runs.length < 2) {
        return 'Not enough runs for trend analysis.\n';
    }
    const current = runs[runs.length - 1];
    if (!current) {
        return 'Not enough runs for trend analysis.\n';
    }
    let previous;
    let nearestAssessment;
    for (let index = runs.length - 2; index >= 0; index -= 1) {
        const candidate = runs[index];
        if (!candidate) {
            continue;
        }
        const assessment = assessTrendComparability(current, candidate);
        if (!nearestAssessment) {
            nearestAssessment = { run: candidate, assessment };
        }
        if (!assessment.comparable) {
            continue;
        }
        previous = candidate;
        break;
    }
    if (!previous) {
        const lines = [
            `Current run: ${current.runId}`,
            'No comparable prior run for trend analysis.',
            'Trend comparisons require the same changed scope and invariant/policy baseline.'
        ];
        if (nearestAssessment) {
            lines.push(`Nearest earlier run: ${nearestAssessment.run.runId}`);
            lines.push(...nearestAssessment.assessment.reasons.map((reason) => `- ${reason}`));
        }
        return `${lines.join('\n')}\n`;
    }
    const survivingCurrent = current.mutations.filter((item) => item.status === 'survived').length;
    const survivingPrevious = previous.mutations.filter((item) => item.status === 'survived').length;
    const lines = [
        `Current run: ${current.runId}`,
        `Previous run: ${previous.runId}`,
        `Merge confidence delta: ${current.verdict.mergeConfidence - previous.verdict.mergeConfidence}`,
        `Surviving mutant delta: ${survivingCurrent - survivingPrevious}`,
        `Outcome transition: ${previous.verdict.outcome} -> ${current.verdict.outcome}`
    ];
    const provenance = (0, render_text_1.renderInvariantProvenanceBlock)(current, { includeObligation: false });
    if (provenance.length > 0) {
        lines.push('', ...provenance);
    }
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=trend.js.map