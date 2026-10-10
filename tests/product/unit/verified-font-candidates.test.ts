import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { create as decodeFont } from 'fontkit';
import { describe, expect, it } from 'vitest';
import {
  curatedFontManifestDigest,
  gitBlobSha,
  requireReviewedFontStagingTarget,
  reviewedFontSourceUrl,
  validateReviewedFontCandidate,
} from '../../../scripts/lib/verifiedFontSources.mjs';

const root = path.join(process.cwd(), 'public', 'fonts', 'lato');
const bytes = readFileSync(path.join(root, 'Lato-Regular.ttf'));
const notice = readFileSync(path.join(root, 'OFL.txt'));
const spec = {
  assetId: 'official-audit-font-test',
  family: 'Lato',
  category: 'Utility',
  fallback: 'sans-serif',
  sourceDirectory: 'lato',
  sourceFile: 'Lato-Regular.ttf',
  sizeBytes: bytes.length,
  gitBlobSha: gitBlobSha(bytes),
  licenseGitBlobSha: gitBlobSha(notice),
  axes: {},
  description: 'Verified original test face',
  intendedRole: 'Readable rules',
};
const manifest = {
  schemaVersion: 1,
  publicationState: 'candidates-require-founder-review',
  upstreamRepository: 'https://github.com/google/fonts',
  upstreamRevision: '51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca',
  license: 'OFL-1.1',
  items: [spec],
};

describe('original font candidate verification before Pipeline publication', () => {
  it('rejects changed binaries, incorrect notices and impersonated family names', () => {
    const altered = Buffer.from(bytes);
    altered[altered.length - 1] ^= 1;
    expect(() => validateReviewedFontCandidate(spec, altered, notice)).toThrow(/bytes/i);
    expect(() => validateReviewedFontCandidate(spec, bytes, Buffer.from('not an OFL notice'))).toThrow(/copyright\/license/i);
    expect(() => validateReviewedFontCandidate({ ...spec, family: 'Invented Lato' }, bytes, notice)).toThrow(/family/i);
  });

  it('decodes the exact font and printable glyphs with a static weight descriptor', () => {
    const result = validateReviewedFontCandidate(spec, bytes, notice);
    expect(result.family).toBe('Lato');
    expect(result.glyphCount).toBeGreaterThan(50);
    expect(result.fontWeightRange).toBe('400');
    expect(result.specimen).toContain('0123456789');
    const decoded = decodeFont(bytes);
    expect('familyName' in decoded ? decoded.familyName : null).toBe(result.family);
  });

  it('constructs only immutable pinned official Google Fonts URLs', () => {
    expect(reviewedFontSourceUrl(manifest, spec)).toBe(
      'https://raw.githubusercontent.com/google/fonts/'
      + manifest.upstreamRevision + '/ofl/lato/Lato-Regular.ttf',
    );
    expect(() => reviewedFontSourceUrl(manifest, { ...spec, sourceDirectory: 'evil' })).toThrow(/not in/i);
    expect(() => reviewedFontSourceUrl(manifest, { ...spec, assetId: 'unknown-source' })).toThrow(/not in/i);
  });

  it('produces a deterministic review digest for exact-approved input', () => {
    const input = Buffer.from(JSON.stringify(manifest));
    expect(curatedFontManifestDigest(input)).toBe(createHash('sha256').update(input).digest('hex'));
  });
  it('refuses production and lookalike hostnames even with a valid candidate digest', () => {
    expect(requireReviewedFontStagingTarget('https://mjdugheniazuiqoefnnb.supabase.co'))
      .toBe('https://mjdugheniazuiqoefnnb.supabase.co');
    expect(() => requireReviewedFontStagingTarget('https://mpmmhjjhdxjedbmuctiv.supabase.co'))
      .toThrow(/staging/i);
    expect(() => requireReviewedFontStagingTarget('https://mjdugheniazuiqoefnnb.supabase.co.evil.test'))
      .toThrow(/staging/i);
    expect(() => requireReviewedFontStagingTarget('http://mjdugheniazuiqoefnnb.supabase.co'))
      .toThrow(/staging/i);
  });

});
