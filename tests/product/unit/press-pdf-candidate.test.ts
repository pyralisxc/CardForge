import { readFileSync } from 'node:fs';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRESS_COLOR_REFERENCE, loadPressColorProfiles, sha256 } from '@/features/card-generator/lib/pressColorProfile';
import { createPressPdfCandidate, compositeWhiteRgb, type PressRasterFace } from '@/features/card-generator/lib/pressPdfCandidate';

const profiles = {
  source: new Uint8Array(readFileSync('public/color-profiles/sRGB.icc')),
  output: new Uint8Array(readFileSync('public/color-profiles/FOGRA39L_coated.icc')),
  notice: new Uint8Array(readFileSync('public/color-profiles/NOTICE.txt')),
};
const face = (uniqueId = 'fictional-card'): PressRasterFace => ({
  uniqueId, cardIndex: 0, face: 'front', widthPx: 830, heightPx: 1120,
  rgb: new Uint8Array(830 * 1120 * 3).fill(200),
  geometry: { trimWidthMm: 63, trimHeightMm: 88, bleedMm: 3, safeMarginMm: 4, productionWidthMm: 69, productionHeightMm: 94 },
});
const raw = (value: unknown): PDFRawStream => {
  if (!(value instanceof PDFRawStream)) throw new Error('Expected an actual PDF stream.');
  return value;
};
const settings = { title: 'Fictional sample & <proof>', createdAt: '2026-10-17T12:00:00.000Z' };
afterEach(() => vi.unstubAllGlobals());

describe('explicit color-managed press candidate', () => {
  it('keeps declared source, output and complete notices byte-identical and fails closed on drift', async () => {
    expect(await sha256(profiles.source)).toBe(PRESS_COLOR_REFERENCE.source.sha256);
    expect(await sha256(profiles.output)).toBe(PRESS_COLOR_REFERENCE.output.sha256);
    expect(await sha256(profiles.notice)).toBe(PRESS_COLOR_REFERENCE.notice.sha256);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('sRGB.icc') ? profiles.source : url.endsWith('FOGRA39L_coated.icc') ? profiles.output : profiles.notice)));
    expect(await loadPressColorProfiles()).toEqual(profiles);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]))));
    await expect(loadPressColorProfiles()).rejects.toThrow(/profile.*changed|notice.*changed/i);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
    await expect(loadPressColorProfiles()).rejects.toThrow(/unavailable/i);
  });

  it('flattens only onto declared opaque white without changing opaque source pixels', () => {
    expect([...compositeWhiteRgb(new Uint8ClampedArray([10, 20, 30, 255, 0, 100, 200, 0, 0, 0, 0, 128]))])
      .toEqual([10, 20, 30, 255, 255, 255, 127, 127, 127]);
    expect(() => compositeWhiteRgb(new Uint8ClampedArray([0, 0, 0]))).toThrow(/RGBA/);
  });

  it('creates one exact bleed-bearing page per available face with explicit separate ICC profiles and pending acceptance', async () => {
    const front = face();
    const back = { ...face(), face: 'back' as const };
    const output = await createPressPdfCandidate([front, back], profiles, settings);
    expect(new TextDecoder().decode(output.pdf.subarray(0, 8))).toBe('%PDF-1.6');
    expect(output.report).toMatchObject({
      format: 'cardforge-press-pdf-candidate-v1', pressReady: false,
      standardsValidation: 'pending', professionalAcceptance: 'pending',
      sourceColorSpace: 'rendered-srgb', paperComposite: 'opaque-white',
      pdfSha256: await sha256(output.pdf),
      pages: [{ page: 1, uniqueId: front.uniqueId, face: 'front' }, { page: 2, uniqueId: back.uniqueId, face: 'back' }],
    });
    const pdf = await PDFDocument.load(output.pdf, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe(settings.title);
    const intent = pdf.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).lookup(0, PDFDict);
    expect(intent.get(PDFName.of('S'))?.toString()).toBe('/GTS_PDFX');
    const outputProfile = raw(pdf.context.lookup(intent.get(PDFName.of('DestOutputProfile'))));
    expect(outputProfile.dict.get(PDFName.of('N'))?.toString()).toBe('4');
    expect(decodePDFRawStream(outputProfile).decode()).toEqual(profiles.output);
    for (const page of pdf.getPages()) {
      expect(page.getMediaBox().width * 25.4 / 72).toBeCloseTo(69, 8);
      expect(page.getBleedBox()).toEqual(page.getMediaBox());
      expect(page.getTrimBox().x * 25.4 / 72).toBeCloseTo(3, 8);
      expect(page.getTrimBox().width * 25.4 / 72).toBeCloseTo(63, 8);
      const resources = page.node.lookup(PDFName.of('Resources'), PDFDict);
      expect(resources.has(PDFName.of('Font'))).toBe(false);
      const image = raw(pdf.context.lookup(resources.lookup(PDFName.of('XObject'), PDFDict).get(PDFName.of('Im0'))));
      expect(image.dict.has(PDFName.of('SMask'))).toBe(false);
      const color = image.dict.lookup(PDFName.of('ColorSpace'), PDFArray);
      expect(color.lookup(0)?.toString()).toBe('/ICCBased');
      expect(decodePDFRawStream(raw(color.lookup(1))).decode()).toEqual(profiles.source);
      expect(await sha256(decodePDFRawStream(image).decode())).toBe(await sha256(front.rgb));
    }
    const metadata = raw(pdf.context.lookup(pdf.catalog.get(PDFName.of('Metadata'))));
    const xmp = new TextDecoder().decode(metadata.contents);
    expect(xmp).toContain('<pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>');
    expect(xmp).toContain('Fictional sample &amp; &lt;proof&gt;');
    expect(xmp).not.toContain('PDF/X-4:2010');
    expect(pdf.context.lookup(pdf.context.trailerInfo.Info, PDFDict).get(PDFName.of('Trapped'))?.toString()).toBe('/False');
    expect(await createPressPdfCandidate([front, back], profiles, settings)).toEqual(output);
  });

  it('rejects invalid geometry, source pixels and missing or wrong profiles before producing a candidate', async () => {
    await expect(createPressPdfCandidate([], profiles, settings)).rejects.toThrow(/face/i);
    await expect(createPressPdfCandidate([{ ...face(), rgb: new Uint8Array(3) }], profiles, settings)).rejects.toThrow(/pixels/i);
    await expect(createPressPdfCandidate([{ ...face(), widthPx: 1, heightPx: 1, rgb: new Uint8Array(3) }], profiles, settings)).rejects.toThrow(/300/);
    const invalid = face(); invalid.geometry.bleedMm = -1;
    await expect(createPressPdfCandidate([invalid], profiles, settings)).rejects.toThrow(/geometry/i);
    await expect(createPressPdfCandidate([face()], { ...profiles, output: profiles.source }, settings)).rejects.toThrow(/profile.*changed/i);
  });

  it('never returns a partial success when a later canonical face render fails', async () => {
    async function* failedRender() { yield face(); throw new Error('Canonical artwork is unavailable.'); }
    await expect(createPressPdfCandidate(failedRender(), profiles, settings)).rejects.toThrow('Canonical artwork is unavailable.');
  });
});
