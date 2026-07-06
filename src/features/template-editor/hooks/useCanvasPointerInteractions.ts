"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useRef } from 'react';

import type { FreeformCanvas, FreeformCardElement, TCGCardTemplate } from '@/types';
import { getElementDepthStack, resolvePointerSelection, scaleElementWithParentResize, type DepthSelectionState } from '@/lib/freeformEditor';
import { getDescendantIds } from '@/features/template-editor/lib/layerTree';
import {
  calculateMovedElementPosition,
  calculateResizedElementBounds,
  getCanvasPointFromRect,
  type ResizeHandle,
} from '@/features/template-editor/lib/canvasPointerMath';

type DragState =
  | { mode: 'move'; id: string; startX: number; startY: number; original: FreeformCardElement; childOriginals: Map<string, FreeformCardElement>; hasMoved: boolean }
  | { mode: 'resize'; id: string; handle: ResizeHandle; startX: number; startY: number; original: FreeformCardElement; childOriginals: Map<string, FreeformCardElement>; hasMoved: boolean };

const DRAG_START_SLOP = 3;

interface UseCanvasPointerInteractionsInput {
  canvas: FreeformCanvas;
  canvasRef: RefObject<HTMLDivElement>;
  currentTemplate: TCGCardTemplate;
  previewMode: boolean;
  recordTemplateHistory: (template?: TCGCardTemplate) => void;
  selectedElementId: string | null;
  selectElement: (id: string | null) => void;
  snapValue: (value: number) => number;
  updateCanvas: (updates: Partial<FreeformCanvas>, trackHistory?: boolean) => void;
  zoom: number;
}

export function useCanvasPointerInteractions({
  canvas,
  canvasRef,
  currentTemplate,
  previewMode,
  recordTemplateHistory,
  selectedElementId,
  selectElement,
  snapValue,
  updateCanvas,
  zoom,
}: UseCanvasPointerInteractionsInput) {
  const dragStateRef = useRef<DragState | null>(null);
  const depthSelectionRef = useRef<DepthSelectionState | null>(null);

  const getCanvasPoint = useCallback((event: Pick<PointerEvent | ReactPointerEvent, 'clientX' | 'clientY'>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return getCanvasPointFromRect(event, rect, zoom);
  }, [canvasRef, zoom]);

  const handleElementPointerDown = useCallback((event: ReactPointerEvent, element: FreeformCardElement) => {
    if (previewMode) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getCanvasPoint(event);
    const hitStack = getElementDepthStack(canvas.elements, point);
    const { nextSelectedId, nextState } = resolvePointerSelection({
      clickedElementId: element.id,
      currentSelectedId: selectedElementId,
      cycleDepth: event.altKey,
      hitStack,
      point,
      previousState: depthSelectionRef.current,
    });
    depthSelectionRef.current = nextState;
    const targetElement = canvas.elements.find((candidate) => candidate.id === (nextSelectedId || element.id)) || element;
    selectElement(targetElement.id);
    if (targetElement.locked) {
      dragStateRef.current = null;
      return;
    }
    const descendantIds = getDescendantIds(targetElement.id, canvas.elements);
    const childOriginals = new Map(canvas.elements.filter((item) => descendantIds.includes(item.id)).map((item) => [item.id, { ...item }]));
    dragStateRef.current = { mode: 'move', id: targetElement.id, startX: point.x, startY: point.y, original: targetElement, childOriginals, hasMoved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [canvas.elements, getCanvasPoint, previewMode, selectElement, selectedElementId]);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent, element: FreeformCardElement, handle: ResizeHandle) => {
    if (previewMode || element.locked) return;
    event.preventDefault();
    event.stopPropagation();
    selectElement(element.id);
    const point = getCanvasPoint(event);
    const descendantIds = getDescendantIds(element.id, canvas.elements);
    const childOriginals = new Map(canvas.elements.filter((item) => descendantIds.includes(item.id)).map((item) => [item.id, { ...item }]));
    dragStateRef.current = { mode: 'resize', id: element.id, handle, startX: point.x, startY: point.y, original: element, childOriginals, hasMoved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [canvas.elements, getCanvasPoint, previewMode, selectElement]);

  const handlePointerMove = useCallback((event: ReactPointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getCanvasPoint(event);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    const movement = Math.hypot(deltaX, deltaY);
    if (!dragState.hasMoved) {
      if (movement < DRAG_START_SLOP) return;
      dragState.hasMoved = true;
      recordTemplateHistory(currentTemplate);
    }

    if (dragState.mode === 'move') {
      const nextPosition = calculateMovedElementPosition({
        original: dragState.original,
        deltaX,
        deltaY,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        snapValue,
      });
      const actualDeltaX = nextPosition.x - dragState.original.x;
      const actualDeltaY = nextPosition.y - dragState.original.y;
      const { childOriginals } = dragState;
      updateCanvas({
        elements: canvas.elements.map((element) => {
          if (element.id === dragState.id) return { ...element, x: nextPosition.x, y: nextPosition.y };
          const originalChild = childOriginals.get(element.id);
          if (originalChild) return { ...element, x: originalChild.x + actualDeltaX, y: originalChild.y + actualDeltaY };
          return element;
        }),
      }, false);
      return;
    }

    const nextParentBounds = calculateResizedElementBounds({
      original: dragState.original,
      handle: dragState.handle,
      deltaX,
      deltaY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      snapValue,
    });

    updateCanvas({
      elements: canvas.elements.map((element) => {
        if (element.id === dragState.id) {
          return {
            ...element,
            ...nextParentBounds,
          };
        }

        const originalChild = dragState.childOriginals.get(element.id);
        if (!originalChild) return element;

        const scaledChild = scaleElementWithParentResize(originalChild, dragState.original, nextParentBounds);
        return {
          ...element,
          x: snapValue(scaledChild.x),
          y: snapValue(scaledChild.y),
          width: snapValue(scaledChild.width),
          height: snapValue(scaledChild.height),
          fontSizePx: scaledChild.fontSizePx,
          strokeWidth: scaledChild.strokeWidth,
        };
      }),
    }, false);
  }, [canvas.elements, canvas.height, canvas.width, currentTemplate, getCanvasPoint, recordTemplateHistory, snapValue, updateCanvas]);

  const handlePointerUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  const clearDepthSelection = useCallback(() => {
    depthSelectionRef.current = null;
  }, []);

  const cancelDrag = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  return {
    cancelDrag,
    clearDepthSelection,
    getCanvasPoint,
    handleElementPointerDown,
    handlePointerMove,
    handlePointerUp,
    handleResizePointerDown,
  };
}

export type { ResizeHandle };
