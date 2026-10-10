import { type CoverageGenerationRecord, type NextEvidenceAction, type RunArtifact } from '../../evidence-model/src/index';
import { generateGovernancePlan } from '../../governance/src/index';
/** Text and Markdown renderers for check summaries, evidence-closure prompts, plans and governance artifacts. */
export declare function renderInvariantProvenanceBlock(run: Pick<RunArtifact, 'behaviorClaims'>, options?: {
    linePrefix?: string;
    includeObligation?: boolean;
}): string[];
export declare function renderCheckSummaryText(run: Pick<RunArtifact, 'behaviorClaims' | 'verdict' | 'executionWitnesses' | 'coverageGeneration' | 'analysisWarnings' | 'nextEvidenceAction'>): string;
export declare function renderCoverageGenerationText(record: CoverageGenerationRecord): string;
export declare function renderNextEvidenceActionText(action: NextEvidenceAction): string;
export declare function renderEvidenceClosurePromptMarkdown(action: NextEvidenceAction): string;
export declare function renderEvidenceClosureTaskManifest(action: NextEvidenceAction): string;
export declare function renderPlanText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string;
export declare function renderPlanArtifactText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string;
export declare function renderGovernanceText(run: RunArtifact, plan: ReturnType<typeof generateGovernancePlan>): string;
export declare function renderGovernanceArtifactText(run: RunArtifact, _plan: ReturnType<typeof generateGovernancePlan>): string;
