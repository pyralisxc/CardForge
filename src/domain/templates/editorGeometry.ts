import type { FreeformCardElement } from '@/domain/templates';

export interface CanvasPoint {
  x: number;
  y: number;
}

interface ResolvePointerPressSelectionInput {
  clickedElementId: string;
  currentSelectedId: string | null;
  forceDepthCycle?: boolean;
  hitStack: FreeformCardElement[];
}

export interface PointerPressSelection {
  activeSelectedId: string | null;
  tapSelectedId: string | null;
  cycleDepthOnTap: boolean;
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

export function getElementDepthStack(elements: FreeformCardElement[], point: CanvasPoint) {
  return elements
    .filter((element) => element.visible !== false)
    .filter((element) => isPointInsideElement(element, point))
    .sort((left, right) => right.zIndex - left.zIndex);
}

export function resolvePointerPressSelection({
  clickedElementId,
  currentSelectedId,
  forceDepthCycle = false,
  hitStack,
}: ResolvePointerPressSelectionInput): PointerPressSelection {
  if (hitStack.length === 0) {
    return {
      activeSelectedId: null,
      tapSelectedId: null,
      cycleDepthOnTap: false,
    };
  }

  const clickedIndex = hitStack.findIndex((element) => element.id === clickedElementId);
  const currentIndex = currentSelectedId
    ? hitStack.findIndex((element) => element.id === currentSelectedId)
    : -1;
  const activeIndex = currentIndex >= 0
    ? currentIndex
    : clickedIndex >= 0
      ? clickedIndex
      : 0;
  const activeSelectedId = hitStack[activeIndex]?.id ?? null;
  const cycleDepthOnTap = hitStack.length > 1 && (forceDepthCycle || currentIndex >= 0);
  const tapSelectedId = cycleDepthOnTap
    ? hitStack[(activeIndex + 1) % hitStack.length]?.id ?? activeSelectedId
    : activeSelectedId;

  return {
    activeSelectedId,
    tapSelectedId,
    cycleDepthOnTap,
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
