"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAmend = runAmend;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_1 = require("../../evidence-model/src/index");
const index_2 = require("../../legitimacy/src/index");
const config_1 = require("./config");
const cli_paths_1 = require("./cli-paths");
const materialize_adopt_1 = require("./materialize-adopt");
/** Constitutional amendment proposals: strict reading, evaluation and optional application. */
function renderAmendmentChangeSummary(change) {
    const currentRuleKind = (0, index_1.renderSafeText)(change.currentRuleKind ?? 'none');
    const proposedRuleKind = (0, index_1.renderSafeText)(change.proposedRuleKind ?? 'none');
    return `- ${(0, index_1.renderSafeText)(change.action)} ${(0, index_1.renderSafeText)(change.ruleId)} (current=${currentRuleKind}; proposed=${proposedRuleKind}; sensitivity=${(0, index_1.renderSafeText)(change.sensitivity)})`;
}
function renderAmendmentDecisionText(decision) {
    const proposalContext = decision.proposalContext;
    const lines = [
        `Proposal: ${(0, index_1.renderSafeText)(proposalContext?.title ?? decision.proposalId)}`,
        `Proposal ID: ${(0, index_1.renderSafeText)(decision.proposalId)}`,
        `Outcome: ${(0, index_1.renderSafeText)(decision.outcome)}`,
        `Required approvals: ${String(decision.requiredApprovals)}`,
        `Accepted approvals: ${decision.approvalsAccepted.length > 0 ? decision.approvalsAccepted.map((item) => (0, index_1.renderSafeText)(item)).join(', ') : 'none'}`
    ];
    if (proposalContext) {
        lines.push(`Approval burden basis: ${(0, index_1.renderSafeText)(proposalContext.approvalBurdenBasis)}`);
        lines.push(`Sensitive rules: ${proposalContext.sensitiveRuleIds.length > 0 ? proposalContext.sensitiveRuleIds.map((item) => (0, index_1.renderSafeText)(item)).join(', ') : 'none'}`);
        lines.push(`Rationale: ${(0, index_1.renderSafeText)(proposalContext.rationale)}`);
        lines.push('', 'Evidence:');
        lines.push(...(proposalContext.evidence.length > 0
            ? proposalContext.evidence.map((item) => `- ${(0, index_1.renderSafeText)(item)}`)
            : ['- none']));
        lines.push('', 'Changes:');
        lines.push(...(proposalContext.changes.length > 0
            ? proposalContext.changes.map((change) => renderAmendmentChangeSummary(change))
            : ['- none']));
    }
    lines.push('', 'Reasons:');
    lines.push(...(decision.reasons.length > 0
        ? decision.reasons.map((reason) => `- ${(0, index_1.renderSafeText)(reason)}`)
        : ['- none']));
    return `${lines.join('\n')}\n`;
}
function isPlainRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function invalidAmendmentProposal(sourceLabel, message) {
    return new Error(`invalid amendment proposal in ${sourceLabel}: ${message}`);
}
function invalidAmendmentProposalJson(sourceLabel, message) {
    return new Error(`invalid amendment proposal JSON in ${sourceLabel}: ${message}`);
}
function amendmentStringField(record, field, sourceLabel, options) {
    const value = record[field];
    if (value === undefined) {
        if (options?.optional) {
            return undefined;
        }
        throw invalidAmendmentProposal(sourceLabel, `field ${field} must be a non-empty string`);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw invalidAmendmentProposal(sourceLabel, `field ${field} must be a non-empty string`);
    }
    return value;
}
function amendmentArrayField(record, field, sourceLabel) {
    const value = record[field];
    if (!Array.isArray(value)) {
        throw invalidAmendmentProposal(sourceLabel, `field ${field} must be an array`);
    }
    return value;
}
function readAmendmentProposal(proposalPath) {
    const sourceLabel = path_1.default.basename(proposalPath);
    let raw;
    try {
        raw = JSON.parse(fs_1.default.readFileSync(proposalPath, 'utf8'));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw invalidAmendmentProposalJson(sourceLabel, message);
    }
    if (!isPlainRecord(raw)) {
        throw invalidAmendmentProposal(sourceLabel, 'top-level value must be an object');
    }
    const evidence = amendmentArrayField(raw, 'evidence', sourceLabel).map((item, index) => {
        if (typeof item !== 'string' || item.trim().length === 0) {
            throw invalidAmendmentProposal(sourceLabel, `field evidence[${index}] must be a non-empty string`);
        }
        return item;
    });
    const changes = amendmentArrayField(raw, 'changes', sourceLabel).map((item, index) => {
        if (!isPlainRecord(item)) {
            throw invalidAmendmentProposal(sourceLabel, `field changes[${index}] must be an object`);
        }
        const action = amendmentStringField(item, 'action', sourceLabel);
        const ruleId = amendmentStringField(item, 'ruleId', sourceLabel);
        const ruleValue = item['rule'];
        if (ruleValue !== undefined && !isPlainRecord(ruleValue)) {
            throw invalidAmendmentProposal(sourceLabel, `field changes[${index}].rule must be an object when provided`);
        }
        return {
            action,
            ruleId,
            ...(ruleValue !== undefined ? { rule: ruleValue } : {})
        };
    });
    const approvals = amendmentArrayField(raw, 'approvals', sourceLabel).map((item, index) => {
        if (!isPlainRecord(item)) {
            throw invalidAmendmentProposal(sourceLabel, `field approvals[${index}] must be an object`);
        }
        const by = amendmentStringField(item, 'by', sourceLabel);
        const rationale = amendmentStringField(item, 'rationale', sourceLabel);
        const createdAt = amendmentStringField(item, 'createdAt', sourceLabel);
        const targetId = amendmentStringField(item, 'targetId', sourceLabel);
        const role = amendmentStringField(item, 'role', sourceLabel, { optional: true });
        const standing = amendmentStringField(item, 'standing', sourceLabel, { optional: true });
        return {
            by,
            rationale,
            createdAt,
            targetId,
            ...(role !== undefined ? { role } : {}),
            ...(standing !== undefined ? { standing } : {})
        };
    });
    return {
        id: amendmentStringField(raw, 'id', sourceLabel),
        title: amendmentStringField(raw, 'title', sourceLabel),
        rationale: amendmentStringField(raw, 'rationale', sourceLabel),
        evidence,
        changes,
        approvals
    };
}
function runAmend(rootDir, proposalFile, apply = false, options) {
    const loaded = (0, config_1.loadContext)(rootDir, options?.configPath);
    const constitution = (0, config_1.loadConstitution)(rootDir, loaded.config.constitutionPath);
    const agents = (0, config_1.loadAgents)(rootDir, loaded.config.agentsPath);
    const proposalPath = (0, cli_paths_1.resolveCliRepoLocalPath)(rootDir, proposalFile, { kind: 'amendment proposal' }).absolutePath;
    const proposal = readAmendmentProposal(proposalPath);
    const decision = (0, index_2.evaluateAmendment)(proposal, constitution, agents);
    const resultPath = path_1.default.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.json`);
    const resultTextPath = path_1.default.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.txt`);
    (0, index_1.ensureDir)(path_1.default.dirname(resultPath));
    (0, index_1.writeJson)(resultPath, decision);
    fs_1.default.writeFileSync(resultTextPath, renderAmendmentDecisionText(decision), 'utf8');
    if (apply && decision.outcome === 'approved') { // ubs:ignore amendment outcome enum check, not a secret comparison
        const nextConstitution = (0, index_2.applyAmendment)(proposal, constitution);
        const constitutionPath = (0, index_1.resolveRepoLocalPath)(rootDir, loaded.config.constitutionPath, { allowMissing: true, kind: 'constitution path' }).absolutePath;
        (0, materialize_adopt_1.writeModuleExport)(constitutionPath, nextConstitution);
    }
    return `${(0, index_1.stableStringify)(decision)}
`;
}
//# sourceMappingURL=amend.js.map