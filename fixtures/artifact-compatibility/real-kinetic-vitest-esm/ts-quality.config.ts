export default {
  sourcePatterns: ['packages/core/src/segmentation.ts'],
  testPatterns: ['.ts-quality/adoption/segmentation-proof.test.ts', 'tests/segmentation.test.ts'],
  coverage: {
    lcovPath: '.ts-quality/adoption/lcov.info',
    generateCommand: [
      'bash',
      '-lc',
      'mkdir -p .ts-quality/adoption && NODE_OPTIONS=--enable-source-maps node --import tsx --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=.ts-quality/adoption/lcov.info .ts-quality/adoption/segmentation-proof.test.ts'
    ],
    generateWhenMissing: true,
    generateTimeoutMs: 60000
  },
  mutations: {
    testCommand: ['node', '--import', 'tsx', '--test', '.ts-quality/adoption/segmentation-proof.test.ts'],
    coveredOnly: true,
    timeoutMs: 60000,
    maxSites: 12,
    runtimeMirrorRoots: ['dist']
  },
  policy: { maxChangedCrap: 80, minMutationScore: 0.8, minMergeConfidence: 70 },
  changeSet: { files: ['packages/core/src/segmentation.ts'] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts',
  approvalsPath: '.ts-quality/approvals.json',
  waiversPath: '.ts-quality/waivers.json',
  overridesPath: '.ts-quality/overrides.json'
};
