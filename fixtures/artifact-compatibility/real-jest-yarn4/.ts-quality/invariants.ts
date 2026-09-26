export default [
  {
    id: 'config.malformed-yaml-fails-informatively',
    title: 'Malformed appmap.yml fails with guidance and is never overwritten',
    description: 'Loading a syntactically broken appmap.yml throws an informative error telling the user how to recover, and leaves the file untouched.',
    severity: 'high',
    selectors: ['src/config.ts'],
    scenarios: [
      {
        id: 'malformed-appmap-yml',
        description: 'An unterminated flow mapping in appmap.yml makes new Config() throw.',
        keywords: ['malformed', 'toThrowError', 'You can remove the file to use the default configuration'],
        expected: 'new Config() throws the recovery hint and appmap.yml keeps its original content.',
        executionWitnessPatterns: ['.ts-quality/witnesses/config-malformed-yaml.json']
      }
    ]
  }
];
