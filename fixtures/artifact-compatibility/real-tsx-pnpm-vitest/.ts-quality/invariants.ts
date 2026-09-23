export default [
  {
    id: 'react.missing-view-fallback',
    title: 'Missing view exports render a deterministic fallback',
    description: 'When a registered view has no renderable component export, WorkspaceRoot renders a labelled fallback instead of crashing the shell.',
    severity: 'high',
    selectors: ['packages/react/src/index.tsx'],
    scenarios: [
      {
        id: 'demo-manifest-missing-preview',
        description: 'The demo manifest registers view.preview without a PreviewView export; the stack renders the missing-view fallback.',
        keywords: ['Missing view export', 'data-missing-view', 'isRenderableComponentType', 'fallback'],
        expected: 'Registration fails and the view.preview stack renders "Missing view export" with the view title and stack id.',
        executionWitnessPatterns: ['.ts-quality/witnesses/react-missing-view-fallback.json']
      }
    ]
  }
];
