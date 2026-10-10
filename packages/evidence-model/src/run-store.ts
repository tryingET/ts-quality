import fs from 'fs';
import path from 'path';
import { resolveRepoLocalPath } from './paths';
import {
  assertSafeRunId,
  ensureDir,
  readJson,
  stableStringify,
  writeJson
} from './text-io';
import { LatestPointer, RunArtifact } from './types-run';

/** Run id reservation, staged atomic publication of run packets, the latest pointer and loading of published runs. */

// Reservations are retained even after failure: retry with a new id, never rebind approvals.
export function reserveRunId(rootDir: string, runId: string): void {
  const safeRunId = assertSafeRunId(runId);
  const runsRoot = resolveRepoLocalPath(rootDir, '.ts-quality/runs', { allowMissing: true, kind: 'run storage' }).absolutePath;
  ensureDir(runsRoot);
  const artifactRoot = path.join(runsRoot, safeRunId);
  const occupied = () => new Error(`Run ${safeRunId} already exists or is reserved. Use a new run id for a new check.`);
  if (fs.existsSync(artifactRoot)) {
    throw occupied();
  }
  try {
    fs.writeFileSync(path.join(runsRoot, `.${safeRunId}.reserved`), '', { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw occupied();
    }
    throw error;
  }
}
const RUN_PUBLICATION_FILE = 'publication.json';
/** Lists the check-time files of a run packet; it is written last, just before the packet becomes visible. */
export interface RunPacketPublication {
  version: '1';
  kind: 'run-packet-publication';
  runId: string;
  files: string[];
}
export interface StagedRunArtifact {
  runId: string;
  stagingDir: string;
}
export class IncompleteRunPacketError extends Error {}
/** Test-only fault injection for crash-recovery proofs: TS_QUALITY_TEST_FAULT=<point> aborts at that point. */
export function injectTestFault(point: 'after-run-json' | 'before-publish' | 'before-latest'): void {
  if (process.env['TS_QUALITY_TEST_FAULT'] === point) {
    throw new Error(`injected fault at ${point}`);
  }
}
function runsRootFor(rootDir: string): string {
  const runsRoot = resolveRepoLocalPath(rootDir, '.ts-quality/runs', { allowMissing: true, kind: 'run storage' }).absolutePath;
  ensureDir(runsRoot);
  return runsRoot;
}
/** Builds a run packet in a hidden staging directory; nothing under the run id is visible until it is published. */
export function stageRunArtifact(rootDir: string, run: RunArtifact): StagedRunArtifact {
  const safeRunId = assertSafeRunId(run.runId);
  const stagingDir = fs.mkdtempSync(path.join(runsRootFor(rootDir), `.${safeRunId}.staging-`));
  fs.writeFileSync(path.join(stagingDir, 'run.json'), `${stableStringify(run)}\n`, { flag: 'wx' });
  injectTestFault('after-run-json');
  writeJson(path.join(stagingDir, 'verdict.json'), run.verdict);
  return { runId: safeRunId, stagingDir };
}
function writeLatestPointer(rootDir: string, runId: string): void {
  const pointerPath = path.join(rootDir, '.ts-quality', 'latest.json');
  const temporaryPath = `${pointerPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporaryPath, `${stableStringify({ latestRunId: runId } satisfies LatestPointer)}\n`, 'utf8');
  // rename replaces the pointer atomically, so readers never see a torn latest.json.
  fs.renameSync(temporaryPath, pointerPath);
}
/**
 * Publishes a staged packet with one directory rename. An existing run is never replaced; on failure the staging
 * directory is removed. The latest pointer moves only after the complete packet is visible.
 */
export function publishRunArtifact(rootDir: string, staged: StagedRunArtifact): string {
  const target = path.join(runsRootFor(rootDir), staged.runId);
  try {
    const files = fs.readdirSync(staged.stagingDir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
    const publication: RunPacketPublication = { version: '1', kind: 'run-packet-publication', runId: staged.runId, files: [...files, RUN_PUBLICATION_FILE].sort((left, right) => left.localeCompare(right)) };
    writeJson(path.join(staged.stagingDir, RUN_PUBLICATION_FILE), publication);
    injectTestFault('before-publish');
    if (fs.existsSync(target)) {
      throw new Error(`Run ${staged.runId} already exists; published packets are never replaced. Use a new run id for a new check.`);
    }
    fs.renameSync(staged.stagingDir, target);
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('injected fault'))) {
      fs.rmSync(staged.stagingDir, { recursive: true, force: true });
    }
    throw error;
  }
  injectTestFault('before-latest');
  writeLatestPointer(rootDir, staged.runId);
  return target;
}
export function writeRunArtifact(rootDir: string, run: RunArtifact): string {
  return publishRunArtifact(rootDir, stageRunArtifact(rootDir, run));
}
export function readLatestRun(rootDir: string): RunArtifact {
  const latestPointerPath = path.join(rootDir, '.ts-quality', 'latest.json');
  if (!fs.existsSync(latestPointerPath)) {
    throw new Error(`No latest run pointer found at ${latestPointerPath}`);
  }
  const pointer = readJson<LatestPointer>(latestPointerPath);
  return loadRun(rootDir, pointer.latestRunId);
}
/** Published run ids; hidden staging directories left by an interrupted check are never listed. */
export function listRunIds(rootDir: string): string[] {
  const runsDir = path.join(rootDir, '.ts-quality', 'runs');
  if (!fs.existsSync(runsDir)) {
    return [];
  }
  return fs.readdirSync(runsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort();
}
/**
 * Loads a run packet. A packet with a publication record must still contain every listed file; packets from
 * versions before publication records (run.json only) stay readable for compatibility.
 */
export function loadRun(rootDir: string, runId: string): RunArtifact {
  const safeRunId = assertSafeRunId(runId);
  const runDir = path.join(rootDir, '.ts-quality', 'runs', safeRunId);
  const publicationPath = path.join(runDir, RUN_PUBLICATION_FILE);
  if (fs.existsSync(publicationPath)) {
    const publication = readJson<Partial<RunPacketPublication>>(publicationPath);
    if (publication.version !== '1' || publication.kind !== 'run-packet-publication' || publication.runId !== safeRunId || !Array.isArray(publication.files) || !publication.files.every((file) => typeof file === 'string' && file.length > 0 && !file.includes('..'))) {
      throw new IncompleteRunPacketError(`Run ${safeRunId} has a malformed or mismatched publication record; it cannot be projected. Re-check with a new run id.`);
    }
    const missing = publication.files.filter((file) => !fs.existsSync(path.join(runDir, file)));
    if (missing.length > 0) {
      throw new IncompleteRunPacketError(`Run ${safeRunId} packet is incomplete: missing ${missing.join(', ')}; it cannot be projected. Re-check with a new run id.`);
    }
  }
  return readJson<RunArtifact>(path.join(runDir, 'run.json'));
}
