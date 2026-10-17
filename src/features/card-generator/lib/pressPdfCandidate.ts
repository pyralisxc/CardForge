import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import type { CardFace } from '@/domain/cards';
import type { PrintProductionPreflightGeometry } from './printProductionPreflight';
import { PRESS_COLOR_REFERENCE, sha256, verifyPressColorProfiles, type PressColorProfiles } from './pressColorProfile';

export interface PressRasterFace {
  uniqueId: string;
  cardIndex: number;
  face: CardFace;
  widthPx: number;
  heightPx: number;
  rgb: Uint8Array;
  geometry: PrintProductionPreflightGeometry;
}

export interface PressPdfCandidateReport {
  format: 'cardforge-press-pdf-candidate-v1';
  recipe: typeof PRESS_COLOR_REFERENCE.id;
  writer: 'pdf-lib-1.17.1-opaque-raster-v1';
  declaredStandard: 'PDF/X-4';
  sourceColorSpace: 'rendered-srgb';
  paperComposite: 'opaque-white';
  renderingIntent: 'RelativeColorimetric';
  outputCondition: typeof PRESS_COLOR_REFERENCE.label;
  profileHashes: { source: string; output: string; notice: string };
  standardsValidation: 'pending';
  professionalAcceptance: 'pending';
  pressReady: false;
  createdAt: string;
  pdfSha256: string;
  pages: Array<Omit<PressRasterFace, 'rgb'> & { page: number; rgbSha256: string }>;
}

/** Canvas may keep alpha even after an apparently opaque render. No source pixels are resampled. */
export function compositeWhiteRgb(rgba: Uint8ClampedArray): Uint8Array {
  if (rgba.length % 4) throw new Error('Expected complete RGBA pixels.');
  const rgb = new Uint8Array(rgba.length / 4 * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4) {
    const alpha = rgba[source + 3];
    for (let channel = 0; channel < 3; channel++) {
      rgb[target++] = Math.round((rgba[source + channel] * alpha + 255 * (255 - alpha)) / 255);
    }
  }
  return rgb;
}

const xml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const pt = (mm: number): number => mm * 72 / 25.4;
const finitePositive = (n: number): boolean => Number.isFinite(n) && n > 0;
const same = (a: number, b: number): boolean => Math.abs(a - b) <= 0.000001;

function validateFace(face: PressRasterFace): void {
  const g = face.geometry;
  if (![g.trimWidthMm, g.trimHeightMm, g.productionWidthMm, g.productionHeightMm].every(finitePositive)
    || !Number.isFinite(g.bleedMm) || g.bleedMm < 0
    || !Number.isFinite(g.safeMarginMm) || g.safeMarginMm < 0
    || g.safeMarginMm * 2 >= Math.min(g.trimWidthMm, g.trimHeightMm)
    || !same(g.productionWidthMm, g.trimWidthMm + 2 * g.bleedMm)
    || !same(g.productionHeightMm, g.trimHeightMm + 2 * g.bleedMm)) {
    throw new Error('Press candidate geometry is invalid. Restore the canonical trim and bleed before exporting.');
  }
  if (!Number.isSafeInteger(face.widthPx) || face.widthPx <= 0
    || !Number.isSafeInteger(face.heightPx) || face.heightPx <= 0
    || face.rgb.length !== face.widthPx * face.heightPx * 3) {
    throw new Error('Press candidate pixels are incomplete. Render the complete production face again.');
  }
  if (Math.min(face.widthPx / g.productionWidthMm, face.heightPx / g.productionHeightMm) * 25.4 < 300) {
    throw new Error('Press candidate pixels must provide at least 300 PPI at the actual production size.');
  }
}

/** Owns only newly constructed opaque raster documents, never arbitrary imported PDFs. */
export async function createPressPdfCandidate(
  faces: Iterable<PressRasterFace> | AsyncIterable<PressRasterFace>,
  profiles: PressColorProfiles,
  settings: { title: string; createdAt: string },
): Promise<{ pdf: Uint8Array; report: PressPdfCandidateReport }> {
  await verifyPressColorProfiles(profiles);
  const date = new Date(settings.createdAt);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== settings.createdAt) throw new Error('Use an exact UTC export timestamp.');
  const title = Array.from(settings.title).map((char) => {
    const code = char.codePointAt(0)!;
    return code < 32 || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff ? ' ' : char;
  }).slice(0, 200).join('').trim() || 'CardForge press candidate';
  const pages: PressPdfCandidateReport['pages'] = [];
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const context = pdf.context;
  const sourceProfile = context.register(context.flateStream(profiles.source, { N: 3 }));
  const outputProfile = context.register(context.flateStream(profiles.output, { N: 4 }));
  const intent = context.register(context.obj({
    Type: 'OutputIntent', S: 'GTS_PDFX', DestOutputProfile: outputProfile,
    OutputConditionIdentifier: PDFString.of('Custom'),
    Info: PDFString.of(PRESS_COLOR_REFERENCE.label),
    OutputCondition: PDFString.of('Older FOGRA39 coated sheetfed-offset reference; not printer or stock calibration.'),
  }));
  pdf.catalog.set(PDFName.of('OutputIntents'), context.obj([intent]));


  for await (const face of faces) {
    validateFace(face);
    const { rgb, ...identity } = face;
    pages.push({ ...identity, geometry: { ...face.geometry }, page: pages.length + 1, rgbSha256: await sha256(rgb) });
    const g = face.geometry;
    const width = pt(g.productionWidthMm), height = pt(g.productionHeightMm);
    const page = pdf.addPage([width, height]);
    page.setBleedBox(0, 0, width, height); page.setCropBox(0, 0, width, height);
    page.setTrimBox(pt(g.bleedMm), pt(g.bleedMm), pt(g.trimWidthMm), pt(g.trimHeightMm));
    const image = context.register(context.flateStream(face.rgb, {
      Type: 'XObject', Subtype: 'Image', Width: face.widthPx, Height: face.heightPx,
      BitsPerComponent: 8, ColorSpace: ['ICCBased', sourceProfile], Intent: 'RelativeColorimetric',
    }));
    page.node.set(PDFName.of('Resources'), context.obj({ XObject: { Im0: image } }));
    page.node.set(PDFName.of('Contents'), context.register(context.flateStream(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`)));
  }
  if (!pages.length) throw new Error('Add at least one rendered face before exporting a press candidate.');
  const id = await sha256(new TextEncoder().encode(JSON.stringify({ recipe: PRESS_COLOR_REFERENCE.id, title, createdAt: settings.createdAt, pages })));
  // XMP URI uses a content-derived custom UUID (version 8), not a random or source-work identity.
  const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-8${id.slice(13, 16)}-${((parseInt(id[16], 16) & 3) | 8).toString(16)}${id.slice(17, 20)}-${id.slice(20, 32)}`;
  const producer = 'CardForge / pdf-lib 1.17.1 opaque raster candidate';
  pdf.setTitle(title); pdf.setCreator('CardForge'); pdf.setProducer(producer);
  pdf.setCreationDate(date); pdf.setModificationDate(date);
  const info = context.lookup(context.trailerInfo.Info, PDFDict);
  info.set(PDFName.of('GTS_PDFXVersion'), PDFString.of('PDF/X-4'));
  info.set(PDFName.of('Trapped'), PDFName.of('False'));
  context.trailerInfo.ID = context.obj([PDFHexString.of(id.slice(0, 32)), PDFHexString.of(id.slice(0, 32))]);

  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"><pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion><pdf:Trapped>False</pdf:Trapped><pdf:Producer>${xml(producer)}</pdf:Producer><xmp:CreatorTool>CardForge</xmp:CreatorTool><xmp:CreateDate>${settings.createdAt}</xmp:CreateDate><xmp:ModifyDate>${settings.createdAt}</xmp:ModifyDate><xmp:MetadataDate>${settings.createdAt}</xmp:MetadataDate><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xml(title)}</rdf:li></rdf:Alt></dc:title><xmpMM:DocumentID>uuid:${uuid}</xmpMM:DocumentID><xmpMM:InstanceID>uuid:${uuid}</xmpMM:InstanceID><xmpMM:VersionID>1</xmpMM:VersionID><xmpMM:RenditionClass>default</xmpMM:RenditionClass></rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`;
  pdf.catalog.set(PDFName.of('Metadata'), context.register(context.stream(new TextEncoder().encode(xmp), { Type: 'Metadata', Subtype: 'XML' })));
  const bytes = await pdf.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
  // The pinned writer serializes a 1.7 header even for our closed <=1.6 grammar.
  // Same-length normalization is valid only for this constructor, not a PDF conversion/repair API.
  if (new TextDecoder().decode(bytes.subarray(0, 8)) !== '%PDF-1.7') throw new Error('The press PDF writer changed. No unverified candidate was exported.');
  bytes[7] = 0x36;
  return { pdf: bytes, report: {
    format: 'cardforge-press-pdf-candidate-v1', recipe: PRESS_COLOR_REFERENCE.id,
    writer: 'pdf-lib-1.17.1-opaque-raster-v1', declaredStandard: 'PDF/X-4',
    sourceColorSpace: 'rendered-srgb', paperComposite: 'opaque-white', renderingIntent: 'RelativeColorimetric',
    outputCondition: PRESS_COLOR_REFERENCE.label,
    profileHashes: { source: PRESS_COLOR_REFERENCE.source.sha256, output: PRESS_COLOR_REFERENCE.output.sha256, notice: PRESS_COLOR_REFERENCE.notice.sha256 },
    standardsValidation: 'pending', professionalAcceptance: 'pending', pressReady: false,
    createdAt: settings.createdAt, pdfSha256: await sha256(bytes), pages,
  } };
}
