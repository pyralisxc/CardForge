import { createCreatorInteractionSession } from './interactionSession';

/**
 * Current Product Reality metadata for the contextual Studio workbench.
 * This is descriptive source-adjacent evidence, not intended placement policy.
 * Keeping an implementation reference makes the declaration move/fail with its owner.
 * Legacy Product Reality fields remain only for the migration dual-run.
 */
export const APP_SHELL_PRODUCT_REALITY = [
  {
    productRealityKind: 'surface',
    id: 'studio',
    label: 'Studio',
    role: 'workbench',
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
    productRealityKind: 'capability',
    id: 'creator.exact-context-return',
    label: 'Exact creator focus and tool return context',
    category: 'navigation',
    ownerFeature: 'app-shell',
    surfaces: ['desk', 'studio'],
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
