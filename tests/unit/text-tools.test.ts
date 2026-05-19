import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RichTextContent, buildTextElementStyle, parseSemanticRulesBlocks } from '@/lib/textTools';
import { CardTextContent } from '@/lib/cardTextRender';
import type { FreeformCardElement, TCGCardTemplate } from '@/types';

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

  it('renders rich markers on plain text contracts when template text contains rich markup', () => {
    const element = {
      id: 'name-element',
      type: 'text',
      name: 'Card Name',
      content: '{{CardName:"**Emberclaw Whelp**"}}',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      zIndex: 1,
      fontSizePx: 18,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{ key: 'CardName', label: 'Card Name', type: 'text', elementId: 'name-element' }],
    } as TCGCardTemplate;
    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: {},
    }));

    expect(html).toContain('Emberclaw Whelp');
    expect(html).toContain('font-weight:bold');
    expect(html).not.toContain('**Emberclaw Whelp**');
  });

  it('preserves mixed variable formatting through the shared card text renderer', () => {
    const element = {
      id: 'rules-element',
      type: 'text',
      name: 'Rules',
      content: 'Lead {{headline:"Hero"}} tail',
      x: 0,
      y: 0,
      width: 240,
      height: 80,
      zIndex: 1,
      fontSizePx: 16,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{ key: 'headline', label: 'Headline', type: 'richText', elementId: 'rules-element' }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: { headline: '**Hero** [color:#22aa66]Glow[/color]' },
    }));

    expect(html).toContain('Lead');
    expect(html).toContain('Hero');
    expect(html).toContain('Glow');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('color:#22aa66');
  });

  it('renders list formatting through the shared card text renderer path', () => {
    const element = {
      id: 'rules-preview',
      type: 'text',
      name: 'Rules Preview',
      content: '{{rulesText:"**Hero**\\n- First\\n- Second"}}',
      x: 0,
      y: 0,
      width: 240,
      height: 120,
      zIndex: 1,
      fontSizePx: 16,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{ key: 'rulesText', label: 'Rules Text', type: 'richText', elementId: 'rules-preview' }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: { rulesText: '**Hero**\n- First\n- Second' },
    }));

    expect(html).toContain('Hero');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('<ul');
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });
});
