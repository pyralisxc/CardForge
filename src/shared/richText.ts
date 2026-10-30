export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: string;
  color?: string;
}

/** Parse the existing saved markers recursively: marks compose on the same span.
 * Triple underscores are the saved underline+italic delimiter, not literal text.
 * A single italic run ends at the next underscore, as in the saved grammar.
 * Do not look ahead for nested underline inside it: the same bytes are the
 * boundary between adjacent native text nodes. Native italic+underline uses
 * the explicit triple-underscore delimiter. Unmatched markers remain text.
 */
export function parseRichText(text: string): RichTextSpan[] {
  if (!text) return [{ text: '' }];
  const spans: RichTextSpan[] = [];
  const regex = /\[color:([^\]]+)\]([\s\S]*?)\[\/color\]|___([\s\S]+?)___|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|_([^_]+)_|==([\s\S]+?)==/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) spans.push({ text: text.slice(lastIndex, match.index) });
    let inner: string;
    let marks: Omit<RichTextSpan, 'text'>;
    if (match[1] !== undefined) { inner = match[2]; marks = { color: match[1] }; }
    else if (match[3] !== undefined) { inner = match[3]; marks = { italic: true, underline: true }; }
    else if (match[4] !== undefined) { inner = match[4]; marks = { bold: true }; }
    else if (match[5] !== undefined) { inner = match[5]; marks = { underline: true }; }
    else if (match[6] !== undefined) { inner = match[6]; marks = { italic: true }; }
    else { inner = match[7]; marks = { highlight: 'rgba(255,215,0,0.35)' }; }
    spans.push(...parseRichText(inner).map(span => ({ ...marks, ...span })));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) spans.push({ text: text.slice(lastIndex) });
  return spans.length > 0 ? spans : [{ text }];
}
