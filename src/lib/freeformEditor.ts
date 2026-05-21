import type { FreeformCardElement } from '@/types';

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface DepthSelectionState {
  point: CanvasPoint;
  stackSignature: string;
}

const MIN_CHILD_SIZE = 12;
const MIN_SCALE_BASE = 1;

function isPointInsideElement(element: FreeformCardElement, point: CanvasPoint) {
  return (
    point.x >= element.x &&
    point.x <= element.x + element.width &&
    point.y >= element.y &&
    point.y <= element.y + element.height
  );
}

function buildStackSignature(stack: FreeformCardElement[]) {
  return stack.map((element) => element.id).join('|');
}

export function projectCanvasDeltaToElementLocal(deltaX: number, deltaY: number, rotationDeg = 0) {
  if (!rotationDeg) return { x: deltaX, y: deltaY };

  const radians = rotationDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: deltaX * cos + deltaY * sin,
    y: -deltaX * sin + deltaY * cos,
  };
}

export function getElementDepthStack(elements: FreeformCardElement[], point: CanvasPoint) {
  return elements
    .filter((element) => element.visible !== false)
    .filter((element) => isPointInsideElement(element, point))
    .sort((left, right) => right.zIndex - left.zIndex);
}

export function resolveDepthSelection(
  hitStack: FreeformCardElement[],
  point: CanvasPoint,
  currentSelectedId: string | null,
  previousState: DepthSelectionState | null,
  threshold = 28,
) {
  if (hitStack.length === 0) {
    return {
      nextSelectedId: null,
      nextState: null,
    };
  }

  const nextState = {
    point,
    stackSignature: buildStackSignature(hitStack),
  };

  if (hitStack.length === 1) {
    return {
      nextSelectedId: hitStack[0]?.id ?? null,
      nextState,
    };
  }

  const sameRegion = previousState
    && previousState.stackSignature === nextState.stackSignature
    && Math.abs(previousState.point.x - point.x) <= threshold
    && Math.abs(previousState.point.y - point.y) <= threshold;

  const currentSelectionStillInStack = currentSelectedId
    ? hitStack.some((element) => element.id === currentSelectedId)
    : false;

  if (!sameRegion && !currentSelectionStillInStack) {
    return {
      nextSelectedId: hitStack[0]?.id ?? null,
      nextState,
    };
  }

  const selectedIndex = hitStack.findIndex((element) => element.id === currentSelectedId);
  const nextIndex = selectedIndex >= 0
    ? (selectedIndex + 1) % hitStack.length
    : 0;

  return {
    nextSelectedId: hitStack[nextIndex]?.id ?? null,
    nextState,
  };
}

export function scaleElementWithParentResize(
  element: FreeformCardElement,
  originalParent: Pick<FreeformCardElement, 'x' | 'y' | 'width' | 'height'>,
  nextParent: Pick<FreeformCardElement, 'x' | 'y' | 'width' | 'height'>,
) {
  const scaleX = nextParent.width / Math.max(originalParent.width, MIN_SCALE_BASE);
  const scaleY = nextParent.height / Math.max(originalParent.height, MIN_SCALE_BASE);
  const uniformScale = Math.min(scaleX, scaleY);

  return {
    ...element,
    x: nextParent.x + (element.x - originalParent.x) * scaleX,
    y: nextParent.y + (element.y - originalParent.y) * scaleY,
    width: Math.max(MIN_CHILD_SIZE, element.width * scaleX),
    height: Math.max(MIN_CHILD_SIZE, element.height * scaleY),
    fontSizePx: element.fontSizePx
      ? Math.max(8, Math.round(element.fontSizePx * uniformScale))
      : element.fontSizePx,
    strokeWidth: typeof element.strokeWidth === 'number'
      ? Math.max(1, Math.round(element.strokeWidth * uniformScale * 100) / 100)
      : element.strokeWidth,
  };
}
