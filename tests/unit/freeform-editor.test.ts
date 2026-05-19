import { describe, expect, it } from 'vitest';

import type { FreeformCardElement } from '@/types';
import { getElementDepthStack, resolveDepthSelection, scaleElementWithParentResize } from '@/lib/freeformEditor';

function makeElement(overrides: Partial<FreeformCardElement>): FreeformCardElement {
  return {
    id: overrides.id || 'element',
    type: overrides.type || 'shape',
    name: overrides.name || 'Element',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    zIndex: overrides.zIndex ?? 1,
    ...overrides,
  };
}

describe('freeform editor helpers', () => {
  it('returns overlapped elements from topmost to deepest', () => {
    const stack = getElementDepthStack([
      makeElement({ id: 'base', zIndex: 1 }),
      makeElement({ id: 'middle', zIndex: 3 }),
      makeElement({ id: 'top', zIndex: 6 }),
    ], { x: 40, y: 40 });

    expect(stack.map((element) => element.id)).toEqual(['top', 'middle', 'base']);
  });

  it('cycles deeper through the same overlap region on repeated clicks', () => {
    const stack = [
      makeElement({ id: 'top', zIndex: 6 }),
      makeElement({ id: 'middle', zIndex: 3 }),
      makeElement({ id: 'base', zIndex: 1 }),
    ];

    const first = resolveDepthSelection(stack, { x: 40, y: 40 }, null, null);
    const second = resolveDepthSelection(stack, { x: 42, y: 41 }, first.nextSelectedId, first.nextState);
    const third = resolveDepthSelection(stack, { x: 41, y: 39 }, second.nextSelectedId, second.nextState);

    expect(first.nextSelectedId).toBe('top');
    expect(second.nextSelectedId).toBe('middle');
    expect(third.nextSelectedId).toBe('base');
  });

  it('continues cycling when repeated clicks drift within the same overlap stack', () => {
    const stack = [
      makeElement({ id: 'top', zIndex: 6 }),
      makeElement({ id: 'middle', zIndex: 3 }),
      makeElement({ id: 'base', zIndex: 1 }),
    ];

    const first = resolveDepthSelection(stack, { x: 40, y: 40 }, null, null);
    const second = resolveDepthSelection(stack, { x: 62, y: 57 }, first.nextSelectedId, first.nextState);

    expect(first.nextSelectedId).toBe('top');
    expect(second.nextSelectedId).toBe('middle');
  });

  it('scales child bounds and type-specific sizing with parent resize', () => {
    const child = makeElement({
      id: 'title',
      type: 'text',
      x: 20,
      y: 30,
      width: 60,
      height: 20,
      fontSizePx: 16,
      strokeWidth: 2,
    });

    const scaled = scaleElementWithParentResize(
      child,
      { x: 10, y: 10, width: 100, height: 100 },
      { x: 10, y: 10, width: 200, height: 150 },
    );

    expect(scaled).toMatchObject({
      x: 30,
      y: 40,
      width: 120,
      height: 30,
      fontSizePx: 24,
      strokeWidth: 3,
    });
  });
});
