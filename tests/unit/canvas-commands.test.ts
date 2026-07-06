import { describe, expect, it } from 'vitest';

import {
  arrangeCanvasSelection,
  deleteCanvasSelection,
  duplicateCanvasSelection,
  groupCanvasElements,
  moveCanvasSelectionByDelta,
  reorderCanvasLayer,
  ungroupCanvasSelection,
} from '@/features/template-editor/lib/canvasCommands';
import type { FreeformCardElement } from '@/types';

const element = (
  id: string,
  zIndex: number,
  overrides: Partial<FreeformCardElement> = {},
): FreeformCardElement => ({
  id,
  name: id,
  type: 'shape',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  zIndex,
  locked: false,
  visible: true,
  ...overrides,
});

describe('canvasCommands', () => {
  it('deletes a selected layer with descendants and selects the top remaining layer', () => {
    const result = deleteCanvasSelection({
      elements: [
        element('background', 1),
        element('group', 5),
        element('child', 6, { parentId: 'group' }),
        element('top-remaining', 10),
      ],
      selectedElementId: 'group',
    });

    expect(result.changed).toBe(true);
    expect(result.elements.map((item) => item.id)).toEqual(['background', 'top-remaining']);
    expect(result.selectedElementId).toBe('top-remaining');
  });

  it('refuses to delete a locked selected layer', () => {
    const elements = [
      element('locked', 2, { locked: true }),
      element('other', 1),
    ];

    const result = deleteCanvasSelection({ elements, selectedElementId: 'locked' });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('locked-selection');
    expect(result.elements).toBe(elements);
    expect(result.selectedElementId).toBe('locked');
  });

  it('refuses to delete a group that contains locked descendants', () => {
    const elements = [
      element('group', 4),
      element('locked-child', 5, { parentId: 'group', locked: true }),
      element('other', 1),
    ];

    const result = deleteCanvasSelection({ elements, selectedElementId: 'group' });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('locked-descendant');
    expect(result.elements).toBe(elements);
    expect(result.selectedElementId).toBe('group');
  });

  it('duplicates a selected group with remapped child parents and an unlocked copy', () => {
    const ids = ['group-copy', 'child-copy'];
    const result = duplicateCanvasSelection({
      elements: [
        element('group', 3),
        element('child', 4, { parentId: 'group', x: 18, y: 28 }),
        element('other', 1),
      ],
      selectedElementId: 'group',
      gridSize: 8,
      createId: () => ids.shift() ?? 'fallback',
    });

    expect(result.changed).toBe(true);
    expect(result.selectedElementId).toBe('group-copy');
    expect(result.duplicatedElementIdMap).toEqual({
      group: 'group-copy',
      child: 'child-copy',
    });

    const groupCopy = result.elements.find((item) => item.id === 'group-copy');
    const childCopy = result.elements.find((item) => item.id === 'child-copy');
    expect(groupCopy).toMatchObject({
      name: 'group Copy',
      x: 18,
      y: 28,
      locked: false,
    });
    expect(childCopy).toMatchObject({
      parentId: 'group-copy',
      x: 26,
      y: 36,
      locked: false,
    });
    expect(Math.max(...result.elements.map((item) => item.zIndex))).toBe(childCopy?.zIndex);
  });

  it('groups checked layers under a generated transparent group element', () => {
    const result = groupCanvasElements({
      elements: [
        element('left', 2, { x: 20, y: 30, width: 40, height: 50 }),
        element('right', 5, { x: 100, y: 90, width: 20, height: 30 }),
        element('other', 1),
      ],
      checkedLayerIds: ['left', 'right'],
      createId: () => 'new-group',
    });

    expect(result.changed).toBe(true);
    expect(result.selectedElementId).toBe('new-group');
    expect(result.checkedLayerIds).toEqual([]);

    const group = result.elements.find((item) => item.id === 'new-group');
    expect(group).toMatchObject({
      type: 'shape',
      name: 'Group',
      x: 12,
      y: 22,
      width: 116,
      height: 106,
      backgroundColor: 'transparent',
      strokeColor: 'transparent',
      zIndex: 6,
    });
    expect(result.elements.find((item) => item.id === 'left')?.parentId).toBe('new-group');
    expect(result.elements.find((item) => item.id === 'right')?.parentId).toBe('new-group');
  });

  it('ungroups a selected group without orphaning nested grandchildren', () => {
    const result = ungroupCanvasSelection({
      elements: [
        element('group', 4),
        element('child', 3, { parentId: 'group' }),
        element('grandchild', 2, { parentId: 'child' }),
      ],
      selectedElementId: 'group',
    });

    expect(result.changed).toBe(true);
    expect(result.elements.map((item) => item.id)).toEqual(['child', 'grandchild']);
    expect(result.elements.find((item) => item.id === 'child')?.parentId).toBeUndefined();
    expect(result.elements.find((item) => item.id === 'grandchild')?.parentId).toBe('child');
    expect(result.selectedElementId).toBeNull();
  });

  it('prevents layer drops that parent a layer under its own descendant', () => {
    const elements = [
      element('group', 3),
      element('child', 2, { parentId: 'group' }),
    ];

    const result = reorderCanvasLayer({
      elements,
      sourceId: 'group',
      targetId: 'child',
      position: 'child',
    });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('cyclic-parent');
    expect(result.elements).toBe(elements);
  });

  it('reorders flat layers with deterministic z-index remapping after removing the source', () => {
    const result = reorderCanvasLayer({
      elements: [
        element('top', 3),
        element('middle', 2),
        element('bottom', 1),
      ],
      sourceId: 'top',
      targetId: 'bottom',
      position: 'after',
    });

    expect(result.changed).toBe(true);
    expect(Object.fromEntries(result.elements.map((item) => [item.id, item.zIndex]))).toEqual({
      middle: 3,
      bottom: 2,
      top: 1,
    });
  });

  it('nudges a selected layer and descendants together', () => {
    const result = moveCanvasSelectionByDelta({
      elements: [
        element('group', 2, { x: 10, y: 20 }),
        element('child', 3, { parentId: 'group', x: 30, y: 40 }),
        element('other', 1, { x: 100, y: 100 }),
      ],
      selectedElementId: 'group',
      deltaX: 5,
      deltaY: -3,
    });

    expect(result.changed).toBe(true);
    expect(result.elements.find((item) => item.id === 'group')).toMatchObject({ x: 15, y: 17 });
    expect(result.elements.find((item) => item.id === 'child')).toMatchObject({ x: 35, y: 37 });
    expect(result.elements.find((item) => item.id === 'other')).toMatchObject({ x: 100, y: 100 });
    expect(result.selectedElementId).toBe('group');
  });

  it('refuses to nudge a locked selected layer', () => {
    const elements = [element('locked', 2, { locked: true })];

    const result = moveCanvasSelectionByDelta({
      elements,
      selectedElementId: 'locked',
      deltaX: 5,
      deltaY: 5,
    });

    expect(result.changed).toBe(false);
    expect(result.reason).toBe('locked-selection');
    expect(result.elements).toBe(elements);
  });

  it('arranges a selected layer one step up by swapping with the nearest higher layer', () => {
    const result = arrangeCanvasSelection({
      elements: [
        element('top', 30),
        element('middle', 20),
        element('bottom', 10),
      ],
      selectedElementId: 'middle',
      direction: 'up',
    });

    expect(result.changed).toBe(true);
    expect(Object.fromEntries(result.elements.map((item) => [item.id, item.zIndex]))).toEqual({
      top: 20,
      middle: 30,
      bottom: 10,
    });
  });

  it('arranges a selected layer to the back without changing selection', () => {
    const result = arrangeCanvasSelection({
      elements: [
        element('top', 30),
        element('middle', 20),
        element('bottom', 10),
      ],
      selectedElementId: 'middle',
      direction: 'back',
    });

    expect(result.changed).toBe(true);
    expect(result.selectedElementId).toBe('middle');
    expect(result.elements.find((item) => item.id === 'middle')?.zIndex).toBe(9);
  });
});
