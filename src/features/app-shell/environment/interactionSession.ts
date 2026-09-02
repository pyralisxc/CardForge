import type { FeatureOwnerId } from './model';

export interface CreatorFocusPath {
  setId: string | null;
  artifactId: string | null;
}

export interface CreatorCamera {
  x: number;
  y: number;
  zoom: number;
}

export interface CreatorLens {
  query: string;
  filterIds: string[];
}

export type CreatorToolPresentation = 'inline' | 'floating' | 'inspector' | 'sheet' | 'provider-handoff';

export interface CreatorToolSession {
  instanceId: string;
  toolId: string;
  ownerFeature: FeatureOwnerId;
  presentation: CreatorToolPresentation;
  targetIds: string[];
  dirty: boolean;
}

export interface CreatorInteractionSession {
  focusPath: CreatorFocusPath;
  /** Desk Set selection is intentionally separate from focused-Set Artifact selection. */
  deskSelection: string[];
  deskSelectionAnchorId: string | null;
  selection: string[];
  inspectionTargetId: string | null;
  camera: CreatorCamera;
  lens: CreatorLens;
  toolStack: CreatorToolSession[];
}

export type CreatorContextClosed = 'tool' | 'inspection' | 'artifact-focus' | 'set-focus' | 'none';

const DEFAULT_CAMERA: CreatorCamera = { x: 0, y: 0, zoom: 1 };

export const createCreatorInteractionSession = (): CreatorInteractionSession => ({
  focusPath: { setId: null, artifactId: null },
  deskSelection: [],
  deskSelectionAnchorId: null,
  selection: [],
  inspectionTargetId: null,
  camera: { ...DEFAULT_CAMERA },
  lens: { query: '', filterIds: [] },
  toolStack: [],
});

export const focusCreatorSet = (
  session: CreatorInteractionSession,
  setId: string,
): CreatorInteractionSession => ({
  ...session,
  focusPath: { setId, artifactId: null },
  selection: [],
  inspectionTargetId: null,
  camera: { ...DEFAULT_CAMERA },
  lens: { query: '', filterIds: [] },
  toolStack: [],
});

export const selectCreatorDeskSets = (
  session: CreatorInteractionSession,
  setIds: readonly string[],
  anchorId: string | null = setIds.at(-1) ?? null,
): CreatorInteractionSession => ({
  ...session,
  deskSelection: Array.from(new Set(setIds.filter(Boolean))),
  deskSelectionAnchorId: anchorId && setIds.includes(anchorId) ? anchorId : setIds.at(-1) ?? null,
});

export const focusCreatorArtifact = (
  session: CreatorInteractionSession,
  artifactId: string,
): CreatorInteractionSession => {
  if (!session.focusPath.setId) return session;
  return {
    ...session,
    focusPath: { ...session.focusPath, artifactId },
  };
};

export const selectCreatorArtifacts = (
  session: CreatorInteractionSession,
  artifactIds: readonly string[],
): CreatorInteractionSession => ({
  ...session,
  selection: Array.from(new Set(artifactIds.filter(Boolean))),
});

export const inspectCreatorArtifact = (
  session: CreatorInteractionSession,
  artifactId: string | null,
): CreatorInteractionSession => ({ ...session, inspectionTargetId: artifactId });

export const setCreatorCamera = (
  session: CreatorInteractionSession,
  camera: CreatorCamera,
): CreatorInteractionSession => ({
  ...session,
  camera: {
    x: Number.isFinite(camera.x) ? camera.x : session.camera.x,
    y: Number.isFinite(camera.y) ? camera.y : session.camera.y,
    zoom: Number.isFinite(camera.zoom) ? Math.min(4, Math.max(0.2, camera.zoom)) : session.camera.zoom,
  },
});

export const setCreatorLens = (
  session: CreatorInteractionSession,
  lens: CreatorLens,
): CreatorInteractionSession => ({
  ...session,
  lens: { query: lens.query, filterIds: Array.from(new Set(lens.filterIds)) },
});

export const openCreatorTool = (
  session: CreatorInteractionSession,
  tool: CreatorToolSession,
): CreatorInteractionSession => ({
  ...session,
  toolStack: [
    ...session.toolStack.filter((candidate) => candidate.instanceId !== tool.instanceId),
    { ...tool, targetIds: [...tool.targetIds] },
  ],
});

export const setCreatorToolDirty = (
  session: CreatorInteractionSession,
  instanceId: string,
  dirty: boolean,
): CreatorInteractionSession => ({
  ...session,
  toolStack: session.toolStack.map((tool) => (
    tool.instanceId === instanceId ? { ...tool, dirty } : tool
  )),
});

export const closeCreatorContext = (
  session: CreatorInteractionSession,
): { session: CreatorInteractionSession; closed: CreatorContextClosed } => {
  if (session.toolStack.length > 0) {
    return { session: { ...session, toolStack: session.toolStack.slice(0, -1) }, closed: 'tool' };
  }
  if (session.inspectionTargetId) {
    return { session: { ...session, inspectionTargetId: null }, closed: 'inspection' };
  }
  if (session.focusPath.artifactId) {
    return { session: { ...session, focusPath: { ...session.focusPath, artifactId: null } }, closed: 'artifact-focus' };
  }
  if (session.focusPath.setId) {
    return {
      session: {
        ...createCreatorInteractionSession(),
        deskSelection: [...session.deskSelection],
        deskSelectionAnchorId: session.deskSelectionAnchorId,
      },
      closed: 'set-focus',
    };
  }
  return { session, closed: 'none' };
};
