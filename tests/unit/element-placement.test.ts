import { describe, expect, it } from 'vitest';

import type { FreeformCardElement } from '@/domain/templates';
import { resolveElementPlacement } from '@/features/template-editor/lib/elementPlacement';

const element = (overrides: Partial<FreeformCardElement> = {}): FreeformCardElement => ({
  id: 'existing',
  name: 'Existing',
  type: 'shape',
  x: 40,
  y: 40,
  width: 20,
  height: 20,
  rotation: 0,
  opacity: 1,
  zIndex: 1,
  locked: false,
  ...overrides,
});

describe('editor element placement', () => {
  it('honors requested and preset positions before automatic placement', () => {
    const canvas = { width: 100, height: 100, elements: [] };
    expect(resolveElementPlacement({ canvas, width: 20, height: 20, requestedPlacement: { x: 3, y: 7 } }))
      .toEqual({ x: 3, y: 7 });
    expect(resolveElementPlacement({ canvas, width: 20, height: 20, presetPosition: { x: 9 } }))
      .toEqual({ x: 9, y: 40 });
  });

  it('centers a free element and staggers away from an overlapping unlocked layer', () => {
    const emptyCanvas = { width: 100, height: 100, elements: [] };
    expect(resolveElementPlacement({ canvas: emptyCanvas, width: 20, height: 20 }))
      .toEqual({ x: 40, y: 40 });

    const occupiedCanvas = { width: 120, height: 120, elements: [element({ x: 50, y: 50 })] };
    expect(resolveElementPlacement({ canvas: occupiedCanvas, width: 20, height: 20 }))
      .toEqual({ x: 74, y: 74 });
  });

  it('ignores locked layers when choosing a safe automatic position', () => {
    const canvas = { width: 100, height: 100, elements: [element({ locked: true })] };
    expect(resolveElementPlacement({ canvas, width: 20, height: 20 }))
      .toEqual({ x: 40, y: 40 });
  });
});
