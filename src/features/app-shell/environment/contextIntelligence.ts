import { createCreatorInteractionSession } from './interactionSession';

/** Current app-shell surface/capability semantics as source-adjacent Development Intelligence evidence. */
export const APP_SHELL_CONTEXT_INTELLIGENCE = [
  {
    developmentIntelligence: {
      kind: 'surface', id: 'studio', label: 'Studio', role: 'workbench',
      relationships: [
        { kind: 'compatibility-ingress', to: 'route:/studio' },
        { kind: 'exposes', to: 'capability:card-rendering.spatial-gestures' },
        { kind: 'exposes', to: 'capability:creator.exact-context-return' },
        { kind: 'exposes', to: 'tool:design' },
        { kind: 'exposes', to: 'tool:generate' },
        { kind: 'exposes', to: 'tool:output' },
        { kind: 'exposes', to: 'tool:pipeline' },
      ],
    },
    implementation: createCreatorInteractionSession,
  },
  {
    developmentIntelligence: {
      kind: 'capability',
      id: 'creator.exact-context-return',
      label: 'Exact creator focus and tool return context',
      category: 'navigation',
      relationships: [{ kind: 'owned-by', to: 'feature:app-shell' }],
    },
    implementation: createCreatorInteractionSession,
  },
] as const;
