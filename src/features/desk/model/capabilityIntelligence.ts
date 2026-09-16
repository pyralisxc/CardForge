import { createCreatorDeskSnapshot } from './creatorHistory';
import {
  getFocusedArtifactFitZoom,
  getFocusedArtifactPresentation,
  moveFocusedArtifactSelection,
} from './focusedArtifactLayout';
import { deriveReflectiveOrganization } from './reflectiveOrganization';
import { getDeskCameraGeometry, moveDeskWorldSelection } from './deskSpatialGeometry';

/** Current Desk capabilities as source-adjacent Development Intelligence evidence. */
export const DESK_CAPABILITY_INTELLIGENCE = [
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.bounded-spatial-workspace', label: 'Bounded spatial Desk with authored object movement', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: [getDeskCameraGeometry, moveDeskWorldSelection],
  },
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.fit-custom-camera', label: 'Fit and Custom spatial camera', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: getDeskCameraGeometry,
  },
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.adaptive-artifact-density', label: 'Adaptive comfortable, compact, and dense Artifact presentation', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: getFocusedArtifactPresentation,
  },
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.readable-fit-floor', label: 'Readable large-Set Fit floor', category: 'accessibility',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: getFocusedArtifactFitZoom,
  },
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.multi-artifact-spatial-move', label: 'Multi-Artifact spatial selection movement', category: 'interaction',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: moveFocusedArtifactSelection,
  },
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.reflective-set-organization', label: 'Reflective Set grouping, filtering, and sorting', category: 'organization',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: deriveReflectiveOrganization,
  },
  {
    developmentIntelligence: {
      kind: 'capability', id: 'desk.context-restoration', label: 'Desk selection and focus restoration', category: 'navigation',
      relationships: [{ kind: 'owned-by', to: 'feature:desk' }],
    },
    implementation: createCreatorDeskSnapshot,
  },
] as const;
