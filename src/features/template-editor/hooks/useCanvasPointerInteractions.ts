"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import type { FreeformCanvas, FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import { getElementDepthStack, resolvePointerPressSelection, scaleElementWithParentResize } from '@/domain/templates/editorGeometry';
import { getDescendantIds } from '@/features/template-editor/lib/layerTree';
import {
  calculateMovedElementPosition,
  calculateResizedElementBounds,
  getCanvasPointFromRect,
  type ResizeHandle,
} from '@/features/template-editor/lib/canvasPointerMath';

type ElementContextAction = (element: FreeformCardElement) => void;

type DragState =
  | { mode: 'move'; id: string; startX: number; startY: number; original: FreeformCardElement; childOriginals: Map<string, FreeformCardElement>; hasMoved: boolean; startSlop: number }
  | { mode: 'resize'; id: string; handle: ResizeHandle; startX: number; startY: number; original: FreeformCardElement; childOriginals: Map<string, FreeformCardElement>; hasMoved: boolean; startSlop: number };

interface PressState {
  pointerId: number;
  pointerTarget: HTMLElement;
  startClientX: number;
  startClientY: number;
  movementSlopPx: number;
  activeElement: FreeformCardElement;
  tapSelectedId: string | null;
  cycleDepthOnTap: boolean;
  hasMoved: boolean;
  longPressTimer: number | null;
  contextAction: ElementContextAction;
}

const MOUSE_DRAG_START_SLOP = 3;
const TOUCH_DRAG_START_SLOP = 10;
export const LONG_PRESS_DURATION_MS = 450;

interface UseCanvasPointerInteractionsInput {
  canvas: FreeformCanvas;
  canvasRef: RefObject<HTMLDivElement | null>;
  currentTemplate: TCGCardTemplate;
  previewMode: boolean;
  recordTemplateHistory: (template?: TCGCardTemplate) => void;
  selectedElementId: string | null;
  selectElement: (id: string | null) => void;
  snapValue: (value: number) => number;
  updateCanvas: (updates: Partial<FreeformCanvas>, trackHistory?: boolean) => void;
  zoom: number;
}

function clearLongPressTimer(press: PressState) {
  if (press.longPressTimer !== null) window.clearTimeout(press.longPressTimer);
  press.longPressTimer = null;
}

function releasePointerCapture(press: PressState) {
  try {
    if (press.pointerTarget.hasPointerCapture(press.pointerId)) {
      press.pointerTarget.releasePointerCapture(press.pointerId);
    }
  } catch {
    // Capture can already be gone after pointer cancellation or element teardown.
  }
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
  const pressStateRef = useRef<PressState | null>(null);

  const clearActivePress = useCallback(() => {
    const press = pressStateRef.current;
    if (!press) return;
    clearLongPressTimer(press);
    releasePointerCapture(press);
    pressStateRef.current = null;
  }, []);

  useEffect(() => () => {
    clearActivePress();
    dragStateRef.current = null;
  }, [clearActivePress]);

  const getCanvasPoint = useCallback((event: Pick<PointerEvent | ReactPointerEvent, 'clientX' | 'clientY'>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return getCanvasPointFromRect(event, rect, zoom);
  }, [canvasRef, zoom]);

  const handleElementContextMenu = useCallback((element: FreeformCardElement, onElementContextAction: ElementContextAction) => {
    selectElement(element.id);
    onElementContextAction(element);
  }, [selectElement]);

  const handleElementPointerDown = useCallback((
    event: ReactPointerEvent,
    element: FreeformCardElement,
    onElementContextAction: ElementContextAction,
  ) => {
    if (previewMode || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    event.stopPropagation();
    clearActivePress();
    dragStateRef.current = null;

    const point = getCanvasPoint(event);
    const hitStack = getElementDepthStack(canvas.elements, point);
    const selection = resolvePointerPressSelection({
      clickedElementId: element.id,
      currentSelectedId: selectedElementId,
      forceDepthCycle: event.altKey,
      hitStack,
    });
    const targetElement = canvas.elements.find((candidate) => candidate.id === (selection.activeSelectedId || element.id)) || element;

    if (event.button === 2) {
      handleElementContextMenu(targetElement, onElementContextAction);
      return;
    }

    selectElement(targetElement.id);
    const pointerTarget = event.currentTarget as HTMLElement;
    pointerTarget.setPointerCapture(event.pointerId);
    const movementSlopPx = event.pointerType === 'touch' ? TOUCH_DRAG_START_SLOP : MOUSE_DRAG_START_SLOP;
    const press: PressState = {
      pointerId: event.pointerId,
      pointerTarget,
      startClientX: event.clientX,
      startClientY: event.clientY,
      movementSlopPx,
      activeElement: targetElement,
      tapSelectedId: selection.tapSelectedId,
      cycleDepthOnTap: selection.cycleDepthOnTap,
      hasMoved: false,
      longPressTimer: null,
      contextAction: onElementContextAction,
    };
    pressStateRef.current = press;

    press.longPressTimer = window.setTimeout(() => {
      const currentPress = pressStateRef.current;
      if (!currentPress || currentPress.pointerId !== press.pointerId || currentPress.hasMoved) return;
      clearLongPressTimer(currentPress);
      dragStateRef.current = null;
      releasePointerCapture(currentPress);
      pressStateRef.current = null;
      handleElementContextMenu(currentPress.activeElement, currentPress.contextAction);
    }, LONG_PRESS_DURATION_MS);

    if (targetElement.locked) return;
    const descendantIds = getDescendantIds(targetElement.id, canvas.elements);
    const childOriginals = new Map(canvas.elements.filter((item) => descendantIds.includes(item.id)).map((item) => [item.id, { ...item }]));
    dragStateRef.current = { mode: 'move', id: targetElement.id, startX: point.x, startY: point.y, original: targetElement, childOriginals, hasMoved: false, startSlop: movementSlopPx / zoom };
  }, [canvas.elements, clearActivePress, getCanvasPoint, handleElementContextMenu, previewMode, selectElement, selectedElementId, zoom]);

  const handleResizePointerDown = useCallback((event: ReactPointerEvent, element: FreeformCardElement, handle: ResizeHandle) => {
    if (previewMode || element.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearActivePress();
    selectElement(element.id);
    const point = getCanvasPoint(event);
    const descendantIds = getDescendantIds(element.id, canvas.elements);
    const childOriginals = new Map(canvas.elements.filter((item) => descendantIds.includes(item.id)).map((item) => [item.id, { ...item }]));
    dragStateRef.current = { mode: 'resize', id: element.id, handle, startX: point.x, startY: point.y, original: element, childOriginals, hasMoved: false, startSlop: event.pointerType === 'touch' ? TOUCH_DRAG_START_SLOP / zoom : MOUSE_DRAG_START_SLOP };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [canvas.elements, clearActivePress, getCanvasPoint, previewMode, selectElement, zoom]);

  const handlePointerMove = useCallback((event: ReactPointerEvent) => {
    const press = pressStateRef.current;
    if (press && press.pointerId === event.pointerId && !press.hasMoved) {
      const movementPx = Math.hypot(event.clientX - press.startClientX, event.clientY - press.startClientY);
      if (movementPx >= press.movementSlopPx) {
        press.hasMoved = true;
        clearLongPressTimer(press);
      }
    }

    const dragState = dragStateRef.current;
    if (!dragState) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getCanvasPoint(event);
    const deltaX = point.x - dragState.startX;
    const deltaY = point.y - dragState.startY;
    const movement = Math.hypot(deltaX, deltaY);
    if (!dragState.hasMoved) {
      if (movement < dragState.startSlop) return;
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

  const handlePointerUp = useCallback((event: ReactPointerEvent) => {
    const press = pressStateRef.current;
    if (press && press.pointerId === event.pointerId) {
      clearLongPressTimer(press);
      if (event.type === 'pointerup' && !press.hasMoved && press.cycleDepthOnTap && press.tapSelectedId) {
        selectElement(press.tapSelectedId);
      }
      releasePointerCapture(press);
      pressStateRef.current = null;
    }
    dragStateRef.current = null;
  }, [selectElement]);

  const clearDepthSelection = useCallback(() => {
    clearActivePress();
    dragStateRef.current = null;
  }, [clearActivePress]);

  const cancelDrag = useCallback(() => {
    clearActivePress();
    dragStateRef.current = null;
  }, [clearActivePress]);

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
