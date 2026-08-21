import { describe, expect, it } from 'vitest';

import type { FreeformCardElement } from '@/domain/templates';
import { getElementDepthStack, resolvePointerPressSelection } from '@/domain/templates/editorGeometry';

const layer = (id: string, zIndex: number, overrides: Partial<FreeformCardElement> = {}) => ({
  id,
  name: id,
  type: 'shape',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  zIndex,
  visible: true,
  ...overrides,
} as FreeformCardElement);

const layers = [layer('bottom', 1), layer('middle', 2), layer('top', 3)];
const point = { x: 50, y: 50 };

describe('Template editor pointer selection', () => {
  it('orders overlapping visible layers from top to bottom', () => {
    expect(getElementDepthStack(layers, point).map((element) => element.id)).toEqual(['top', 'middle', 'bottom']);
  });

  it('selects the directly pressed layer when the current selection is outside the hit stack', () => {
    expect(resolvePointerPressSelection({
      clickedElementId: 'top',
      currentSelectedId: null,
      hitStack: getElementDepthStack(layers, point),
    })).toEqual({
      activeSelectedId: 'top',
      tapSelectedId: 'top',
      cycleDepthOnTap: false,
    });
  });

  it('uses the selected layer as the tap-through cursor across repeated presses', () => {
    const hitStack = getElementDepthStack(layers, point);

    const fromTop = resolvePointerPressSelection({
      clickedElementId: 'top',
      currentSelectedId: 'top',
      hitStack,
    });
    expect(fromTop).toEqual({
      activeSelectedId: 'top',
      tapSelectedId: 'middle',
      cycleDepthOnTap: true,
    });

    const fromMiddleEvenWhenTopReceivesThePointer = resolvePointerPressSelection({
      clickedElementId: 'top',
      currentSelectedId: fromTop.tapSelectedId,
      hitStack,
    });
    expect(fromMiddleEvenWhenTopReceivesThePointer).toEqual({
      activeSelectedId: 'middle',
      tapSelectedId: 'bottom',
      cycleDepthOnTap: true,
    });

    const fromBottom = resolvePointerPressSelection({
      clickedElementId: 'top',
      currentSelectedId: fromMiddleEvenWhenTopReceivesThePointer.tapSelectedId,
      hitStack,
    });
    expect(fromBottom).toEqual({
      activeSelectedId: 'bottom',
      tapSelectedId: 'top',
      cycleDepthOnTap: true,
    });
  });

  it('does not invent depth cycling when only one visible layer is under the pointer', () => {
    const hitStack = getElementDepthStack([layers[0]!], point);
    expect(resolvePointerPressSelection({
      clickedElementId: 'bottom',
      currentSelectedId: 'bottom',
      hitStack,
    })).toEqual({
      activeSelectedId: 'bottom',
      tapSelectedId: 'bottom',
      cycleDepthOnTap: false,
    });
  });

  it('keeps Alt as an explicit desktop depth-cycle accelerator', () => {
    const hitStack = getElementDepthStack(layers, point);
    expect(resolvePointerPressSelection({
      clickedElementId: 'top',
      currentSelectedId: null,
      forceDepthCycle: true,
      hitStack,
    })).toEqual({
      activeSelectedId: 'top',
      tapSelectedId: 'middle',
      cycleDepthOnTap: true,
    });
  });
});
