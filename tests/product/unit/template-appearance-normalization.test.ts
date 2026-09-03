import { describe, expect, it } from 'vitest';

import {
  normalizeAppearanceForElement,
  reconstructFreeformCanvas,
} from '@/domain/templates';

describe('freeform appearance normalization', () => {
  it('keeps borderless text borderless when legacy stroke defaults are present', () => {
    expect(normalizeAppearanceForElement({
      type: 'text',
      borderWidth: '_none_',
      strokeWidth: 2,
      strokeColor: '#fbbf24',
    }).border).toMatchObject({ kind: 'none', width: 0 });
  });

  it('does not inject a legacy stroke into reconstructed borderless text', () => {
    const canvas = reconstructFreeformCanvas({
      width: 630,
      height: 880,
      elements: [{
        id: 'title',
        type: 'text',
        name: 'Title',
        x: 40,
        y: 40,
        width: 400,
        height: 60,
        zIndex: 1,
        content: '{{title:"Title"}}',
        borderWidth: '_none_',
      }],
    });

    expect(canvas.elements[0]).toMatchObject({
      borderWidth: '_none_',
      appearance: { border: { kind: 'none', width: 0 } },
    });
    expect(canvas.elements[0].strokeWidth).toBeUndefined();
  });
});
