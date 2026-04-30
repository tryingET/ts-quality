export default {
  sourcePatterns: ['src/**/*.js'],
  testPatterns: ['test/**/*.js'],
  coverage: { lcovPath: 'coverage/lcov.info' },
  mutations: { testCommand: ['node', '--test', 'test/masked.test.js'], coveredOnly: false, timeoutMs: 10000, maxSites: 12 },
  policy: { maxChangedCrap: 40, minMutationScore: 0, minMergeConfidence: 0 },
  changeSet: { files: ['src/masked.js'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json'
};
