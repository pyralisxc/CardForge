import { describe, expect, it } from 'vitest';

import {
  FIELD_CONTRACT_VERSION,
  normalizeTemplateFieldContracts,
  validateCardDataAgainstFieldContracts,
} from '@/domain/templates';
import { extractTemplateFieldDefinitions } from '@/domain/templates';
import type { TCGCardTemplate } from '@/domain/templates';

describe('field contract v1 helpers', () => {
  it('keeps persisted browser artwork structural and removes only its stale synthesized contract', () => {
    const source = `cardforge-browser-asset://${'a'.repeat(64)}`;
    const template: TCGCardTemplate = {
      id: 'browser-art', name: 'Browser art', aspectRatio: '63:88',
      freeformCanvas: { width: 630, height: 880, elements: [
        { id: 'art', type: 'image', name: 'Image Layer', x: 0, y: 0, width: 220, height: 160, zIndex: 1, imageSource: source, content: 'artworkUrl' },
      ] },
      fieldContracts: [{ key: 'image_image_layer_art', type: 'image', defaultValue: source }],
    };
    const normalized = normalizeTemplateFieldContracts(template);
    expect(normalized.fieldContracts).toEqual([]);
    expect(extractTemplateFieldDefinitions(normalized)).toEqual([]);
    expect(normalized.freeformCanvas?.elements[0]?.imageSource).toBe(source);
    const explicit = normalizeTemplateFieldContracts({ ...template, fieldContracts: [{ key: 'hero', type: 'image', elementId: 'art' }] });
    const fields = extractTemplateFieldDefinitions(explicit);
    expect(fields.map((field) => field.key)).toEqual(['hero']);
    expect(validateCardDataAgainstFieldContracts(fields, { hero: source })).toEqual({ issues: [], warnings: [] });
  });

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
        { key: 'rulesText', label: 'Rules', type: 'text', required: false, allowedFormatting: ['bold'] },
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
        type: 'text',
        required: true,
        defaultValue: 'Ashen Crown',
        allowedFormatting: ['bold', 'italic', 'underline', 'color', 'highlight', 'lists', 'rulesMarkers'],
      }),
      expect.objectContaining({
        key: 'rulesText',
        elementId: 'rules-text',
        label: 'Rules Text',
        type: 'text',
        defaultValue: 'Deal 1 damage.',
        allowedFormatting: ['bold', 'italic', 'underline', 'color', 'highlight', 'lists', 'rulesMarkers'],
      }),
    ]);
  });

  it('does not turn a locked fixed-source frame into a per-card image field', () => {
    const template: TCGCardTemplate = {
      id: 'locked-frame-template',
      name: 'Locked Frame Template',
      aspectRatio: '63:88',
      fieldContracts: [{
        key: 'image_premium_frame_overlay_locked_frame_overlay',
        label: 'Image Premium Frame Overlay Locked Frame Overlay',
        type: 'image',
        required: false,
        defaultValue: '/frames/premium.webp',
        allowedFormatting: [],
      }],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          { id: 'art', type: 'image', name: 'Artwork', x: 0, y: 0, width: 630, height: 880, zIndex: 1, imageSource: '{{artwork}}' },
          { id: 'locked-frame-overlay', type: 'image', name: 'Premium Frame Overlay', x: 0, y: 0, width: 630, height: 880, zIndex: 2, imageSource: '/frames/premium.webp', locked: true },
        ],
      },
    };

    const normalized = normalizeTemplateFieldContracts(template);

    expect(normalized.fieldContracts?.map((contract) => contract.key)).toEqual(['artwork']);
    expect(extractTemplateFieldDefinitions(normalized).map((field) => field.key)).toEqual(['artwork']);
  });
});
