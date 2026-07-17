export type LegalBodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'list'; items: string[] };

export type LegalInlinePart =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string };

const rawHtmlPattern = /<(?:\/?[A-Za-z][^>]*>|!--|![A-Za-z]|!\[|\?)/i;
const markdownLinkPattern = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export const isSafeLegalHref = (href: string): boolean => {
  if (/[\u0000-\u0020\u007f]/.test(href)) return false;

  if (href.startsWith('https://')) {
    try {
      return new URL(href).protocol === 'https:';
    } catch {
      return false;
    }
  }

  if (href.startsWith('mailto:')) return href.length > 'mailto:'.length;

  return !href.startsWith('//')
    && !href.startsWith('\\')
    && !/^[A-Za-z][A-Za-z\d+.-]*:/.test(href);
};

export const parseLegalInline = (text: string): LegalInlinePart[] => {
  const parts: LegalInlinePart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(markdownLinkPattern)) {
    const index = match.index ?? 0;
    const [source, label, href] = match;
    if (!isSafeLegalHref(href)) throw new Error(`Legal document contains an unsafe link: ${href}`);
    if (index > cursor) parts.push({ type: 'text', text: text.slice(cursor, index) });
    parts.push({ type: 'link', text: label, href });
    cursor = index + source.length;
  }

  if (cursor < text.length) parts.push({ type: 'text', text: text.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: 'text', text }];
};

const validateText = (text: string) => {
  if (rawHtmlPattern.test(text)) throw new Error('Legal document body cannot contain raw HTML.');
  parseLegalInline(text);
};

export const parseLegalBody = (body: string): LegalBodyBlock[] => {
  if (rawHtmlPattern.test(body)) throw new Error('Legal document body cannot contain raw HTML.');

  const blocks: LegalBodyBlock[] = [];
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(' ').trim();
    validateText(text);
    blocks.push({ type: 'paragraph', text });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    listItems.forEach(validateText);
    blocks.push({ type: 'list', items: listItems });
    listItems = [];
  };

  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    const heading = /^(##|###)\s+(.+)$/.exec(line);
    const listItem = /^-\s+(.+)$/.exec(line);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      validateText(heading[2]);
      blocks.push({ type: 'heading', level: heading[1].length as 2 | 3, text: heading[2] });
    } else if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
};
