import { describe, expect, it } from 'vitest';

import {
  FIELD_CONTRACT_VERSION,
  normalizeTemplateFieldContracts,
  validateCardDataAgainstFieldContracts,
} from '@/lib/fieldContracts';
import { extractTemplateFieldDefinitions } from '@/lib/templateFields';
import type { TCGCardTemplate } from '@/types';

describe('field contract v1 helpers', () => {
  it('exposes the current contract version as a stable schema marker', () => {
    expect(FIELD_CONTRACT_VERSION).toBe(1);
  });

  it('validates required fields, max length, image sources, and formatting permissions', () => {
    const fields = extractTemplateFieldDefinitions({
      id: 'validation-template',
      name: 'Validation Template',
      aspectRatio: '63:88',
      fieldContracts: [
        { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 8 },
        { key: 'rulesText', label: 'Rules', type: 'rules', required: false, allowedFormatting: ['bold'] },
        { key: 'artworkUrl', label: 'Artwork', type: 'image', required: true },
      ],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          { id: 'name-text', type: 'text', name: 'Name', x: 0, y: 0, width: 200, height: 40, zIndex: 1, content: '{{name}}' },
          { id: 'rules-text', type: 'text', name: 'Rules', x: 0, y: 50, width: 200, height: 120, zIndex: 2, content: '{{rulesText}}' },
          { id: 'art', type: 'image', name: 'Artwork', x: 0, y: 180, width: 200, height: 200, zIndex: 3, imageSource: '{{artworkUrl}}' },
        ],
      },
    });

    const result = validateCardDataAgainstFieldContracts(fields, {
      name: 'Overlong Name',
      rulesText: '<mark>Highlighted</mark>',
      artworkUrl: 'not-an-image-source',
    });

    expect(result).toEqual({
      issues: [],
      warnings: [
        'Name is 13 characters; maximum is 8.',
        'Rules contains highlight formatting, but the field contract allows only bold.',
        'Artwork is not a URL/data URI and may not render.',
      ],
    });
  });

  it('can normalize inferred template fields into explicit v1 contracts', () => {
    const template: TCGCardTemplate = {
      id: 'repair-template',
      name: 'Repair Template',
      aspectRatio: '63:88',
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          { id: 'name-text', type: 'text', name: 'Name', x: 0, y: 0, width: 200, height: 40, zIndex: 1, content: '{{cardName:"Ashen Crown"}}' },
          { id: 'rules-text', type: 'text', name: 'Rules', x: 0, y: 50, width: 200, height: 120, zIndex: 2, content: '{{rulesText:"Deal 1 damage."}}' },
        ],
      },
    };

    const normalized = normalizeTemplateFieldContracts(template);

    expect(normalized.fieldContracts).toEqual([
      expect.objectContaining({
        key: 'cardName',
        elementId: 'name-text',
        label: 'Card Name',
        type: 'richText',
        required: true,
        defaultValue: 'Ashen Crown',
        allowedFormatting: ['bold', 'italic', 'underline', 'color', 'highlight', 'lists'],
      }),
      expect.objectContaining({
        key: 'rulesText',
        elementId: 'rules-text',
        label: 'Rules Text',
        type: 'rules',
        defaultValue: 'Deal 1 damage.',
        allowedFormatting: ['bold', 'italic', 'underline', 'color', 'highlight', 'lists', 'rulesMarkers'],
      }),
    ]);
  });
});
