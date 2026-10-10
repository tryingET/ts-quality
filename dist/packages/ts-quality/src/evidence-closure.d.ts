import { type NextEvidenceAction, type RunArtifact } from '../../evidence-model/src/index';
export declare function buildNextEvidenceAction(run: Pick<RunArtifact, 'runId' | 'coverage' | 'coverageGeneration' | 'executionWitnesses' | 'files' | 'mutations' | 'governance' | 'verdict' | 'behaviorClaims' | 'symbols'>): NextEvidenceAction;
