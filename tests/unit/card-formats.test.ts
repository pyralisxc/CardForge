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
import { buildCustomDimensionTemplateUpdate } from '@/features/template-editor/lib/makerDimensions';

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
});
