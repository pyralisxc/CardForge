import { createCreatorDeskSnapshot } from './creatorHistory';
import {
  getDirectionalArtifactNeighbor,
  getFocusedArtifactFitZoom,
  getFocusedArtifactPresentation,
  moveFocusedArtifactSelection,
} from './focusedArtifactLayout';
import { deriveReflectiveOrganization } from './reflectiveOrganization';
import { getDeskCameraGeometry, moveDeskWorldSelection } from './deskSpatialGeometry';

/**
 * Descriptive, source-adjacent capability evidence for parity audits.
 * These declarations identify current behavior only; Product Direction remains the
 * authority for what CardForge should become.
 */
export const DESK_PRODUCT_REALITY = [
  {
    productRealityKind: 'capability',
    id: 'desk.bounded-spatial-workspace',
    label: 'Bounded spatial Desk with authored object movement',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: [getDeskCameraGeometry, moveDeskWorldSelection],
  },
  {
    productRealityKind: 'capability',
    id: 'desk.fit-custom-camera',
    label: 'Fit and Custom spatial camera',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: getDeskCameraGeometry,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.adaptive-artifact-density',
    label: 'Adaptive comfortable, compact, and dense Artifact presentation',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: getFocusedArtifactPresentation,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.complete-fit-overview',
    label: 'Complete bounded Set Fit with adaptive detail',
    category: 'accessibility',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: getFocusedArtifactFitZoom,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.focused-artifact-spatial-browse',
    label: 'Focused Artifact directional browsing through Set geometry',
    category: 'navigation',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: getDirectionalArtifactNeighbor,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.multi-artifact-spatial-move',
    label: 'Multi-Artifact spatial selection movement',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: moveFocusedArtifactSelection,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.reflective-set-organization',
    label: 'Reflective Set grouping, filtering, and sorting',
    category: 'organization',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: deriveReflectiveOrganization,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.context-restoration',
    label: 'Desk selection and focus restoration',
    category: 'navigation',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: createCreatorDeskSnapshot,
  },
] as const;
