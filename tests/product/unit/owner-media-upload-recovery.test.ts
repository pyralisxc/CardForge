import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ error: null as unknown, remove: vi.fn(), update: vi.fn(), upload: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/features/owner/server/ownerSiteCommands', () => ({ finalizeOwnerPublication: vi.fn() }));
vi.mock('@/infrastructure/security/abuseProtection', () => ({ consumeRateLimit: async () => ({ allowed: true }) }));
vi.mock('@/infrastructure/database/supabaseServer', () => ({ getSupabaseServerClient: () => ({ storage: { from: () => ({ upload: state.upload, remove: state.remove }) } }) }));
vi.mock('@/features/public-site/server', () => ({
  SiteMediaStoreError: class extends Error { constructor(message: string, public status = 503) { super(message); } },
  isSiteMediaSlot: () => true, isComposedSiteMediaSlot: () => false,
  assertComposedSiteMediaReference: async () => undefined,
  getDefaultSiteMedia: () => ({ slot: 'landing.hero', updatedAt: null, previousVersion: null }),
  normalizeSiteMediaAlt: (alt: string) => alt,
  getSiteMedia: async () => [{ slot: 'landing.hero', updatedAt: 'revision', previousVersion: null }],
  validateSiteMediaFile: () => ({ ok: true }), processSiteMediaImage: async () => ({ buffer: Buffer.from('fixture'), width: 20, height: 20 }),
  getSiteMediaStoragePath: () => 'landing/hero/uncommitted.webp', getSiteMediaContentType: () => 'image/webp', SITE_MEDIA_BUCKET: 'media',
  updateSiteMedia: async () => { state.update(); throw state.error; }, revalidateSiteMediaCache: vi.fn(), restorePreviousSiteMedia: vi.fn(),
}));
import { SiteMediaStoreError } from '@/features/public-site/server';
import { publishOwnerSiteMedia } from '@/features/owner/server/ownerMediaCommands';
beforeEach(() => { vi.clearAllMocks(); state.upload.mockResolvedValue({ error: null }); state.remove.mockResolvedValue({ error: null }); });
const publish = () => publishOwnerSiteMedia({ actor: { userId: 'owner', email: null }, slot: 'landing.hero', alt: 'Fixture', presentation: {}, expectedUpdatedAt: 'revision', image: new File(['fixture'], 'image.png', { type: 'image/png' }) });
describe('uploaded media recovery', () => {
  it.each([new Error('Response lost'), new SiteMediaStoreError('Database unavailable', 503)])('retains uploaded bytes when persistence outcome is uncertain', async (error) => {
    state.error = error;
    await expect(publish()).rejects.toBe(error);
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.remove).not.toHaveBeenCalled();
  });
  it('removes uncommitted bytes after a proven revision conflict', async () => {
    state.error = new SiteMediaStoreError('Revision changed', 409);
    await expect(publish()).rejects.toMatchObject({ status: 409 });
    expect(state.remove).toHaveBeenCalledWith(['landing/hero/uncommitted.webp']);
  });
});
