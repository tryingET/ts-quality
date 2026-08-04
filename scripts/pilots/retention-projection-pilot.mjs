#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const {
  buildArtifactRetentionPlan,
  renderArtifactRetentionPlanMachine
} = await import(path.join(repoRoot, 'dist', 'packages', 'ts-quality', 'src', 'index.js'));

const PILOT_POLICY_BODY = deepFreeze({
  id: 'ts-quality.agent-interaction.retention-projection-canary',
  version: 1,
  owner_surface: 'ts-quality.artifact-retention',
  owner_schema_version: 1,
  declared_policy_target: 'pi-agent-interaction-canary',
  allowed_source_pointers: ['/surface', '/schemaVersion', '/rootDir', '/config', '/keep', '/ignore', '/warnings'],
  compact_omissions: ['/schemaVersion', '/surface'],
  redactions: ['control-characters', 'authorized-root-path', 'secret-token-patterns'],
  validity_context: {
    mode: 'read-only-retention-projection-pilot',
    config_path: 'ts-quality.config.json',
    fixture_root_coordinate: 'fixtures/minimal-external-adoption',
    observable_read_boundaries: ['fixture-root', 'in-memory-owner-policy']
  }
});
const PILOT_POLICY_DIGEST_SHA256 = 'd7ec868f732e0e361c2c1b6290ec4f9e4d3b505050dc36c51cb40d8e2ef41e00';

function deepFreeze(value) {
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') deepFreeze(child);
  }
  return Object.freeze(value);
}

function usage() {
  return 'Usage: node scripts/pilots/retention-projection-pilot.mjs [--root fixtures/minimal-external-adoption] [--config ts-quality.config.json] --policy-target pi-agent-interaction-canary\n';
}

function canonicalFixtureRoot() {
  return path.join(repoRoot, PILOT_POLICY_BODY.validity_context.fixture_root_coordinate);
}

function parseArgs(argv) {
  let rootDir = canonicalFixtureRoot();
  let configPath = PILOT_POLICY_BODY.validity_context.config_path;
  let declaredPolicyTarget;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      process.stdout.write(usage());
      process.exit(0);
    }
    if (!['--root', '--config', '--policy-target'].includes(arg)) throw new Error(`unexpected argument ${arg}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`${arg} requires a value`);
    index += 1;
    if (arg === '--root') rootDir = path.resolve(value);
    else if (arg === '--config') configPath = value;
    else declaredPolicyTarget = value;
  }
  if (declaredPolicyTarget !== PILOT_POLICY_BODY.declared_policy_target) {
    throw new Error('declared policy target does not match the owner pilot policy');
  }
  if (configPath !== PILOT_POLICY_BODY.validity_context.config_path) {
    throw new Error('config path is outside the owner pilot policy validity context');
  }
  if (fs.realpathSync(rootDir) !== fs.realpathSync(canonicalFixtureRoot())) {
    throw new Error('root is not the canonical owner fixture authorized by the production pilot policy');
  }
  return { rootDir, configPath, declaredPolicyTarget };
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

function validateCompactClaims(plan, compactText, sourcePlan = plan) {
  const parsed = parseMachineProjection(compactText);
  const expected = expectedProjectionFromPlan(plan);
  if (JSON.stringify(parsed) !== JSON.stringify(expected.projection)) {
    throw new Error('parsed compact claims drifted from the exact owner plan');
  }
  const omissions = leafPointers(sourcePlan).filter((pointer) => !expected.represented.has(pointer)).sort();
  return {
    claims_subset_of_source_plan: true,
    explicit_omissions: omissions,
    explicit_derivations: expected.derived,
    expansion_pointer: '/structured_owner_plan'
  };
}

const READ_METHODS = ['existsSync', 'readFileSync', 'readdirSync', 'statSync', 'lstatSync', 'realpathSync'];

function observeReadEffects(rootDir, callback) {
  const effects = [];
  const originals = new Map();
  for (const method of READ_METHODS) {
    const original = fs[method];
    originals.set(method, original);
    fs[method] = function observedRead(...args) {
      const candidate = typeof args[0] === 'string' || args[0] instanceof URL ? fileURLToPathIfNeeded(args[0]) : undefined;
      let outcome = 'returned';
      let result;
      try {
        result = original.apply(this, args);
        return result;
      } catch (error) {
        outcome = 'threw';
        throw error;
      } finally {
        if (candidate !== undefined) effects.push({ operation: method, target: describeReadTarget(rootDir, candidate), outcome });
        if (method === 'realpathSync' && typeof result === 'string') {
          effects.push({ operation: 'realpathSync:resolved', target: describeReadTarget(rootDir, result), outcome });
        }
      }
    };
  }
  try {
    return { value: callback(), effects };
  } finally {
    for (const [method, original] of originals) fs[method] = original;
  }
}

function fileURLToPathIfNeeded(value) {
  return value instanceof URL ? fileURLToPath(value) : value;
}

function describeReadTarget(rootDir, candidate) {
  const absolute = path.resolve(candidate);
  const relative = path.relative(rootDir, absolute);
  if (relative === '') return { scope: 'authorized-root', path: '.' };
  if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    return { scope: 'authorized-root', path: relative.replaceAll(path.sep, '/') };
  }
  return { scope: 'outside-authorized-root', path: absolute };
}

function isAuthorized(pointer, policyBody) {
  return policyBody.allowed_source_pointers.some((allowed) => pointer === allowed || pointer.startsWith(`${allowed}/`));
}

function requireProjectionAuthorization(plan, policyBody) {
  const unauthorizedClaims = leafPointers(plan).filter((pointer) => !isAuthorized(pointer, policyBody));
  if (unauthorizedClaims.length > 0) {
    throw new Error(`owner pilot policy does not authorize source claims: ${unauthorizedClaims.join(', ')}`);
  }
  if (plan.surface !== policyBody.owner_surface || plan.schemaVersion !== policyBody.owner_schema_version) {
    throw new Error('owner plan surface or schema version is outside the owner pilot policy');
  }
}

function createRedactor(rootDir) {
  const events = { control_characters: 0, authorized_root_paths: 0, secret_token_patterns: 0 };
  return {
    text(value) {
      let output = String(value);
      output = output.replace(/[\u0000-\u001f\u007f]/gu, () => {
        events.control_characters += 1;
        return ' ';
      });
      for (const rootForm of [...new Set([rootDir, rootDir.replaceAll(path.sep, '/')])]) {
        if (rootForm && output.includes(rootForm)) {
          events.authorized_root_paths += output.split(rootForm).length - 1;
          output = output.replaceAll(rootForm, '<authorized-root>');
        }
      }
      output = output.replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/gu, () => {
        events.secret_token_patterns += 1;
        return '<redacted-secret>';
      });
      return output.trim();
    },
    events
  };
}

function redactPlan(plan, redactor) {
  const redactEntry = (entry) => ({
    status: redactor.text(entry.status ?? 'pattern'),
    path: redactor.text(entry.path),
    reason: redactor.text(entry.reason)
  });
  return {
    surface: plan.surface,
    schemaVersion: plan.schemaVersion,
    rootDir: redactor.text(plan.rootDir),
    config: plan.config.loaded
      ? { loaded: true, path: redactor.text(plan.config.path ?? '') }
      : { loaded: false, ...(plan.config.error === undefined ? {} : { error: redactor.text(plan.config.error) }) },
    keep: plan.keep.map(redactEntry),
    ignore: plan.ignore.map(redactEntry),
    warnings: plan.warnings.map((warning) => redactor.text(warning))
  };
}

function redactReadEffects(effects, redactor) {
  const unique = new Map();
  for (const effect of effects) {
    const redacted = { ...effect, target: { ...effect.target, path: redactor.text(effect.target.path) } };
    const key = JSON.stringify(redacted);
    const existing = unique.get(key);
    unique.set(key, existing ? { ...existing, occurrences: existing.occurrences + 1 } : { ...redacted, occurrences: 1 });
  }
  return [...unique.values()].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function executePilot(options, policyBody, expectedPolicyDigest) {
  const computedPolicyDigest = sha256(JSON.stringify(policyBody));
  if (expectedPolicyDigest !== undefined && computedPolicyDigest !== expectedPolicyDigest) {
    throw new Error('embedded owner pilot policy digest mismatch');
  }
  const planOptions = { configPath: options.configPath };

  // Observe both owner-plan production and the parity renderer invocation. Module
  // loading occurred before this boundary and OS-level syscalls are not observed.
  const observed = observeReadEffects(options.rootDir, () => {
    const plan = buildArtifactRetentionPlan(options.rootDir, planOptions);
    const ownerMachineText = renderArtifactRetentionPlanMachine(options.rootDir, planOptions);
    return { plan, ownerMachineText };
  });
  const { plan, ownerMachineText } = observed.value;
  const outsideReads = observed.effects.filter((effect) => effect.target.scope !== 'authorized-root');
  if (outsideReads.length > 0) throw new Error('observed filesystem read escaped the owner pilot policy fixture boundary');
  requireProjectionAuthorization(plan, policyBody);

  const rawCompactText = renderMachineFromPlan(plan);
  const ownerRendererMatch = ownerMachineText === rawCompactText;
  if (!ownerRendererMatch) throw new Error('experimental compact renderer does not match the owner renderer');

  const redactor = createRedactor(options.rootDir);
  const authorizedPlan = redactPlan(plan, redactor);
  const compactText = renderMachineFromPlan(authorizedPlan);
  const compactChecks = validateCompactClaims(authorizedPlan, compactText, plan);
  if (JSON.stringify(compactChecks.explicit_omissions) !== JSON.stringify(policyBody.compact_omissions)) {
    throw new Error('compact omissions drifted from the owner pilot policy');
  }
  const recoverableOmissions = compactChecks.explicit_omissions.map((pointer) => {
    const recovered = resolvePointer(authorizedPlan, pointer);
    if (recovered === undefined) throw new Error(`compact omission is not recoverable from authorized expansion: ${pointer}`);
    return { pointer, expansion_pointer: `/structured_owner_plan${pointer}`, recovered: true };
  });
  const readEffects = redactReadEffects(observed.effects, redactor);
  // The raw plan remains internal. Only the post-authorization, post-redaction
  // view establishes the emitted plan-generation coordinate.
  const authorizedViewDigest = sha256(JSON.stringify(authorizedPlan));
  const compactDigest = sha256(compactText);
  const validityContext = {
    ...policyBody.validity_context,
    declared_policy_target: options.declaredPolicyTarget,
    policy_digest_sha256: computedPolicyDigest
  };
  const structuredBytes = Buffer.byteLength(JSON.stringify(authorizedPlan));
  const compactBytes = Buffer.byteLength(compactText);
  return {
    pilot: {
      surface: 'ts-quality.agent-interaction.retention-projection-pilot',
      schema_version: 4,
      experimental: true,
      read_only: true,
      authority: 'ts-quality owner plan remains advisory; this receipt is dogfood evidence only',
      compatibility_promise: false
    },
    policy: {
      id: policyBody.id,
      version: policyBody.version,
      digest_sha256: computedPolicyDigest,
      owner_surface: policyBody.owner_surface,
      owner_schema_version: policyBody.owner_schema_version,
      declared_policy_target: policyBody.declared_policy_target,
      authentication: 'deferred to the enclosing registered Pi tool receipt',
      allowed_source_pointers: policyBody.allowed_source_pointers,
      compact_omissions: policyBody.compact_omissions,
      redactions: policyBody.redactions,
      validity_context: validityContext
    },
    generation: {
      plan_generation_digest_sha256: authorizedViewDigest,
      digest_basis: 'authorized-view-after-redaction',
      policy_digest_sha256: computedPolicyDigest
    },
    structured_owner_plan: authorizedPlan,
    compact_projection: {
      protocol: 'TSQ_RETENTION_PLAN_V1',
      text: compactText,
      plan_generation_digest_sha256: authorizedViewDigest,
      policy_digest_sha256: computedPolicyDigest,
      digest_sha256: compactDigest,
      omissions: compactChecks.explicit_omissions,
      recoverable_omissions: recoverableOmissions,
      derivations: compactChecks.explicit_derivations,
      expansion_pointer: compactChecks.expansion_pointer
    },
    redaction: {
      policy: 'owner-authored control-character, authorized-root-path, and secret-token-pattern redactions apply before either emitted view',
      monotonic: true,
      replacements: redactor.events
    },
    effects: {
      classification: readEffects.length > 0 ? 'G3-read-effect-observed' : 'G3-not-observed',
      invocation_scope: 'owner plan production and owner machine renderer',
      observed_api_scope: READ_METHODS.map((method) => `node:fs.${method}`),
      reads: readEffects,
      all_observed_reads_within_policy_boundary: true,
      writes_requested_by_pilot: false,
      observation_limit: 'in-process synchronous node:fs method observation; not OS syscall tracing'
    },
    measurements: {
      structured_bytes: structuredBytes,
      compact_bytes: compactBytes,
      byte_reduction: structuredBytes - compactBytes,
      compact_to_structured_ratio: Number((compactBytes / structuredBytes).toFixed(4))
    },
    checks: {
      views_share_plan_generation: true,
      authorized_view_plan_generation_digest_bound: true,
      raw_plan_digest_unemitted: true,
      owner_authored_policy_bound: true,
      declared_policy_target_matched: true,
      caller_authentication_deferred_to_pi_tool_receipt: true,
      authorized_source_subset: true,
      redaction_monotonic: true,
      compact_claims_subset_of_source_plan: compactChecks.claims_subset_of_source_plan,
      omissions_explicit: compactChecks.explicit_omissions.length > 0,
      every_omission_recoverable_in_authorized_view: recoverableOmissions.every((entry) => entry.recovered),
      derivations_explicit: true,
      expansion_available: true,
      deterministic_content_addressing: true,
      owner_machine_renderer_match: ownerRendererMatch,
      no_mutation_requested: true
    }
  };
}

export function runPilotWithInjectedTestPolicy(rootDir) {
  const policyBody = deepFreeze({
    ...PILOT_POLICY_BODY,
    id: `${PILOT_POLICY_BODY.id}.internal-test`,
    validity_context: {
      ...PILOT_POLICY_BODY.validity_context,
      mode: 'internal-injected-test-policy',
      fixture_root_coordinate: '<injected-test-fixture>'
    }
  });
  return executePilot({
    rootDir: path.resolve(rootDir),
    configPath: policyBody.validity_context.config_path,
    declaredPolicyTarget: policyBody.declared_policy_target
  }, policyBody);
}

function resolvePointer(value, pointer) {
  return pointer.split('/').slice(1).reduce((current, token) => {
    if (current === undefined || current === null) return undefined;
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    return current[key];
  }, value);
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  const receipt = executePilot(options, PILOT_POLICY_BODY, PILOT_POLICY_DIGEST_SHA256);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
