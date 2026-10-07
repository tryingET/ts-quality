"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNavigation = buildNavigation;
exports.compareInterventionLineage = compareInterventionLineage;
exports.collectGitContext = collectGitContext;
exports.renderNavigationText = renderNavigationText;
const child_process_1 = require("child_process");
const index_1 = require("../../evidence-model/src/index");
const CLASS_RANK = {
    'evidence-invalidity': 1,
    'governance-veto': 2,
    'legitimacy-denial': 3,
    'behavioral-counterexample': 4,
    'coverage-witness-insufficiency': 5,
    'policy-burden': 6,
    'context-suggestion': 7
};
const SEVERITY_RANK = { blocking: 1, warning: 2, info: 3 };
const ORDERING_EXPLANATION = 'Items sort by class rank, then severity, then scope, then identity (lexical). Class ranks: evidence-invalidity 1, governance-veto 2, legitimacy-denial 3, behavioral-counterexample 4, coverage-witness-insufficiency 5, policy-burden 6, context-suggestion 7. This headline is separate from the protected primaryAction, which is reported unchanged.';
// Verdict finding codes the class builders below cover; any other blocking finding becomes a policy-burden item.
const MAPPED_FINDING_CODES = new Set(['mutation-baseline', 'mutation-evidence-missing', 'governance', 'surviving-mutant', 'mutation-execution', 'invariant-risk']);
/** Severity follows the verdict: an unwaived error blocks; a waived or warning finding does not. */
function severityFor(findings, id, fallback) {
    const finding = findings.get(id);
    if (!finding) {
        return { severity: fallback, note: '' };
    }
    if (finding.waived) {
        return { severity: 'warning', note: ` (waived by ${finding.waiverId ?? 'a waiver'})` };
    }
    return { severity: finding.level === 'error' ? 'blocking' : 'warning', note: '' };
}
function item(input) {
    const scope = [...input.scope].sort((left, right) => left.localeCompare(right));
    return { ...input, scope, orderKey: [CLASS_RANK[input.class], SEVERITY_RANK[input.severity], scope.join(','), input.identity] };
}
function compareItems(left, right) {
    for (let index = 0; index < left.orderKey.length; index += 1) {
        const a = left.orderKey[index];
        const b = right.orderKey[index];
        if (a < b)
            return -1;
        if (a > b)
            return 1;
    }
    return 0;
}
function targetSpec(target) {
    if (target.kind === 'site')
        return `site:${target.siteId}`;
    if (target.kind === 'file')
        return `file:${target.filePath}`;
    if (target.kind === 'span')
        return `span:${target.filePath}:${target.startLine}-${target.endLine}`;
    return `symbol:${target.filePath}#${target.symbol}${target.startLine !== undefined ? `@${target.startLine}-${target.endLine}` : ''}`;
}
/** The same check again under a new run id: same config, changed scope and mutation targets. */
function recheckExperiment(run, inputs, stopCriteria) {
    const configPath = run.analysis?.configPath;
    const commaInScope = run.changedFiles.some((file) => file.includes(','));
    const targets = run.mutationSelection?.policy.targets ?? [];
    return {
        argv: [
            'ts-quality', 'check',
            ...(configPath ? ['--config', configPath] : []),
            ...(commaInScope ? [] : ['--changed', run.changedFiles.join(',')]),
            ...(targets.length > 0 ? ['--mutation-targets', targets.map(targetSpec).join(';')] : []),
            '--run-id', '<new-run-id>'
        ],
        cwd: '.',
        inputs,
        stopCriteria: commaInScope ? `${stopCriteria} A changed path contains a comma, so set changeSet.files instead of --changed.` : stopCriteria,
        executed: false
    };
}
function focusedTestsFor(run, filePath) {
    const normalized = (0, index_1.normalizePath)(filePath);
    return [...new Set(run.behaviorClaims
            .filter((claim) => (claim.evidenceSummary?.impactedFiles ?? []).map((entry) => (0, index_1.normalizePath)(entry)).includes(normalized))
            .flatMap((claim) => claim.evidenceSummary?.focusedTests ?? []))].sort((left, right) => left.localeCompare(right));
}
function evidenceInvalidity(run, drift, findings) {
    const items = drift.map((entry) => {
        const changedPath = entry.subject.startsWith('changed file ') ? entry.subject.slice('changed file '.length) : undefined;
        return item({
            class: 'evidence-invalidity',
            severity: 'blocking',
            scope: changedPath ? [changedPath] : [],
            identity: `drift:${entry.subject}`,
            why: `${entry.subject} changed since run ${run.runId} (recorded ${entry.expected}, now ${entry.actual}); this run no longer describes the workspace.`,
            experiment: recheckExperiment(run, changedPath ? [changedPath] : [], 'A new run id checks the current bytes; never re-check this run id.')
        });
    });
    if (run.mutationBaseline && run.mutationBaseline.status !== 'pass') {
        const { severity, note } = severityFor(findings, 'policy:mutation-baseline', 'blocking');
        items.push(item({
            class: 'evidence-invalidity',
            severity,
            scope: run.changedFiles,
            identity: 'mutation-baseline',
            why: `The unmutated test command ended ${run.mutationBaseline.status}, so no mutant outcome is evidence${note}.`,
            experiment: recheckExperiment(run, [...run.changedFiles], 'The unmutated test command passes and the new check reports a green baseline.')
        }));
    }
    else if (run.mutationSelection && !run.mutationSelection.complete) {
        const { counts } = run.mutationSelection;
        items.push(item({
            class: 'evidence-invalidity',
            severity: 'warning',
            scope: run.changedFiles,
            identity: 'mutation-selection-incomplete',
            why: `Mutation evidence is incomplete: ${counts.selected} selected, ${counts.executed} executed, ${counts.cached} cached, ${counts.unobserved} not executed; selected sites without a verdict are unknown, not clean.`
        }));
    }
    return items;
}
function governanceVetoes(run, findings) {
    return run.governance
        .filter((finding) => finding.level === 'error')
        .map((finding) => {
        const { severity, note } = severityFor(findings, `policy:governance:${finding.id}`, 'blocking');
        return item({ class: 'governance-veto', severity, scope: finding.scope, identity: `governance:${finding.id}`, why: `${finding.message}${note}` });
    });
}
function legitimacyDenials(authorizations) {
    return authorizations
        .filter((record) => record.outcome !== 'approve')
        .map((record) => item({ class: 'legitimacy-denial', severity: 'blocking', scope: [], identity: record.identity, why: `Authorization outcome ${record.outcome}${record.reasons.length > 0 ? `: ${record.reasons.join('; ')}` : ''}.` }));
}
function behavioralCounterexamples(run, findings) {
    return run.mutations.flatMap((result) => {
        const where = `${result.filePath}:${result.span?.startLine ?? '?'}`;
        if (result.status === 'survived') {
            const { severity, note } = severityFor(findings, `policy:surviving:${result.siteId}`, 'blocking');
            return [item({
                    class: 'behavioral-counterexample',
                    severity,
                    scope: [result.filePath],
                    identity: `site:${result.siteId}`,
                    why: `Mutant ${JSON.stringify(result.original ?? '')} -> ${JSON.stringify(result.replacement ?? '')} at ${where} survived the test command${note}.`,
                    experiment: recheckExperiment(run, [result.filePath, ...focusedTestsFor(run, result.filePath)], `After tightening an assertion, site ${result.siteId} is killed in the new check with a green baseline.`)
                })];
        }
        if (result.status === 'error' || result.status === 'invalid') {
            const { severity, note } = severityFor(findings, `policy:mutation-error:${result.siteId}`, 'blocking');
            return [item({ class: 'behavioral-counterexample', severity, scope: [result.filePath], identity: `site:${result.siteId}`, why: `Mutant at ${where} has no verdict (${result.errorKind ?? result.status}): unknown, not killed${note}.` })];
        }
        return [];
    });
}
function coverageWitnessInsufficiency(run, findings) {
    const missing = findings.get('policy:mutation-missing');
    const evidenceMissing = missing ? [item({
            class: 'coverage-witness-insufficiency',
            ...(() => { const { severity, note } = severityFor(findings, 'policy:mutation-missing', 'blocking'); return { severity, why: `${missing.message}: no killed or surviving mutant was measured${note}.` }; })(),
            scope: missing.scope,
            identity: 'mutation-evidence-missing',
            experiment: recheckExperiment(run, [...run.changedFiles], 'The new check measures at least one killed or surviving mutant in the changed scope.')
        })] : [];
    const claims = run.behaviorClaims
        .filter((claim) => claim.status !== 'supported')
        .map((claim) => {
        const { severity, note } = severityFor(findings, `policy:invariant:${claim.invariantId}`, claim.status === 'at-risk' ? 'blocking' : 'warning');
        return item({ class: 'coverage-witness-insufficiency', severity, scope: claim.evidenceSummary?.impactedFiles ?? [], identity: `invariant:${claim.invariantId}`, why: `Invariant ${claim.invariantId} is ${claim.status}${note}.` });
    });
    const coverage = run.complexity
        .filter((entry) => entry.changed && entry.coverageStatus !== undefined && entry.coverageStatus !== 'measured')
        .map((entry) => item({ class: 'coverage-witness-insufficiency', severity: 'warning', scope: [entry.filePath], identity: `coverage:${entry.filePath}#${entry.symbol}`, why: `Coverage of changed ${entry.symbol} is unknown (${entry.coverageStatus}).` }));
    const excluded = run.mutationSelection?.excluded ?? [];
    const exclusions = excluded.length === 0 ? [] : [item({
            class: 'coverage-witness-insufficiency',
            severity: 'warning',
            scope: [...new Set(excluded.map((entry) => entry.filePath))],
            identity: 'mutation-selection-exclusions',
            why: `${excluded.length} changed-scope site(s) were not mutation-tested (${[...new Set(excluded.map((entry) => entry.reason))].sort().join(', ')}); their absence from the results is not evidence.`
        })];
    return [...evidenceMissing, ...claims, ...coverage, ...exclusions];
}
function policyBurden(run) {
    const findings = run.verdict.findings
        .filter((finding) => !MAPPED_FINDING_CODES.has(finding.code))
        .map((finding) => item({
        class: 'policy-burden',
        severity: finding.waived ? 'warning' : finding.level === 'error' ? 'blocking' : 'warning',
        scope: finding.scope,
        identity: `policy:${finding.code}:${finding.id}`,
        why: `${finding.message}${finding.waived ? ` (waived by ${finding.waiverId ?? 'a waiver'})` : ''}`
    }));
    const confidence = run.verdict.blockedBy
        .filter((reason) => reason.startsWith('Merge confidence '))
        .map((reason) => item({ class: 'policy-burden', severity: 'blocking', scope: [], identity: 'policy:merge-confidence', why: reason }));
    return [...findings, ...confidence];
}
function contextSuggestions(git) {
    return (git?.hints ?? []).map((hint) => item({ class: 'context-suggestion', severity: 'info', scope: [hint.filePath], identity: `git:${hint.hint}:${hint.filePath}`, why: `${hint.filePath}: ${hint.hint} (Git fact, not evidence; it cannot create, clear or outrank an obligation).` }));
}
function buildNavigation(input) {
    const { run } = input;
    const findings = new Map(run.verdict.findings.map((finding) => [finding.id, finding]));
    const queue = [
        ...evidenceInvalidity(run, input.drift, findings),
        ...governanceVetoes(run, findings),
        ...legitimacyDenials(input.authorizations),
        ...behavioralCounterexamples(run, findings),
        ...coverageWitnessInsufficiency(run, findings),
        ...policyBurden(run),
        ...contextSuggestions(input.git)
    ];
    if (run.verdict.blockedBy.length > 0 && !queue.some((entry) => entry.severity === 'blocking')) {
        // The navigation never contradicts a blocked verdict: unmapped block reasons surface as policy burden.
        run.verdict.blockedBy.forEach((reason, index) => queue.push(item({ class: 'policy-burden', severity: 'blocking', scope: [], identity: `verdict:blocked:${index + 1}`, why: reason })));
    }
    queue.sort(compareItems);
    const first = queue.find((entry) => entry.severity === 'blocking');
    const primary = run.nextEvidenceAction?.primaryAction;
    return {
        version: '1',
        kind: 'ts-quality-navigation',
        runId: run.runId,
        derived: true,
        primaryAction: primary ? { kind: primary.kind, title: primary.title, source: 'run.nextEvidenceAction.primaryAction (unchanged)' } : null,
        headline: first ? { class: first.class, identity: first.identity, why: first.why } : { class: 'none', identity: 'none', why: 'No blocking facts for this run.' },
        orderingExplanation: ORDERING_EXPLANATION,
        queue,
        comparisons: [
            { type: 'cache-reuse', basis: 'exact execution fingerprint, source digest and site identity', claim: 'a result marked origin cached is the same observation reused, not a new one' },
            { type: 'aggregate-trend', basis: 'comparable scope, invariants, policy, constitution and mutation selection (ts-quality trend)', claim: 'score movement between comparable runs, not a causal improvement' },
            { type: 'intervention-lineage', basis: 'same site identity, fresh green execution, fixed context except declared test edits', claim: input.lineage ? 'see lineage' : 'not requested (use --intervention-from and --intervention-tests)' }
        ],
        ...(input.lineage ? { lineage: input.lineage } : {}),
        ...(input.git ? { context: { git: input.git } } : {})
    };
}
function digestsChanged(before, after) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => before[key] !== after[key]).sort((left, right) => left.localeCompare(right));
}
/**
 * Compares an observed survivor in `before` with the same site in `after`. A site counts as cleared only when it
 * was freshly executed and killed behind a green baseline, its identity and source are unchanged, and the only
 * context change is an edit to the declared test files.
 */
function compareInterventionLineage(before, after, declaredTests) {
    const declared = [...new Set(declaredTests.map((entry) => (0, index_1.normalizePath)(entry)))].sort((left, right) => left.localeCompare(right));
    const beforeContext = before.mutationContext;
    const afterContext = after.mutationContext;
    const runChanges = [];
    if (beforeContext && afterContext) {
        const testChanges = digestsChanged(beforeContext.testFileDigests, afterContext.testFileDigests);
        if (declared.some((file) => beforeContext.testFileDigests[file] !== undefined && afterContext.testFileDigests[file] === undefined))
            runChanges.push('test-deleted');
        if (testChanges.some((file) => !declared.includes(file)))
            runChanges.push('undeclared-test-change');
        if (!declared.some((file) => testChanges.includes(file)))
            runChanges.push('declared-test-unchanged');
        if ((0, index_1.stableStringify)(beforeContext.testCommand) !== (0, index_1.stableStringify)(afterContext.testCommand))
            runChanges.push('command-changed');
        if (beforeContext.timeoutMs !== afterContext.timeoutMs)
            runChanges.push('timeout-changed');
        if ((0, index_1.stableStringify)(beforeContext.runtime) !== (0, index_1.stableStringify)(afterContext.runtime))
            runChanges.push('runtime-changed');
        if (beforeContext.environmentDigest !== afterContext.environmentDigest)
            runChanges.push('environment-changed');
        if (digestsChanged(beforeContext.dependencyDigests, afterContext.dependencyDigests).length > 0)
            runChanges.push('dependency-changed');
        if ((0, index_1.stableStringify)(beforeContext.tool) !== (0, index_1.stableStringify)(afterContext.tool))
            runChanges.push('tool-changed');
        // Any changed source file can explain a kill, not only the survivor's own file.
        const sourceDigests = (run) => Object.fromEntries(run.files.map((entry) => [(0, index_1.normalizePath)(entry.filePath), entry.digest]));
        const sourceChanged = digestsChanged(sourceDigests(before), sourceDigests(after)).length > 0;
        if (sourceChanged)
            runChanges.push('source-changed');
        if (!sourceChanged && beforeContext.nonTestFilesDigest !== afterContext.nonTestFilesDigest)
            runChanges.push('support-file-changed');
    }
    if (before.controlPlane?.configDigest !== after.controlPlane?.configDigest)
        runChanges.push('config-changed');
    if ((0, index_1.stableStringify)(before.controlPlane?.policy ?? null) !== (0, index_1.stableStringify)(after.controlPlane?.policy ?? null))
        runChanges.push('policy-changed');
    const excludedAfter = new Set((after.mutationSelection?.excluded ?? []).map((entry) => entry.siteId));
    const observedSurvivors = before.mutations.filter((result) => result.status === 'survived' && result.origin !== 'not-executed');
    const sites = observedSurvivors.map((survivor) => {
        const base = { siteId: survivor.siteId, filePath: survivor.filePath, line: survivor.span?.startLine ?? null, original: survivor.original ?? null, replacement: survivor.replacement ?? null };
        const unknown = (reason, contextChanges, detail) => ({
            ...base, status: 'unknown', reason, contextChanges, statement: `observed survivor before; ${detail}; the obligation stays open`, clearsObligation: false
        });
        if (!beforeContext || !afterContext) {
            return unknown('no-execution-context', runChanges, 'a run lacks the recorded execution context needed to compare');
        }
        const afterResult = after.mutations.find((result) => result.siteId === survivor.siteId);
        if (!after.changedFiles.map((entry) => (0, index_1.normalizePath)(entry)).includes((0, index_1.normalizePath)(survivor.filePath))) {
            return unknown('outside-after-scope', runChanges, 'the after run did not include this file in its changed scope');
        }
        if (!afterResult) {
            return excludedAfter.has(survivor.siteId)
                ? unknown('not-selected-after', runChanges, 'the site was not selected after')
                : unknown('site-identity-missing', runChanges, 'no site with the same identity exists after (the source moved or changed)');
        }
        if (after.mutationBaseline?.status !== 'pass') {
            return unknown('baseline-not-green-after', runChanges, 'the after baseline was not green');
        }
        if (afterResult.status === 'error' || afterResult.status === 'invalid' || afterResult.status === 'skipped') {
            return unknown('no-verdict-after', runChanges, `the site has no verdict after (${afterResult.errorKind ?? afterResult.status})`);
        }
        if (afterResult.origin === 'cached') {
            return unknown('cached-after', runChanges, 'the after result is a cached reuse, not a fresh observation');
        }
        const siteChanges = [...runChanges];
        if (afterResult.status === 'survived') {
            return { ...base, status: 'still-survived', contextChanges: siteChanges, statement: 'observed survivor before; observed survivor after', clearsObligation: false };
        }
        if (siteChanges.length > 0) {
            return { ...base, status: 'killed-with-context-change', contextChanges: siteChanges, statement: `observed survivor before; observed kill after, but the context also changed (${siteChanges.join(', ')}), so the kill is not attributed to the declared test edit`, clearsObligation: false };
        }
        return { ...base, status: 'observed-kill-after-declared-intervention', contextChanges: [], statement: 'observed survivor before; observed kill after declared test edit. This is an observation under a fixed context, not proof that the edit alone is responsible', clearsObligation: true };
    });
    return {
        comparison: 'intervention-lineage',
        beforeRunId: before.runId,
        afterRunId: after.runId,
        declaredTests: declared,
        contextChanges: runChanges,
        sites,
        clearsBroaderInvariants: false,
        note: 'Clearing a mutation site never clears an invariant obligation; that still needs a current focused witness and governance.'
    };
}
// Pinned settings so Git facts do not depend on user configuration, never refresh the index and never run fsmonitor.
const GIT_PINNED_CONFIG = ['core.fsmonitor=false', 'core.untrackedCache=false', 'core.quotePath=false', 'log.follow=false', 'log.showSignature=false', 'log.mailmap=false', 'status.showUntrackedFiles=normal', 'diff.renames=true'];
function git(rootDir, args) {
    const result = (0, child_process_1.spawnSync)('git', ['--no-optional-locks', ...GIT_PINNED_CONFIG.flatMap((setting) => ['-c', setting]), '-C', rootDir, ...args], {
        encoding: 'utf8',
        env: { ...process.env, GIT_LITERAL_PATHSPECS: '1', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' }
    });
    return { ok: result.status === 0, stdout: (result.stdout ?? '').trim(), missing: result.error?.code === 'ENOENT' };
}
function utcSeconds(iso) {
    return new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');
}
/** Read-only Git facts for the given files, pinned to an explicit ancestor commit. Facts, not evidence. */
function collectGitContext(rootDir, horizon, files) {
    const note = 'Git history facts, not evidence: they never create, clear or outrank an obligation.';
    if (horizon.startsWith('-') || horizon.length === 0) {
        throw new Error(`--git-horizon must name a commit, not an option: ${horizon}`);
    }
    const empty = { horizon, note, files: [], hints: [] };
    const inside = git(rootDir, ['rev-parse', '--is-inside-work-tree']);
    if (inside.missing) {
        return { available: false, reason: 'git-unavailable', ...empty };
    }
    if (inside.stdout !== 'true') {
        return { available: false, reason: 'not-a-git-repository', ...empty };
    }
    const shallow = git(rootDir, ['rev-parse', '--is-shallow-repository']).stdout === 'true';
    const resolved = git(rootDir, ['rev-parse', '--verify', '--quiet', `${horizon}^{commit}`]);
    if (!resolved.ok) {
        return { available: false, reason: 'horizon-not-in-history', shallow, ...empty };
    }
    if (!git(rootDir, ['merge-base', '--is-ancestor', resolved.stdout, 'HEAD']).ok) {
        return { available: false, reason: 'horizon-not-ancestor', shallow, ...empty };
    }
    const head = git(rootDir, ['rev-parse', 'HEAD']).stdout;
    const prefix = git(rootDir, ['rev-parse', '--show-prefix']).stdout;
    const range = `${resolved.stdout}..HEAD`;
    const facts = [...new Set(files.map((entry) => (0, index_1.normalizePath)(entry)))].sort((left, right) => left.localeCompare(right)).map((filePath) => {
        // --follow keeps history across renames, so counts and renamedFrom describe the same file.
        const log = git(rootDir, ['log', '--follow', '--format=%H%x09%aE%x09%cI', range, '--', filePath]).stdout.split('\n').filter(Boolean);
        const status = git(rootDir, ['status', '--porcelain', '--', filePath]).stdout;
        const renames = git(rootDir, ['log', '--follow', '--name-status', '--format=', range, '--', filePath]).stdout.split('\n').filter((line) => /^R\d*\t/.test(line));
        const oldestTopLevel = renames[renames.length - 1]?.split('\t')[1];
        // name-status paths are relative to the repository top level; report them relative to --root like filePath.
        const oldest = oldestTopLevel && prefix && oldestTopLevel.startsWith(prefix) ? oldestTopLevel.slice(prefix.length) : oldestTopLevel;
        return {
            filePath,
            commitsSinceHorizon: log.length,
            lastCommitAt: log[0] ? utcSeconds(log[0].split('\t')[2]) : null,
            authorCount: new Set(log.map((line) => line.split('\t')[1])).size,
            uncommittedChanges: status.length > 0 && !status.startsWith('??'),
            untracked: status.startsWith('??'),
            ...(oldest && oldest !== filePath ? { renamedFrom: oldest } : {})
        };
    });
    const hints = facts.flatMap((fact) => [
        ...(fact.uncommittedChanges ? [{ filePath: fact.filePath, hint: 'uncommitted-changes' }] : []),
        ...(fact.commitsSinceHorizon >= 5 ? [{ filePath: fact.filePath, hint: 'high-churn' }] : []),
        ...(fact.renamedFrom ? [{ filePath: fact.filePath, hint: 'renamed' }] : [])
    ]);
    return { available: true, horizon, horizonCommit: resolved.stdout, head, shallow, note, files: facts, hints };
}
function experimentText(experiment) {
    return `   experiment (not run): argv ${JSON.stringify(experiment.argv)} cwd ${experiment.cwd} inputs ${JSON.stringify(experiment.inputs)}; stop when: ${experiment.stopCriteria}`;
}
function renderNavigationText(nav) {
    const lines = [
        `Navigation for run ${nav.runId} (derived and read-only; nothing ran)`,
        `Primary action (unchanged): ${nav.primaryAction ? `${nav.primaryAction.kind}: ${nav.primaryAction.title}` : 'none'}`,
        `Navigation headline: ${nav.headline.class === 'none' ? nav.headline.why : `${nav.headline.class}: ${nav.headline.why}`}`,
        `Queue (${nav.orderingExplanation.split('. ')[0]}):`
    ];
    nav.queue.forEach((entry, index) => {
        lines.push(`${index + 1}. [${entry.class}, ${entry.severity}] ${entry.identity}: ${entry.why}`);
        if (entry.experiment) {
            lines.push(experimentText(entry.experiment));
        }
    });
    if (nav.queue.length === 0) {
        lines.push('- none');
    }
    if (nav.lineage) {
        lines.push(`Intervention lineage ${nav.lineage.beforeRunId} -> ${nav.lineage.afterRunId} (declared tests: ${nav.lineage.declaredTests.join(', ')}):`);
        for (const site of nav.lineage.sites) {
            lines.push(`- ${site.filePath}:${site.line ?? '?'} ${JSON.stringify(site.original)} -> ${JSON.stringify(site.replacement)}: ${site.status}${site.reason ? ` (${site.reason})` : ''}${site.contextChanges.length > 0 ? ` [${site.contextChanges.join(', ')}]` : ''}`);
        }
        lines.push(nav.lineage.note);
    }
    if (nav.context?.git) {
        const gitContext = nav.context.git;
        lines.push(gitContext.available ? `Git context since ${gitContext.horizon} (${gitContext.note}):` : `Git context unavailable: ${gitContext.reason}`);
        for (const fact of gitContext.files) {
            lines.push(`- ${fact.filePath}: ${fact.commitsSinceHorizon} commit(s), last ${fact.lastCommitAt ?? 'none'}, ${fact.authorCount} author(s)${fact.uncommittedChanges ? ', uncommitted changes' : ''}${fact.renamedFrom ? `, renamed from ${fact.renamedFrom}` : ''}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
//# sourceMappingURL=navigation.js.map