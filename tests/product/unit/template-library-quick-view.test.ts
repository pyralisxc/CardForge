import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import { getTemplateQuickView } from '@/features/template-editor/components/TemplateLibraryPanel';

const template = (id: string, category?: string): TCGCardTemplate => ({
  id,
  name: id,
  aspectRatio: '63:88',
  templateCategory: category,
  freeformCanvas: { width: 630, height: 880, elements: [] },
});

describe('Template Library quick view', () => {
  it('shows a concise, category-diverse shelf while the full catalog remains available', () => {
    const catalog = [
      template('tcg-one', 'TCG'),
      template('tcg-two', 'TCG'),
      template('tarot', 'Tarot'),
      template('business', 'Business'),
      template('poster', 'Poster'),
      template('badge', 'Badge'),
      template('rulebook', 'Rulebook'),
    ];

    const quickView = getTemplateQuickView(catalog);
    expect(quickView).toHaveLength(5);
    expect(quickView.map((item) => item.id)).toEqual(['tcg-one', 'tarot', 'business', 'poster', 'badge']);
    expect(catalog).toHaveLength(7);
  });
});
