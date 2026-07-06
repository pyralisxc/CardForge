import type { FreeformCardElement } from '@/types';
import { CANVAS_ZOOM } from '@/features/template-editor/lib/canvasViewportConfig';

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface CanvasPointerEventLike {
  clientX: number;
  clientY: number;
}

interface CanvasRectLike {
  left: number;
  top: number;
}

interface StageRectLike extends CanvasRectLike {
  width?: number;
  height?: number;
}

type SnapValue = (value: number) => number;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const getCanvasPointFromRect = (
  event: CanvasPointerEventLike,
  rect: CanvasRectLike,
  zoom: number,
) => ({
  x: (event.clientX - rect.left) / zoom,
  y: (event.clientY - rect.top) / zoom,
});

export const getTouchDistance = (
  first: CanvasPointerEventLike,
  second: CanvasPointerEventLike,
): number => Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);

export const getTouchMidpoint = (
  first: CanvasPointerEventLike,
  second: CanvasPointerEventLike,
): CanvasPointerEventLike => ({
  clientX: (first.clientX + second.clientX) / 2,
  clientY: (first.clientY + second.clientY) / 2,
});

export const calculateZoomAroundClientPoint = ({
  currentZoom,
  nextZoom,
  scrollLeft,
  scrollTop,
  focalPoint,
  stageRect,
  minZoom = CANVAS_ZOOM.min,
  maxZoom = CANVAS_ZOOM.max,
}: {
  currentZoom: number;
  nextZoom: number;
  scrollLeft: number;
  scrollTop: number;
  focalPoint: CanvasPointerEventLike;
  stageRect: StageRectLike;
  minZoom?: number;
  maxZoom?: number;
}) => {
  const clampedZoom = clamp(nextZoom, minZoom, maxZoom);
  const ratio = clampedZoom / Math.max(currentZoom, minZoom);
  const focalX = focalPoint.clientX - stageRect.left;
  const focalY = focalPoint.clientY - stageRect.top;

  return {
    zoom: clampedZoom,
    scrollLeft: (scrollLeft + focalX) * ratio - focalX,
    scrollTop: (scrollTop + focalY) * ratio - focalY,
  };
};

export const calculateMovedElementPosition = ({
  original,
  deltaX,
  deltaY,
  canvasWidth,
  canvasHeight,
  snapValue,
  minVisible = 20,
}: {
  original: FreeformCardElement;
  deltaX: number;
  deltaY: number;
  canvasWidth: number;
  canvasHeight: number;
  snapValue: SnapValue;
  minVisible?: number;
}) => ({
  x: clamp(snapValue(original.x + deltaX), -(original.width - minVisible), canvasWidth - minVisible),
  y: clamp(snapValue(original.y + deltaY), -(original.height - minVisible), canvasHeight - minVisible),
});

export const calculateResizedElementBounds = ({
  original,
  handle,
  deltaX,
  deltaY,
  canvasWidth,
  canvasHeight,
  snapValue,
}: {
  original: FreeformCardElement;
  handle: ResizeHandle;
  deltaX: number;
  deltaY: number;
  canvasWidth: number;
  canvasHeight: number;
  snapValue: SnapValue;
}) => {
  const horizontalFactor = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const verticalFactor = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  const centerX = original.x + original.width / 2;
  const centerY = original.y + original.height / 2;
  const width = horizontalFactor === 0
    ? original.width
    : clamp(snapValue(original.width + horizontalFactor * deltaX * 2), 20, canvasWidth * 2);
  const height = verticalFactor === 0
    ? original.height
    : clamp(snapValue(original.height + verticalFactor * deltaY * 2), 12, canvasHeight * 2);
  const x = horizontalFactor === 0 ? original.x : snapValue(centerX - width / 2);
  const y = verticalFactor === 0 ? original.y : snapValue(centerY - height / 2);

  return {
    x,
    y,
    width,
    height,
  };
};
