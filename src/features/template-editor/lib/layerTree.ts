import type { FreeformCardElement } from '@/types';

export interface LayerTreeNode {
  element: FreeformCardElement;
  children: LayerTreeNode[];
}

export interface LayerDropTarget {
  id: string;
  pos: 'before' | 'after' | 'child';
}

export const buildLayerTree = (elements: FreeformCardElement[]): LayerTreeNode[] => {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const roots: LayerTreeNode[] = [];
  const nodeMap = new Map<string, LayerTreeNode>(
    elements.map((element) => [element.id, { element, children: [] }]),
  );

  for (const element of elements) {
    if (element.parentId && nodeMap.has(element.parentId)) {
      nodeMap.get(element.parentId)!.children.push(nodeMap.get(element.id)!);
    } else if (!element.parentId || !byId.has(element.parentId)) {
      roots.push(nodeMap.get(element.id)!);
    }
  }

  const sortDescending = (nodes: LayerTreeNode[]) => {
    nodes.sort((a, b) => b.element.zIndex - a.element.zIndex);
    nodes.forEach((node) => sortDescending(node.children));
  };

  sortDescending(roots);
  return roots;
};

export const getDescendantIds = (id: string, elements: FreeformCardElement[]): string[] => {
  const directChildren = elements.filter((element) => element.parentId === id);
  return directChildren.flatMap((child) => [child.id, ...getDescendantIds(child.id, elements)]);
};
