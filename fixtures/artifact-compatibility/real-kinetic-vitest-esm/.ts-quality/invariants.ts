export default [
  {
    id: 'segmentation.readable-bursts',
    title: 'Readable-burst segmentation stays deterministic',
    description: 'The shorts-a2 segmentation profile groups normalized lesson captions into deterministic readable bursts with stable line hints and focal-word choices.',
    severity: 'medium',
    selectors: ['packages/core/src/segmentation.ts'],
    scenarios: [
      {
        id: 'lesson-basic-shorts-a2',
        description: 'The lesson-basic SRT fixture segments into the checked-in basic-segments golden output under shorts-a2.',
        keywords: ['readable-bursts-v1', 'shorts-a2', 'basic-segments', 'lineHints', 'focalWords'],
        expected: 'segmentProject returns the exact basic-segments golden fixture for lesson-basic.srt.',
        executionWitnessPatterns: ['.ts-quality/witnesses/segmentation-readable-bursts.json']
      }
    ]
  }
];
