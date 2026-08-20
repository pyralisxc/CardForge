import { describe, expect, it } from 'vitest';

import { extractTemplateFieldDefinitions } from '@/domain/templates';
import type { TCGCardTemplate } from '@/domain/templates';

describe('generator contract field behavior', () => {
  it('preserves an explicit empty formatting contract as plain text', () => {
    const template: TCGCardTemplate = {
      id: 'template-plain-text-contract',
      name: 'Plain Text Contract',
      aspectRatio: '63:88',
      fieldContracts: [
        {
          key: 'card_name',
          elementId: 'card-name',
          label: 'Card Name',
          type: 'text',
          required: true,
          allowedFormatting: [],
        },
      ],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'card-name',
            type: 'text',
            name: 'Card Name',
            x: 0,
            y: 0,
            width: 200,
            height: 40,
            zIndex: 1,
            content: '{{card_name:"ROCK"}}',
          },
        ],
      },
    };

    const [field] = extractTemplateFieldDefinitions(template);
    expect(field).toMatchObject({
      key: 'card_name',
      allowedFormatting: [],
      supportsRichText: false,
    });
  });

  it('uses explicit image contracts and excludes locked static decoration from generator fields', () => {
    const template: TCGCardTemplate = {
      id: 'template-layered-card',
      name: 'Layered Card',
      aspectRatio: '63:88',
      fieldContracts: [
        {
          key: 'artwork',
          elementId: 'artwork',
          label: 'Artwork',
          type: 'image',
          required: true,
        },
      ],
      freeformCanvas: {
        width: 630,
        height: 880,
        elements: [
          {
            id: 'artwork',
            type: 'image',
            name: 'Artwork — Bottom Layer',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            zIndex: 0,
            locked: false,
            imageSource: 'https://example.com/rock-test-art.png',
          },
          {
            id: 'frame-overlay',
            type: 'image',
            name: 'Premium Frame Overlay — Locked',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            zIndex: 10,
            locked: true,
            imageSource: 'https://example.com/frame-overlay.png',
          },
        ],
      },
    };

    const fields = extractTemplateFieldDefinitions(template);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      key: 'artwork',
      label: 'Artwork',
      isImage: true,
      required: true,
      defaultValue: undefined,
      supportsRichText: false,
    });
  });
});
