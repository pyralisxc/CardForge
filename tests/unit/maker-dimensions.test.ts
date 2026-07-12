import { describe, expect, it } from 'vitest';

import { buildCustomDimensionTemplateUpdate } from '@/features/template-editor/lib/makerDimensions';
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

  it('builds a single canvas update using the selected unit', () => {
    const update = buildCustomDimensionTemplateUpdate({
      widthValue: '2.5',
      heightValue: '3.5',
      unit: 'in',
      template: {},
    });

    expect(update).not.toBeNull();
    expect(update?.aspectRatio).toBe('63.5:88.9');
    expect(update?.freeformCanvas?.width).toBe(635);
    expect(update?.freeformCanvas?.height).toBe(889);
    expect(update).not.toHaveProperty('backCanvas');
  });
});
