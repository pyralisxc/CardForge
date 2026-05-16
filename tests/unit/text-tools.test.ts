import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RichTextContent, buildTextElementStyle, parseSemanticRulesBlocks } from '@/lib/textTools';
import type { FreeformCardElement } from '@/types';

describe('text tools', () => {
  it('renders multiline rich text with highlight spans', () => {
    const html = renderToStaticMarkup(createElement(RichTextContent, { text: 'Alpha\n==Beta==' }));

    expect(html).toContain('<p class="m-0">Alpha</p>');
    expect(html).toContain('Beta');
    expect(html).toContain('background-color:rgba(255,215,0,0.35)');
  });

  it('renders custom highlight colors when provided', () => {
    const html = renderToStaticMarkup(createElement(RichTextContent, { text: '==Beta==', highlightColor: '#66ccff' }));

    expect(html).toContain('background-color:#66ccff');
  });

  it('parses semantic rules blocks from one textarea field', () => {
    const blocks = parseSemanticRulesBlocks('[ability] Flying\n[effect] Deal 3 damage.\n[reminder] (Can target creatures.)');

    expect(blocks).toEqual([
      { kind: 'ability', text: 'Flying' },
      { kind: 'effect', text: 'Deal 3 damage.' },
      { kind: 'reminder', text: '(Can target creatures.)' },
    ]);
  });

  it('renders semantic rules blocks with distinct styling', () => {
    const html = renderToStaticMarkup(createElement(RichTextContent, {
      text: '[ability] Flying\n[flavor] "The fire remembers."',
      contentModel: 'rulesBlocks',
    }));

    expect(html).toContain('font-weight:700');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('The fire remembers.');
  });

  it('builds scaled text element styles for preview rendering', () => {
    const style = buildTextElementStyle({
      fontSizePx: 20,
      textAlign: 'center',
      lineHeight: '1.6',
      letterSpacing: '4px',
      textTransform: 'uppercase',
      textDecoration: 'underline',
      fontStyle: 'italic',
      writingMode: 'vertical-rl',
    } as Pick<FreeformCardElement, 'fontSize' | 'fontSizePx' | 'textAlign' | 'lineHeight' | 'letterSpacing' | 'textTransform' | 'textDecoration' | 'fontStyle' | 'writingMode'>, 0.5);

    expect(style.display).toBe('block');
    expect(style.fontSize).toBe('10px');
    expect(style.letterSpacing).toBe('2px');
    expect(style.textOrientation).toBe('upright');
    expect(style.lineHeight).toBe('1.6');
  });
});
