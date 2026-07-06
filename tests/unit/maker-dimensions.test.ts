import { describe, expect, it } from 'vitest';

import { buildCustomDimensionTemplateUpdate } from '@/features/template-editor/lib/makerDimensions';
import { createDefaultFreeformCanvas } from '@/lib/templateModel';

describe('maker dimensions', () => {
  it('returns null for invalid custom dimensions', () => {
    expect(buildCustomDimensionTemplateUpdate({
      widthValue: '0',
      heightValue: '88',
      unit: 'mm',
      template: {},
    })).toBeNull();

    expect(buildCustomDimensionTemplateUpdate({
      widthValue: 'abc',
      heightValue: '88',
      unit: 'mm',
      template: {},
    })).toBeNull();
  });

  it('builds front and back canvas updates using the selected unit', () => {
    const backCanvas = createDefaultFreeformCanvas({ width: 100, height: 200 });
    const update = buildCustomDimensionTemplateUpdate({
      widthValue: '2.5',
      heightValue: '3.5',
      unit: 'in',
      template: { backCanvas },
    });

    expect(update).not.toBeNull();
    expect(update?.aspectRatio).toBe('63.5:88.9');
    expect(update?.freeformCanvas?.width).toBe(635);
    expect(update?.freeformCanvas?.height).toBe(889);
    expect(update?.backCanvas?.width).toBe(635);
    expect(update?.backCanvas?.height).toBe(889);
    expect(update?.freeformCanvas?.gridSize).toBe(update?.backCanvas?.gridSize);
  });
});
