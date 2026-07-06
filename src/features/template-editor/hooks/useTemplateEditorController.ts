"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  commitTemplateEditorState,
  createTemplateEditorState,
  getTemplateEditorCanvas,
  reconcileTemplateEditorSelection,
  recordTemplateEditorHistory,
  redoTemplateEditorState,
  resetTemplateEditorState,
  selectTemplateEditorElement,
  setTemplateEditorFace,
  undoTemplateEditorState,
  type TemplateEditorFace,
} from '@/features/template-editor/lib/templateEditorState';
import { remapDuplicatedTextElementContracts } from '@/features/template-editor/lib/templateVariableContracts';
import type { FreeformCardElement, FreeformCanvas, TCGCardTemplate } from '@/types';
import {
  createDefaultFreeformCanvas,
  reconstructFreeformCanvas,
  reconstructMinimalTemplate,
} from '@/lib/templateModel';

type TemplateUpdater = (template: TCGCardTemplate) => TCGCardTemplate;

export function useTemplateEditorController(initialTemplate: TCGCardTemplate) {
  const [editorState, setEditorState] = useState(() => createTemplateEditorState(initialTemplate));
  const [checkedLayerIds, setCheckedLayerIds] = useState<string[]>([]);

  useEffect(() => {
    setEditorState(resetTemplateEditorState(initialTemplate));
    setCheckedLayerIds([]);
  }, [initialTemplate]);

  const canvas = useMemo(() => (
    getTemplateEditorCanvas(editorState.currentTemplate, editorState.activeFace)
    || createDefaultFreeformCanvas()
  ), [editorState.activeFace, editorState.currentTemplate]);

  const selectedElement = useMemo(() => (
    canvas.elements.find((element) => element.id === editorState.selectedElementId) || null
  ), [canvas.elements, editorState.selectedElementId]);

  const commitTemplate = useCallback((
    updater: TemplateUpdater,
    trackHistory = true,
    nextSelectedElementId?: string | null,
  ) => {
    setEditorState((previous) => commitTemplateEditorState(
      previous,
      updater,
      trackHistory,
      nextSelectedElementId,
    ));
  }, []);

  const setCurrentTemplate: Dispatch<SetStateAction<TCGCardTemplate>> = useCallback((nextValue) => {
    setEditorState((previous) => {
      const currentTemplate = reconstructMinimalTemplate(
        typeof nextValue === 'function'
          ? (nextValue as TemplateUpdater)(previous.currentTemplate)
          : nextValue,
      );
      return reconcileTemplateEditorSelection({
        ...previous,
        currentTemplate,
      });
    });
  }, []);

  const resetTemplate = useCallback((template: TCGCardTemplate) => {
    setEditorState(resetTemplateEditorState(template));
    setCheckedLayerIds([]);
  }, []);

  const updateTemplate = useCallback((updates: Partial<TCGCardTemplate>, trackHistory = true) => {
    commitTemplate((template) => ({ ...template, ...updates }), trackHistory);
  }, [commitTemplate]);

  const updateCanvas = useCallback((
    updates: Partial<FreeformCanvas>,
    trackHistory = true,
    nextSelectedElementId?: string | null,
  ) => {
    setEditorState((previous) => commitTemplateEditorState(
      previous,
      (template) => {
        const activeCanvas = getTemplateEditorCanvas(template, previous.activeFace) || createDefaultFreeformCanvas();
        return {
          ...template,
          [previous.activeFace === 'back' ? 'backCanvas' : 'freeformCanvas']: reconstructFreeformCanvas({
            ...activeCanvas,
            ...updates,
          }),
        };
      },
      trackHistory,
      nextSelectedElementId,
    ));
  }, []);

  const updateElement = useCallback((
    elementId: string,
    updates: Partial<FreeformCardElement>,
    trackHistory = true,
  ) => {
    updateCanvas({
      elements: canvas.elements.map((element) => (
        element.id === elementId ? { ...element, ...updates } : element
      )),
    }, trackHistory);
  }, [canvas.elements, updateCanvas]);

  const recordTemplateHistory = useCallback((template?: TCGCardTemplate) => {
    setEditorState((previous) => recordTemplateEditorHistory(previous, template ?? previous.currentTemplate));
  }, []);

  const undo = useCallback(() => {
    setEditorState(undoTemplateEditorState);
  }, []);

  const redo = useCallback(() => {
    setEditorState(redoTemplateEditorState);
  }, []);

  const setActiveFace = useCallback((activeFace: TemplateEditorFace) => {
    setEditorState((previous) => setTemplateEditorFace(previous, activeFace));
    setCheckedLayerIds([]);
  }, []);

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
          const activeCanvas = getTemplateEditorCanvas(template, previous.activeFace) || createDefaultFreeformCanvas();
          const remapped = remapDuplicatedTextElementContracts({
            elements: result.elements,
            fieldContracts: template.fieldContracts,
            duplicatedElementIdMap: result.duplicatedElementIdMap,
            createKey: (baseKey) => `${baseKey}_copy`,
          });
          return {
            ...template,
            fieldContracts: remapped.fieldContracts,
            [previous.activeFace === 'back' ? 'backCanvas' : 'freeformCanvas']: reconstructFreeformCanvas({
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

  const createBackFace = useCallback((backCanvas: FreeformCanvas) => {
    setEditorState((previous) => {
      const committed = commitTemplateEditorState(
        previous,
        (template) => ({ ...template, backCanvas }),
        true,
      );
      return reconcileTemplateEditorSelection({
        ...committed,
        activeFace: 'back',
        selectedElementId: backCanvas.elements[0]?.id ?? null,
      });
    });
    setCheckedLayerIds([]);
  }, []);

  const clearCheckedLayers = useCallback(() => setCheckedLayerIds([]), []);

  const toggleCheckedLayer = useCallback((elementId: string, checked: boolean) => {
    setCheckedLayerIds((previous) => (
      checked ? [...previous, elementId] : previous.filter((id) => id !== elementId)
    ));
  }, []);

  return {
    activeFace: editorState.activeFace,
    canvas,
    checkedLayerIds,
    clearCheckedLayers,
    commitTemplate,
    createBackFace,
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
    setActiveFace,
    setCheckedLayerIds,
    setCurrentTemplate,
    setSelectedElementId,
    toggleCheckedLayer,
    undo,
    ungroupSelected,
    updateCanvas,
    updateElement,
    updateTemplate,
    arrangeSelected,
  };
}
