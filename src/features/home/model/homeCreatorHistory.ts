import type { CreatorInteractionSession, CreatorToolSession } from '@/features/app-shell/client/environment';

export type HomeContextualToolId = 'design' | 'generate' | 'output' | 'pipeline';

export interface HomeCreatorHistorySnapshot {
  version: 1;
  focusedWorkId: string | null;
  inspectorWorkId: string | null;
  session: CreatorInteractionSession;
}

export const HOME_CREATOR_HISTORY_KEY = 'cardforgeCreatorContext';

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

export const readHomeCreatorHistorySnapshot = (state: unknown): HomeCreatorHistorySnapshot | null => {
  if (!state || typeof state !== 'object') return null;
  const snapshot = (state as Record<string, unknown>)[HOME_CREATOR_HISTORY_KEY];
  if (!snapshot || typeof snapshot !== 'object') return null;
  const candidate = snapshot as Partial<HomeCreatorHistorySnapshot>;
  if (candidate.version !== 1) return null;
  if (candidate.focusedWorkId !== null && typeof candidate.focusedWorkId !== 'string') return null;
  if (candidate.inspectorWorkId !== null && typeof candidate.inspectorWorkId !== 'string') return null;
  if (!isInteractionSession(candidate.session)) return null;
  return candidate as HomeCreatorHistorySnapshot;
};

export const createHomeCreatorHistoryState = (
  state: unknown,
  snapshot: HomeCreatorHistorySnapshot,
): Record<string, unknown> => ({
  ...(state && typeof state === 'object' ? state : {}),
  [HOME_CREATOR_HISTORY_KEY]: snapshot,
});

export const createHomeCreatorHref = (snapshot: HomeCreatorHistorySnapshot): string => {
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

export const createHomeCreatorTool = (
  setId: string,
  toolId: HomeContextualToolId,
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
