import type { FreeformCardElement } from './types';

export const FREEFORM_HIERARCHY_VERSION = 2 as const;

export interface ElementWorldOrigin {
  x: number;
  y: number;
}

const finite = (value: number): number => Number.isFinite(value) ? value : 0;

const elementMap = (elements: readonly FreeformCardElement[]) => (
  new Map(elements.map((element) => [element.id, element] as const))
);

export const resolveCanvasElementWorldOrigin = (
  element: FreeformCardElement,
  elements: readonly FreeformCardElement[],
): ElementWorldOrigin => {
  const byId = elementMap(elements);
  const visited = new Set<string>();
  let x = finite(element.x);
  let y = finite(element.y);
  let parentId = element.parentId;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    x += finite(parent.x);
    y += finite(parent.y);
    parentId = parent.parentId;
  }

  return { x, y };
};

export const getCanvasElementParentWorldOrigin = (
  element: Pick<FreeformCardElement, 'parentId'>,
  elements: readonly FreeformCardElement[],
): ElementWorldOrigin => {
  if (!element.parentId) return { x: 0, y: 0 };
  const parent = elements.find((candidate) => candidate.id === element.parentId);
  return parent ? resolveCanvasElementWorldOrigin(parent, elements) : { x: 0, y: 0 };
};

export const resolveCanvasElementWorldGeometry = (
  element: FreeformCardElement,
  elements: readonly FreeformCardElement[],
): FreeformCardElement => {
  const world = resolveCanvasElementWorldOrigin(element, elements);
  return { ...element, x: world.x, y: world.y };
};

export const resolveCanvasElementsForRender = (
  elements: readonly FreeformCardElement[],
): FreeformCardElement[] => elements.map((element) => (
  resolveCanvasElementWorldGeometry(element, elements)
));

export const worldToCanvasElementLocalPosition = (
  element: Pick<FreeformCardElement, 'parentId'>,
  world: ElementWorldOrigin,
  elements: readonly FreeformCardElement[],
): ElementWorldOrigin => {
  const parent = getCanvasElementParentWorldOrigin(element, elements);
  return {
    x: finite(world.x) - parent.x,
    y: finite(world.y) - parent.y,
  };
};

/**
 * Legacy parentId was organizational only: every x/y was canvas-absolute.
 * Convert each direct child once by subtracting its direct parent's legacy
 * absolute origin. Nested groups then compose correctly in v2.
 */
export const migrateLegacyAbsoluteHierarchy = (
  elements: readonly FreeformCardElement[],
): FreeformCardElement[] => {
  const byId = elementMap(elements);
  return elements.map((element) => {
    if (!element.parentId) return { ...element };
    const parent = byId.get(element.parentId);
    if (!parent) return { ...element, parentId: undefined };
    return {
      ...element,
      x: finite(element.x) - finite(parent.x),
      y: finite(element.y) - finite(parent.y),
    };
  });
};
