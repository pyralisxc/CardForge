import type { TCGCardTemplate } from '@/types';
import { reconstructMinimalTemplate } from '@/lib/templateModel';
import { TEMPLATE_HISTORY_LIMIT } from '@/features/template-editor/lib/templateHistory';

export interface TemplateEditorSnapshot {
  currentTemplate: TCGCardTemplate;
  selectedElementId: string | null;
}

export interface TemplateEditorState extends TemplateEditorSnapshot {
  history: TemplateEditorSnapshot[];
  future: TemplateEditorSnapshot[];
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
  ...history.slice(-(TEMPLATE_HISTORY_LIMIT - 1)),
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
});

export const commitTemplateEditorState = (
  state: TemplateEditorState,
  updater: TemplateUpdater,
  trackHistory = true,
  nextSelectedElementId?: string | null,
): TemplateEditorState => {
  const before = toSnapshot(state);
  const currentTemplate = reconstructMinimalTemplate(updater(before.currentTemplate));
  const nextState = reconcileTemplateEditorSelection({
    ...state,
    currentTemplate,
    selectedElementId: nextSelectedElementId === undefined
      ? state.selectedElementId
      : nextSelectedElementId,
    history: trackHistory ? appendHistorySnapshot(state.history, before) : state.history,
    future: trackHistory ? [] : state.future,
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
