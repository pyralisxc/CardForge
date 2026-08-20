import { describe, expect, it } from 'vitest';

import {
  extractTemplateFieldDefinitions,
  materializeTemplateFieldBindings,
  type TCGCardTemplate,
} from '@/domain/templates';
import { createBulkImportContract } from '@/features/card-generator/server';
import { createProjectDocumentFromTemplateDraft } from '@/features/studio-documents/model';

const makeLiteralContractTemplate = (): TCGCardTemplate => ({
  id: 'clash-template',
  name: 'Clash of Fists',
  aspectRatio: '63:88',
  templateSource: 'user',
  fieldContracts: [
    {
      key: 'card_name',
      elementId: 'card-name',
      label: 'Card Name',
      type: 'text',
      required: true,
      defaultValue: 'ROCK',
    },
    {
      key: 'card_type',
      elementId: 'card-type',
      label: 'Card Type',
      type: 'text',
      required: true,
      defaultValue: 'Gesture',
    },
    {
      key: 'rules_text',
      elementId: 'rules-text',
      label: 'Rules Text',
      type: 'text',
      required: true,
      multiline: true,
      defaultValue: 'Crushes scissors.',
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
        x: 40,
        y: 40,
        width: 300,
        height: 50,
        zIndex: 2,
        content: 'ROCK',
      },
      {
        id: 'card-type',
        type: 'text',
        name: 'Card Type',
        x: 40,
        y: 100,
        width: 300,
        height: 40,
        zIndex: 2,
        content: 'Gesture',
      },
      {
        id: 'rules-text',
        type: 'text',
        name: 'Rules Text',
        x: 40,
        y: 600,
        width: 550,
        height: 160,
        zIndex: 2,
        content: 'Crushes scissors.',
      },
      {
        id: 'main-art',
        type: 'image',
        name: 'Main Artwork',
        x: 40,
        y: 160,
        width: 550,
        height: 400,
        zIndex: 1,
        content: 'artworkUrl',
        imageSource: 'artworkUrl',
      },
    ],
  },
});

describe('agent card generation field bindings', () => {
  it('materializes explicit whole-element text contracts into native Template bindings', () => {
    const template = materializeTemplateFieldBindings(makeLiteralContractTemplate());
    const elements = template.freeformCanvas?.elements ?? [];

    expect(elements.find((element) => element.id === 'card-name')?.content).toBe('{{card_name:"ROCK"}}');
    expect(elements.find((element) => element.id === 'card-type')?.content).toBe('{{card_type:"Gesture"}}');
    expect(elements.find((element) => element.id === 'rules-text')?.content).toBe('{{rules_text:"Crushes scissors."}}');
  });

  it('exposes literal agent text fields in the canonical bulk contract instead of only image fields', () => {
    const template = materializeTemplateFieldBindings(makeLiteralContractTemplate());
    const fields = extractTemplateFieldDefinitions(template).filter((field) => !field.isStaticBaseText);
    const contract = createBulkImportContract({ template, fieldDefinitions: fields });
    const keys = contract.fields.map((field) => field.key);

    expect(keys).toEqual(expect.arrayContaining(['card_name', 'card_type', 'rules_text']));
    expect(contract.fields.find((field) => field.key === 'rules_text')).toMatchObject({
      required: true,
      multiline: true,
      type: 'text',
    });
  });

  it('binds a new agent working set to the front Template immediately', () => {
    const template = makeLiteralContractTemplate();
    const document = createProjectDocumentFromTemplateDraft({
      title: 'Clash of Fists',
      productionPlan: {
        version: 1,
        decisionMode: 'delegated',
        purpose: 'Create editable cards.',
        deliverable: 'Card set',
        outputSize: { width: 630, height: 880, unit: 'px' },
        visualDirection: { summary: 'RPS card set', palette: [], typography: [] },
        editableFieldKeys: ['card_name', 'card_type', 'rules_text'],
        assets: [],
      },
      template: template as Parameters<typeof createProjectDocumentFromTemplateDraft>[0]['template'],
    }, 'clash-template');

    expect(document.activeCardSetId).toBe('active-card-set');
    expect(document.cardSets).toEqual([{
      id: 'active-card-set',
      name: 'Untitled Set',
      frontTemplateId: 'clash-template',
      backingTemplateId: null,
    }]);
    expect(document.userTemplates[0].freeformCanvas?.elements.find((element) => element.id === 'card-name')?.content)
      .toBe('{{card_name:"ROCK"}}');
  });
});
