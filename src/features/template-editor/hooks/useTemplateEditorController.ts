"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  arrangeCanvasSelection,
  deleteCanvasSelection,
  duplicateCanvasSelection,
  groupCanvasElements,
  moveCanvasSelectionByDelta,
  reorderCanvasLayer,
  ungroupCanvasSelection,
  type ArrangeDirection,
  type CanvasCommandResult,
  type LayerDropPosition,
} from '@/features/template-editor/lib/canvasCommands';
import {
  acceptSavedTemplateEditorState,
  commitTemplateEditorState,
  createTemplateEditorState,
  getTemplateEditorCanvas,
  reconcileTemplateEditorSelection,
  recordTemplateEditorHistory,
  redoTemplateEditorState,
  resetTemplateEditorState,
  selectTemplateEditorElement,
  undoTemplateEditorState,
} from '@/features/template-editor/lib/templateEditorState';
import { remapDuplicatedTextElementContracts } from '@/features/template-editor/lib/templateVariableContracts';
import type { FreeformCardElement, FreeformCanvas, TCGCardTemplate } from '@/domain/templates';
import {
  createDefaultFreeformCanvas,
  reconstructFreeformCanvas,
  reconstructMinimalTemplate,
} from '@/domain/templates';

type IconApplication = {
  phase: 'pending' | 'acknowledged' | 'cancelled';
  attempt: number;
  templateId: string;
  elementId: string;
  changes: Pick<FreeformCardElement, 'iconName' | 'iconImageSource' | 'iconRenderMode'>;
  resolve: () => void;
  reject: (reason: Error) => void;
  signal?: AbortSignal;
  abort: () => void;
};

const iconApplyCancellation = () => new DOMException('Icon selection was cancelled.', 'AbortError');
const iconApplyFailure = () => new Error('The selected Icon was not applied. Keep this Template open, select its layer, and try again.');

const matchesIconApplication = (
  element: FreeformCardElement,
  changes: IconApplication['changes'],
) => element.iconName === changes.iconName
  && element.iconImageSource === changes.iconImageSource
  && element.iconRenderMode === changes.iconRenderMode;

type TemplateUpdater = (template: TCGCardTemplate) => TCGCardTemplate;

export function useTemplateEditorController(initialTemplate: TCGCardTemplate) {
  const [editorState, setEditorState] = useState(() => createTemplateEditorState(initialTemplate));
  const [checkedLayerIds, setCheckedLayerIds] = useState<string[]>([]);
  const initialTemplateRef = useRef(initialTemplate);
  initialTemplateRef.current = initialTemplate;
  // Parent selection and a deliberately begun unsaved draft are distinct.
  // The controller owns the active working document; parent ID changes still
  // invalidate it and reset from the incoming Template.
  const activeDocumentIdRef = useRef(initialTemplate.id);
  const syncedInitialIdRef = useRef(initialTemplate.id);
  const acknowledgedSaveIdentityRef = useRef<{ fromId: string; toId: string } | null>(null);
  // One in-flight Icon confirmation owned by this controller, not a second editor store.
  const committedRef = useRef(editorState);
  const controllerAliveRef = useRef(true);
  const pendingIconRef = useRef<IconApplication | null>(null);
  const nextIconAttemptRef = useRef(0);
  const finishIcon = useCallback((request: IconApplication, error?: Error) => {
    if (pendingIconRef.current !== request) return;
    pendingIconRef.current = null;
    request.phase = error ? 'cancelled' : 'acknowledged';
    request.signal?.removeEventListener('abort', request.abort);
    if (error) request.reject(error);
    else request.resolve();
  }, []);

  useLayoutEffect(() => {
    committedRef.current = editorState;
    // A Save can acknowledge a draft→persisted identity while newer edits keep
    // the parent selected Template unchanged. Reconcile the active document
    // only after the saved ID actually commits in canonical editor state.
    const savedIdentity = acknowledgedSaveIdentityRef.current;
    if (savedIdentity
      && activeDocumentIdRef.current === savedIdentity.fromId
      && editorState.currentTemplate.id === savedIdentity.toId) {
      activeDocumentIdRef.current = savedIdentity.toId;
    }
    const request = pendingIconRef.current;
    if (!request) return;
    const element = getTemplateEditorCanvas(editorState.currentTemplate)?.elements.find(
      candidate => candidate.id === request.elementId,
    );
    if (request.signal?.aborted) return finishIcon(request, iconApplyCancellation());
    if (initialTemplate.id !== syncedInitialIdRef.current
      || activeDocumentIdRef.current !== request.templateId
      || editorState.currentTemplate.id !== request.templateId
      || editorState.selectedElementId !== request.elementId
      || !element || element.type !== 'icon' || element.locked) {
      return finishIcon(request, iconApplyFailure());
    }
    // A different concurrent editor commit is not evidence that this Icon
    // updater ran. Only its marker in the *committed state* can settle it.
    if (editorState.iconApplicationAttempt !== request.attempt) return;
    finishIcon(request, matchesIconApplication(element, request.changes) ? undefined : iconApplyFailure());
  }, [editorState, finishIcon, initialTemplate.id]);

  useLayoutEffect(() => {
    // Strict Mode replays setup after cleanup; a retained callback must reject
    // only while this controller is actually unmounted.
    controllerAliveRef.current = true;
    return () => {
      controllerAliveRef.current = false;
      const request = pendingIconRef.current;
      if (request) finishIcon(request, iconApplyCancellation());
    };
  }, [finishIcon]);


  useEffect(() => {
    const nextId = initialTemplateRef.current.id;
    const savedIdentity = acknowledgedSaveIdentityRef.current;
    acknowledgedSaveIdentityRef.current = null;
    // Persisting the *same* working draft under its new library ID is not
    // switching to another Template. acceptSavedTemplate already reconciled
    // every authored history snapshot and the selected layer.
    const isAcknowledgedPersistence = Boolean(savedIdentity
      && savedIdentity.toId === activeDocumentIdRef.current
      && savedIdentity.toId === nextId
      && committedRef.current.currentTemplate.id === nextId);
    syncedInitialIdRef.current = nextId;
    activeDocumentIdRef.current = nextId;
    if (isAcknowledgedPersistence) return;
    setEditorState(resetTemplateEditorState(initialTemplateRef.current));
    setCheckedLayerIds([]);
  }, [initialTemplate.id]);

  const canvas = useMemo(() => (
    getTemplateEditorCanvas(editorState.currentTemplate)
    || createDefaultFreeformCanvas()
  ), [editorState.currentTemplate]);

  const selectedElement = useMemo(() => (
    canvas.elements.find((element) => element.id === editorState.selectedElementId) || null
  ), [canvas.elements, editorState.selectedElementId]);

  const commitTemplate = useCallback((
    updater: TemplateUpdater,
    trackHistory = true,
    nextSelectedElementId?: string | null,
    historyGroup?: string,
  ) => {
    setEditorState((previous) => commitTemplateEditorState(
      previous,
      updater,
      trackHistory,
      nextSelectedElementId,
      historyGroup ? { key: historyGroup, at: Date.now() } : undefined,
    ));
  }, []);

  const setCurrentTemplate: Dispatch<SetStateAction<TCGCardTemplate>> = useCallback((nextValue) => {
    setEditorState((previous) => {
      const currentTemplate = reconstructMinimalTemplate(
        typeof nextValue === 'function'
          ? (nextValue as TemplateUpdater)(previous.currentTemplate)
          : nextValue,
      );
      if (JSON.stringify(currentTemplate) === JSON.stringify(previous.currentTemplate)) return previous;
      return reconcileTemplateEditorSelection({
        ...previous,
        currentTemplate,
        future: [],
        historyGroup: undefined,
      });
    });
  }, []);

  const resetTemplate = useCallback((template: TCGCardTemplate) => {
    const pending = pendingIconRef.current;
    if (pending) finishIcon(pending, iconApplyCancellation());
    activeDocumentIdRef.current = template.id;
    setEditorState(resetTemplateEditorState(template));
    setCheckedLayerIds([]);
  }, [finishIcon]);

  const updateTemplate = useCallback((updates: Partial<TCGCardTemplate>, trackHistory = true) => {
    commitTemplate((template) => ({ ...template, ...updates }), trackHistory);
  }, [commitTemplate]);

  const updateCanvas = useCallback((
    updates: Partial<FreeformCanvas>,
    trackHistory = true,
    nextSelectedElementId?: string | null,
    historyGroup?: string,
  ) => {
    setEditorState((previous) => commitTemplateEditorState(
      previous,
      (template) => {
        const activeCanvas = getTemplateEditorCanvas(template) || createDefaultFreeformCanvas();
        return {
          ...template,
          freeformCanvas: reconstructFreeformCanvas({
            ...activeCanvas,
            ...updates,
          }),
        };
      },
      trackHistory,
      nextSelectedElementId,
      historyGroup ? { key: historyGroup, at: Date.now() } : undefined,
    ));
  }, []);

  const updateElement = useCallback((
    elementId: string,
    updates: Partial<FreeformCardElement>,
    trackHistory = true,
    historyGroup?: string,
  ) => {
    // Apply against the latest queued Template state, not the render-time canvas
    // snapshot. Library selection and inspector edits can complete in the same
    // React batch; neither may overwrite the other's already-queued element edits.
    commitTemplate((template) => {
      const activeCanvas = getTemplateEditorCanvas(template) || createDefaultFreeformCanvas();
      if (!activeCanvas.elements.some((element) => element.id === elementId)) return template;
      return {
        ...template,
        freeformCanvas: reconstructFreeformCanvas({
          ...activeCanvas,
          elements: activeCanvas.elements.map((element) => (
            element.id === elementId ? { ...element, ...updates } : element
          )),
        }),
      };
    }, trackHistory, undefined, historyGroup);
  }, [commitTemplate]);

  const applyIconSelection = useCallback((
    elementId: string,
    changes: IconApplication['changes'],
    signal?: AbortSignal,
    expectedTemplateId: string | null = initialTemplateRef.current.id,
  ): Promise<void> => {
    if (!controllerAliveRef.current) return Promise.reject(iconApplyCancellation());
    const state = committedRef.current;
    const current = getTemplateEditorCanvas(state.currentTemplate)?.elements.find(candidate => candidate.id === elementId);
    if (signal?.aborted) return Promise.reject(iconApplyCancellation());
    if (!expectedTemplateId || expectedTemplateId !== state.currentTemplate.id
      || initialTemplateRef.current.id !== syncedInitialIdRef.current
      || state.currentTemplate.id !== activeDocumentIdRef.current || state.selectedElementId !== elementId
      || !current || current.type !== 'icon' || current.locked) return Promise.reject(iconApplyFailure());
    // A second confirmation cannot overtake an uncommitted Icon selection.
    // Even an already-current value must not acknowledge ahead of that write.
    if (pendingIconRef.current) return Promise.reject(new Error('An Icon selection is still being applied. Try again after it finishes.'));
    if (matchesIconApplication(current, changes)) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const request: IconApplication = {
        phase: 'pending', attempt: ++nextIconAttemptRef.current,
        templateId: state.currentTemplate.id!, elementId, changes, resolve, reject, signal,
        abort: () => finishIcon(request, iconApplyCancellation()),
      };
      pendingIconRef.current = request;
      signal?.addEventListener('abort', request.abort, { once: true });
      // A React updater is not confirmation. The layout effect reads the *committed*
      // controller state. Return a new envelope for rejected/no-op updates so
      // missing/locked targets are also checked without adding history or dirt.
      setEditorState(previous => {
        // React can replay this updater when a lower-priority change rebases.
        // An acknowledged commit must remain replayable even after picker close
        // aborts its signal or clears the pending pointer. Only an uncommitted
        // cancellation may suppress the write.
        const active = request.phase === 'acknowledged'
          || (request.phase === 'pending' && controllerAliveRef.current
            && pendingIconRef.current === request && !signal?.aborted);
        if (!active) return { ...previous };
        const marked = (next: typeof previous) => ({
          ...next, iconApplicationAttempt: request.attempt,
        });
        if (previous.currentTemplate.id !== request.templateId
          || previous.selectedElementId !== elementId) return marked(previous);
        const canvas = getTemplateEditorCanvas(previous.currentTemplate);
        const element = canvas?.elements.find(candidate => candidate.id === elementId);
        if (!canvas || !element || element.type !== 'icon' || element.locked) return marked(previous);
        const next = commitTemplateEditorState(previous, template => ({
          ...template,
          freeformCanvas: reconstructFreeformCanvas({
            ...canvas,
            elements: canvas.elements.map(candidate => candidate.id === elementId
              ? { ...candidate, ...changes } : candidate),
          }),
        }), true);
        return marked(next);
      });
    });
  }, [finishIcon]);

  const recordTemplateHistory = useCallback((template?: TCGCardTemplate) => {
    setEditorState((previous) => recordTemplateEditorHistory(previous, template ?? previous.currentTemplate));
  }, []);

  const acceptSavedTemplate = useCallback((submitted: TCGCardTemplate, saved: TCGCardTemplate) => {
    // The only authorized identity handoff is an acknowledged Save for this
    // same working document. Unrelated navigation retains reset semantics.
    const workingId = committedRef.current.currentTemplate.id;
    acknowledgedSaveIdentityRef.current = submitted.id && saved.id && submitted.id !== saved.id
      && workingId === submitted.id
      ? { fromId: submitted.id, toId: saved.id }
      : null;
    setEditorState(previous => acceptSavedTemplateEditorState(previous, submitted, saved));
  }, []);

  const finishHistoryGroup = useCallback(() => setEditorState(previous => previous.historyGroup ? { ...previous, historyGroup: undefined } : previous), []);

  const undo = useCallback(() => {
    const pending = pendingIconRef.current;
    if (pending) finishIcon(pending, iconApplyCancellation());
    setEditorState(undoTemplateEditorState);
  }, [finishIcon]);

  const redo = useCallback(() => {
    const pending = pendingIconRef.current;
    if (pending) finishIcon(pending, iconApplyCancellation());
    setEditorState(redoTemplateEditorState);
  }, [finishIcon]);

  const setSelectedElementId: Dispatch<SetStateAction<string | null>> = useCallback((nextValue) => {
    setEditorState((previous) => selectTemplateEditorElement(
      previous,
      typeof nextValue === 'function'
        ? (nextValue as (value: string | null) => string | null)(previous.selectedElementId)
        : nextValue,
    ));
  }, []);

  const selectElement = useCallback((selectedElementId: string | null) => {
    setEditorState((previous) => selectTemplateEditorElement(previous, selectedElementId));
  }, []);

  const applyCanvasCommandResult = useCallback((result: CanvasCommandResult) => {
    if (!result.changed) return result;
    updateCanvas({ elements: result.elements }, true, result.selectedElementId);
    if (result.checkedLayerIds) setCheckedLayerIds(result.checkedLayerIds);
    return result;
  }, [updateCanvas]);

  const groupChecked = useCallback((createId: () => string) => applyCanvasCommandResult(groupCanvasElements({
    elements: canvas.elements,
    checkedLayerIds,
    createId,
  })), [applyCanvasCommandResult, canvas.elements, checkedLayerIds]);

  const ungroupSelected = useCallback(() => applyCanvasCommandResult(ungroupCanvasSelection({
    elements: canvas.elements,
    selectedElementId: editorState.selectedElementId,
  })), [applyCanvasCommandResult, canvas.elements, editorState.selectedElementId]);

  const duplicateSelected = useCallback((createId: () => string, gridSize: number) => (
    (() => {
      const result = duplicateCanvasSelection({
        elements: canvas.elements,
        selectedElementId: editorState.selectedElementId,
        gridSize,
        createId,
      });
      if (!result.changed) return result;

      setEditorState((previous) => commitTemplateEditorState(
        previous,
        (template) => {
          const activeCanvas = getTemplateEditorCanvas(template) || createDefaultFreeformCanvas();
          const remapped = remapDuplicatedTextElementContracts({
            elements: result.elements,
            fieldContracts: template.fieldContracts,
            duplicatedElementIdMap: result.duplicatedElementIdMap,
            createKey: (baseKey) => `${baseKey}_copy`,
          });
          return {
            ...template,
            fieldContracts: remapped.fieldContracts,
            freeformCanvas: reconstructFreeformCanvas({
              ...activeCanvas,
              elements: remapped.elements,
            }),
          };
        },
        true,
        result.selectedElementId,
      ));

      return result;
    })()
  ), [canvas.elements, editorState.selectedElementId]);

  const deleteSelected = useCallback(() => applyCanvasCommandResult(deleteCanvasSelection({
    elements: canvas.elements,
    selectedElementId: editorState.selectedElementId,
  })), [applyCanvasCommandResult, canvas.elements, editorState.selectedElementId]);

  const arrangeSelected = useCallback((direction: ArrangeDirection) => applyCanvasCommandResult(arrangeCanvasSelection({
    elements: canvas.elements,
    selectedElementId: editorState.selectedElementId,
    direction,
  })), [applyCanvasCommandResult, canvas.elements, editorState.selectedElementId]);

  const moveSelectionByDelta = useCallback((deltaX: number, deltaY: number) => applyCanvasCommandResult(moveCanvasSelectionByDelta({
    elements: canvas.elements,
    selectedElementId: editorState.selectedElementId,
    deltaX,
    deltaY,
  })), [applyCanvasCommandResult, canvas.elements, editorState.selectedElementId]);

  const reorderLayer = useCallback((
    sourceId: string,
    targetId: string,
    position: LayerDropPosition,
  ) => applyCanvasCommandResult(reorderCanvasLayer({
    elements: canvas.elements,
    sourceId,
    targetId,
    position,
  })), [applyCanvasCommandResult, canvas.elements]);

  const clearCheckedLayers = useCallback(() => setCheckedLayerIds([]), []);

  const toggleCheckedLayer = useCallback((elementId: string, checked: boolean) => {
    setCheckedLayerIds((previous) => (
      checked ? [...previous, elementId] : previous.filter((id) => id !== elementId)
    ));
  }, []);

  return {
    canvas,
    checkedLayerIds,
    clearCheckedLayers,
    commitTemplate,
    finishHistoryGroup,
    acceptSavedTemplate,
    currentTemplate: editorState.currentTemplate,
    deleteSelected,
    duplicateSelected,
    future: editorState.future,
    groupChecked,
    history: editorState.history,
    moveSelectionByDelta,
    recordTemplateHistory,
    redo,
    reorderLayer,
    resetTemplate,
    selectedElement,
    selectedElementId: editorState.selectedElementId,
    selectElement,
    setCheckedLayerIds,
    setCurrentTemplate,
    setSelectedElementId,
    toggleCheckedLayer,
    undo,
    ungroupSelected,
    updateCanvas,
    updateElement,
    applyIconSelection,
    updateTemplate,
    arrangeSelected,
  };
}

export type TemplateEditorController = ReturnType<typeof useTemplateEditorController>;
