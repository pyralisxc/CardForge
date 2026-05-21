import type { JSONContent } from '@tiptap/react';

import { parseRichText } from '@/lib/utils';
import { buildTextBinding, parseTemplateTextSegments } from '@/lib/textBindings';

type InlineNode = NonNullable<JSONContent['content']>[number];

const textNode = (text: string, marks?: JSONContent['marks']): InlineNode | null =>
  text ? { type: 'text', text, ...(marks && marks.length > 0 ? { marks } : {}) } : null;

const richTextMarksForSpan = (span: ReturnType<typeof parseRichText>[number]): JSONContent['marks'] => {
  const marks: JSONContent['marks'] = [];
  if (span.bold) marks.push({ type: 'bold' });
  if (span.italic) marks.push({ type: 'italic' });
  if (span.underline) marks.push({ type: 'underline' });
  if (span.highlight) marks.push({ type: 'highlight' });
  if (span.color) marks.push({ type: 'textStyle', attrs: { color: span.color } });
  return marks;
};

const richTextToInlineNodes = (value: string): InlineNode[] => {
  const nodes: InlineNode[] = [];
  const lines = value.replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((line, lineIndex) => {
    parseRichText(line).forEach((span) => {
      const node = textNode(span.text, richTextMarksForSpan(span));
      if (node) nodes.push(node);
    });
    if (lineIndex < lines.length - 1) nodes.push({ type: 'hardBreak' });
  });

  return nodes;
};

export const templateTextToTiptapDoc = (value?: string): JSONContent => {
  const inlineContent: InlineNode[] = [];

  parseTemplateTextSegments(value).forEach((segment) => {
    if (segment.type === 'variable') {
      inlineContent.push({
        type: 'cardForgeVariable',
        attrs: {
          key: segment.key || 'variable',
        },
        content: richTextToInlineNodes(segment.text || segment.key || 'Variable'),
      });
      return;
    }

    inlineContent.push(...richTextToInlineNodes(segment.text));
  });

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        ...(inlineContent.length > 0 ? { content: inlineContent } : {}),
      },
    ],
  };
};

const wrapMarkedText = (text: string, marks?: JSONContent['marks']): string => {
  if (!marks || marks.length === 0) return text;

  return marks.reduce((next, mark) => {
    if (mark.type === 'bold') return `**${next}**`;
    if (mark.type === 'italic') return `_${next}_`;
    if (mark.type === 'underline') return `__${next}__`;
    if (mark.type === 'highlight') return `==${next}==`;
    if (mark.type === 'textStyle' && typeof mark.attrs?.color === 'string') {
      return `[color:${mark.attrs.color}]${next}[/color]`;
    }
    return next;
  }, text);
};

const inlineNodesToTemplateText = (nodes?: InlineNode[]): string => {
  if (!nodes) return '';

  return nodes.map((node) => {
    if (node.type === 'text') return wrapMarkedText(node.text || '', node.marks);
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'cardForgeVariable') {
      const key = typeof node.attrs?.key === 'string' ? node.attrs.key : 'variable';
      return buildTextBinding(key, inlineNodesToTemplateText(node.content as InlineNode[] | undefined));
    }
    if (node.content) return inlineNodesToTemplateText(node.content as InlineNode[]);
    return '';
  }).join('');
};

export const tiptapDocToTemplateText = (doc: JSONContent): string => {
  const blocks = doc.content || [];
  return blocks.map((block, index) => blockToTemplateText(block, index)).join('\n');
};

const splitListItemLines = (item: JSONContent): string[] =>
  blockToTemplateText(item)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

const blockToTemplateText = (block: JSONContent, index = 0): string => {
  if (block.type === 'bulletList') {
    return (block.content || [])
      .flatMap((item) => splitListItemLines(item).map((line) => `- ${line}`))
      .join('\n');
  }

  if (block.type === 'orderedList') {
    let itemNumber = 1;
    return (block.content || []).flatMap((item) =>
      splitListItemLines(item).map((line) => `${itemNumber++}. ${line}`)
    ).join('\n');
  }

  if (block.type === 'listItem') {
    return (block.content || [])
      .map((child) => blockToTemplateText(child))
      .join('\n');
  }

  if (block.type === 'paragraph') {
    return inlineNodesToTemplateText(block.content as InlineNode[] | undefined);
  }

  if (block.content) return (block.content || []).map((child) => blockToTemplateText(child, index)).join('\n');
  return '';
};

export const getTiptapDocPlainText = (doc: JSONContent): string => {
  const walk = (nodes?: InlineNode[]): string => (nodes || []).map((node) => {
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    return walk(node.content as InlineNode[] | undefined);
  }).join('');

  return (doc.content || []).map((block) => walk(block.content as InlineNode[] | undefined)).join('\n');
};
