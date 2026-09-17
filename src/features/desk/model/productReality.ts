import { createCreatorDeskSnapshot } from './creatorHistory';
import {
  buildFocusedArtifactLayout,
  getDirectionalArtifactNeighbor,
  getFocusedArtifactFrame,
  getFocusedArtifactFitZoom,
  getFocusedArtifactPresentation,
  moveFocusedArtifactSelection,
} from './focusedArtifactLayout';
import { deriveReflectiveOrganization } from './reflectiveOrganization';
import { getDeskCameraGeometry, getDeskFramingTarget, moveDeskWorldSelection } from './deskSpatialGeometry';

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
    id: 'desk.fit-work-camera',
    label: 'Content-aware Fit Work spatial camera',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: getDeskFramingTarget,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.fit-selection-camera',
    label: 'Visible-selection spatial framing',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: [getDeskFramingTarget, getFocusedArtifactFrame],
  },
  {
    productRealityKind: 'capability',
    id: 'desk.custom-spatial-camera',
    label: 'Custom pan and zoom camera that preserves authored coordinates',
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
    id: 'desk.whole-spatial-overview',
    label: 'Explicit complete bounded Desk and Set overview',
    category: 'accessibility',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: [getDeskCameraGeometry, getFocusedArtifactFitZoom],
  },
  {
    productRealityKind: 'capability',
    id: 'desk.stable-set-arrangement',
    label: 'Viewport-independent Grid and Stack Set arrangement',
    category: 'organization',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    implementation: buildFocusedArtifactLayout,
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
