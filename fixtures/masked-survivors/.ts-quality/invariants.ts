export default [
  {
    id: 'masked.survivor.behavior',
    title: 'Masked survivor behavior remains observable',
    description: 'Masked survivor fixtures must produce next-evidence guidance that points agents toward observable behavior instead of only naming changed operators.',
    severity: 'high',
    selectors: ['path:src/masked.js'],
    requiredTestPatterns: ['test/masked.test.js'],
    scenarios: [
      {
        id: 'masked-boundaries',
        description: 'boundary, equality, combined condition, and boolean changes are masked by later truthiness or fallback behavior',
        keywords: ['masked boundary output', 'masked equality output', 'masked combined condition output', 'masked boolean output'],
        failurePathKeywords: ['missing fallback', 'remains truthy'],
        expected: 'observable-guidance'
      }
    ]
  }
];
