import { describe, expect, it } from 'vitest';

import type { TCGCardTemplate } from '@/domain/templates';
import type { DisplayCard } from '@/domain/rendering';
import { createPrintProductionPreflight } from '@/features/card-generator/lib/printProductionPreflight';

const baseTemplate: TCGCardTemplate = {
  id: 'print-template',
  name: 'Print Template',
  aspectRatio: '63:88',
  fieldContracts: [
    {
      key: 'artworkUrl',
      label: 'Artwork',
      type: 'image',
      required: false,
    },
  ],
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [],
  },
};

const makeCard = (overrides: Partial<DisplayCard> = {}): DisplayCard => ({
  uniqueId: overrides.uniqueId ?? 'card-1',
  data: overrides.data ?? { artworkUrl: 'https://example.com/art.png' },
  template: overrides.template ?? baseTemplate,
  backingTemplate: overrides.backingTemplate,
  backingTemplateId: overrides.backingTemplateId ?? overrides.backingTemplate?.id ?? null,
});

describe('print production preflight', () => {
  it('separates CardForge production preparation from unresolved press-standard readiness', () => {
    const report = createPrintProductionPreflight([makeCard()], 300);

    expect(report).toMatchObject({
      format: 'cardforge-print-preflight-v1',
      cardCount: 1,
      faceCount: 1,
      requestedDpi: 300,
      effectivePixelsPerInch: 900,
      productionPrepared: true,
      pressReady: false,
      colorManagement: {
        sourceColorSpace: 'rgb',
        outputIntent: null,
        pressStandard: null,
      },
      issueSummary: {
        blockers: 0,
        standardsGaps: 1,
      },
    });
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: 'standards.output_intent_missing',
      severity: 'standards-gap',
    }));
  });

  it('blocks placeholder artwork from a production-prepared package', () => {
    const report = createPrintProductionPreflight([
      makeCard({ data: { artworkUrl: 'https://placehold.co/600x400.png?text=Artwork' } }),
    ], 300);

    expect(report.productionPrepared).toBe(false);
    expect(report.pressReady).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: 'content.export_blocker',
      severity: 'blocker',
      message: expect.stringMatching(/placeholder/i),
    }));
  });

  it('blocks output below 300 effective pixels per inch', () => {
    const report = createPrintProductionPreflight([makeCard()], 72);

    expect(report.effectivePixelsPerInch).toBe(72);
    expect(report.productionPrepared).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: 'resolution.below_300_ppi',
      severity: 'blocker',
    }));
  });

  it('blocks mismatched front/back physical geometry for a duplex production pair', () => {
    const report = createPrintProductionPreflight([
      makeCard({
        backingTemplate: {
          id: 'business-back',
          name: 'Mismatched Back',
          aspectRatio: '35:20',
          templateUsage: 'back-preset',
          freeformCanvas: { width: 1050, height: 600, elements: [] },
        },
      }),
    ], 300);

    expect(report.faceCount).toBe(2);
    expect(report.productionPrepared).toBe(false);
    expect(report.issues).toContainEqual(expect.objectContaining({
      code: 'geometry.duplex_mismatch',
      severity: 'blocker',
    }));
  });

  it('is deterministic for the same set and quality inputs', () => {
    const cards = [makeCard()];
    expect(createPrintProductionPreflight(cards, 300)).toEqual(
      createPrintProductionPreflight(cards, 300),
    );
  });
});
