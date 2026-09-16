import { createCreatorDeskSnapshot } from './creatorHistory';
import {
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
 *
 * During the Development Intelligence migration each object exposes both the
 * legacy Product Reality fields and the generic DI declaration. The legacy fields
 * are temporary dual-run evidence and can be removed with the old scanner.
 */
export const DESK_PRODUCT_REALITY = [
  {
    productRealityKind: 'capability',
    id: 'desk.bounded-spatial-workspace',
    label: 'Bounded spatial Desk with authored object movement',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.bounded-spatial-workspace', label: 'Bounded spatial Desk with authored object movement', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: [getDeskCameraGeometry, moveDeskWorldSelection],
  },
  {
    productRealityKind: 'capability',
    id: 'desk.fit-custom-camera',
    label: 'Fit and Custom spatial camera',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.fit-custom-camera', label: 'Fit and Custom spatial camera', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: getDeskCameraGeometry,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.adaptive-artifact-density',
    label: 'Adaptive comfortable, compact, and dense Artifact presentation',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.adaptive-artifact-density', label: 'Adaptive comfortable, compact, and dense Artifact presentation', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: getFocusedArtifactPresentation,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.readable-fit-floor',
    label: 'Readable large-Set Fit floor',
    category: 'accessibility',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.readable-fit-floor', label: 'Readable large-Set Fit floor', category: 'accessibility',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: getFocusedArtifactFitZoom,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.multi-artifact-spatial-move',
    label: 'Multi-Artifact spatial selection movement',
    category: 'interaction',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.multi-artifact-spatial-move', label: 'Multi-Artifact spatial selection movement', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: moveFocusedArtifactSelection,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.reflective-set-organization',
    label: 'Reflective Set grouping, filtering, and sorting',
    category: 'organization',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.reflective-set-organization', label: 'Reflective Set grouping, filtering, and sorting', category: 'organization',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: deriveReflectiveOrganization,
  },
  {
    productRealityKind: 'capability',
    id: 'desk.context-restoration',
    label: 'Desk selection and focus restoration',
    category: 'navigation',
    ownerFeature: 'desk',
    surfaces: ['desk'],
    developmentIntelligence: {
      kind: 'capability', id: 'desk.context-restoration', label: 'Desk selection and focus restoration', category: 'navigation',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: createCreatorDeskSnapshot,
  },
] as const;
