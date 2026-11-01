import { beforeEach, expect, it, vi } from 'vitest';
import { normalizeProjectFontAsset, type ProjectFontAsset } from '@/features/project/model/projectFont';
import { mapProjectFontsToCardFontOptions } from '@/features/project/persistence/projectFonts';
import { mapRegistryRowsToCardFontOptions, mergeCardFontOptions } from '@/domain/rendering';
const f = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/features/pipeline/lib/registryContentAssets', () => ({ getPublishedRegistryRows: async () => f.rows, readRegistryContentAsset: vi.fn() }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => null, getSupabaseServerConfigStatus: () => ({ configured: true }) }));
import { getCardForgeStudioBootstrapManifest } from '@/features/pipeline/lib/catalogManifest';
beforeEach(() => { f.rows = []; });
it('captures raw governed font identity and runtime value from the same native catalog observation', async () => {
  const row = { asset_id: 'Heading / Regular', contributor_submission_id: '10000000-0000-4000-8000-000000000001', asset_type: 'font', name: 'Governed Heading', url: 'https://example.invalid/font.woff2', metadata: {}, studio_destinations: ['typography.font'], access_tier: 'free', status: 'published' };
  f.rows = [row]; const bootstrap = await getCardForgeStudioBootstrapManifest();
  expect(bootstrap.fonts.fonts[0].value).toBe(mapRegistryRowsToCardFontOptions([row])[0].value);
  expect(bootstrap.pipeline).toEqual([{ assetId: row.asset_id, submissionId: row.contributor_submission_id, fontValue: bootstrap.fonts.fonts[0].value }]);
  expect(bootstrap.pipeline![0].assetId).not.toBe(bootstrap.pipeline![0].fontValue);
});
it('retains both raw sources when the canonical runtime sanitizer collides, without inventing a reverse identity', async () => {
  f.rows = ['Collision/Face', 'Collision Face'].map((asset_id, index) => ({ asset_id, contributor_submission_id: `10000000-0000-4000-8000-00000000000${index + 1}`, asset_type: 'font', name: `Font ${index}`, url: 'https://example.invalid/font.woff2', metadata: {}, studio_destinations: ['typography.font'], access_tier: 'free', status: 'published' }));
  const bootstrap = await getCardForgeStudioBootstrapManifest();
  expect(bootstrap.pipeline![0].fontValue).toBe(bootstrap.pipeline![1].fontValue);
  expect(bootstrap.pipeline!.map(item => item.assetId)).toEqual(['Collision/Face', 'Collision Face']);
  expect(new Set(bootstrap.pipeline!.map(item => item.submissionId)).size).toBe(2);
});

it('native project-font normalization and option merging cannot shadow a published runtime identity', () => {
  const governed = mapRegistryRowsToCardFontOptions([{ asset_id: 'Heading / Regular', name: 'Governed Heading', url: 'https://example.invalid/governed.woff2', metadata: {} }])[0];
  const forged = { id: 'Heading-Regular', name: 'Private lookalike', value: governed.value, mimeType: 'font/woff2', dataUrl: 'data:font/woff2;base64,AA==', fileSizeBytes: 1 };
  const normalized = normalizeProjectFontAsset(forged)!;
  expect(normalized.value).toBe('font-personal-heading-regular');
  const personal = mapProjectFontsToCardFontOptions([forged as ProjectFontAsset]);
  const options = mergeCardFontOptions([governed], personal);
  expect(options).toHaveLength(2); expect(options.find(font => font.value === governed.value)?.sourceUrl).toBe(governed.sourceUrl);
  expect(personal[0].value).not.toBe(governed.value); expect(personal[0].sourceUrl).toBe(forged.dataUrl);
});
