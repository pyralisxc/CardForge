import { describe, expect, it } from 'vitest';

import {
  calculateMovedElementPosition,
  calculateResizedElementBounds,
  getCanvasPointFromRect,
} from '@/features/template-editor/lib/canvasPointerMath';
import type { FreeformCardElement } from '@/types';

const element = (overrides: Partial<FreeformCardElement> = {}): FreeformCardElement => ({
  id: 'element',
  name: 'Element',
  type: 'shape',
  x: 100,
  y: 80,
  width: 60,
  height: 40,
  zIndex: 1,
  ...overrides,
});

const snap = (value: number) => Math.round(value / 10) * 10;

describe('canvasPointerMath', () => {
  it('converts client coordinates into zoom-adjusted canvas coordinates', () => {
    expect(getCanvasPointFromRect({ clientX: 180, clientY: 140 }, { left: 100, top: 80 }, 2)).toEqual({
      x: 40,
      y: 30,
    });
  });

  it('moves an element with snapping while keeping a visible grab area on canvas', () => {
    expect(calculateMovedElementPosition({
      original: element(),
      deltaX: -200,
      deltaY: 900,
      canvasWidth: 300,
      canvasHeight: 220,
      snapValue: snap,
    })).toEqual({
      x: -40,
      y: 200,
    });
  });

  it('resizes from the center using the active handle direction', () => {
    expect(calculateResizedElementBounds({
      original: element(),
      handle: 'se',
      deltaX: 15,
      deltaY: 10,
      canvasWidth: 300,
      canvasHeight: 220,
      snapValue: snap,
    })).toEqual({
      x: 90,
      y: 70,
      width: 90,
      height: 60,
    });
  });
});
