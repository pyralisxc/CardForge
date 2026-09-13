import { createCreatorInteractionSession } from './interactionSession';

/**
 * Current Product Reality metadata for the contextual Studio workbench.
 * This is descriptive source-adjacent evidence, not intended placement policy.
 * Keeping an implementation reference makes the declaration move/fail with its owner.
 */
export const APP_SHELL_PRODUCT_REALITY = [
  {
    productRealityKind: 'surface',
    id: 'studio',
    label: 'Studio',
    role: 'workbench',
    implementation: createCreatorInteractionSession,
  },
  {
    productRealityKind: 'capability',
    id: 'creator.exact-context-return',
    label: 'Exact creator focus and tool return context',
    category: 'navigation',
    ownerFeature: 'app-shell',
    surfaces: ['desk', 'studio'],
    implementation: createCreatorInteractionSession,
  },
] as const;
