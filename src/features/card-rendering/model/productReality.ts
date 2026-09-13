import { useSpatialGestures } from '../hooks/useSpatialGestures';

/** Current shared spatial-input behavior, exposed as descriptive Product Reality evidence. */
export const CARD_RENDERING_PRODUCT_REALITY = [
  {
    productRealityKind: 'capability',
    id: 'card-rendering.spatial-gestures',
    label: 'Pointer, touch pan, pinch zoom, and hold-to-drag spatial gestures',
    category: 'interaction',
    ownerFeature: 'card-rendering',
    surfaces: ['desk', 'studio'],
    implementation: useSpatialGestures,
  },
] as const;
