import { parseFragment, serialize } from 'parse5';

import { PipelineStoreError } from './pipelineStore';

const SAFE_SVG_ELEMENTS = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask',
]);

const SAFE_SVG_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:xlink', 'viewBox', 'preserveAspectRatio', 'width', 'height',
  'id', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'd', 'points', 'transform', 'opacity', 'color',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'vector-effect',
  'offset', 'stop-color', 'stop-opacity',
  'gradientUnits', 'gradientTransform', 'spreadMethod',
  'clip-path', 'clipPathUnits', 'mask', 'maskUnits', 'maskContentUnits',
  'href', 'xlink:href',
]);

const INTERNAL_REFERENCE = /^#[A-Za-z_][A-Za-z0-9_.:-]*$/u;
const INTERNAL_URL_REFERENCE = /^url\(#[A-Za-z_][A-Za-z0-9_.:-]*\)$/u;
const MAX_SVG_NODES = 5_000;
const MAX_SVG_ATTRIBUTE_LENGTH = 500_000;

type SvgNode = {
  nodeName?: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string; prefix?: string }>;
  childNodes?: SvgNode[];
};

const invalidSvg = (message: string): never => {
  throw new PipelineStoreError(message, 400, { kind: 'invalid' });
};

const validateReferenceValue = (name: string, value: string): void => {
  const normalized = value.trim();
  if (name === 'xmlns' && normalized === 'http://www.w3.org/2000/svg') return;
  if (name === 'xmlns:xlink' && normalized === 'http://www.w3.org/1999/xlink') return;
  if (name === 'href' || name === 'xlink:href') {
    if (!INTERNAL_REFERENCE.test(normalized)) invalidSvg('Vector references must stay inside the uploaded SVG.');
    return;
  }
  if (normalized.toLowerCase().includes('url(') && !INTERNAL_URL_REFERENCE.test(normalized)) {
    invalidSvg('Vector paint and clipping references must stay inside the uploaded SVG.');
  }
  if (/javascript:|data:|https?:|file:/iu.test(normalized)) {
    invalidSvg('Vector assets cannot contain scripts, embedded files, or external URLs.');
  }
};

const validateSvgTree = (root: SvgNode): void => {
  let nodeCount = 0;
  const visit = (node: SvgNode, parentTagName?: string): void => {
    nodeCount += 1;
    if (nodeCount > MAX_SVG_NODES) invalidSvg('Vector assets may contain at most 5,000 drawing nodes.');
    if (node.nodeName === '#text') {
      if (node.value?.trim() && parentTagName !== 'title' && parentTagName !== 'desc') {
        invalidSvg('Vector assets must convert text to paths before upload.');
      }
      return;
    }
    if (node.nodeName === '#comment') return;
    if (!node.tagName || !SAFE_SVG_ELEMENTS.has(node.tagName)) {
      invalidSvg(`Vector element ${node.tagName || node.nodeName || 'unknown'} is not supported.`);
    }
    for (const attribute of node.attrs ?? []) {
      const qualifiedName = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
      if (qualifiedName.startsWith('on') || !SAFE_SVG_ATTRIBUTES.has(qualifiedName)) {
        invalidSvg(`Vector attribute ${qualifiedName} is not supported.`);
      }
      if (attribute.value.length > MAX_SVG_ATTRIBUTE_LENGTH) invalidSvg('Vector path data is too complex.');
      validateReferenceValue(qualifiedName, attribute.value);
    }
    for (const child of node.childNodes ?? []) visit(child, node.tagName);
  };
  visit(root);
};

const readViewBox = (root: SvgNode): number[] => {
  const value = root.attrs?.find((attribute) => attribute.name === 'viewBox')?.value ?? '';
  const parts = value.trim().split(/[\s,]+/u).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part)) || parts[2]! <= 0 || parts[3]! <= 0) {
    invalidSvg('Vector assets require a valid viewBox so Studio can resize them reliably.');
  }
  return parts;
};

/**
 * Converts an uploaded SVG into CardForge's deliberately small, inert vector subset.
 * The serialized result—not the contributor's original bytes—is what remains in
 * shared Storage.
 */
export const sanitizePipelineSvg = (source: string): Buffer => {
  const withoutDeclaration = source.trim().replace(/^<\?xml[^>]*>\s*/iu, '');
  if (!withoutDeclaration || /<!doctype|<!entity/iu.test(withoutDeclaration)) {
    invalidSvg('Vector assets cannot contain document type or entity declarations.');
  }
  const fragment = parseFragment(withoutDeclaration) as unknown as SvgNode;
  const roots = (fragment.childNodes ?? []).filter((node) => node.nodeName !== '#text' || node.value?.trim());
  if (roots.length !== 1 || roots[0]?.tagName !== 'svg') invalidSvg('Upload one complete SVG drawing.');
  const root = roots[0]!;
  readViewBox(root);
  validateSvgTree(root);
  root.attrs = root.attrs?.filter((attribute) => attribute.name !== 'width' && attribute.name !== 'height');
  const sanitized = serialize(fragment as never);
  return Buffer.from(sanitized, 'utf8');
};
