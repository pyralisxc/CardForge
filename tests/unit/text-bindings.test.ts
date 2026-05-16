import { describe, expect, it } from 'vitest';

import { parseTemplateTextSegments, parseTextBinding, renamePlaceholderKeyInText } from '@/lib/textBindings';

describe('text bindings helpers', () => {
  it('parses mixed static text and inline variable placeholders into segments', () => {
    expect(parseTemplateTextSegments('When {{ability_name:"Flying"}} enters, draw a card.')).toEqual([
      { type: 'text', text: 'When ' },
      { type: 'variable', key: 'ability_name', text: 'Flying' },
      { type: 'text', text: ' enters, draw a card.' },
    ]);
  });

  it('renames only the targeted placeholder key inside mixed content', () => {
    expect(
      renamePlaceholderKeyInText(
        'When {{ability_name:"Flying"}} enters, {{ability_name:"Flying"}} gains haste.',
        'ability_name',
        'headline'
      )
    ).toBe('When {{headline:"Flying"}} enters, {{headline:"Flying"}} gains haste.');
  });

  it('does not mistake multi-placeholder content for one simple binding', () => {
    expect(parseTextBinding('{{setCode:"DRK"}} - {{cardNumber:"001/100"}}')).toEqual({
      field: '',
      fallback: '{{setCode:"DRK"}} - {{cardNumber:"001/100"}}',
    });
  });
});
