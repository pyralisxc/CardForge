import { describe, expect, it } from 'vitest';

import type { DisplayCard } from '@/domain/rendering';
import { getCardFaceData } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';

const template = (id: string, previewData?: Record<string, string>): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  templatePreviewData: previewData,
});

describe('generated card face data', () => {
  it('uses generated backing data for the back face', () => {
    const card: DisplayCard = {
      uniqueId: 'card-1',
      template: template('front'),
      backingTemplate: template('back', { title: 'Template preview' }),
      backingData: { title: 'Generated back', artwork: 'data:image/png;base64,abc' },
      data: { title: 'Generated front' },
    };

    expect(getCardFaceData(card, 'front')).toEqual({ title: 'Generated front' });
    expect(getCardFaceData(card, 'back')).toEqual({
      title: 'Generated back',
      artwork: 'data:image/png;base64,abc',
    });
  });

  it('keeps legacy cards compatible by falling back to template preview data', () => {
    const card: DisplayCard = {
      uniqueId: 'legacy-card',
      template: template('front'),
      backingTemplate: template('back', { title: 'Legacy preview' }),
      data: { title: 'Front' },
    };

    expect(getCardFaceData(card, 'back')).toEqual({ title: 'Legacy preview' });
  });
});
