export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: string;
  color?: string;
}

export function parseRichText(text: string): RichTextSpan[] {
  if (!text) return [{ text: '' }];
  const spans: RichTextSpan[] = [];
  const regex = /(\*\*([^*]+)\*\*|_([^_]+)_|__([^_]+)__|==([^=]+)==|\[color:([^\]]+)\]([\s\S]*?)\[\/color\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) spans.push({ text: text.slice(lastIndex, match.index) });
    if (match[2] !== undefined) spans.push({ text: match[2], bold: true });
    else if (match[3] !== undefined) spans.push({ text: match[3], italic: true });
    else if (match[4] !== undefined) spans.push({ text: match[4], underline: true });
    else if (match[5] !== undefined) spans.push({ text: match[5], highlight: 'rgba(255,215,0,0.35)' });
    else if (match[6] !== undefined && match[7] !== undefined) spans.push({ text: match[7], color: match[6] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) spans.push({ text: text.slice(lastIndex) });
  return spans.length > 0 ? spans : [{ text }];
}
