import type { CardProductionGeometryMm } from '@/domain/rendering';
import type { FontData } from 'pdfnative';

export const GRACOL_PROFILE = {
  path: '/print-profiles/GRACoL2013_CRPC6.icc',
  condition: 'CGATS21-2-CRPC6',
  label: 'GRACoL 2013 CRPC6',
  sha256: '4ebbfad6bc9cfc033fdafdd8ac5df8159208932cb16d9a6596d349ae7ab50443',
} as const;
export const MAX_PRINT_ICC_BYTES = 8 * 1024 * 1024;

export const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((value) => value.toString(16).padStart(2, '0')).join('');

export function validatePrintIcc(bytes: Uint8Array) {
  if (bytes.length < 132 || bytes.length > MAX_PRINT_ICC_BYTES) throw new Error('Choose a complete printing ICC profile up to 8 MB.');
  const signature = (start: number) => String.fromCharCode(...bytes.subarray(start, start + 4));
  const declaredSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (declaredSize !== bytes.length || signature(36) !== 'acsp') throw new Error('The ICC profile is incomplete or invalid.');
  if (signature(12) !== 'prtr' || signature(16) !== 'CMYK') throw new Error('PDF/X output needs a CMYK printing profile, not a display profile.');
}

/** Packages canonical sRGB canvas pixels; never reinterprets authored Templates. */
export async function buildPdfXFace(png: Uint8Array, geometry: CardProductionGeometryMm, iccProfile: Uint8Array, condition: string, creationDate: Date) {
  validatePrintIcc(iccProfile);
  if (!condition.trim()) throw new Error('Name the printing condition for this ICC profile.');
  const [{ buildDocumentPDFBytes, validatePdfX, validateFontData, setDeflateImpl }, fontData, { zlibSync }, { decode, encode }] = await Promise.all([
    import('pdfnative'), import('pdfnative/fonts/noto-polish-data.js'), import('fflate'), import('fast-png'),
  ]);
  if (!validateFontData(fontData).valid) throw new Error('The PDF generator font resource is invalid.');
  setDeflateImpl((bytes) => zlibSync(bytes));
  // pdfnative 1.8 rejects alpha PNGs. Flatten canonical canvas alpha onto white
  // paper losslessly, using the existing PNG codec rather than a JPEG conversion.
  const decoded = decode(png);
  if (decoded.depth !== 8 || decoded.palette) throw new Error('PDF/X packaging requires an 8-bit canonical canvas PNG.');
  const rgb = new Uint8Array(decoded.width * decoded.height * 3);
  for (let pixel = 0; pixel < decoded.width * decoded.height; pixel++) {
    const start = pixel * decoded.channels;
    const alpha = decoded.channels === 2 || decoded.channels === 4 ? decoded.data[start + decoded.channels - 1] : 255;
    for (let channel = 0; channel < 3; channel++) {
      const value = decoded.data[start + (decoded.channels < 3 ? 0 : channel)];
      rgb[pixel * 3 + channel] = Math.round((value * alpha + 255 * (255 - alpha)) / 255);
    }
  }
  const opaquePng = encode({ width: decoded.width, height: decoded.height, data: rgb, channels: 3, depth: 8 });
  const pt = (mm: number) => mm * 72 / 25.4;
  const width = pt(geometry.productionWidthMm);
  const height = pt(geometry.productionHeightMm);
  const bytes = buildDocumentPDFBytes({
    // A title in this API paints a heading. Omit it to preserve exact artwork.
    blocks: [{ type: 'image', data: opaquePng, width, height }],
    // Strict image-only documents still require an embedded font in pdfnative 1.8.
    // The generated module declares anchor records as unknown; validate before narrowing.
    fontEntries: [{ fontData: fontData as unknown as FontData, fontRef: '/F3', lang: 'latin' }],
    metadata: { trapped: 'False' },
    layout: {
      pdfx: 'pdfx4', strict: true, compress: true, creationDate,
      pageWidth: width, pageHeight: height,
      margins: { t: 0, r: 0, b: 0, l: 0 }, footerTemplate: {},
      print: { trimBox: [pt(geometry.bleedMm), pt(geometry.bleedMm), pt(geometry.bleedMm + geometry.trimWidthMm), pt(geometry.bleedMm + geometry.trimHeightMm)], bleedBox: [0, 0, width, height] },
      outputIntent: { iccProfile, outputConditionIdentifier: condition, outputCondition: condition, registryName: 'http://www.color.org' },
    },
  });
  const validation = validatePdfX(bytes);
  if (!validation.valid) throw new Error(`PDF/X structural checks failed: ${validation.errors.slice(0, 2).join(' ')}`);
  return { bytes, validation };
}
