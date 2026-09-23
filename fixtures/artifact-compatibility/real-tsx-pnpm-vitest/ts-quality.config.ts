// ts-quality pilot config: pnpm workspace, React TSX, Vitest + jsdom, vite-tsconfig-paths source aliases.
const focused = ['pnpm', 'exec', 'vitest', 'run', 'tests/react-renderer.test.tsx'];
export default {
  sourcePatterns: ['packages/react/src/index.tsx'],
  testPatterns: ['tests/react-renderer.test.tsx'],
  coverage: {
    lcovPath: '.ts-quality/adoption/coverage/lcov.info',
    generateCommand: [...focused, '--coverage.enabled', '--coverage.provider=v8', '--coverage.reporter=lcov', '--coverage.reportsDirectory=.ts-quality/adoption/coverage', '--coverage.include=packages/react/src/**'],
    generateWhenMissing: true,
    generateTimeoutMs: 120000
  },
  mutations: { testCommand: focused, coveredOnly: true, timeoutMs: 60000, maxSites: 12, runtimeMirrorRoots: ['dist'] },
  policy: { maxChangedCrap: 80, minMutationScore: 0.6, minMergeConfidence: 60 },
  changeSet: { files: [] },
  invariantsPath: '.ts-quality/invariants.ts',
  constitutionPath: '.ts-quality/constitution.ts',
  agentsPath: '.ts-quality/agents.ts'
};
