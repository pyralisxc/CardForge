import { describe, expect, it } from 'vitest';

import { getExportProfile, validateCardExportQuality } from '@/lib/printValidation';
import type { DisplayCard, TCGCardTemplate } from '@/types';

const baseTemplate: TCGCardTemplate = {
  id: 'template-1',
  name: 'Template',
  aspectRatio: '63:88',
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [
      {
        id: 'text-1',
        type: 'text',
        name: 'Rules',
        x: 10,
        y: 10,
        width: 300,
        height: 120,
        zIndex: 1,
        content: '{{rulesText:"Deal 1 damage."}}',
        fontFamily: 'font-sans',
      },
      {
        id: 'image-1',
        type: 'image',
        name: 'Artwork',
        x: 10,
        y: 150,
        width: 300,
        height: 300,
        zIndex: 2,
        content: 'artworkUrl',
        imageSource: 'artworkUrl',
      },
    ],
  },
};

const makeCard = (data: Record<string, string>): DisplayCard => ({
  uniqueId: 'card-1',
  template: baseTemplate,
  data,
});

describe('print validation', () => {
  it('provides profile defaults for physical and virtual exports', () => {
    expect(getExportProfile('physical')).toMatchObject({ dpi: 300, renderWidthPx: 744, canvasPixelRatio: 3, colorSpace: 'rgb', recommendedFormat: 'png' });
    expect(getExportProfile('virtual')).toMatchObject({ dpi: 150, renderWidthPx: 372, canvasPixelRatio: 2, colorSpace: 'rgb', recommendedFormat: 'png' });
  });

  it('supports configurable dpi while preserving profile semantics', () => {
    expect(getExportProfile('physical', 600)).toMatchObject({ dpi: 600, canvasPixelRatio: 3 });
    expect(getExportProfile('virtual', 96)).toMatchObject({ dpi: 96, canvasPixelRatio: 1 });
  });

  it('blocks physical exports when placeholders are used', () => {
    const card = makeCard({ rulesText: 'Text', artworkUrl: 'https://placehold.co/600x400.png?text=Artwork' });
    const validation = validateCardExportQuality(card, 'physical');

    expect(validation.critical.some((message) => message.includes('placeholder'))).toBe(true);
  });

  it('downgrades placeholder checks to warnings in virtual mode', () => {
    const card = makeCard({ rulesText: 'Text', artworkUrl: 'https://placehold.co/600x400.png?text=Artwork' });
    const validation = validateCardExportQuality(card, 'virtual');

    expect(validation.critical.some((message) => message.includes('placeholder'))).toBe(false);
    expect(validation.warnings.some((message) => message.includes('placeholder'))).toBe(true);
  });

  it('treats missing required text fields as warnings, not blockers', () => {
    const card = makeCard({ rulesText: '', artworkUrl: 'https://example.com/image.png' });
    const validation = validateCardExportQuality(card, 'physical');

    expect(validation.critical.some((message) => message.includes('is required'))).toBe(false);
    expect(validation.warnings.some((message) => message === 'Rules Text is required.')).toBe(true);
  });

  it('warns when physical export DPI is below print standard', () => {
    const card = makeCard({ rulesText: 'Text', artworkUrl: 'https://example.com/image.png' });
    const validation = validateCardExportQuality(card, 'physical', 150);

    expect(validation.warnings.some((message) => message.includes('at least 300 DPI'))).toBe(true);
  });

  it('warns when text content sits inside the physical safe area', () => {
    const card = makeCard({ rulesText: 'Text', artworkUrl: 'https://example.com/image.png' });
    const validation = validateCardExportQuality(card, 'physical');

    expect(validation.warnings.some((message) => message.includes('inside the print safe area'))).toBe(true);
  });

  it('uses field contract validation for export quality warnings', () => {
    const template: TCGCardTemplate = {
      ...baseTemplate,
      fieldContracts: [
        {
          key: 'rulesText',
          label: 'Rules',
          type: 'rules',
          required: true,
          maxLength: 8,
          allowedFormatting: ['bold'],
        },
        {
          key: 'artworkUrl',
          label: 'Artwork',
          type: 'image',
          required: true,
        },
      ],
    };
    const card: DisplayCard = {
      uniqueId: 'card-contract-export',
      template,
      data: {
        rulesText: '<mark>Too much text</mark>',
        artworkUrl: 'local-file.png',
      },
    };

    const validation = validateCardExportQuality(card, 'virtual');

    expect(validation.warnings).toContain('Rules is 26 characters; maximum is 8.');
    expect(validation.warnings).toContain('Rules contains highlight formatting, but the field contract allows only bold.');
    expect(validation.warnings).toContain('Artwork is not a URL/data URI and may not render.');
  });
});
