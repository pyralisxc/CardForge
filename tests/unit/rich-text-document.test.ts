import { describe, expect, it } from 'vitest';

import { templateTextToTiptapDoc, tiptapDocToTemplateText } from '@/lib/richTextDocument';

describe('rich text document serialization', () => {
  it('round-trips inline variables with rich fallback text', () => {
    const source = '{{Ability:"**Flying**"}}\nWhen this enters, draw a card.\n{{SubText:"_\\"Small but fierce.\\"_"}}';

    expect(tiptapDocToTemplateText(templateTextToTiptapDoc(source))).toBe(source);
  });

  it('round-trips every supported inline rich text marker', () => {
    const source = '**bold** _italic_ __underline__ ==highlight== [color:#d5ad54]gold[/color]';

    expect(tiptapDocToTemplateText(templateTextToTiptapDoc(source))).toBe(source);
  });

  it('keeps normal text visual while preserving template variables', () => {
    const doc = templateTextToTiptapDoc('Alpha {{Beta:"==Gamma=="}} Omega');

    expect(doc.content?.[0]?.content?.some((node) => node.type === 'cardForgeVariable')).toBe(true);
    expect(tiptapDocToTemplateText(doc)).toBe('Alpha {{Beta:"==Gamma=="}} Omega');
  });

  it('serializes Tiptap list blocks back into marker text', () => {
    expect(tiptapDocToTemplateText({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        },
      ],
    })).toBe('- First\n- Second');
  });
});
