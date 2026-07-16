"use client";

import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FreeformCardElement } from '@/domain/templates';
import { useCanvasPointerInteractions } from '@/features/template-editor/hooks/useCanvasPointerInteractions';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import { CONSOLIDATED_ELEMENT_KITS } from '@/features/template-editor/lib/elementKits';
import {
  calculateZoomAroundClientPoint,
  getTouchDistance,
  getTouchMidpoint,
} from '@/features/template-editor/lib/canvasPointerMath';
import {
  CANVAS_GUTTER,
  CANVAS_RULER_WIDTH,
  CANVAS_SCROLL_PADDING,
  CANVAS_ZOOM,
} from '@/features/template-editor/lib/canvasViewportConfig';
import { clamp } from '@/features/template-editor/lib/makerGeometry';

export type MobileMakerPanel = 'canvas' | 'library' | 'inspector';

type TouchPoint = { clientX: number; clientY: number };
interface TouchGestureState {
  distance: number;
  midpoint: TouchPoint;
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
}

interface UseTemplateEditorViewportInput {
  addElement: (
    type: FreeformCardElement['type'],
    placement?: { x: number; y: number },
    preset?: Partial<FreeformCardElement>,
  ) => void;
  canvasRef: RefObject<HTMLDivElement | null>;
  controller: TemplateEditorController;
  deleteSelected: () => void;
  selectElement: (id: string | null) => void;
}

export function useTemplateEditorViewport({
  addElement,
  canvasRef,
  controller,
  deleteSelected,
  selectElement,
}: UseTemplateEditorViewportInput) {
  const {
    canvas,
    currentTemplate,
    moveSelectionByDelta,
    recordTemplateHistory,
    selectedElement,
    selectedElementId,
    updateCanvas,
  } = controller;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const touchPointersRef = useRef<Map<number, TouchPoint>>(new Map());
  const touchGestureRef = useRef<TouchGestureState | null>(null);
  const [zoom, setZoom] = useState(0.62);
  const [autoFitCanvas, setAutoFitCanvas] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<MobileMakerPanel>('canvas');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const gridSize = canvas.gridSize || 20;

  useEffect(() => {
    const stage = stageRef.current;
    if (!autoFitCanvas || !stage) return;
    const updateFit = () => {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (!width || !height) return;
      const chrome = CANVAS_RULER_WIDTH + CANVAS_GUTTER * 2 + CANVAS_SCROLL_PADDING;
      const widthFit = (width - chrome) / canvas.width;
      const heightFit = (height - chrome) / canvas.height;
      const fitted = width < 1024
        ? Math.min(widthFit, CANVAS_ZOOM.autoFitMax)
        : Math.min(widthFit, heightFit, CANVAS_ZOOM.autoFitMax);
      setZoom(clamp(Math.round(fitted * 100) / 100, CANVAS_ZOOM.min, CANVAS_ZOOM.autoFitMax));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [autoFitCanvas, canvas.height, canvas.width]);

  const snapValue = useCallback(
    (value: number) => snapToGrid ? Math.round(value / gridSize) * gridSize : Math.round(value),
    [gridSize, snapToGrid],
  );
  const pointer = useCanvasPointerInteractions({
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
  });

  const beginTouchGesture = useCallback(() => {
    const stage = stageRef.current;
    const points = Array.from(touchPointersRef.current.values());
    if (!stage || points.length < 2) {
      touchGestureRef.current = null;
      return;
    }
    const [first, second] = points;
    touchGestureRef.current = {
      distance: Math.max(1, getTouchDistance(first, second)),
      midpoint: getTouchMidpoint(first, second),
      zoom,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
    };
  }, [zoom]);

  const handleStagePointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (touchPointersRef.current.size >= 2) {
      event.preventDefault();
      setAutoFitCanvas(false);
      pointer.cancelDrag();
      beginTouchGesture();
    }
  }, [beginTouchGesture, pointer]);

  const handleStagePointerMoveCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !touchPointersRef.current.has(event.pointerId)) return;
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const stage = stageRef.current;
    const gesture = touchGestureRef.current;
    const points = Array.from(touchPointersRef.current.values());
    if (!stage || !gesture || points.length < 2) return;
    event.preventDefault();
    event.stopPropagation();
    const [first, second] = points;
    const currentDistance = Math.max(1, getTouchDistance(first, second));
    const currentMidpoint = getTouchMidpoint(first, second);
    const nextViewport = calculateZoomAroundClientPoint({
      currentZoom: gesture.zoom,
      nextZoom: gesture.zoom * (currentDistance / gesture.distance),
      scrollLeft: gesture.scrollLeft,
      scrollTop: gesture.scrollTop,
      focalPoint: gesture.midpoint,
      stageRect: stage.getBoundingClientRect(),
      minZoom: CANVAS_ZOOM.min,
      maxZoom: CANVAS_ZOOM.max,
    });
    setZoom(Math.round(nextViewport.zoom * CANVAS_ZOOM.precision) / CANVAS_ZOOM.precision);
    stage.scrollLeft = nextViewport.scrollLeft + (gesture.midpoint.clientX - currentMidpoint.clientX);
    stage.scrollTop = nextViewport.scrollTop + (gesture.midpoint.clientY - currentMidpoint.clientY);
  }, []);

  const handleStagePointerUpCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    touchPointersRef.current.delete(event.pointerId);
    if (touchPointersRef.current.size >= 2) beginTouchGesture();
    else touchGestureRef.current = null;
  }, [beginTouchGesture]);

  const handleStageWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    setAutoFitCanvas(false);
    const nextViewport = calculateZoomAroundClientPoint({
      currentZoom: zoom,
      nextZoom: zoom * (event.deltaY > 0 ? 0.92 : 1.08),
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
      focalPoint: { clientX: event.clientX, clientY: event.clientY },
      stageRect: stage.getBoundingClientRect(),
      minZoom: CANVAS_ZOOM.min,
      maxZoom: CANVAS_ZOOM.max,
    });
    setZoom(Math.round(nextViewport.zoom * CANVAS_ZOOM.precision) / CANVAS_ZOOM.precision);
    stage.scrollLeft = nextViewport.scrollLeft;
    stage.scrollTop = nextViewport.scrollTop;
  }, [zoom]);

  const centerCanvasViewport = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
  }, []);

  const fitCanvasToViewport = useCallback(() => {
    setAutoFitCanvas(true);
    requestAnimationFrame(centerCanvasViewport);
  }, [centerCanvasViewport]);

  const resetCanvasZoom = useCallback(() => {
    setAutoFitCanvas(false);
    setZoom(CANVAS_ZOOM.actualSize);
    requestAnimationFrame(centerCanvasViewport);
  }, [centerCanvasViewport]);

  const handleDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/cardforge-element') as FreeformCardElement['type'];
    if (!type) return;
    const kitIndex = Number(event.dataTransfer.getData('application/cardforge-kit-index'));
    const serializedPreset = event.dataTransfer.getData('application/cardforge-preset');
    const preset = serializedPreset
      ? JSON.parse(serializedPreset) as Partial<FreeformCardElement>
      : Number.isFinite(kitIndex) ? CONSOLIDATED_ELEMENT_KITS[kitIndex]?.preset : undefined;
    const point = pointer.getCanvasPoint(event);
    addElement(type, { x: snapValue(point.x), y: snapValue(point.y) }, preset);
  }, [addElement, pointer, snapValue]);

  const handleCanvasKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!selectedElement) return;
    const step = event.shiftKey ? gridSize : 1;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      deleteSelected();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      moveSelectionByDelta(dx, dy);
    }
  }, [deleteSelected, gridSize, moveSelectionByDelta, selectedElement]);

  return {
    ...pointer,
    autoFitCanvas,
    canvasRef,
    centerCanvasViewport,
    fitCanvasToViewport,
    gridSize,
    handleCanvasKeyDown,
    handleDrop,
    handleStagePointerDownCapture,
    handleStagePointerMoveCapture,
    handleStagePointerUpCapture,
    handleStageWheel,
    mobilePanel,
    previewMode,
    resetCanvasZoom,
    setAutoFitCanvas,
    setMobilePanel,
    setPreviewMode,
    setShowGrid,
    setSnapToGrid,
    setZoom,
    showGrid,
    snapToGrid,
    stageRef,
    zoom,
  };
}
