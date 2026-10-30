import type { TCGCardTemplate } from '@/domain/templates';
import { reconstructMinimalTemplate } from '@/domain/templates';

const TEMPLATE_EDITOR_HISTORY_LIMIT = 40;

export interface TemplateEditorSnapshot {
  currentTemplate: TCGCardTemplate;
  selectedElementId: string | null;
}

export interface TemplateEditorState extends TemplateEditorSnapshot {
  history: TemplateEditorSnapshot[];
  future: TemplateEditorSnapshot[];
  historyGroup?: { key: string; at: number };
}

type TemplateUpdater = (template: TCGCardTemplate) => TCGCardTemplate;

export const getTemplateEditorCanvas = (
  template: TCGCardTemplate,
): TCGCardTemplate['freeformCanvas'] => template.freeformCanvas;

export const getDefaultSelectedElementId = (
  template: TCGCardTemplate,
) => getTemplateEditorCanvas(template)?.elements?.[0]?.id ?? null;

const toSnapshot = (state: TemplateEditorSnapshot): TemplateEditorSnapshot => ({
  currentTemplate: reconstructMinimalTemplate(state.currentTemplate),
  selectedElementId: state.selectedElementId,
});

const appendHistorySnapshot = (
  history: TemplateEditorSnapshot[],
  snapshot: TemplateEditorSnapshot,
) => [
  ...history.slice(-(TEMPLATE_EDITOR_HISTORY_LIMIT - 1)),
  toSnapshot(snapshot),
];

export const reconcileTemplateEditorSelection = (
  state: TemplateEditorState,
): TemplateEditorState => {
  const canvas = getTemplateEditorCanvas(state.currentTemplate);
  const selectedElementId = state.selectedElementId && canvas?.elements.some((element) => element.id === state.selectedElementId)
    ? state.selectedElementId
    : getDefaultSelectedElementId(state.currentTemplate);

  if (selectedElementId === state.selectedElementId) return state;
  return { ...state, selectedElementId };
};

export const createTemplateEditorState = (
  initialTemplate: TCGCardTemplate,
): TemplateEditorState => {
  const currentTemplate = reconstructMinimalTemplate(initialTemplate);
  return {
    currentTemplate,
    selectedElementId: getDefaultSelectedElementId(currentTemplate),
    history: [],
    future: [],
  };
};

export const resetTemplateEditorState = (
  template: TCGCardTemplate,
): TemplateEditorState => createTemplateEditorState(template);

export const selectTemplateEditorElement = (
  state: TemplateEditorState,
  selectedElementId: string | null,
): TemplateEditorState => ({
  ...state,
  selectedElementId,
  historyGroup: state.selectedElementId === selectedElementId ? state.historyGroup : undefined,
});

export const commitTemplateEditorState = (
  state: TemplateEditorState,
  updater: TemplateUpdater,
  trackHistory = true,
  nextSelectedElementId?: string | null,
  group?: { key: string; at: number },
): TemplateEditorState => {
  const before = toSnapshot(state);
  const currentTemplate = reconstructMinimalTemplate(updater(before.currentTemplate));
  if (JSON.stringify(currentTemplate) === JSON.stringify(state.currentTemplate)) {
    const unchanged=nextSelectedElementId===undefined?state:selectTemplateEditorElement(state,nextSelectedElementId);
    return !group&&unchanged.historyGroup?{...unchanged,historyGroup:undefined}:unchanged;
  }
  const extendGroup = Boolean(group && state.historyGroup?.key === group.key && group.at >= state.historyGroup.at && group.at - state.historyGroup.at < 750);
  const nextState = reconcileTemplateEditorSelection({
    ...state,
    currentTemplate,
    selectedElementId: nextSelectedElementId === undefined
      ? state.selectedElementId
      : nextSelectedElementId,
    history: trackHistory && !extendGroup ? appendHistorySnapshot(state.history, before) : state.history,
    future: [],
    historyGroup: trackHistory ? group : undefined,
  });

  return nextState;
};

export const recordTemplateEditorHistory = (
  state: TemplateEditorState,
  template: TCGCardTemplate = state.currentTemplate,
): TemplateEditorState => ({
  ...state,
  history: appendHistorySnapshot(state.history, {
    currentTemplate: template,
    selectedElementId: state.selectedElementId,
  }),
  future: [],
  historyGroup: undefined,
});

export const undoTemplateEditorState = (
  state: TemplateEditorState,
): TemplateEditorState => {
  const previous = state.history[state.history.length - 1];
  if (!previous) return state;

  return reconcileTemplateEditorSelection({
    currentTemplate: reconstructMinimalTemplate(previous.currentTemplate),
    selectedElementId: previous.selectedElementId,
    history: state.history.slice(0, -1),
    future: [
      toSnapshot(state),
      ...state.future,
    ],
  });
};

export const redoTemplateEditorState = (
  state: TemplateEditorState,
): TemplateEditorState => {
  const next = state.future[0];
  if (!next) return state;

  return reconcileTemplateEditorSelection({
    currentTemplate: reconstructMinimalTemplate(next.currentTemplate),
    selectedElementId: next.selectedElementId,
    history: appendHistorySnapshot(state.history, state),
    future: state.future.slice(1),
  });
};

// Library persistence owns these identities; Undo must not restore stale revision metadata.
const SAVED_TEMPLATE_METADATA = new Set<keyof TCGCardTemplate>([
  'id', 'templateSource', 'templateLibrarySource', 'templateAccessTier',
  'templateRegistryStatus', 'templateContributorName', 'templateLineageId',
  'templateRevision', 'templateRevisionId', 'templateParentRevisionId',
  'templateOriginLineageId', 'templateOriginRevisionId', 'templatePipelineContext',
]);

export const acceptSavedTemplateEditorState = (
  state: TemplateEditorState,
  submitted: TCGCardTemplate,
  saved: TCGCardTemplate,
): TemplateEditorState => {
  if (state.currentTemplate.id !== submitted.id && state.currentTemplate.id !== saved.id) return state;
  const reconcile = (template: TCGCardTemplate): TCGCardTemplate => {
    const next = { ...template };
    const keys = new Set([...Object.keys(submitted), ...Object.keys(saved)] as (keyof TCGCardTemplate)[]);
    for (const key of keys) {
      // Preserve authored changes since the captured snapshot, including history before it.
      if (SAVED_TEMPLATE_METADATA.has(key) || JSON.stringify(template[key]) === JSON.stringify(submitted[key])) {
        if (Object.hasOwn(saved, key)) Object.assign(next, { [key]: saved[key] });
        else delete next[key];
      }
    }
    return reconstructMinimalTemplate(next);
  };
  return reconcileTemplateEditorSelection({
    ...state,
    currentTemplate: reconcile(state.currentTemplate),
    history: state.history.map(snapshot => ({ ...snapshot, currentTemplate: reconcile(snapshot.currentTemplate) })),
    future: state.future.map(snapshot => ({ ...snapshot, currentTemplate: reconcile(snapshot.currentTemplate) })),
    historyGroup: undefined,
  });
};
