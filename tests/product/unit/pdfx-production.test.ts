import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getTemplateProductionGeometryMm } from '@/domain/rendering';
import { buildPdfXFace, GRACOL_PROFILE, sha256Hex, validatePrintIcc } from '@/features/card-generator/lib/pdfxProduction';

const icc = new Uint8Array(readFileSync('public/print-profiles/GRACoL2013_CRPC6.icc'));

describe('PDF/X candidate production', () => {
  it('embeds the unmodified reference intent, exact boxes and calibrated RGB without overclaiming validation', async () => {
    expect(await sha256Hex(icc)).toBe(GRACOL_PROFILE.sha256);
    const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
    const geometry = getTemplateProductionGeometryMm({ aspectRatio: '63:88' });
    const result = await buildPdfXFace(png, geometry, icc, GRACOL_PROFILE.condition, new Date('2026-10-15T00:00:00Z'));
    expect(result.validation).toMatchObject({ valid: true, errors: [] });
    const text = Buffer.from(result.bytes).toString('latin1');
    expect(text).toContain('/GTS_PDFX');
    expect(text).toContain('/DefaultRGB');
    expect(text).toContain('/TrimBox');
    expect(text).toContain('/BleedBox');
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('rejects incomplete and display profiles before generating a candidate', () => {
    expect(() => validatePrintIcc(icc.subarray(0, 200))).toThrow(/incomplete/);
    const display = icc.slice();
    display.set(new TextEncoder().encode('mntr'), 12);
    expect(() => validatePrintIcc(display)).toThrow(/printing profile/);
  });
});
