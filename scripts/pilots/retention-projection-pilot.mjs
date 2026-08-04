#!/usr/bin/env node

import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const {
  buildArtifactRetentionPlan,
  renderArtifactRetentionPlanMachine
} = await import(path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'index.js'));

function usage() {
  return 'Usage: node scripts/pilots/retention-projection-pilot.mjs [--root <dir>] [--config <file>]\n';
}

function parseArgs(argv) {
  let rootDir = process.cwd();
  let configPath;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    }
    if (arg !== '--root' && arg !== '--config') {
      throw new Error(`unexpected argument ${arg}`);
    }
    const value = argv[index + 1];
    if (!value) {
      throw new Error(`${arg} requires a value`);
    }
    index += 1;
    if (arg === '--root') {
      rootDir = path.resolve(value);
    } else {
      configPath = value;
    }
  }
  return { rootDir, ...(configPath ? { configPath } : {}) };
}

function safeText(value) {
  return String(value).replace(/[\t\r\n]+/gu, ' ').trim();
}

function renderMachineFromPlan(plan) {
  const lines = [
    'TSQ_RETENTION_PLAN_V1',
    `root\t${safeText(plan.rootDir)}`,
    plan.config.loaded
      ? `config\tok\tpath=${safeText(plan.config.path ?? '')}`
      : `config\terror\tmessage=${safeText(plan.config.error ?? 'missing')}`,
    ...plan.keep.map((entry) => `keep\t${safeText(entry.status ?? 'pattern')}\t${safeText(entry.path)}\treason=${safeText(entry.reason)}`),
    ...plan.ignore.map((entry) => `ignore\t${safeText(entry.status ?? 'pattern')}\t${safeText(entry.path)}\treason=${safeText(entry.reason)}`),
    ...plan.warnings.map((warning) => `warning\t${safeText(warning)}`)
  ];
  return `${lines.join('\n')}\n`;
}

function parseMachineProjection(compactText) {
  const lines = compactText.trimEnd().split('\n');
  if (lines.shift() !== 'TSQ_RETENTION_PLAN_V1') {
    throw new Error('compact projection has an unexpected protocol header');
  }
  const parsed = { root: undefined, config: undefined, keep: [], ignore: [], warnings: [] };
  for (const line of lines) {
    const fields = line.split('\t');
    const kind = fields.shift();
    if (kind === 'root' && fields.length === 1) {
      parsed.root = fields[0];
    } else if (kind === 'config' && fields.length === 2) {
      const [status, detail] = fields;
      const separator = detail.indexOf('=');
      if (separator < 1) throw new Error('compact config record lacks key/value detail');
      parsed.config = { status, key: detail.slice(0, separator), value: detail.slice(separator + 1) };
    } else if ((kind === 'keep' || kind === 'ignore') && fields.length === 3) {
      const [status, entryPath, reasonField] = fields;
      if (!reasonField.startsWith('reason=')) throw new Error(`compact ${kind} record lacks reason`);
      parsed[kind].push({ status, path: entryPath, reason: reasonField.slice('reason='.length) });
    } else if (kind === 'warning' && fields.length === 1) {
      parsed.warnings.push(fields[0]);
    } else {
      throw new Error(`compact projection has malformed ${kind ?? 'unknown'} record`);
    }
  }
  if (parsed.root === undefined || parsed.config === undefined) {
    throw new Error('compact projection lacks root or config record');
  }
  return parsed;
}

function pointerToken(value) {
  return String(value).replaceAll('~', '~0').replaceAll('/', '~1');
}

function leafPointers(value, pointer = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafPointers(item, `${pointer}/${index}`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => leafPointers(item, `${pointer}/${pointerToken(key)}`));
  }
  return [pointer || '/'];
}

function expectedProjectionFromPlan(plan) {
  const represented = new Set(['/rootDir', '/config/loaded']);
  const derived = [];
  const mapEntry = (entry, collection, index) => {
    represented.add(`/${collection}/${index}/path`);
    represented.add(`/${collection}/${index}/reason`);
    if (entry.status === undefined) {
      derived.push(`/${collection}/${index}/status=pattern`);
    } else {
      represented.add(`/${collection}/${index}/status`);
    }
    return {
      status: safeText(entry.status ?? 'pattern'),
      path: safeText(entry.path),
      reason: safeText(entry.reason)
    };
  };
  const config = plan.config.loaded
    ? (() => {
        represented.add('/config/path');
        return { status: 'ok', key: 'path', value: safeText(plan.config.path ?? '') };
      })()
    : (() => {
        if (plan.config.error === undefined) {
          derived.push('/config/error=missing');
        } else {
          represented.add('/config/error');
        }
        return { status: 'error', key: 'message', value: safeText(plan.config.error ?? 'missing') };
      })();
  plan.warnings.forEach((_warning, index) => represented.add(`/warnings/${index}`));
  return {
    projection: {
      root: safeText(plan.rootDir),
      config,
      keep: plan.keep.map((entry, index) => mapEntry(entry, 'keep', index)),
      ignore: plan.ignore.map((entry, index) => mapEntry(entry, 'ignore', index)),
      warnings: plan.warnings.map(safeText)
    },
    represented,
    derived
  };
}

function validateCompactClaims(plan, compactText) {
  const parsed = parseMachineProjection(compactText);
  const expected = expectedProjectionFromPlan(plan);
  if (JSON.stringify(parsed) !== JSON.stringify(expected.projection)) {
    throw new Error('parsed compact claims drifted from the exact owner plan');
  }
  const omissions = leafPointers(plan).filter((pointer) => !expected.represented.has(pointer)).sort();
  return {
    claims_subset_of_source_plan: true,
    explicit_omissions: omissions,
    explicit_derivations: expected.derived,
    expansion_pointer: '/structured_owner_plan'
  };
}

const options = parseArgs(process.argv.slice(2));
const planOptions = options.configPath ? { configPath: options.configPath } : undefined;

// One owner-produced plan is the sole source for both projections in this pilot.
const plan = buildArtifactRetentionPlan(options.rootDir, planOptions);
const compactText = renderMachineFromPlan(plan);
const compactChecks = validateCompactClaims(plan, compactText);

// This comparison detects drift between the experimental from-plan renderer and
// the existing public renderer. It is valid only because the pilot is read-only
// and the target fixture is held stable for the duration of this process.
const ownerMachineText = renderArtifactRetentionPlanMachine(options.rootDir, planOptions);
const ownerRendererMatch = ownerMachineText === compactText;
if (!ownerRendererMatch) {
  throw new Error('experimental compact renderer does not match the owner renderer');
}

const structuredBytes = Buffer.byteLength(JSON.stringify(plan));
const compactBytes = Buffer.byteLength(compactText);
const receipt = {
  pilot: {
    surface: 'ts-quality.agent-interaction.retention-projection-pilot',
    schema_version: 1,
    experimental: true,
    read_only: true,
    authority: 'ts-quality owner plan remains advisory; this receipt is dogfood evidence only',
    compatibility_promise: false
  },
  source: {
    digest_sha256: crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex'),
    generation: 'single in-process ArtifactRetentionPlan object'
  },
  structured_owner_plan: plan,
  compact_projection: {
    protocol: 'TSQ_RETENTION_PLAN_V1',
    text: compactText,
    omissions: compactChecks.explicit_omissions,
    derivations: compactChecks.explicit_derivations,
    expansion_pointer: compactChecks.expansion_pointer
  },
  measurements: {
    structured_bytes: structuredBytes,
    compact_bytes: compactBytes,
    byte_reduction: structuredBytes - compactBytes,
    compact_to_structured_ratio: Number((compactBytes / structuredBytes).toFixed(4))
  },
  checks: {
    same_owner_plan_generation: true,
    compact_claims_subset_of_source_plan: compactChecks.claims_subset_of_source_plan,
    omissions_explicit: compactChecks.explicit_omissions.length > 0,
    derivations_explicit: true,
    expansion_available: true,
    owner_machine_renderer_match: ownerRendererMatch,
    no_mutation_requested: true
  }
};

process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
