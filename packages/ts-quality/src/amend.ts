import fs from 'fs';
import path from 'path';
import {
  type AmendmentDecision,
  type AmendmentProposal,
  type Approval,
  type ConstitutionRule,
  ensureDir,
  renderSafeText,
  resolveRepoLocalPath,
  stableStringify,
  writeJson
} from '../../evidence-model/src/index';
import { applyAmendment, evaluateAmendment } from '../../legitimacy/src/index';
import { loadAgents, loadConstitution, loadContext } from './config';
import { resolveCliRepoLocalPath } from './cli-paths';
import { writeModuleExport } from './materialize-adopt';

/** Constitutional amendment proposals: strict reading, evaluation and optional application. */

function renderAmendmentChangeSummary(change: NonNullable<AmendmentDecision['proposalContext']>['changes'][number]): string {
  const currentRuleKind = renderSafeText(change.currentRuleKind ?? 'none');
  const proposedRuleKind = renderSafeText(change.proposedRuleKind ?? 'none');
  return `- ${renderSafeText(change.action)} ${renderSafeText(change.ruleId)} (current=${currentRuleKind}; proposed=${proposedRuleKind}; sensitivity=${renderSafeText(change.sensitivity)})`;
}
function renderAmendmentDecisionText(decision: AmendmentDecision): string {
  const proposalContext = decision.proposalContext;
  const lines = [
    `Proposal: ${renderSafeText(proposalContext?.title ?? decision.proposalId)}`,
    `Proposal ID: ${renderSafeText(decision.proposalId)}`,
    `Outcome: ${renderSafeText(decision.outcome)}`,
    `Required approvals: ${String(decision.requiredApprovals)}`,
    `Accepted approvals: ${decision.approvalsAccepted.length > 0 ? decision.approvalsAccepted.map((item) => renderSafeText(item)).join(', ') : 'none'}`
  ];
  if (proposalContext) {
    lines.push(`Approval burden basis: ${renderSafeText(proposalContext.approvalBurdenBasis)}`);
    lines.push(`Sensitive rules: ${proposalContext.sensitiveRuleIds.length > 0 ? proposalContext.sensitiveRuleIds.map((item) => renderSafeText(item)).join(', ') : 'none'}`);
    lines.push(`Rationale: ${renderSafeText(proposalContext.rationale)}`);
    lines.push('', 'Evidence:');
    lines.push(...(proposalContext.evidence.length > 0
      ? proposalContext.evidence.map((item) => `- ${renderSafeText(item)}`)
      : ['- none']));
    lines.push('', 'Changes:');
    lines.push(...(proposalContext.changes.length > 0
      ? proposalContext.changes.map((change) => renderAmendmentChangeSummary(change))
      : ['- none']));
  }
  lines.push('', 'Reasons:');
  lines.push(...(decision.reasons.length > 0
    ? decision.reasons.map((reason) => `- ${renderSafeText(reason)}`)
    : ['- none']));
  return `${lines.join('\n')}\n`;
}
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function invalidAmendmentProposal(sourceLabel: string, message: string): Error {
  return new Error(`invalid amendment proposal in ${sourceLabel}: ${message}`);
}
function invalidAmendmentProposalJson(sourceLabel: string, message: string): Error {
  return new Error(`invalid amendment proposal JSON in ${sourceLabel}: ${message}`);
}
function amendmentStringField(record: Record<string, unknown>, field: string, sourceLabel: string, options?: { optional?: boolean }): string | undefined {
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
function amendmentArrayField(record: Record<string, unknown>, field: string, sourceLabel: string): unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw invalidAmendmentProposal(sourceLabel, `field ${field} must be an array`);
  }
  return value;
}
function readAmendmentProposal(proposalPath: string): AmendmentProposal {
  const sourceLabel = path.basename(proposalPath);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  } catch (error) {
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
    const action = amendmentStringField(item, 'action', sourceLabel) as AmendmentProposal['changes'][number]['action'];
    const ruleId = amendmentStringField(item, 'ruleId', sourceLabel) as string;
    const ruleValue = item['rule'];
    if (ruleValue !== undefined && !isPlainRecord(ruleValue)) {
      throw invalidAmendmentProposal(sourceLabel, `field changes[${index}].rule must be an object when provided`);
    }
    return {
      action,
      ruleId,
      ...(ruleValue !== undefined ? { rule: ruleValue as unknown as ConstitutionRule } : {})
    };
  });

  const approvals = amendmentArrayField(raw, 'approvals', sourceLabel).map((item, index) => {
    if (!isPlainRecord(item)) {
      throw invalidAmendmentProposal(sourceLabel, `field approvals[${index}] must be an object`);
    }
    const by = amendmentStringField(item, 'by', sourceLabel) as string;
    const rationale = amendmentStringField(item, 'rationale', sourceLabel) as string;
    const createdAt = amendmentStringField(item, 'createdAt', sourceLabel) as string;
    const targetId = amendmentStringField(item, 'targetId', sourceLabel) as string;
    const role = amendmentStringField(item, 'role', sourceLabel, { optional: true });
    const standing = amendmentStringField(item, 'standing', sourceLabel, { optional: true });
    return {
      by,
      rationale,
      createdAt,
      targetId,
      ...(role !== undefined ? { role } : {}),
      ...(standing !== undefined ? { standing } : {})
    } satisfies Approval;
  });

  return {
    id: amendmentStringField(raw, 'id', sourceLabel) as string,
    title: amendmentStringField(raw, 'title', sourceLabel) as string,
    rationale: amendmentStringField(raw, 'rationale', sourceLabel) as string,
    evidence,
    changes,
    approvals
  };
}
export function runAmend(rootDir: string, proposalFile: string, apply = false, options?: { configPath?: string }): string {
  const loaded = loadContext(rootDir, options?.configPath);
  const constitution = loadConstitution(rootDir, loaded.config.constitutionPath);
  const agents = loadAgents(rootDir, loaded.config.agentsPath);
  const proposalPath = resolveCliRepoLocalPath(rootDir, proposalFile, { kind: 'amendment proposal' }).absolutePath;
  const proposal = readAmendmentProposal(proposalPath);
  const decision = evaluateAmendment(proposal, constitution, agents);
  const resultPath = path.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.json`);
  const resultTextPath = path.join(rootDir, '.ts-quality', 'amendments', `${proposal.id}.result.txt`);
  ensureDir(path.dirname(resultPath));
  writeJson(resultPath, decision);
  fs.writeFileSync(resultTextPath, renderAmendmentDecisionText(decision), 'utf8');
  if (apply && decision.outcome === 'approved') { // ubs:ignore amendment outcome enum check, not a secret comparison
    const nextConstitution = applyAmendment(proposal, constitution);
    const constitutionPath = resolveRepoLocalPath(rootDir, loaded.config.constitutionPath, { allowMissing: true, kind: 'constitution path' }).absolutePath;
    writeModuleExport(constitutionPath, nextConstitution);
  }
  return `${stableStringify(decision)}
`;
}
