// ts-quality pilot config: CommonJS TypeScript library, Jest with @swc/jest, Yarn 4, tests colocated in src/__tests__.
const jest = ['node', '.yarn/releases/yarn-4.13.0.cjs', 'jest', 'src/__tests__/config.test.ts'];
export default {
  sourcePatterns: ['src/config.ts'],
  testPatterns: ['src/__tests__/config.test.ts'],
  coverage: {
    lcovPath: '.ts-quality/adoption/coverage/lcov.info',
    generateCommand: [...jest, '--coverage', '--coverageReporters=lcov', '--coverageDirectory=.ts-quality/adoption/coverage', '--collectCoverageFrom=src/config.ts'],
    generateWhenMissing: true,
    generateTimeoutMs: 120000
  },
  mutations: { testCommand: [...jest, '--runInBand'], coveredOnly: true, timeoutMs: 60000, maxSites: 12, runtimeMirrorRoots: ['dist'] },
  policy: { maxChangedCrap: 80, minMutationScore: 0.6, minMergeConfidence: 60 },
  changeSet: { files: [] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts'
};
