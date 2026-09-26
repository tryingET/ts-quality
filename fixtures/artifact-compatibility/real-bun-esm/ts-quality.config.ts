// ts-quality init preset: default
// Node test projects can let check create coverage/lcov.info when it is missing.
export default {
  sourcePatterns: ['src/core/runtime-config.ts'],
  testPatterns: ['tests/runtime-config.test.ts'],
  coverage: {
    lcovPath: '.ts-quality/adoption/coverage/lcov.info',
    // When lcovPath is missing, check can run this command after creating the parent directory.
    generateCommand: ['bun', 'test', 'tests/runtime-config.test.ts', '--coverage', '--coverage-reporter=lcov', '--coverage-dir=.ts-quality/adoption/coverage'],
    generateTimeoutMs: 60000
  },
  mutations: { testCommand: ['bun', 'test', 'tests/runtime-config.test.ts'], coveredOnly: true, timeoutMs: 15000, maxSites: 25, runtimeMirrorRoots: ['dist'] },
  policy: { maxChangedCrap: 30, minMutationScore: 0.8, minMergeConfidence: 70 },
  // Provide --changed <a,b,c> or set changeSet.files / changeSet.diffFile before running check.
  changeSet: { files: [] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts'
};
