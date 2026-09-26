export default [
  {
    id: 'runtime-config.path-containment',
    title: 'Runtime database and workspace paths stay inside the config directory',
    description: 'Configured database and workspace paths may not escape the config directory lexically or through symlinked parents.',
    severity: 'high',
    selectors: ['src/core/runtime-config.ts'],
    scenarios: [
      {
        id: 'escape-attempts-rejected',
        description: 'Lexical ../ escapes and symlinked parents in runtime paths are rejected.',
        keywords: ['cannot escape', 'symlink', 'toThrow'],
        expected: 'Loading a runtime config whose paths escape the config directory throws.',
        executionWitnessPatterns: ['.ts-quality/witnesses/runtime-config-path-containment.json']
      }
    ]
  }
];
