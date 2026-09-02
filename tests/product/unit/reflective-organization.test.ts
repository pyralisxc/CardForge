import { describe, expect, it } from 'vitest';

import type { DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import {
  deriveReflectiveOrganization,
  getSemanticOrganizationField,
} from '@/features/desk/model/reflectiveOrganization';

const template = (id: string, name = 'Playing Card'): TCGCardTemplate => ({
  id,
  name,
  aspectRatio: '63:88',
  fieldContracts: [
    { key: 'suit', elementId: 'suit', label: 'Suit', type: 'text' },
    { key: 'content_type', elementId: 'content-type', label: 'Card Type', type: 'text' },
    { key: 'card_name', elementId: 'card-name', label: 'Card Name', type: 'text' },
  ],
  freeformCanvas: {
    width: 630,
    height: 880,
    elements: [
      { id: 'suit', type: 'text', name: 'Suit', x: 0, y: 0, width: 100, height: 40, zIndex: 1, content: '{{suit}}' },
      { id: 'content-type', type: 'text', name: 'Card Type', x: 0, y: 50, width: 100, height: 40, zIndex: 2, content: '{{content_type}}' },
      { id: 'card-name', type: 'text', name: 'Card Name', x: 0, y: 100, width: 100, height: 40, zIndex: 3, content: '{{card_name}}' },
    ],
  },
});

const card = (index: number, data: Record<string, string>, cardTemplate = template('playing')): DisplayCard => ({
  uniqueId: `card-${index}`,
  template: cardTemplate,
  data,
});

describe('reflective Set organization', () => {
  it('uses human field metadata and exposes only meaningful current dimensions', () => {
    const organization = deriveReflectiveOrganization([
      card(1, { suit: 'Hearts', content_type: 'Character', card_name: 'One' }),
      card(2, { suit: 'Spades', content_type: 'Action', card_name: 'Two' }),
      card(3, { suit: 'Hearts', content_type: 'Character', card_name: 'Three' }),
      card(4, { suit: 'Spades', content_type: 'Action', card_name: 'Four' }),
    ]);

    expect(organization.fields.find((field) => field.id === 'suit')).toMatchObject({
      label: 'Suit',
      valueCount: 2,
      groupable: true,
      semanticGrouping: null,
    });
    expect(getSemanticOrganizationField(organization.fields, 'contentType')).toMatchObject({
      id: 'content_type',
      label: 'Card Type',
      semanticGrouping: 'content-type',
    });
    expect(organization.groupings).toContain('field');
    expect(organization.groupings).toContain('content-type');
    expect(organization.groupings).not.toContain('template');
    expect(organization.groupings).not.toContain('batch');
  });

  it('keeps high-cardinality names sortable without offering them as groups', () => {
    const organization = deriveReflectiveOrganization(Array.from({ length: 20 }, (_, index) => card(index, {
      card_name: `Unique Card ${index}`,
    })));
    expect(organization.fields).toEqual([
      expect.objectContaining({ id: 'card_name', groupable: false, sortable: true }),
    ]);
    expect(organization.groupings).not.toContain('field');
  });

  it('offers Template grouping only when the Set actually contains multiple Templates', () => {
    const organization = deriveReflectiveOrganization([
      card(1, {}, template('front-a', 'Front A')),
      card(2, {}, template('front-b', 'Front B')),
    ]);
    expect(organization.groupings).toEqual(['template']);
  });
});
