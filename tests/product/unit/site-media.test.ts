import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SITE_MEDIA,
  getDefaultSiteMedia,
  getSiteMediaDisplaySrc,
  getSiteMediaStoragePath,
  normalizeSiteMediaPresentation,
} from '@/features/public-site/client';
import {
  MAX_SITE_MEDIA_BYTES,
  processSiteMediaImage,
  validateSiteMediaFile,
} from '@/features/public-site/server';

describe('owner-managed homepage media', () => {
  it('keeps every owner-managed public image in one explicit media catalog', () => {
    expect(DEFAULT_SITE_MEDIA.map((asset) => asset.slot)).toEqual([
      'brand.mark',
      'brand.favicon',
      'brand.watermark',
      'brand.social',
      'landing.hero',
      'landing.showcase.layout',
      'landing.showcase.generator-single',
      'landing.showcase.generator-bulk',
      'landing.showcase.art.playing.ace',
      'landing.showcase.art.playing.king',
      'landing.showcase.art.playing.queen',
      'landing.showcase.art.playing.jack',
      'landing.showcase.art.creature.emberclaw',
      'landing.showcase.art.creature.mossback',
      'landing.showcase.art.creature.moonveil',
      'landing.showcase.art.creature.stormglass',
      'founder.portrait',
    ]);
    const hero = getDefaultSiteMedia('landing.hero');
    expect(getSiteMediaDisplaySrc(hero)).toBe('/site-fallbacks/showcase/cardforge-workshop-cover.webp');
    expect(getSiteMediaDisplaySrc({ ...hero, storagePath: 'landing/hero/example.webp', updatedAt: '2026-07-21T19:30:00.000Z' }))
      .toContain('/api/public/site-media/landing.hero?v=');
    expect(getSiteMediaStoragePath('landing.hero', 'upload-id')).toBe('landing/hero/upload-id.webp');
    expect(getSiteMediaStoragePath('founder.portrait', 'upload-id')).toBe('founder/portrait/upload-id.webp');
    expect(getSiteMediaStoragePath('brand.favicon', 'upload-id')).toBe('brand/favicon/upload-id.png');
    expect(getSiteMediaDisplaySrc(getDefaultSiteMedia('founder.portrait'))).toBeNull();
    expect(hero.presentation).toMatchObject({ frame: 'wide', fit: 'cover', desktopFocalX: 62 });
    expect(getDefaultSiteMedia('landing.showcase.layout').presentation.frame).toBe('natural');
    expect(getDefaultSiteMedia('landing.showcase.layout')).toMatchObject({ width: 1119, height: 1536 });
    expect(getSiteMediaDisplaySrc(getDefaultSiteMedia('landing.showcase.art.creature.emberclaw')))
      .toBe('/site-fallbacks/showcase/creatures/emberclaw-whelp.webp');
    expect(getDefaultSiteMedia('founder.portrait').presentation.frame).toBe('portrait');
    expect(hero.previousVersion).toBeNull();
  });

  it('validates responsive presentation controls by media slot', () => {
    const layout = getDefaultSiteMedia('landing.showcase.layout');
    const valid = normalizeSiteMediaPresentation('landing.showcase.layout', {
      ...layout.presentation,
      frame: 'wide',
      fit: 'contain',
      desktopSize: 'compact',
      mobileSize: 'large',
    });
    expect(valid).toMatchObject({ ok: true, value: { frame: 'wide', fit: 'contain' } });

    expect(normalizeSiteMediaPresentation('landing.hero', {
      ...getDefaultSiteMedia('landing.hero').presentation,
      frame: 'natural',
    })).toMatchObject({ ok: false });
    expect(normalizeSiteMediaPresentation('founder.portrait', {
      ...getDefaultSiteMedia('founder.portrait').presentation,
      desktopZoom: 4,
    })).toMatchObject({ ok: false });
    expect(normalizeSiteMediaPresentation('landing.showcase.art.playing.ace', {
      ...getDefaultSiteMedia('landing.showcase.art.playing.ace').presentation,
      frame: 'wide',
    })).toMatchObject({ ok: false });
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
    const metadata = await sharp(processed.buffer).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(2400);
    expect(metadata.exif).toBeUndefined();
    expect(processed.width).toBe(metadata.width);
    expect(processed.height).toBe(metadata.height);

    const portraitSource = await sharp({
      create: { width: 2200, height: 3300, channels: 3, background: '#5f4526' },
    }).png().toBuffer();
    const portrait = await processSiteMediaImage(portraitSource, 'founder.portrait');
    expect(portrait.width).toBeLessThanOrEqual(1600);
    expect(portrait.height).toBeLessThanOrEqual(2000);

    const favicon = await processSiteMediaImage(source, 'brand.favicon');
    const faviconMetadata = await sharp(favicon.buffer).metadata();
    expect(faviconMetadata).toMatchObject({ format: 'png', width: 512, height: 512 });
  });
});
