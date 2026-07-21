import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SITE_MEDIA,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  getSiteMediaStoragePath,
} from '@/features/public-site/client';
import {
  MAX_SITE_MEDIA_BYTES,
  processSiteMediaImage,
  validateSiteMediaFile,
} from '@/features/public-site/server';

describe('owner-managed homepage media', () => {
  it('keeps four explicit homepage image slots with safe bundled fallbacks', () => {
    expect(DEFAULT_SITE_MEDIA.map((asset) => asset.slot)).toEqual([
      'landing.hero',
      'landing.showcase.layout',
      'landing.showcase.generator-single',
      'landing.showcase.generator-bulk',
    ]);
    const hero = getDefaultSiteMedia('landing.hero');
    expect(getSiteMediaDisplaySrc(hero)).toBe('/card-assets/showcase/cardforge-workshop-cover.webp');
    expect(getSiteMediaDisplaySrc({ ...hero, storagePath: 'landing/hero/example.webp', updatedAt: '2026-07-21T19:30:00.000Z' }))
      .toContain('/api/public/site-media/landing.hero?v=');
    expect(getSiteMediaStoragePath('landing.hero', 'upload-id')).toBe('landing/hero/upload-id.webp');
  });

  it('accepts declared images, bounds them, strips metadata, and emits WebP', async () => {
    expect(validateSiteMediaFile({ size: 100, type: 'image/jpeg' })).toEqual({ ok: true });
    expect(validateSiteMediaFile({ size: 100, type: 'image/png' })).toEqual({ ok: true });
    expect(validateSiteMediaFile({ size: 100, type: 'image/webp' })).toEqual({ ok: true });
    expect(validateSiteMediaFile({ size: 100, type: 'image/svg+xml' }).ok).toBe(false);
    expect(validateSiteMediaFile({ size: MAX_SITE_MEDIA_BYTES + 1, type: 'image/png' }).ok).toBe(false);

    const source = await sharp({
      create: { width: 3000, height: 3200, channels: 3, background: '#8c5b2d' },
    }).png().withMetadata({ orientation: 1 }).toBuffer();
    const processed = await processSiteMediaImage(source, 'landing.showcase.layout');
    const metadata = await sharp(processed).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(2400);
    expect(metadata.exif).toBeUndefined();
  });

  it('keeps owner authorization and successful storage ahead of publishing media state', () => {
    const route = readFileSync(join(process.cwd(), 'src/app/api/owner/site-media/[slot]/route.ts'), 'utf8');
    const panel = readFileSync(join(process.cwd(), 'src/features/owner/components/OwnerHomepageMediaPanel.tsx'), 'utf8');

    expect(route.indexOf('await getCurrentOwnerAccess()')).toBeLessThan(route.indexOf('await request.formData()'));
    expect(route.indexOf('.upload(uploadedPath')).toBeLessThan(route.indexOf('await updateSiteMedia('));
    expect(route).toContain('revalidateSiteMediaCache()');
    expect(panel).toContain('Upload and publish');
    expect(panel).toContain('AbortSignal.timeout(UPLOAD_TIMEOUT_MS)');
  });
});
