import { describe, expect, it } from 'vitest';

import { summarizeProjectProductionAssets } from '@/features/project/server';
import {
  createProjectDocumentFromTemplateDraft,
  gptTemplateDraftInputSchema,
  normalizeStudioDocumentPayload,
} from '@/features/studio-documents/model';

const productionPlan = ({
  width = 1080,
  height = 1350,
  editableFieldKeys = [] as string[],
  assets = [] as Array<Record<string, unknown>>,
  decisionMode = 'confirmed' as 'confirmed' | 'delegated',
} = {}) => ({
  version: 1,
  decisionMode,
  purpose: 'Create an editable CardForge marketing composition.',
  deliverable: 'Marketing showcase graphic',
  audience: 'CardForge creators and prospective users',
  outputSize: { width, height, unit: 'px' as const, aspectRatio: `${width}:${height}` },
  visualDirection: {
    summary: 'Premium forged-fantasy presentation with clear hierarchy and restrained ornamental detail.',
    palette: ['#120c08', '#f5d27b', '#7d5cff'],
    typography: ['font-cinzel', 'font-humanist'],
  },
  editableFieldKeys,
  assets,
});

const nativeTextElement = (id: string, index = 0) => ({
  id,
  type: 'text' as const,
  name: `Text ${index + 1}`,
  x: 40 + index,
  y: 40 + index,
  width: 300,
  height: 80,
  zIndex: index + 1,
  content: 'Editable CardForge text',
});

describe('account Studio documents', () => {
  it('turns a planned contributor AI template into a private editable project document', () => {
    const input = gptTemplateDraftInputSchema.parse({
      title: 'Launch proof poster',
      productionPlan: productionPlan(),
      template: {
        name: 'Launch proof poster',
        aspectRatio: '4:5',
        baseBackgroundColor: '#120c08',
        freeformCanvas: {
          width: 1080,
          height: 1350,
          elements: [{
            id: 'headline',
            type: 'text',
            name: 'Headline',
            x: 80,
            y: 90,
            width: 920,
            height: 180,
            zIndex: 1,
            content: 'Design one card. Build the set.',
          }],
        },
      },
    });

    const document = createProjectDocumentFromTemplateDraft(input, 'gpt-template-123');

    expect(document.version).toBe(1);
    expect(document.productionPlan).toMatchObject({
      decisionMode: 'confirmed',
      outputSize: { width: 1080, height: 1350, unit: 'px' },
    });
    expect(document.userTemplates).toHaveLength(1);
    expect(document.userTemplates[0]).toMatchObject({
      id: 'gpt-template-123',
      name: 'Launch proof poster',
      templateSource: 'user',
      templateLibrarySource: 'personal',
      templateRegistryStatus: 'localOnly',
    });
    expect(document.userTemplates[0].freeformCanvas?.elements[0]).toMatchObject({
      id: 'headline',
      type: 'text',
    });
    expect(normalizeStudioDocumentPayload(document)).toEqual(document);
  });

  it('accepts rich native Studio styling, field contracts, image controls, and an asset ledger', () => {
    const input = gptTemplateDraftInputSchema.parse({
      title: 'Four-set marketing showcase',
      productionPlan: productionPlan({
        editableFieldKeys: ['Headline', 'HeroImage'],
        assets: [
          {
            id: 'hero-library-art',
            name: 'Forge showcase hero',
            kind: 'image',
            role: 'Primary showcase image',
            source: 'cardforge-library',
            quantity: 1,
            status: 'selected',
            assetId: 'showcase-playing-cards-ace-of-spades',
            assetUrl: 'https://example.test/ace.webp',
            targetElementIds: ['hero'],
          },
          {
            id: 'custom-ornament',
            name: 'Custom forged corner ornament',
            kind: 'border',
            role: 'Outer decorative finish',
            source: 'custom-generated',
            quantity: 1,
            status: 'needed',
            prompt: 'Subtle forged-brass corner ornament with arcane violet enamel.',
            targetElementIds: ['frame'],
          },
        ],
      }),
      template: {
        name: 'Four-set marketing showcase',
        aspectRatio: '4:5',
        formatId: 'custom',
        trimWidthMm: 216,
        trimHeightMm: 270,
        templateCategory: 'Marketing',
        templateDescription: 'A reusable CardForge campaign showcase with editable copy and art.',
        baseBackgroundColor: '#120c08',
        appearance: {
          material: {
            baseColor: '#120c08',
            gradient: {
              type: 'radial',
              stops: [
                { id: 'core', color: '#38205c', position: 0, opacity: 0.5 },
                { id: 'edge', color: '#080605', position: 100, opacity: 1 },
              ],
            },
          },
          border: { kind: 'relic', color: '#d5ad54', secondaryColor: '#7d5cff', width: 4, radius: 24 },
          effects: { glow: 12, bevel: 18, shadow: 20 },
        },
        fieldContracts: [
          {
            key: 'Headline',
            elementId: 'headline',
            label: 'Headline',
            type: 'text',
            required: true,
            textAutoFit: true,
            minFontSizePx: 18,
          },
          {
            key: 'HeroImage',
            elementId: 'hero',
            label: 'Hero image',
            type: 'image',
          },
        ],
        freeformCanvas: {
          width: 1080,
          height: 1350,
          gridSize: 20,
          elements: [
            {
              id: 'frame',
              type: 'shape',
              name: 'Outer frame',
              x: 24,
              y: 24,
              width: 1032,
              height: 1302,
              zIndex: 0,
              shapeKind: 'bracket-frame',
              shapeRole: 'artFrame',
              fillColor: 'transparent',
              appearance: {
                border: { kind: 'double', color: '#d5ad54', secondaryColor: '#7d5cff', width: 3, radius: 18 },
                effects: { glow: 8, bevel: 10 },
              },
            },
            {
              id: 'hero',
              type: 'image',
              name: 'Hero image',
              x: 90,
              y: 280,
              width: 900,
              height: 720,
              zIndex: 1,
              imageSource: 'https://example.test/ace.webp',
              imageObjectFit: 'cover',
              imageObjectPositionX: '50%',
              imageObjectPositionY: '42%',
              imageScale: 1.08,
              imageOffsetX: 4,
              imageOffsetY: -6,
              imageRotation: -1,
            },
            {
              id: 'headline',
              type: 'text',
              name: 'Headline',
              x: 90,
              y: 90,
              width: 900,
              height: 140,
              zIndex: 2,
              content: '{{Headline:"Forge a set worth showing."}}',
              fontFamily: 'font-cinzel',
              fontSizePx: 52,
              fontWeight: 'font-bold',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              textAutoFit: true,
              textMinFontSizePx: 18,
              textColor: '#f5d27b',
            },
          ],
        },
      },
    });

    const document = createProjectDocumentFromTemplateDraft(input, 'gpt-rich-template');
    const template = document.userTemplates[0];
    const hero = template.freeformCanvas?.elements.find((element) => element.id === 'hero');
    const frame = template.freeformCanvas?.elements.find((element) => element.id === 'frame');

    expect(template.fieldContracts?.map((field) => field.key)).toEqual(['Headline', 'HeroImage']);
    expect(template.appearance).toMatchObject({
      border: { kind: 'relic', color: '#d5ad54' },
      effects: { glow: 12, bevel: 18 },
    });
    expect(hero).toMatchObject({
      imageObjectFit: 'cover',
      imageObjectPositionX: '50%',
      imageScale: 1.08,
      imageOffsetY: -6,
    });
    expect(frame).toMatchObject({ shapeKind: 'bracket-frame', shapeRole: 'artFrame' });
    expect(summarizeProjectProductionAssets(input.productionPlan)).toMatchObject({
      totalRequirements: 2,
      totalAssetInstances: 2,
      imageInstances: 1,
      selectedInstances: 1,
      neededInstances: 1,
    });
    expect(normalizeStudioDocumentPayload(document)).toEqual(document);
  });

  it('bounds the contributor-only AI input instead of accepting an arbitrary project payload', () => {
    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Too many layers',
      productionPlan: productionPlan({ width: 1000, height: 1000 }),
      template: {
        name: 'Too many layers',
        aspectRatio: '1:1',
        freeformCanvas: {
          width: 1000,
          height: 1000,
          elements: Array.from({ length: 201 }, (_, index) => nativeTextElement(String(index), index)),
        },
      },
    }).success).toBe(false);

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Unexpected command',
      productionPlan: productionPlan(),
      template: {
        name: 'Draft',
        aspectRatio: '4:5',
        freeformCanvas: { width: 1080, height: 1350, elements: [nativeTextElement('text')] },
      },
      publish: true,
    }).success).toBe(false);
  });

  it('rejects invented canvas vocabularies before an AI draft can be persisted', () => {
    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Generic design tool payload',
      productionPlan: productionPlan({ width: 1600, height: 900 }),
      template: {
        name: 'Generic design tool payload',
        aspectRatio: '16:9',
        freeformCanvas: {
          width: 1600,
          height: 900,
          elements: [{
            id: 'slot-1',
            type: 'image-slot',
            name: 'Forge export 01',
            x: 100,
            y: 100,
            width: 300,
            height: 400,
            zIndex: 1,
          }],
        },
      },
    }).success).toBe(false);

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Native image element',
      productionPlan: productionPlan({ width: 1600, height: 900 }),
      template: {
        name: 'Native image element',
        aspectRatio: '16:9',
        freeformCanvas: {
          width: 1600,
          height: 900,
          elements: [{
            id: 'slot-1',
            type: 'image',
            name: 'Forge export 01',
            x: 100,
            y: 100,
            width: 300,
            height: 400,
            zIndex: 1,
            imageSource: 'artworkUrl',
            imageObjectFit: 'cover',
          }],
        },
      },
    }).success).toBe(true);
  });

  it('rejects production plans that are not actually bound to the editable Studio document', () => {
    const baseTemplate = {
      name: 'Binding test',
      aspectRatio: '4:5',
      freeformCanvas: {
        width: 1080,
        height: 1350,
        elements: [nativeTextElement('headline')],
      },
    };

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Missing editable field contract',
      productionPlan: productionPlan({ editableFieldKeys: ['Headline'] }),
      template: baseTemplate,
    }).success).toBe(false);

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Missing asset target',
      productionPlan: productionPlan({
        assets: [{
          id: 'art',
          name: 'Hero art',
          kind: 'image',
          role: 'Hero',
          source: 'placeholder',
          quantity: 1,
          status: 'placeholder',
          targetElementIds: ['does-not-exist'],
        }],
      }),
      template: baseTemplate,
    }).success).toBe(false);

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Pretend generated art',
      productionPlan: productionPlan({
        assets: [{
          id: 'custom-art',
          name: 'Generated hero',
          kind: 'image',
          role: 'Hero',
          source: 'custom-generated',
          quantity: 1,
          status: 'selected',
          targetElementIds: ['headline'],
        }],
      }),
      template: baseTemplate,
    }).success).toBe(false);

    expect(gptTemplateDraftInputSchema.safeParse({
      title: 'Mismatched dimensions',
      productionPlan: productionPlan({ width: 1200, height: 1200 }),
      template: baseTemplate,
    }).success).toBe(false);
  });
});
