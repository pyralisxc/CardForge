import { describe, expect, it } from 'vitest';

import { buildLayerTree, getDescendantIds } from '@/features/template-editor/lib/layerTree';
import type { FreeformCardElement } from '@/types';

const element = (
  id: string,
  zIndex: number,
  parentId?: string,
): FreeformCardElement => ({
  id,
  name: id,
  type: 'shape',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  zIndex,
  parentId,
});

describe('layerTree', () => {
  it('builds nested layer trees sorted by descending z-index', () => {
    const tree = buildLayerTree([
      element('root-low', 1),
      element('child-low', 2, 'root-high'),
      element('root-high', 10),
      element('child-high', 8, 'root-high'),
    ]);

    expect(tree.map((node) => node.element.id)).toEqual(['root-high', 'root-low']);
    expect(tree[0].children.map((node) => node.element.id)).toEqual(['child-high', 'child-low']);
  });

  it('treats missing parents as roots', () => {
    const tree = buildLayerTree([
      element('orphan', 3, 'missing'),
      element('root', 1),
    ]);

    expect(tree.map((node) => node.element.id)).toEqual(['orphan', 'root']);
  });

  it('returns recursive descendant ids in tree order', () => {
    const elements = [
      element('root', 1),
      element('child-a', 2, 'root'),
      element('grandchild', 3, 'child-a'),
      element('child-b', 4, 'root'),
      element('other', 5),
    ];

    expect(getDescendantIds('root', elements)).toEqual(['child-a', 'grandchild', 'child-b']);
  });
});
