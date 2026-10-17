import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { CARDFORGE_EXAMPLES } from '@/features/public-site/client';
import { CARD_FORMATS } from '@/domain/card-formats';
import { ArtifactThumbnail, CardPreview, TemplateThumbnail } from '@/features/card-rendering/client';
import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';
import type { DisplayCard } from '@/domain/rendering';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';

interface ShippedTemplate {
  id: string;
  formatId?: string;
  templateUsage?: string;
  trimWidthMm?: number;
  trimHeightMm?: number;
  cardBackgroundImageUrl?: string;
  fieldContracts?: Array<{ key?: string; type?: string; elementId?: string }>;
  freeformCanvas?: {
    elements?: Array<{
      id?: string;
      type?: string;
      imageSource?: string;
      content?: string;
      backgroundImageUrl?: string;
    }>;
  };
}

const readTemplate = (filename: string): ShippedTemplate => JSON.parse(
  readFileSync(join(process.cwd(), 'data/pipeline-bootstrap/templates', filename), 'utf8'),
) as ShippedTemplate;

const findExample = (templateId: string) => {
  const example = CARDFORGE_EXAMPLES.find((candidate) => candidate.frontTemplateId === templateId);
  expect(example, `Expected a public example for ${templateId}`).toBeDefined();
  return example!;
};

describe('showcase templates', () => {
  it('turns the playing-card center into unique artwork with an optional title', () => {
    const template = readTemplate('default-playing-card-theme.json');
    const contracts = new Map(template.fieldContracts?.map((field) => [field.key, field]));
    const elements = new Map(template.freeformCanvas?.elements?.map((element) => [element.id, element]));

    expect(contracts.get('Artwork')).toMatchObject({ type: 'image', elementId: 'pc-center-artwork' });
    expect(contracts.get('CardTitle')).toMatchObject({ type: 'text', elementId: 'pc-card-title' });
    expect(elements.get('pc-center-artwork')).toMatchObject({ type: 'image', imageSource: 'Artwork' });
    expect(elements.get('pc-card-title')?.content).toContain('{{CardTitle:');
    expect(elements.has('pc-center')).toBe(false);
    expect(JSON.stringify(template)).not.toContain('CenterMark');
    expect(JSON.stringify(template)).not.toContain('\\"?\\"');
    expect(['pc-top-rank', 'pc-top-suit', 'pc-bottom-rank', 'pc-bottom-suit'].every((id) => elements.has(id))).toBe(true);

    const example = findExample(template.id);
    expect(example.rows).toHaveLength(4);
    expect(new Set(example.rows.map((row) => row.Artwork)).size).toBe(4);
    expect(example.rows.every((row) => row.Artwork.startsWith('/api/public/site-media/landing.showcase.art.playing.'))).toBe(true);
    expect(example.rows.every((row) => row.CardTitle.trim().length > 0)).toBe(true);
  });

  it('publishes a four-card creature set with unique artwork and complete card data', () => {
    const template = readTemplate('default-mtg-theme.json');
    const example = findExample(template.id);

    expect(example.rows).toHaveLength(4);
    expect(new Set(example.rows.map((row) => row.Artwork)).size).toBe(4);
    expect(example.rows.every((row) => row.Artwork.startsWith('/api/public/site-media/landing.showcase.art.creature.'))).toBe(true);
    for (const row of example.rows) {
      for (const key of ['CardName', 'TypeLine', 'Ability', 'Power', 'Toughness']) {
        expect(row[key]?.trim(), `${key} should be populated`).not.toBe('');
      }
    }
  });

  it('uses role color as a real event-pass template field across four variants', () => {
    const template = readTemplate('default-event-badge-theme.json');
    const contracts = new Map(template.fieldContracts?.map((field) => [field.key, field]));
    const elements = template.freeformCanvas?.elements ?? [];

    expect(contracts.get('RoleColor')).toMatchObject({ type: 'text', elementId: 'badge-role-accent' });
    expect(elements.find((element) => element.id === 'badge-role-accent')?.backgroundImageUrl).toContain('{{RoleColor:');

    const example = findExample(template.id);
    expect(example.rows).toHaveLength(4);
    expect(new Set(example.rows.map((row) => row.RoleColor)).size).toBe(4);
    expect(example.rows.every((row) => /^#[0-9a-f]{6}$/i.test(row.RoleColor))).toBe(true);
  });

  it('ships an official CardForge Studio back for every standard card format', () => {
    const filenames = readdirSync(join(process.cwd(), 'data/pipeline-bootstrap/templates'))
      .filter((filename) => filename.startsWith('default-cardforge-studio-back-'));
    const backs = filenames.map(readTemplate);

    expect(backs).toHaveLength(CARD_FORMATS.length);
    for (const format of CARD_FORMATS) {
      const back = backs.find((candidate) => candidate.formatId === format.id);
      expect(back, `Expected a CardForge Studio back for ${format.id}`).toMatchObject({
        templateUsage: 'back-preset',
        trimWidthMm: format.widthMm,
        trimHeightMm: format.heightMm,
      });
      const imagePath = back?.cardBackgroundImageUrl?.replace(/^bootstrap-media:\/\//, '');
      expect(imagePath && existsSync(join(process.cwd(), 'data/pipeline-bootstrap/media', imagePath))).toBe(true);
    }
  });

  it('renders branded-back thumbnails from their real artwork and orientation', () => {
    const landscapeBack = makeNewFreeformTemplate({
      name: 'CardForge Studio business back',
      templateUsage: 'back-preset',
      formatId: 'us-business',
      startingPoint: 'branded-back',
      brandedBackTemplate: {
        ...readTemplate('default-cardforge-studio-back-us-business.json'),
        cardBackgroundImageUrl: '/site-fallbacks/showcase/cardforge-workshop-cover.webp',
        name: 'CardForge Studio business back',
        aspectRatio: '3.5:2',
        templateSource: 'default',
        templateLibrarySource: 'pipeline',
        templateRegistryStatus: 'published',
      } as TCGCardTemplate,
    });

    const html = renderToStaticMarkup(createElement(TemplateThumbnail, { template: landscapeBack }));

    expect(html).toContain('cardforge-workshop-cover.webp');
    expect(html).toContain('background-size:100% 100%');
    expect(html).toContain('width:112px');
    expect(html).not.toContain('CF</span>');
  });
});

describe('authored back background projections', () => {
  const source = 'https://cdn.example.test/original-back.webp';
  const back = (overrides: Partial<TCGCardTemplate> = {}) => reconstructMinimalTemplateObject({
    id: 'contained-back', name: 'Contained Back', aspectRatio: '57:89', frameStyle: 'freeform',
    baseBackgroundColor: '#05030a', cardBorderWidth: '0px',
    freeformCanvas: { width: 570, height: 890, gridSize: 10, elements: [] },
    appearance: { assetSource: source, assetKind: 'frame', assetRenderMode: 'original', tileMode: 'contain', material: { baseColor: '#05030a', texture: { kind: 'none' } } },
    ...overrides,
  });
  const cardFor = (template: TCGCardTemplate): DisplayCard => ({ uniqueId: 'back-card', template, backingTemplate: null, backingTemplateId: null, data: {} });
  const backgrounds = (html: string) => [...html.matchAll(/style="([^"]*)"/gu)].map(match => match[1]).filter(style => style.includes('background-image:'));
  const surfaces = (template: TCGCardTemplate) => {
    const card = cardFor(template);
    return [
      renderToStaticMarkup(createElement(CardPreview, { card })),
      renderToStaticMarkup(createElement(TemplateThumbnail, { template })),
      renderToStaticMarkup(createElement(ArtifactThumbnail, { card, width: 57, height: 89, showImage: true })),
    ];
  };

  it.each([undefined, ''])('preserves one unchanged contained source across native surfaces with legacy background %s', (legacy) => {
    const template = { ...back(), cardBackgroundImageUrl: legacy };
    const before = JSON.stringify(template);
    for (const html of surfaces(template)) {
      const imageStyles = backgrounds(html);
      expect(imageStyles).toHaveLength(1);
      expect(imageStyles[0]).toContain(`background-image:url(${source})`);
      expect(imageStyles[0]).toContain('background-size:contain');
      expect(imageStyles[0]).toContain('background-repeat:no-repeat');
      expect(imageStyles[0]).toContain('background-position:center');
      expect(html.split(source)).toHaveLength(2);
    }
    expect(JSON.stringify(template)).toBe(before);
  });

  it('preserves appearance layer order and matching fit lists in each native surface', () => {
    const template = back({ appearance: {
      assetSource: source, tileMode: 'contain',
      material: {
        texture: { kind: 'uploaded', assetSource: 'https://cdn.example.test/texture.webp', tileMode: 'repeat', textureScale: 72 },
        gradient: { type: 'linear', stops: [{ id: 'start', color: '#000000', position: 0 }, { id: 'end', color: '#ffffff', position: 100 }] },
      },
      rawCss: { backgroundImage: 'radial-gradient(red, blue)' },
    } });
    for (const html of surfaces(template)) {
      const imageStyles = backgrounds(html);
      expect(imageStyles).toHaveLength(1);
      expect(imageStyles[0]).toContain(`background-image:url(${source}), url(https://cdn.example.test/texture.webp), linear-gradient(135deg, #000000 0%, #ffffff 100%), radial-gradient(red, blue)`);
      expect(imageStyles[0]).toContain('background-size:contain, 72px 72px, auto, auto');
      expect(imageStyles[0]).toContain('background-repeat:no-repeat, repeat, repeat, repeat');
      expect(imageStyles[0]).toContain('background-position:center, 0% 0%, 0% 0%, 0% 0%');
    }
  });

  it('retains explicit legacy source precedence and the existing surface-specific legacy fit', () => {
    const legacy = 'https://cdn.example.test/legacy-back.webp';
    const template = back({ cardBackgroundImageUrl: legacy });
    const [canonical, thumbnail, artifact] = surfaces(template).map(html => backgrounds(html)[0]);
    expect(thumbnail).toContain(`background-image:url(${legacy});`);
    expect(thumbnail).not.toContain(source);
    expect(thumbnail).toContain('background-size:100% 100%');
    for (const style of [canonical, artifact]) {
      expect(style).toContain(`background-image:url(${legacy}), url(${source})`);
      expect(style).toContain('background-size:cover');
      expect(style).toContain('background-repeat:no-repeat');
      expect(style).toContain('background-position:center');
    }
  });

  it('does not duplicate a legacy image synthesized by appearance normalization in thumbnails', () => {
    const template = back({ cardBackgroundImageUrl: source, appearance: undefined });
    expect(template.appearance?.material?.texture?.imageSource).toBe(source);
    const card = cardFor(template);
    for (const html of [
      renderToStaticMarkup(createElement(TemplateThumbnail, { template })),
      renderToStaticMarkup(createElement(ArtifactThumbnail, { card, width: 57, height: 89, showImage: true })),
    ]) expect(html.split(source)).toHaveLength(2);
  });

  it('treats whitespace-only legacy values as absent in thumbnails', () => {
    const template = { ...back(), cardBackgroundImageUrl: ' \t ' };
    const card = cardFor(template);
    for (const html of [
      renderToStaticMarkup(createElement(TemplateThumbnail, { template })),
      renderToStaticMarkup(createElement(ArtifactThumbnail, { card, width: 57, height: 89, showImage: true })),
    ]) {
      expect(backgrounds(html)).toHaveLength(1);
      expect(backgrounds(html)[0]).toContain(`background-image:url(${source})`);
      expect(backgrounds(html)[0]).toContain('background-size:contain');
    }
  });

  it('preserves legacy raw CSS thumbnail fit without resolving or duplicating deferred URL layers', () => {
    const rawBackground = `linear-gradient(red, blue), url(${source})`;
    const template = back({ appearance: { rawCss: { backgroundImage: rawBackground } } });
    const card = cardFor(template);
    const thumbnail = renderToStaticMarkup(createElement(TemplateThumbnail, { template }));
    expect(backgrounds(thumbnail)[0]).toContain(`background-image:${rawBackground}`);
    expect(backgrounds(thumbnail)[0]).toContain('background-size:100% 100%');
    const artifact = renderToStaticMarkup(createElement(ArtifactThumbnail, { card, width: 57, height: 89, showImage: true }));
    expect(artifact.split(source)).toHaveLength(2);
    expect(backgrounds(artifact)).toHaveLength(1);
    const deferred = renderToStaticMarkup(createElement(ArtifactThumbnail, { card, width: 57, height: 89, showImage: false }));
    expect(deferred).not.toContain(source);
  });

  it('keeps image-element hero previews image-led and cover fitted', () => {
    const template = back();
    template.freeformCanvas!.elements = [{ id: 'hero', name: 'Hero', type: 'image', x: 0, y: 0, width: 500, height: 400, zIndex: 1, content: '{{Artwork}}', imageSource: '{{Artwork}}', imageObjectFit: 'contain' }];
    const card = { ...cardFor(template), data: { Artwork: 'https://cdn.example.test/hero.webp' } };
    const html = renderToStaticMarkup(createElement(ArtifactThumbnail, { card, width: 57, height: 89, showImage: true }));
    expect(html).toContain('src="https://cdn.example.test/hero.webp"');
    expect(html).toContain('object-fit:cover;object-position:center');
    expect(backgrounds(html)[0]).toContain('background-size:contain');
  });
});
