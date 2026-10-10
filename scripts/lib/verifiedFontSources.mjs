import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { create as decodeFont } from 'fontkit';

const SHA = /^[a-f0-9]{40}$/u;
const DIRECTORY = /^[a-z][a-z0-9]*$/u;
const ASSET_ID = /^official-[a-z0-9-]+$/u;
const FONT_FILE = /^[A-Za-z][A-Za-z0-9,._[\]-]*\.ttf$/u;
const CATEGORIES = new Set(['Fantasy', 'Classic', 'Sci-Fi', 'Utility', 'System']);
const SAMPLE = 'AaBbZz 0123456789!?.,;:-+/()[]';

export const gitBlobSha = (bytes) => createHash('sha1')
  .update('blob ' + bytes.byteLength + '\0')
  .update(bytes)
  .digest('hex');

export const curatedFontManifestDigest = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The original notice is published alongside the immutable original font.
 * It remains byte-for-byte recoverable from this deterministic JSON payload. */
export const createVerifiedFontLicenseSidecar = ({ candidate, licenseBytes, sourceRevision }) => {
  const original = Buffer.from(licenseBytes);
  if (!SHA.test(sourceRevision) || gitBlobSha(original) !== candidate.licenseGitBlobSha) {
    throw new Error('The source copyright notice differs from the pinned original.');
  }
  const originalNotice = original.toString('utf8');
  if (!originalNotice.includes('SIL OPEN FONT LICENSE Version 1.1') || !/copyright/iu.test(originalNotice)) {
    throw new Error('The original font license notice is incomplete.');
  }
  return Buffer.from(JSON.stringify({
    license: 'OFL-1.1',
    copyrightAndLicenseText: originalNotice,
    sourceRepository: 'https://github.com/google/fonts',
    sourceRevision,
    licenseGitBlobSha: candidate.licenseGitBlobSha,
  }, null, 2) + '\n');
};



// Approved typography publication in this tranche is strictly a STAGING-only
// operation. A valid digest and Owner secret are not permission to write to the
// production Supabase project. This explicit identity check must remain before
// creating a privileged client or performing any provider operation.
export const APPROVED_FONT_PREVIEW_SUPABASE_URL = 'https://mjdugheniazuiqoefnnb.supabase.co';

export const assertPreviewFontPublicationTarget = (url) => {
  let target;
  try {
    target = new URL(String(url || ''));
  } catch {
    throw new Error('The reviewed Font publication requires the verified Card Forge Staging URL.');
  }
  if (target.origin !== APPROVED_FONT_PREVIEW_SUPABASE_URL
    || target.username || target.password || target.pathname !== '/'
    || target.search || target.hash) {
    throw new Error('Refusing Font publication outside the verified Card Forge Staging Supabase project.');
  }
  return target.origin;
};


const assertSourceSpec = (manifest) => {
  if (!manifest || manifest.schemaVersion !== 1
    || manifest.publicationState !== 'candidates-require-founder-review'
    || manifest.upstreamRepository !== 'https://github.com/google/fonts'
    || !SHA.test(manifest.upstreamRevision)
    || manifest.license !== 'OFL-1.1'
    || !Array.isArray(manifest.items) || manifest.items.length < 1 || manifest.items.length > 8) {
    throw new Error('The reviewed font source manifest is missing or invalid.');
  }
  const ids = new Set();
  for (const font of manifest.items) {
    if (!ASSET_ID.test(font.assetId) || ids.has(font.assetId)
      || !DIRECTORY.test(font.sourceDirectory) || !FONT_FILE.test(font.sourceFile)
      || !SHA.test(font.gitBlobSha) || !SHA.test(font.licenseGitBlobSha)
      || !Number.isSafeInteger(font.sizeBytes) || font.sizeBytes < 10_000 || font.sizeBytes > 20_000_000
      || typeof font.family !== 'string' || !font.family.trim()
      || !CATEGORIES.has(font.category) || !['serif', 'sans-serif'].includes(font.fallback)
      || !font.axes || typeof font.axes !== 'object' || Array.isArray(font.axes)
      || typeof font.description !== 'string' || !font.description.trim()
      || typeof font.intendedRole !== 'string' || !font.intendedRole.trim()) {
      throw new Error('An official font candidate has invalid identity, source, license, or classification.');
    }
    ids.add(font.assetId);
    for (const [tag, range] of Object.entries(font.axes)) {
      if (!/^[a-z]{4}$/u.test(tag) || !Array.isArray(range) || range.length !== 2
        || range.some(value => !Number.isFinite(value))
        || range[0] >= range[1]) {
        throw new Error('An official font candidate has invalid variation axis constraints.');
      }
    }
  }
  return manifest;
};

export const reviewedFontSourceUrl = (manifest, candidate) => {
  assertSourceSpec(manifest);
  if (!manifest.items.some(item => item.assetId === candidate.assetId
    && item.gitBlobSha === candidate.gitBlobSha
    && item.sourceDirectory === candidate.sourceDirectory
    && item.sourceFile === candidate.sourceFile
    && item.licenseGitBlobSha === candidate.licenseGitBlobSha)) {
    throw new Error('The requested source is not in the reviewed font candidate manifest.');
  }
  // The host/repository/path are not user-supplied; only pinned source names are
  // permitted so this cannot become a generic remote-asset download proxy.
  return 'https://raw.githubusercontent.com/google/fonts/'
    + manifest.upstreamRevision + '/ofl/' + candidate.sourceDirectory + '/'
    + encodeURIComponent(candidate.sourceFile);
};

const axisMetadata = (font, candidate) => {
  const actual = font.variationAxes || {};
  const expected = candidate.axes;
  const actualTags = Object.keys(actual).sort();
  const expectedTags = Object.keys(expected).sort();
  if (JSON.stringify(actualTags) !== JSON.stringify(expectedTags)) {
    throw new Error('The original font variable axes differ from the reviewed source metadata.');
  }
  for (const [tag, range] of Object.entries(expected)) {
    const reported = actual[tag];
    if (!reported || Math.abs(reported.min - range[0]) > 0.01 || Math.abs(reported.max - range[1]) > 0.01) {
      throw new Error('The original font axis range differs from the reviewed source metadata.');
    }
  }
  const weight = expected.wght;
  return weight ? String(weight[0]) + ' ' + String(weight[1]) : '400';
};

/** Source identity, complete font glyph outlines and machine-checkable axes.
 * Specimen *legibility* remains a separate Founder/Pipeline editorial gate. */
export const validateReviewedFontCandidate = (candidate, originalBytes, licenseBytes) => {
  const bytes = Buffer.from(originalBytes);
  const notice = Buffer.from(licenseBytes);
  if (bytes.byteLength !== candidate.sizeBytes || gitBlobSha(bytes) !== candidate.gitBlobSha) {
    throw new Error('Font bytes do not match the immutable reviewed upstream Git object.');
  }
  if (gitBlobSha(notice) !== candidate.licenseGitBlobSha) {
    throw new Error('The font copyright/license notice differs from its reviewed upstream version.');
  }
  const license = notice.toString('utf8');
  if (!license.includes('SIL OPEN FONT LICENSE Version 1.1') || !/copyright/iu.test(license)) {
    throw new Error('The reviewed original OFL and copyright notice is incomplete.');
  }
  let font;
  try {
    font = decodeFont(bytes);
    const normalized = value => String(value || '').replace(/[^a-z0-9]/giu, '').toLowerCase();
    // Variable optical-size fonts can report a style-qualified family in the
    // legacy name table (e.g. the Bricolage 96pt instance). The immutable source
    // SHA already proves exact file identity; retain a family-prefix check and
    // require matching declared axes and readable glyphs below.
    const actualFamily = normalized(font.familyName);
    const expectedFamily = normalized(candidate.family);
    if (!actualFamily.startsWith(expectedFamily)) {
      throw new Error('Original font reported family "' + String(font.familyName)
        + '", expected "' + candidate.family + '".');
    }
    if (!font.numGlyphs || !font.unitsPerEm || !font.characterSet?.length) {
      throw new Error('Original font "' + candidate.assetId + '" lacks valid glyph metadata.');
    }
    const weightDescriptor = axisMetadata(font, candidate);
    const covered = new Set(font.characterSet);
    for (const character of SAMPLE) {
      const code = character.codePointAt(0);
      if (!covered.has(code)) throw new Error('Font cannot render the required Latin/digit/punctuation specimen.');
      const glyph = font.glyphForCodePoint(code);
      void glyph.path.commands;
      if (!Number.isFinite(glyph.advanceWidth)) throw new Error('Invalid source glyph metrics.');
    }
    return {
      bytes,
      family: font.familyName,
      glyphCount: font.numGlyphs,
      fontWeightRange: weightDescriptor,
      specimen: SAMPLE,
    };
  } catch (error) {
    throw new Error('Reviewed font decode/specimen validation failed: '
      + (error instanceof Error ? error.message : 'invalid font'));
  }
};

export const verifyReviewedFontSources = async ({
  manifestPath,
  fetchSource = fetch,
}) => {
  const manifestBytes = await readFile(manifestPath);
  const manifest = assertSourceSpec(JSON.parse(manifestBytes.toString('utf8')));
  const verified = await Promise.all(manifest.items.map(async candidate => {
    const licensePath = path.join(path.dirname(manifestPath), 'licenses',
      candidate.sourceDirectory + '-OFL.txt');
    const notice = await readFile(licensePath);
    const url = reviewedFontSourceUrl(manifest, candidate);
    const response = await fetchSource(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Pinned original font source unavailable: ' + candidate.assetId);
    const bytes = Buffer.from(await response.arrayBuffer());
    let validated;
    try {
      validated = validateReviewedFontCandidate(candidate, bytes, notice);
    } catch (error) {
      throw new Error(candidate.assetId + ': '
        + (error instanceof Error ? error.message : 'Source validation failed.'));
    }
    return { candidate, ...validated, sourceUrl: url, licensePath, licenseBytes: notice };
  }));
  return { items: verified, sourceRevision: manifest.upstreamRevision, manifestDigest: curatedFontManifestDigest(manifestBytes) };
};
