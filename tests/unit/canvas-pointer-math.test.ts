import { describe, expect, it } from 'vitest';

import {
  calculateMovedElementPosition,
  calculateResizedElementBounds,
  calculateZoomAroundClientPoint,
  getCanvasPointFromRect,
  getTouchDistance,
  getTouchMidpoint,
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

  it('calculates touch gesture distance and midpoint', () => {
    const first = { clientX: 10, clientY: 20 };
    const second = { clientX: 40, clientY: 60 };

    expect(getTouchDistance(first, second)).toBe(50);
    expect(getTouchMidpoint(first, second)).toEqual({ clientX: 25, clientY: 40 });
  });

  it('keeps the focal point stable when zooming the scrollable stage', () => {
    expect(calculateZoomAroundClientPoint({
      currentZoom: 0.5,
      nextZoom: 1,
      scrollLeft: 100,
      scrollTop: 80,
      focalPoint: { clientX: 250, clientY: 180 },
      stageRect: { left: 50, top: 30 },
    })).toEqual({
      zoom: 1,
      scrollLeft: 400,
      scrollTop: 310,
    });
  });

  it('allows a deeper mobile-friendly zoom ceiling while clamping runaway zoom', () => {
    expect(calculateZoomAroundClientPoint({
      currentZoom: 1,
      nextZoom: 3,
      scrollLeft: 0,
      scrollTop: 0,
      focalPoint: { clientX: 100, clientY: 100 },
      stageRect: { left: 0, top: 0 },
    }).zoom).toBe(2.4);
  });
});
