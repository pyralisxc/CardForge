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

  it('renders nested rich text marks from Maker-authored toolbar combinations', () => {
    const html = renderToStaticMarkup(createElement(RichTextContent, {
      text: '==**Variable**== [color:#f5d27b]_tail_[/color]',
    }));

    expect(html).toContain('Variable');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('background-color:rgba(255,215,0,0.35)');
    expect(html).toContain('tail');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('color:#f5d27b');
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

  it('applies variable contract typography without wrapping user rich text markers', () => {
    const element = {
      id: 'title-element',
      type: 'text',
      name: 'Title',
      content: '{{CardName:"Hero"}}',
      x: 0,
      y: 0,
      width: 260,
      height: 72,
      zIndex: 1,
      fontSizePx: 16,
      fontFamily: 'font-sans',
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{
        key: 'CardName',
        label: 'Card Name',
        type: 'richText',
        elementId: 'title-element',
        fontFamily: 'font-serif',
        fontSizePx: 28,
        fontWeight: 'font-bold',
        fontStyle: 'italic',
        textDecoration: 'underline',
        textColor: '#38bdf8',
        letterSpacing: '1px',
      }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: { CardName: '**Azure** _Blade_' },
    }));

    expect(html).toContain('Azure');
    expect(html).toContain('Blade');
    expect(html).toContain('font-serif');
    expect(html).toContain('font-size:28px');
    expect(html).not.toContain('font-size:16px');
    expect(html).toContain('font-weight:700');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('text-decoration:underline');
    expect(html).toContain('color:#38bdf8');
    expect(html).toContain('letter-spacing:1px');
    expect(html).toContain('font-weight:bold');
    expect(html).not.toContain('**Azure**');
    expect(html).not.toContain('_Blade_');
  });

  it('lets a generated card override template variable typography for one card', () => {
    const element = {
      id: 'name-element',
      type: 'text',
      name: 'Name',
      content: '{{Name:"Fallback"}}',
      x: 0,
      y: 0,
      width: 260,
      height: 72,
      zIndex: 1,
      fontSizePx: 16,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{ key: 'Name', label: 'Name', type: 'richText', elementId: 'name-element', fontSizePx: 20 }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: { Name: 'Override Hero' },
      styleOverrides: {
        Name: {
          fontSizePx: 44,
          fontFamily: 'font-serif',
          textColor: '#ef4444',
          fontWeight: 'font-bold',
        },
      },
    }));

    expect(html).toContain('Override Hero');
    expect(html).toContain('font-size:44px');
    expect(html).toContain('font-serif');
    expect(html).toContain('color:#ef4444');
    expect(html).toContain('font-weight:700');
    expect(html).not.toContain('font-size:20px');
  });

  it('reuses one variable value and style each time the key appears in a text block', () => {
    const element = {
      id: 'route-element',
      type: 'text',
      name: 'Routes',
      content: 'Exit {{Position:"North"}} opens.\nReturn to {{Position:"North"}} gate.',
      x: 0,
      y: 0,
      width: 300,
      height: 120,
      zIndex: 1,
      fontSizePx: 14,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{ key: 'Position', label: 'Position', type: 'richText', elementId: 'route-element', fontSizePx: 22, fontWeight: 'font-bold' }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: { Position: 'East' },
    }));

    expect((html.match(/East/g) || []).length).toBe(2);
    expect((html.match(/font-size:22px/g) || []).length).toBe(2);
    expect((html.match(/font-weight:700/g) || []).length).toBe(2);
  });

  it('renders structured list rows inside a variable text block', () => {
    const element = {
      id: 'exits-element',
      type: 'text',
      name: 'Exits',
      content: '{{Exits:""}}',
      x: 0,
      y: 0,
      width: 300,
      height: 160,
      zIndex: 1,
      fontSizePx: 14,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{
        key: 'Exits',
        label: 'Exits',
        type: 'structuredList',
        elementId: 'exits-element',
        fontSizePx: 18,
        structuredListColumns: [
          { key: 'position', label: 'Position' },
          { key: 'description', label: 'Description' },
        ],
      }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: {
        Exits: JSON.stringify([
          { id: 'north', values: { position: 'North', description: 'Market road' } },
          { id: 'east', values: { position: 'East', description: 'Broken bridge' } },
        ]),
      },
    }));

    expect(html).toContain('North - Market road');
    expect(html).toContain('East - Broken bridge');
    expect(html).toContain('font-size:18px');
  });

  it('renders structured list rows with template-owned rich row and separator formatting', () => {
    const element = {
      id: 'exits-element',
      type: 'text',
      name: 'Exits',
      content: '{{Exits:""}}',
      x: 0,
      y: 0,
      width: 300,
      height: 160,
      zIndex: 1,
      fontSizePx: 14,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{
        key: 'Exits',
        label: 'Exits',
        type: 'structuredList',
        elementId: 'exits-element',
        structuredListColumns: [
          { key: 'position', label: 'Position' },
          { key: 'description', label: 'Description' },
        ],
        structuredListRowTemplate: '**{{position}}**: [color:#22aa66]{{description}}[/color]',
        structuredListRowSeparator: '\\n==Choose carefully==\\n',
      }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: {
        Exits: JSON.stringify([
          { id: 'north', values: { position: 'North', description: 'Market road' } },
          { id: 'east', values: { position: 'East', description: 'Broken bridge' } },
        ]),
      },
    }));

    expect(html).toContain('North');
    expect(html).toContain('Market road');
    expect(html).toContain('Choose carefully');
    expect(html).toContain('East');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('color:#22aa66');
    expect(html).toContain('background-color:rgba(255,215,0,0.35)');
    expect(html).not.toContain('{{position}}');
  });

  it('renders structured list sub-variable styles without raw row format markers', () => {
    const element = {
      id: 'exits-element',
      type: 'text',
      name: 'Exits',
      content: '{{Exits:""}}',
      x: 0,
      y: 0,
      width: 300,
      height: 160,
      zIndex: 1,
      fontSizePx: 14,
    } as FreeformCardElement;
    const template = {
      id: 'template',
      name: 'Template',
      aspectRatio: '63:88',
      frameStyle: 'freeform',
      freeformCanvas: { width: 630, height: 880, elements: [element] },
      fieldContracts: [{
        key: 'Exits',
        label: 'Exits',
        type: 'structuredList',
        elementId: 'exits-element',
        structuredListColumns: [
          { key: 'position', label: 'Position' },
          { key: 'description', label: 'Description' },
        ],
        structuredListColumnSeparator: ': ',
        structuredListRowSeparatorText: 'Choose carefully',
        structuredListRowSeparatorStyle: {
          fontSizePx: 10,
          fontWeight: 'font-bold',
          textColor: '#f59e0b',
        },
        structuredListColumnStyles: {
          position: {
            fontSizePx: 22,
            fontFamily: 'font-serif',
            fontWeight: 'font-bold',
            textColor: '#38bdf8',
          },
          description: {
            fontSizePx: 16,
            fontStyle: 'italic',
            textColor: '#22aa66',
          },
        },
      }],
    } as TCGCardTemplate;

    const html = renderToStaticMarkup(createElement(CardTextContent, {
      template,
      element,
      data: {
        Exits: JSON.stringify([
          { id: 'north', values: { position: 'North', description: 'Market road' } },
          { id: 'east', values: { position: 'East', description: 'Broken bridge' } },
        ]),
      },
    }));

    expect(html).toContain('North');
    expect(html).toContain('Market road');
    expect(html).toContain('Choose carefully');
    expect(html).toContain('font-serif');
    expect(html).toContain('font-size:22px');
    expect(html).toContain('font-size:16px');
    expect(html).toContain('font-size:10px');
    expect(html).toContain('color:#38bdf8');
    expect(html).toContain('color:#22aa66');
    expect(html).toContain('color:#f59e0b');
    expect(html).not.toContain('{{position}}');
    expect(html).not.toContain('**{{position}}**');
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
