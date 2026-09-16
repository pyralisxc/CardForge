import { useSpatialGestures } from '../hooks/useSpatialGestures';

/** Current shared spatial-input capability as source-adjacent Development Intelligence evidence. */
export const CARD_RENDERING_CAPABILITY_INTELLIGENCE = [
  {
    developmentIntelligence: {
      kind: 'capability',
      id: 'card-rendering.spatial-gestures',
      label: 'Pointer, touch pan, pinch zoom, and hold-to-drag spatial gestures',
      category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:card-rendering' }],
    },
    implementation: useSpatialGestures,
  },
] as const;
