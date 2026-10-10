import { type Attestation, type AttestationVerificationRecord, type ControlPlaneSnapshot, type RunArtifact } from '../../evidence-model/src/index';
import { defaultPolicy } from '../../policy-engine/src/index';
import { loadAgents, loadApprovals, loadConstitution, loadContext, loadOverrides } from './config';
/** Run selection, containment, control-plane snapshots, drift and the projected decision context shared by every read command. */
interface RunDriftEntry {
    subject: string;
    expected: string;
    actual: string;
}
interface RunDecisionContext {
    run: RunArtifact;
    projectedRun: RunArtifact;
    approvals: ReturnType<typeof loadApprovals>;
    overrides: ReturnType<typeof loadOverrides>;
    agents: ReturnType<typeof loadAgents>;
    constitution: ReturnType<typeof loadConstitution>;
    runAttestations: Attestation[];
    runAttestationVerification: AttestationVerificationRecord[];
    drift: RunDriftEntry[];
}
interface ReportDecisionContext {
    projection: 'persisted' | 'projected';
    drift: RunDriftEntry[];
}
interface ReportJsonArtifact extends RunArtifact {
    decisionContext: ReportDecisionContext;
}
interface RunSelectionOptions {
    runId?: string;
}
export interface RunDecisionOptions extends RunSelectionOptions {
    configPath?: string;
}
export declare function selectedRun(rootDir: string, options?: RunSelectionOptions): RunArtifact;
export declare function expectedRunFileDigest(run: RunArtifact, filePath: string): string | undefined;
export declare function digestOrMissing(absolutePath: string): string;
export declare function policyConfigFromLoadedContext(loaded: ReturnType<typeof loadContext>): ReturnType<typeof defaultPolicy>;
export declare function buildControlPlaneSnapshot(rootDir: string, loaded: ReturnType<typeof loadContext>, constitution: ReturnType<typeof loadConstitution>, agents: ReturnType<typeof loadAgents>): ControlPlaneSnapshot;
export declare function projectedRunForDecision(rootDir: string, run: RunArtifact, options?: {
    configPath?: string;
}): RunDecisionContext;
export declare function renderRunDriftNotice(run: Pick<RunArtifact, 'runId'>, drift: RunDriftEntry[]): string;
export declare function renderRunDriftMarkdownNotice(run: Pick<RunArtifact, 'runId'>, drift: RunDriftEntry[]): string;
export declare function injectMarkdownNotice(markdown: string, notice: string): string;
export declare function buildReportJsonArtifact(run: RunArtifact, decisionContext: ReportDecisionContext): ReportJsonArtifact;
/** Loads another run for comparison with repo containment (symlink escapes refused) and a supported schema version. */
export declare function assertSupportedRun(run: RunArtifact): RunArtifact;
export declare function assertContainedRunFiles(rootDir: string, runId: string): void;
export declare function loadContainedRun(rootDir: string, runId: string): RunArtifact;
export {};
