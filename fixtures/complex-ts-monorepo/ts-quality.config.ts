export default {
  sourcePatterns: ['packages/api/src/**/*.ts'],
  testPatterns: ['packages/api/test/**/*.js'],
  coverage: { lcovPath: 'coverage/api-token.lcov.info' },
  mutations: {
    testCommand: ['node', 'packages/api/test/token.test.js'],
    coveredOnly: true,
    timeoutMs: 10000,
    maxSites: 4,
    runtimeMirrorRoots: ['dist']
  },
  policy: { maxChangedCrap: 40, minMutationScore: 0.5, minMergeConfidence: 60 },
  changeSet: { diffFile: '.ts-quality/inputs/review.diff' },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json'
};
