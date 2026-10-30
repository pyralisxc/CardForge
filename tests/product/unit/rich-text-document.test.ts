import { parseRichText } from '@/shared/richText';
import { describe, expect, it } from 'vitest';

import { templateTextToTiptapDoc, tiptapDocToTemplateText } from '@/features/card-rendering/client';

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

describe('composed formatting survives the canonical saved syntax', () => {
  const formats = ['bold', 'italic', 'underline', 'highlight', 'textStyle'];
  for (let mask = 1; mask < 32; mask++) {
    it(`preserves combined mark set ${mask} through save, parse and reopen`, () => {
      const marks = formats.filter((_, index) => mask & (1 << index)).map(type => ({ type, ...(type === 'textStyle' ? { attrs: { color: '#123456' } } : {}) }));
      const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Combined words', marks }] }] };
      const saved = tiptapDocToTemplateText(doc);
      expect(parseRichText(saved)).toEqual([{ text: 'Combined words',
        ...(mask & 1 ? { bold: true } : {}), ...(mask & 2 ? { italic: true } : {}), ...(mask & 4 ? { underline: true } : {}),
        ...(mask & 8 ? { highlight: 'rgba(255,215,0,0.35)' } : {}), ...(mask & 16 ? { color: '#123456' } : {}) }]);
      expect(templateTextToTiptapDoc(saved).content?.[0].content?.[0]).toEqual(doc.content[0].content[0]);
      expect(tiptapDocToTemplateText(templateTextToTiptapDoc(saved))).toBe(saved);
    });
  }
  it('retains variable keys and composed fallback markup without changing ordinary or unmatched text', () => {
    const saved = 'Before {{Ability:"___**Flying**___"}} after _**strong italic**_.';
    expect(tiptapDocToTemplateText(templateTextToTiptapDoc(saved))).toBe(saved);
    for (const text of ['ordinary text', 'unfinished **bold', 'unfinished __under', '[color:red]unclosed']) expect(parseRichText(text)).toEqual([{ text }]);
    expect(parseRichText('**bold** _italic_ __underline__')).toEqual([{text:'bold',bold:true},{text:' '},{text:'italic',italic:true},{text:' '},{text:'underline',underline:true}]);
  });
});

it('composes alternate saved nesting and adjacent independently formatted spans', () => {
  for (const source of ['**___text___**', '__**_text_**__', '___**text**___']) {
    expect(parseRichText(source)).toEqual([{ text: 'text', bold: true, italic: true, underline: true }]);
  }
  expect(parseRichText('_**one**_ __two__ **three**')).toEqual([
    { text: 'one', bold: true, italic: true }, { text: ' ' }, { text: 'two', underline: true }, { text: ' ' }, { text: 'three', bold: true },
  ]);
});

it('preserves every adjacent canonical mark pair without inserting delimiter characters', () => {
  const formats = ['bold', 'italic', 'underline', 'highlight', 'textStyle'];
  const node = (text: string, mask: number) => ({ type: 'text', text, marks: formats.filter((_, i) => mask & (1 << i)).map(type => ({ type, ...(type === 'textStyle' ? { attrs: { color: '#123456' } } : {}) })) });
  for (let first = 0; first < 32; first++) for (let second = 0; second < 32; second++) {
    const a = node('one', first), b = node('two', second);
    const saved = tiptapDocToTemplateText({ type: 'doc', content: [{ type: 'paragraph', content: [a, b] }] });
    const spans = parseRichText(saved);
    expect(spans.map(span => span.text).join(''), `adjacent marks ${first}/${second}: ${saved}`).toBe('onetwo');
    const perCharacter = spans.flatMap(({ text, ...marks }) => [...text].map(char => ({ char, ...marks })));
    const independent = [a,b].flatMap(n => parseRichText(tiptapDocToTemplateText({ type:'doc',content:[{type:'paragraph',content:[n]}] })).flatMap(({text,...marks})=>[...text].map(char=>({char,...marks}))));
    expect(perCharacter, `adjacent marks ${first}/${second}`).toEqual(independent);
  }
});

it('reopens no-gap mixed marks, independently removes underline and preserves variable boundaries', () => {
  const source = '_**first**____**second**___';
  const reopened = templateTextToTiptapDoc(source);
  expect(reopened.content?.[0].content).toEqual([
    { type: 'text', text: 'first', marks: [{ type: 'bold' }, { type: 'italic' }] },
    { type: 'text', text: 'second', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] },
  ]);
  expect(tiptapDocToTemplateText(reopened)).toBe(source);
  const second = reopened.content![0].content![1]; second.marks = second.marks!.filter(mark => mark.type !== 'underline');
  const removed = tiptapDocToTemplateText(reopened);
  expect(parseRichText(removed)).toEqual([{ text: 'first', bold: true, italic: true }, { text: 'second', bold: true, italic: true }]);
  const variable = '_first_{{Ability:"___**Flying**___"}}___second___';
  const doc = templateTextToTiptapDoc(variable);
  expect(doc.content?.[0].content?.[1]).toMatchObject({ type: 'cardForgeVariable', attrs: { key: 'Ability' }, content: [{ type: 'text', text: 'Flying', marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'underline' }] }] });
  expect(tiptapDocToTemplateText(doc)).toBe(variable);
});

it('preserves three-node native mark transitions without interpreting boundaries as nested underline', () => {
  const formats = ['bold', 'italic', 'underline', 'highlight', 'textStyle'];
  const marked = (text: string, mask: number) => ({ type: 'text', text, marks: formats.filter((_, i) => mask & (1 << i)).map(type => ({ type, ...(type === 'textStyle' ? { attrs: { color: '#123456' } } : {}) })) });
  const serialize = (content: ReturnType<typeof marked>[]) => tiptapDocToTemplateText({ type: 'doc', content: [{ type: 'paragraph', content }] });
  const characters = (source: string) => parseRichText(source).flatMap(({ text, ...marks }) => [...text].map(char => ({ char, ...marks })));
  for (let a = 0; a < 32; a++) for (let b = 0; b < 32; b++) for (let c = 0; c < 32; c++) {
    const nodes = [marked('one', a), marked('two', b), marked('three', c)];
    const saved = serialize(nodes);
    expect(characters(saved), `native transition ${a}/${b}/${c}: ${saved}`).toEqual(nodes.flatMap(node => characters(serialize([node]))));
  }
});
