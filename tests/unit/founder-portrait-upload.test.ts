import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  MAX_FOUNDER_PORTRAIT_BYTES,
  processFounderPortrait,
  validateFounderPortraitFile,
} from '@/features/public-site/server/founderPortrait';

describe('founder portrait upload', () => {
  it('accepts only declared JPEG, PNG, and WebP files within eight megabytes', () => {
    expect(validateFounderPortraitFile({ size: 100, type: 'image/jpeg' })).toEqual({ ok: true });
    expect(validateFounderPortraitFile({ size: 100, type: 'image/png' })).toEqual({ ok: true });
    expect(validateFounderPortraitFile({ size: 100, type: 'image/webp' })).toEqual({ ok: true });
    expect(validateFounderPortraitFile({ size: 100, type: 'image/svg+xml' }).ok).toBe(false);
    expect(validateFounderPortraitFile({ size: MAX_FOUNDER_PORTRAIT_BYTES + 1, type: 'image/png' }).ok).toBe(false);
    expect(validateFounderPortraitFile({ size: 0, type: 'image/png' }).ok).toBe(false);
  });

  it('auto-orients, bounds dimensions without enlargement, strips metadata, and emits WebP', async () => {
    const oversized = await sharp({
      create: { width: 1800, height: 2700, channels: 3, background: '#8c5b2d' },
    }).png().withMetadata({ orientation: 1 }).toBuffer();

    const processed = await processFounderPortrait(oversized);
    const metadata = await sharp(processed).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(2000);
    expect(metadata.exif).toBeUndefined();

    const small = await sharp({
      create: { width: 120, height: 160, channels: 3, background: '#8c5b2d' },
    }).png().toBuffer();
    const smallMetadata = await sharp(await processFounderPortrait(small)).metadata();
    expect(smallMetadata.width).toBe(120);
    expect(smallMetadata.height).toBe(160);
  });

  it('rejects undecodable image bytes', async () => {
    await expect(processFounderPortrait(Buffer.from('not-an-image'))).rejects.toThrow('valid image');
  });

  it('keeps authorization and Storage success ahead of the profile mutation', () => {
    const route = readFileSync(
      join(process.cwd(), 'src/app/api/owner/founder-profile/portrait/route.ts'),
      'utf8',
    );

    expect(route.indexOf('await getCurrentOwnerAccess()')).toBeLessThan(route.indexOf('await request.formData()'));
    expect(route).toContain(".from(FOUNDER_PORTRAIT_BUCKET)");
    expect(route).toContain(".upload(FOUNDER_PORTRAIT_PATH");
    expect(route).toContain('upsert: true');
    expect(route.indexOf('if (uploadError)')).toBeLessThan(route.indexOf('await updateFounderProfile('));

    const panel = readFileSync(
      join(process.cwd(), 'src/features/owner/components/OwnerFounderProfilePanel.tsx'),
      'utf8',
    );
    expect(panel).toContain('AbortSignal.timeout(PORTRAIT_UPLOAD_TIMEOUT_MS)');
    expect(panel).toContain('This upload took too long.');
  });
});
