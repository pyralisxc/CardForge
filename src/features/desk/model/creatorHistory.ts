import {
  createCreatorInteractionSession,
  focusCreatorArtifact,
  focusCreatorSet,
  selectCreatorArtifacts,
  selectCreatorDeskSets,
  type CreatorInteractionSession,
  type CreatorToolSession,
} from '@/features/app-shell/client/environment';

export type DeskContextualToolId = 'design' | 'generate' | 'output' | 'pipeline';

export interface CreatorHistorySnapshot {
  version: 1;
  focusedWorkId: string | null;
  inspectorWorkId: string | null;
  session: CreatorInteractionSession;
}

export const DESK_CREATOR_HISTORY_KEY = 'cardforgeCreatorContext';
const CREATOR_LAUNCH_INTENT_KEYS = ['document', 'revision', 'returnTo', 'editTemplate'] as const;

export const createCreatorInitialSession = (
  focusedWorkId?: string | null,
  focusedArtifactId?: string | null,
): CreatorInteractionSession => {
  const session = createCreatorInteractionSession();
  if (!focusedWorkId?.startsWith('set:')) return session;
  const focusedSet = focusCreatorSet(
    selectCreatorDeskSets(session, [focusedWorkId], focusedWorkId),
    focusedWorkId.slice(4),
  );
  if (!focusedArtifactId) return focusedSet;
  return focusCreatorArtifact(
    selectCreatorArtifacts(focusedSet, [focusedArtifactId]),
    focusedArtifactId,
  );
};

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')
);

const isInteractionSession = (value: unknown): value is CreatorInteractionSession => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CreatorInteractionSession>;
  return Boolean(
    candidate.focusPath
    && (candidate.focusPath.setId === null || typeof candidate.focusPath.setId === 'string')
    && (candidate.focusPath.artifactId === null || typeof candidate.focusPath.artifactId === 'string')
    && isStringArray(candidate.selection)
    && (candidate.deskSelection === undefined || isStringArray(candidate.deskSelection))
    && (candidate.deskSelectionAnchorId === undefined || candidate.deskSelectionAnchorId === null || typeof candidate.deskSelectionAnchorId === 'string')
    && (candidate.inspectionTargetId === null || typeof candidate.inspectionTargetId === 'string')
    && candidate.camera
    && Number.isFinite(candidate.camera.x)
    && Number.isFinite(candidate.camera.y)
    && Number.isFinite(candidate.camera.zoom)
    && candidate.lens
    && typeof candidate.lens.query === 'string'
    && isStringArray(candidate.lens.filterIds)
    && Array.isArray(candidate.toolStack)
    && candidate.toolStack.every((tool) => (
      tool && typeof tool === 'object'
      && typeof tool.instanceId === 'string'
      && typeof tool.toolId === 'string'
      && isStringArray(tool.targetIds)
      && typeof tool.dirty === 'boolean'
    )),
  );
};

export const readCreatorHistorySnapshot = (state: unknown): CreatorHistorySnapshot | null => {
  if (!state || typeof state !== 'object') return null;
  const snapshot = (state as Record<string, unknown>)[DESK_CREATOR_HISTORY_KEY];
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidate = snapshot as Partial<CreatorHistorySnapshot>;
  if (candidate.version !== 1) return null;
  if (candidate.focusedWorkId !== null && typeof candidate.focusedWorkId !== 'string') return null;
  if (candidate.inspectorWorkId !== null && typeof candidate.inspectorWorkId !== 'string') return null;
  if (!isInteractionSession(candidate.session)) return null;
  const typed = candidate as CreatorHistorySnapshot;
  return {
    ...typed,
    session: {
      ...typed.session,
      deskSelection: typed.session.deskSelection ?? [],
      deskSelectionAnchorId: typed.session.deskSelectionAnchorId ?? null,
    },
  };
};

export const createCreatorHistoryState = (
  state: unknown,
  snapshot: CreatorHistorySnapshot,
): Record<string, unknown> => ({
  ...(state && typeof state === 'object' ? state : {}),
  [DESK_CREATOR_HISTORY_KEY]: snapshot,
});

export const createCreatorHref = (snapshot: CreatorHistorySnapshot): string => {
  const params = new URLSearchParams();
  if (snapshot.focusedWorkId) params.set('focus', snapshot.focusedWorkId);
  if (snapshot.session.focusPath.artifactId) params.set('artifact', snapshot.session.focusPath.artifactId);
  const activeTool = snapshot.session.toolStack.at(-1);
  if (activeTool && ['design', 'generate', 'output', 'pipeline'].includes(activeTool.toolId)) {
    params.set('tool', activeTool.toolId);
  }
  const query = params.toString();
  return query ? `/account?${query}` : '/account';
};

export const preserveCreatorLaunchIntent = (
  creatorHref: string,
  currentHref: string,
): string => {
  const base = 'https://cardforge.local';
  const current = new URL(currentHref, base);
  const target = new URL(creatorHref, base);
  for (const key of CREATOR_LAUNCH_INTENT_KEYS) {
    const value = current.searchParams.get(key);
    if (value !== null && !target.searchParams.has(key)) target.searchParams.set(key, value);
  }
  return `${target.pathname}${target.search}${target.hash}`;
};

export const createCreatorTool = (
  setId: string,
  toolId: DeskContextualToolId,
): CreatorToolSession => ({
  instanceId: `desk-${toolId}-${setId}`,
  toolId,
  ownerFeature: toolId === 'design'
    ? 'template-editor'
    : toolId === 'pipeline'
      ? 'pipeline'
      : 'card-generator',
  presentation: toolId === 'design' || toolId === 'output' ? 'floating' : 'sheet',
  targetIds: [setId],
  dirty: false,
});
