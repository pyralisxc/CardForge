import { normalizeAppearanceForElement } from '@/lib/appearance';
import type { FreeformCardElement } from '@/types';

export type LayerDropPosition = 'before' | 'after' | 'child';
export type ArrangeDirection = 'front' | 'back' | 'up' | 'down';

export interface CanvasCommandResult {
  elements: FreeformCardElement[];
  selectedElementId: string | null;
  checkedLayerIds?: string[];
  duplicatedElementIdMap?: Record<string, string>;
  changed: boolean;
  reason?: string;
}

const unchanged = (
  elements: FreeformCardElement[],
  selectedElementId: string | null,
  reason?: string,
  checkedLayerIds?: string[],
): CanvasCommandResult => ({
  elements,
  selectedElementId,
  checkedLayerIds,
  changed: false,
  reason,
});

const getSafeDescendantIds = (
  id: string,
  elements: FreeformCardElement[],
): string[] => {
  const byParent = new Map<string, FreeformCardElement[]>();
  for (const element of elements) {
    if (!element.parentId) continue;
    const children = byParent.get(element.parentId) ?? [];
    children.push(element);
    byParent.set(element.parentId, children);
  }

  const descendants: string[] = [];
  const visited = new Set([id]);
  const visit = (parentId: string) => {
    for (const child of byParent.get(parentId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      descendants.push(child.id);
      visit(child.id);
    }
  };

  visit(id);
  return descendants;
};

const getTopSelectableId = (elements: FreeformCardElement[]): string | null => {
  return [...elements]
    .filter((element) => element.visible !== false)
    .sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null;
};

export const deleteCanvasSelection = ({
  elements,
  selectedElementId,
}: {
  elements: FreeformCardElement[];
  selectedElementId: string | null;
}): CanvasCommandResult => {
  if (!selectedElementId) return unchanged(elements, null, 'missing-selection');

  const selectedElement = elements.find((element) => element.id === selectedElementId);
  if (!selectedElement) return unchanged(elements, null, 'missing-selection');
  if (selectedElement.locked) return unchanged(elements, selectedElementId, 'locked-selection');

  const descendantIds = getSafeDescendantIds(selectedElementId, elements);
  const hasLockedDescendant = elements.some((element) => (
    descendantIds.includes(element.id) && element.locked
  ));
  if (hasLockedDescendant) return unchanged(elements, selectedElementId, 'locked-descendant');

  const deleteIds = new Set([
    selectedElementId,
    ...descendantIds,
  ]);
  const nextElements = elements.filter((element) => !deleteIds.has(element.id));

  return {
    elements: nextElements,
    selectedElementId: getTopSelectableId(nextElements),
    changed: true,
  };
};

export const duplicateCanvasSelection = ({
  elements,
  selectedElementId,
  gridSize,
  createId,
}: {
  elements: FreeformCardElement[];
  selectedElementId: string | null;
  gridSize: number;
  createId: () => string;
}): CanvasCommandResult => {
  if (!selectedElementId) return unchanged(elements, null, 'missing-selection');

  const selectedElement = elements.find((element) => element.id === selectedElementId);
  if (!selectedElement) return unchanged(elements, null, 'missing-selection');

  const duplicateIds = [
    selectedElementId,
    ...getSafeDescendantIds(selectedElementId, elements),
  ];
  const elementsToDuplicate = duplicateIds
    .map((id) => elements.find((element) => element.id === id))
    .filter((element): element is FreeformCardElement => Boolean(element));
  const idMap = new Map(elementsToDuplicate.map((element) => [element.id, createId()]));
  const maxZ = Math.max(0, ...elements.map((element) => element.zIndex));
  const copies = elementsToDuplicate.map((element, index) => {
    const nextId = idMap.get(element.id)!;
    const copiedParentId = element.parentId && idMap.has(element.parentId)
      ? idMap.get(element.parentId)
      : element.parentId;

    return {
      ...element,
      id: nextId,
      name: element.id === selectedElementId ? `${element.name} Copy` : element.name,
      x: element.x + gridSize,
      y: element.y + gridSize,
      zIndex: maxZ + index + 1,
      locked: false,
      parentId: copiedParentId,
    };
  });

  return {
    elements: [...elements, ...copies],
    selectedElementId: idMap.get(selectedElementId) ?? null,
    duplicatedElementIdMap: Object.fromEntries(idMap.entries()),
    changed: true,
  };
};

export const moveCanvasSelectionByDelta = ({
  elements,
  selectedElementId,
  deltaX,
  deltaY,
}: {
  elements: FreeformCardElement[];
  selectedElementId: string | null;
  deltaX: number;
  deltaY: number;
}): CanvasCommandResult => {
  if (!selectedElementId) return unchanged(elements, null, 'missing-selection');

  const selectedElement = elements.find((element) => element.id === selectedElementId);
  if (!selectedElement) return unchanged(elements, null, 'missing-selection');
  if (selectedElement.locked) return unchanged(elements, selectedElementId, 'locked-selection');
  if (deltaX === 0 && deltaY === 0) return unchanged(elements, selectedElementId, 'empty-move');

  const moveIds = new Set([
    selectedElementId,
    ...getSafeDescendantIds(selectedElementId, elements),
  ]);

  return {
    elements: elements.map((element) => (
      moveIds.has(element.id)
        ? { ...element, x: element.x + deltaX, y: element.y + deltaY }
        : element
    )),
    selectedElementId,
    changed: true,
  };
};

export const arrangeCanvasSelection = ({
  elements,
  selectedElementId,
  direction,
}: {
  elements: FreeformCardElement[];
  selectedElementId: string | null;
  direction: ArrangeDirection;
}): CanvasCommandResult => {
  if (!selectedElementId) return unchanged(elements, null, 'missing-selection');

  const selectedElement = elements.find((element) => element.id === selectedElementId);
  if (!selectedElement) return unchanged(elements, null, 'missing-selection');
  if (selectedElement.locked) return unchanged(elements, selectedElementId, 'locked-selection');

  const zValues = elements.map((element) => element.zIndex);
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);

  if (direction === 'front' || direction === 'back') {
    const nextZ = direction === 'front' ? maxZ + 1 : minZ - 1;
    if (selectedElement.zIndex === nextZ) return unchanged(elements, selectedElementId, 'already-arranged');
    return {
      elements: elements.map((element) => (
        element.id === selectedElementId ? { ...element, zIndex: nextZ } : element
      )),
      selectedElementId,
      changed: true,
    };
  }

  const candidates = elements
    .filter((element) => element.id !== selectedElementId)
    .filter((element) => (
      direction === 'up'
        ? element.zIndex > selectedElement.zIndex
        : element.zIndex < selectedElement.zIndex
    ))
    .sort((a, b) => (
      direction === 'up'
        ? a.zIndex - b.zIndex
        : b.zIndex - a.zIndex
    ));
  const swapTarget = candidates[0];
  if (!swapTarget) return unchanged(elements, selectedElementId, 'already-arranged');

  return {
    elements: elements.map((element) => {
      if (element.id === selectedElementId) return { ...element, zIndex: swapTarget.zIndex };
      if (element.id === swapTarget.id) return { ...element, zIndex: selectedElement.zIndex };
      return element;
    }),
    selectedElementId,
    changed: true,
  };
};

export const groupCanvasElements = ({
  elements,
  checkedLayerIds,
  createId,
}: {
  elements: FreeformCardElement[];
  checkedLayerIds: string[];
  createId: () => string;
}): CanvasCommandResult => {
  const checkedIds = new Set(checkedLayerIds);
  const elementsToGroup = elements.filter((element) => checkedIds.has(element.id));
  if (elementsToGroup.length < 2) {
    return unchanged(elements, null, 'not-enough-layers', checkedLayerIds);
  }

  const minX = Math.min(...elementsToGroup.map((element) => element.x));
  const minY = Math.min(...elementsToGroup.map((element) => element.y));
  const maxX = Math.max(...elementsToGroup.map((element) => element.x + element.width));
  const maxY = Math.max(...elementsToGroup.map((element) => element.y + element.height));
  const x = minX - 8;
  const y = minY - 8;
  const width = maxX - x + 8;
  const height = maxY - y + 8;
  const zIndex = Math.max(0, ...elements.map((element) => element.zIndex)) + 1;
  const groupId = createId();
  const groupElement: FreeformCardElement = {
    id: groupId,
    type: 'shape',
    name: 'Group',
    x,
    y,
    width,
    height,
    zIndex,
    locked: false,
    visible: true,
    shapeKind: 'rectangle',
    fillColor: 'transparent',
    strokeColor: 'transparent',
    strokeWidth: 0,
    backgroundColor: 'transparent',
    borderWidth: '_none_',
    appearance: normalizeAppearanceForElement({
      id: groupId,
      type: 'shape',
      name: 'Group',
      x,
      y,
      width,
      height,
      zIndex,
    }),
  };

  return {
    elements: [
      ...elements.map((element) => (
        checkedIds.has(element.id) ? { ...element, parentId: groupId } : element
      )),
      groupElement,
    ],
    selectedElementId: groupId,
    checkedLayerIds: [],
    changed: true,
  };
};

export const ungroupCanvasSelection = ({
  elements,
  selectedElementId,
}: {
  elements: FreeformCardElement[];
  selectedElementId: string | null;
}): CanvasCommandResult => {
  if (!selectedElementId) return unchanged(elements, null, 'missing-selection');

  const selectedElement = elements.find((element) => element.id === selectedElementId);
  if (!selectedElement) return unchanged(elements, null, 'missing-selection');
  const directChildIds = new Set(
    elements
      .filter((element) => element.parentId === selectedElementId)
      .map((element) => element.id),
  );
  if (directChildIds.size === 0) return unchanged(elements, selectedElementId, 'not-a-group');

  return {
    elements: elements
      .filter((element) => element.id !== selectedElementId)
      .map((element) => (
        directChildIds.has(element.id) ? { ...element, parentId: undefined } : element
      )),
    selectedElementId: null,
    changed: true,
  };
};

export const reorderCanvasLayer = ({
  elements,
  sourceId,
  targetId,
  position,
}: {
  elements: FreeformCardElement[];
  sourceId: string;
  targetId: string;
  position: LayerDropPosition;
}): CanvasCommandResult => {
  if (sourceId === targetId) return unchanged(elements, null, 'same-layer');

  const sourceElement = elements.find((element) => element.id === sourceId);
  const targetElement = elements.find((element) => element.id === targetId);
  if (!sourceElement || !targetElement) return unchanged(elements, null, 'missing-layer');

  if (position === 'child') {
    const sourceDescendants = new Set(getSafeDescendantIds(sourceId, elements));
    if (sourceDescendants.has(targetId)) {
      return unchanged(elements, null, 'cyclic-parent');
    }

    return {
      elements: elements.map((element) => (
        element.id === sourceId ? { ...element, parentId: targetId } : element
      )),
      selectedElementId: sourceId,
      changed: true,
    };
  }

  const sortedLayers = [...elements].sort((a, b) => b.zIndex - a.zIndex);
  const sourceLayer = sortedLayers.find((element) => element.id === sourceId);
  const layersWithoutSource = sortedLayers.filter((element) => element.id !== sourceId);
  const targetIndex = layersWithoutSource.findIndex((element) => element.id === targetId);
  if (!sourceLayer || targetIndex === -1) return unchanged(elements, null, 'missing-layer');

  const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
  layersWithoutSource.splice(Math.min(insertAt, layersWithoutSource.length), 0, sourceLayer);

  const totalZ = layersWithoutSource.length;
  const zIndexById = new Map(layersWithoutSource.map((element, index) => [element.id, totalZ - index]));

  return {
    elements: elements.map((element) => ({
      ...element,
      zIndex: zIndexById.get(element.id) ?? element.zIndex,
    })),
    selectedElementId: sourceId,
    changed: true,
  };
};
