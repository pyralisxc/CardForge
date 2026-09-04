import { parse } from 'parse5';

const requireText = (value, label) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is empty`);
  }
  return value;
};

const nonContentTags = new Set(['script', 'style', 'template', 'noscript']);
const textBreakTags = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'td', 'th', 'tr', 'ul']);
const isNonContent = (node) => nonContentTags.has(node.tagName)
  || node.attrs?.some(({ name, value }) => name === 'hidden' || (name === 'aria-hidden' && value.toLowerCase() === 'true'));

const findElements = (node, tagName) => {
  if (isNonContent(node)) return [];
  return [
    ...(node.tagName === tagName ? [node] : []),
    ...(node.childNodes ?? []).flatMap((child) => findElements(child, tagName)),
  ];
};

const requireElement = (root, tagName, label) => {
  const elements = findElements(root, tagName);
  if (elements.length !== 1) throw new Error(`${label} requires exactly one ${tagName} element.`);
  return elements[0];
};

const textContent = (node) => {
  if (isNonContent(node)) return '';
  if (node.nodeName === '#text') return node.value;
  const text = (node.childNodes ?? []).map(textContent).join('');
  return textBreakTags.has(node.tagName) ? ` ${text} ` : text;
};
const normalizedText = (node) => textContent(node).replace(/\s+/gu, ' ').trim();

// Check the authored semantic surface, not shell announcements, attributes or RSC payloads.
// HTML parsing also decodes entities and preserves words split across inline formatting.
const readPublicSurface = (html, label, legal = false) => {
  const main = requireElement(parse(requireText(html, label)), 'main', label);
  const surface = legal ? requireElement(main, 'article', label) : main;
  return { surface, text: requireText(normalizedText(surface), label) };
};

export const assertContributorPublicTruth = (html) => {
  const { text: body } = readPublicSurface(html, 'Contributor page');
  if (/propose clearer public-site text/iu.test(body)) {
    throw new Error('Contributor page still advertises retired public-site copy proposals');
  }
  if (!/public-site editing (?:remains|is) owner-only/iu.test(body)) {
    throw new Error('Contributor page does not state the Owner-only publication boundary');
  }
};

export const assertPrivacyPublicTruth = (html) => {
  const { text: body } = readPublicSurface(html, 'Privacy publication', true);
  const retiredClaims = [
    /developer profile/iu,
    /developer submission/iu,
    /developer vote/iu,
    /owner\/developer accounts/iu,
    /Owner Console/u,
    /browser-local Studio projects/iu,
  ];
  if (retiredClaims.some((claim) => claim.test(body))) {
    throw new Error('Privacy publication contains retired Developer, Owner Console, or Studio-project language');
  }
  if (!/Contributor profiles/iu.test(body) || !/browser-local CardForge projects/iu.test(body)) {
    throw new Error('Privacy publication is missing current Contributor or local-project language');
  }
};

export const assertContributorTermsPublicTruth = (html) => {
  const { surface, text: body } = readPublicSurface(html, 'Contributor Terms publication', true);
  if (/Developer Contributor Terms/iu.test(body) || /\bDevelopers?\b/iu.test(body) || /developer (?:contribution|path|votes?)/iu.test(body)) {
    throw new Error('Contributor Terms contain retired Developer-program language');
  }
  const title = normalizedText(requireElement(surface, 'h1', 'Contributor Terms publication'));
  if (title !== 'Contributor Terms' || !/review Pipeline/iu.test(body)) {
    throw new Error('Contributor Terms are missing the current title or Pipeline language');
  }
};

const findById = (items, id) => Array.isArray(items) ? items.find((item) => item?.id === id) : null;

export const assertRepresentativeCatalogRouting = (catalog) => {
  const starter = findById(catalog?.sets?.items, 'standard-playing-card-deck');
  const starterPipeline = findById(catalog?.pipeline?.items, 'standard-playing-card-deck');
  if (!starter?.packageUrl || starter.access !== 'free' || starterPipeline?.assetType !== 'set' || !starterPipeline.previewUrl) {
    throw new Error('Starter Set is not routed consistently through Sets and Pipeline');
  }

  const template = findById(catalog?.templates?.defaults, 'default-mtg-theme');
  const templatePipeline = findById(catalog?.pipeline?.items, 'default-mtg-theme');
  if (!template || templatePipeline?.assetType !== 'template' || templatePipeline.previewUrl !== '/api/templates#default-mtg-theme') {
    throw new Error('Representative Template is not routed to the Template catalog destination');
  }

  const icon = findById(catalog?.assets?.icons, 'arcane-star');
  const iconPipeline = findById(catalog?.pipeline?.items, 'arcane-star');
  if (!Array.isArray(icon?.studioDestinations) || !icon.studioDestinations.includes('element.icon') || iconPipeline?.assetType !== 'icon' || icon.previewUrl !== iconPipeline.previewUrl) {
    throw new Error('Representative icon is not routed consistently to the element Picker');
  }
};
