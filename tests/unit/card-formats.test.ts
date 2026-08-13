import { describe, expect, it } from 'vitest';

import {
  CARD_FORMATS,
  areTemplateFormatsCompatible,
  getCardFormatMeasurement,
  getCompatibleCardBacks,
  resolveTemplateCardFormat,
} from '@/domain/card-formats';
import { getCardPhysicalSizeMm } from '@/domain/rendering';
import { reconstructMinimalTemplateObject, type TCGCardTemplate } from '@/domain/templates';
import {
  buildCardFormatTemplateUpdate,
  buildCustomDimensionTemplateUpdate,
} from '@/features/template-editor/lib/makerDimensions';
import { makeNewFreeformTemplate } from '@/features/template-editor/lib/makerTemplateFactory';

const makeCard = (template: TCGCardTemplate) => ({
  uniqueId: 'card-1',
  template,
  data: {},
});

describe('card format ownership', () => {
  it('defines the supported standard formats with physical and canvas dimensions', () => {
    expect(CARD_FORMATS.map((format) => format.id)).toEqual([
      'poker',
      'bridge',
      'tarot',
      'us-business',
      'event-badge',
      'ttrpg-reference',
    ]);

    const poker = CARD_FORMATS[0];
    expect(getCardFormatMeasurement(poker, 'mm')).toMatchObject({ width: 63, height: 88, suffix: 'mm' });
    expect(getCardFormatMeasurement(poker, 'in')).toMatchObject({ width: 2.48, height: 3.46, suffix: 'in' });
    expect(getCardFormatMeasurement(poker, 'px')).toMatchObject({ width: 630, height: 880, suffix: 'px' });

    const ttrpgSheet = CARD_FORMATS.find((format) => format.id === 'ttrpg-reference');
    expect(ttrpgSheet).toMatchObject({
      label: 'TTRPG sheet (US Letter)',
      widthMm: 215.9,
      heightMm: 279.4,
      canvasWidthPx: 850,
      canvasHeightPx: 1100,
    });
  });

  it('normalizes legacy shipped formats without changing their authored canvas', () => {
    const business = reconstructMinimalTemplateObject({
      id: 'default-name-card-theme',
      name: 'Name Card Theme',
      aspectRatio: '35:20',
      freeformCanvas: { width: 1050, height: 600, elements: [] },
    });
    const badge = reconstructMinimalTemplateObject({
      id: 'default-event-badge-theme',
      name: 'Event Badge Theme',
      aspectRatio: '3:4',
      freeformCanvas: { width: 750, height: 1000, elements: [] },
    });

    expect(business).toMatchObject({
      formatId: 'us-business',
      trimWidthMm: 88.9,
      trimHeightMm: 50.8,
      freeformCanvas: { width: 1050, height: 600 },
    });
    expect(badge).toMatchObject({
      formatId: 'event-badge',
      trimWidthMm: 75,
      trimHeightMm: 100,
      freeformCanvas: { width: 750, height: 1000 },
    });
  });

  it('uses canonical physical trim sizes for export instead of interpreting legacy ratios as millimeters', () => {
    const business = reconstructMinimalTemplateObject({
      id: 'business',
      name: 'Business',
      aspectRatio: '35:20',
      freeformCanvas: { width: 1050, height: 600, elements: [] },
    });

    expect(getCardPhysicalSizeMm(makeCard(business))).toEqual({ widthMm: 88.9, heightMm: 50.8 });
  });

  it('matches backs by canonical trim size and excludes cross-format backs', () => {
    const front = reconstructMinimalTemplateObject({ id: 'front', name: 'Front', formatId: 'poker' });
    const matchingBack = reconstructMinimalTemplateObject({
      id: 'poker-back',
      name: 'Poker Back',
      formatId: 'poker',
      templateUsage: 'back-preset',
    });
    const tarotBack = reconstructMinimalTemplateObject({
      id: 'tarot-back',
      name: 'Tarot Back',
      formatId: 'tarot',
      templateUsage: 'back-preset',
    });

    expect(areTemplateFormatsCompatible(front, matchingBack)).toBe(true);
    expect(areTemplateFormatsCompatible(front, tarotBack)).toBe(false);
    expect(getCompatibleCardBacks(front, [matchingBack, tarotBack])).toEqual([matchingBack]);
  });

  it('preserves explicit custom trim dimensions while deriving a stable canvas format', () => {
    const resolved = resolveTemplateCardFormat({
      formatId: 'custom',
      trimWidthMm: 100,
      trimHeightMm: 150,
      aspectRatio: '2:3',
      freeformCanvas: { width: 1000, height: 1500 },
    });

    expect(resolved).toMatchObject({
      formatId: 'custom',
      widthMm: 100,
      heightMm: 150,
      canvasWidthPx: 1000,
      canvasHeightPx: 1500,
    });
  });

  it('accepts custom measurements in millimeters, inches, or canvas pixels', () => {
    const template = reconstructMinimalTemplateObject({ id: 'custom-source', name: 'Custom source', formatId: 'poker' });

    expect(buildCustomDimensionTemplateUpdate({
      widthValue: '2.5',
      heightValue: '3.5',
      unit: 'in',
      template,
    })).toMatchObject({
      formatId: 'custom',
      trimWidthMm: 63.5,
      trimHeightMm: 88.9,
    });

    expect(buildCustomDimensionTemplateUpdate({
      widthValue: '630',
      heightValue: '880',
      unit: 'px',
      template,
    })).toMatchObject({
      formatId: 'custom',
      trimWidthMm: 63,
      trimHeightMm: 88,
      freeformCanvas: { width: 630, height: 880 },
    });
  });

  it('resizes into standard formats without distorting element proportions', () => {
    const source = reconstructMinimalTemplateObject({
      id: 'square-source',
      name: 'Square source',
      formatId: 'custom',
      trimWidthMm: 100,
      trimHeightMm: 100,
      freeformCanvas: {
        width: 1000,
        height: 1000,
        elements: [{
          id: 'element',
          type: 'shape',
          name: 'Element',
          x: 100,
          y: 100,
          width: 400,
          height: 200,
          zIndex: 1,
        }],
      },
    });

    const update = buildCardFormatTemplateUpdate({
      formatId: 'poker',
      resizeStrategy: 'fit',
      template: source,
    });
    const element = update.freeformCanvas?.elements[0];
    expect(update).toMatchObject({ formatId: 'poker', trimWidthMm: 63, trimHeightMm: 88 });
    expect(update.freeformCanvas).toMatchObject({ width: 630, height: 880 });
    expect(Number(element?.width) / Number(element?.height)).toBe(2);
    expect(element?.x).toBe(63);
    expect(element?.y).toBe(188);
  });

  it('creates a named standard design and a correctly oriented branded back', () => {
    const front = makeNewFreeformTemplate({
      name: 'Moonlit tarot',
      formatId: 'tarot',
      startingPoint: 'starter',
    });
    const back = makeNewFreeformTemplate({
      name: 'Guild business back',
      templateUsage: 'back-preset',
      formatId: 'us-business',
      startingPoint: 'branded-back',
      brandedBackTemplate: reconstructMinimalTemplateObject({
        id: 'pipeline-us-business-back',
        name: 'Pipeline business back',
        aspectRatio: '3.5:2',
        formatId: 'us-business',
        templateSource: 'default',
        templateLibrarySource: 'pipeline',
        templateRegistryStatus: 'published',
        templateUsage: 'back-preset',
        cardBackgroundImageUrl: 'https://assets.cardforges.com/back-business.webp',
        fieldContracts: [
          { key: 'guildName', label: 'Guild name', type: 'text', required: false, elementId: 'guild-name' },
        ],
        freeformCanvas: {
          width: 1050,
          height: 600,
          elements: [
            {
              id: 'guild-name',
              type: 'text',
              name: 'Guild name',
              x: 225,
              y: 250,
              width: 600,
              height: 80,
              zIndex: 1,
              content: '{{guildName}}',
            },
          ],
        },
      }),
    });

    expect(front).toMatchObject({
      name: 'Moonlit tarot',
      formatId: 'tarot',
      trimWidthMm: 70,
      trimHeightMm: 120,
      freeformCanvas: { width: 700, height: 1200 },
    });
    expect(back).toMatchObject({
      name: 'Guild business back',
      formatId: 'us-business',
      templateUsage: 'back-preset',
      cardBackgroundImageUrl: 'https://assets.cardforges.com/back-business.webp',
      fieldContracts: [{ key: 'guildName', elementId: 'guild-name' }],
      freeformCanvas: {
        width: 1050,
        height: 600,
        elements: [{ id: 'guild-name', content: '{{guildName}}' }],
      },
    });
  });
});
