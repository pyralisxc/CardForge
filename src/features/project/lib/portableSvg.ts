import { ProjectPackageError } from './projectPackageError';

/** A conservative portability check, not an SVG sanitizer or renderer.
 * Keep native vector geometry and local fragment paint references. Resource-
 * bearing/encoded constructs we cannot prove self-contained fail explicitly.
 */
export function assertPortableSvg(bytes: Uint8Array): void {
  let svg: string;
  try { svg = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {
    throw new ProjectPackageError('SVG artwork must use UTF-8 encoding for portable export.');
  }
  if (Array.from(svg).some((char) => char.charCodeAt(0) < 32 && !['\t', '\r', '\n'].includes(char))
    || /encoding\s*=\s*(['"])(?!utf-8\1)[^'"]+\1/iu.test(svg)) {
    throw new ProjectPackageError('SVG artwork must use UTF-8 encoding for portable export.');
  }
  const withoutLocalReferences = svg
    .replace(/\b(?:xlink:)?href\s*=\s*(['"])#[\w.:-]+\1/giu, '')
    .replace(/url\(\s*(['"]?)#[\w.:-]+\1\s*\)/giu, '');
  if (/[&\\@]/u.test(svg)
    || /<!DOCTYPE|<!ENTITY|<\?(?!xml\s)|<\s*(?:[\w.-]+:)?(?:script|foreignObject|animate\w*|set|link)\b|\bxml:base\s*=/iu.test(svg)
    || /\b(?:href|src)\s*=|url\s*\(|image-set\s*\(/iu.test(withoutLocalReferences)) {
    throw new ProjectPackageError('SVG artwork contains linked or unsupported encoded dependencies. Import a self-contained SVG or raster image before exporting.');
  }
}
