import { fromJsonSchema } from '@modelcontextprotocol/server';

import {
  CARDFORGE_FREEFORM_ELEMENT_TYPES,
  CARDFORGE_FREEFORM_SHAPE_KINDS,
} from '@/domain/templates';
import {
  PROJECT_ASSET_REQUIREMENT_KINDS,
  PROJECT_ASSET_REQUIREMENT_SOURCES,
  PROJECT_ASSET_REQUIREMENT_STATUSES,
  PROJECT_PRODUCTION_DECISION_MODES,
  PROJECT_PRODUCTION_PLAN_VERSION,
  PROJECT_PRODUCTION_SIZE_UNITS,
} from '@/features/project/server';
import type { GptTemplateDraftInput } from '@/features/studio-documents/model';
import { STUDIO_CREATION_LIBRARY_KINDS, type StudioCreationLibraryKind } from './studioCreationLibrary';

const appearanceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assetSource: { type: 'string', maxLength: 20000 },
    assetKind: { type: 'string', enum: ['texture', 'divider', 'border', 'frame'] },
    blendMode: { type: 'string', maxLength: 100 },
    textureScale: { type: 'number', exclusiveMinimum: 0, maximum: 10000 },
    textureOpacity: { type: 'number', minimum: 0, maximum: 100 },
    tileMode: { type: 'string', enum: ['repeat', 'stretch', 'contain'] },
    dividerAsset: { type: 'string', maxLength: 20000 },
    shapeRole: { type: 'string', enum: ['basic', 'panel', 'artFrame', 'rulesBox', 'titlePlate', 'statGem', 'costOrb', 'divider'] },
    material: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', maxLength: 255 },
        baseColor: { type: 'string', maxLength: 255 },
        textColor: { type: 'string', maxLength: 255 },
        fillColor: { type: 'string', maxLength: 255 },
        strokeColor: { type: 'string', maxLength: 255 },
        gradient: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'stops'],
          properties: {
            type: { type: 'string', enum: ['linear', 'radial', 'none'] },
            angle: { type: 'number' },
            stops: {
              type: 'array',
              maxItems: 32,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'color', 'position'],
                properties: {
                  id: { type: 'string', minLength: 1, maxLength: 255 },
                  color: { type: 'string', maxLength: 255 },
                  position: { type: 'number', minimum: 0, maximum: 100 },
                  opacity: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            },
          },
        },
        texture: {
          type: 'object',
          additionalProperties: false,
          required: ['kind'],
          properties: {
            kind: { type: 'string', enum: ['none', 'parchment', 'foil', 'etched', 'grain', 'hatch', 'uploaded'] },
            intensity: { type: 'number', minimum: 0, maximum: 100 },
            scale: { type: 'number', exclusiveMinimum: 0, maximum: 10000 },
            imageSource: { type: 'string', maxLength: 20000 },
            assetSource: { type: 'string', maxLength: 20000 },
            assetKind: { type: 'string', enum: ['texture', 'divider', 'border', 'frame'] },
            blendMode: { type: 'string', maxLength: 100 },
            textureScale: { type: 'number', exclusiveMinimum: 0, maximum: 10000 },
            textureOpacity: { type: 'number', minimum: 0, maximum: 100 },
            tileMode: { type: 'string', enum: ['repeat', 'stretch', 'contain'] },
          },
        },
      },
    },
    border: {
      type: 'object',
      additionalProperties: false,
      required: ['kind'],
      properties: {
        kind: { type: 'string', enum: ['none', 'solid', 'double', 'etched', 'relic', 'foil'] },
        color: { type: 'string', maxLength: 255 },
        secondaryColor: { type: 'string', maxLength: 255 },
        width: { type: 'number', minimum: 0, maximum: 100 },
        radius: { type: 'number', minimum: 0, maximum: 10000 },
        innerWidth: { type: 'number', minimum: 0, maximum: 100 },
        outerWidth: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
    effects: {
      type: 'object',
      additionalProperties: false,
      properties: {
        shadow: { type: 'number', minimum: 0, maximum: 100 },
        glow: { type: 'number', minimum: 0, maximum: 100 },
        bevel: { type: 'number', minimum: 0, maximum: 100 },
        innerHighlight: { type: 'number', minimum: 0, maximum: 100 },
        overlayOpacity: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
    rawCss: {
      type: 'object',
      additionalProperties: false,
      properties: {
        backgroundImage: { type: 'string', maxLength: 20000 },
        borderImageSource: { type: 'string', maxLength: 20000 },
      },
    },
  },
};

const productionPlanSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'decisionMode', 'purpose', 'deliverable', 'outputSize', 'visualDirection', 'editableFieldKeys', 'assets'],
  properties: {
    version: { type: 'number', const: PROJECT_PRODUCTION_PLAN_VERSION },
    decisionMode: { type: 'string', enum: [...PROJECT_PRODUCTION_DECISION_MODES] },
    purpose: { type: 'string', minLength: 1, maxLength: 1000 },
    deliverable: { type: 'string', minLength: 1, maxLength: 500 },
    audience: { type: 'string', maxLength: 1000 },
    outputSize: {
      type: 'object',
      additionalProperties: false,
      required: ['width', 'height', 'unit'],
      properties: {
        width: { type: 'number', exclusiveMinimum: 0, maximum: 20000 },
        height: { type: 'number', exclusiveMinimum: 0, maximum: 20000 },
        unit: { type: 'string', enum: [...PROJECT_PRODUCTION_SIZE_UNITS] },
        aspectRatio: { type: 'string', maxLength: 40 },
      },
    },
    visualDirection: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'palette', 'typography'],
      properties: {
        summary: { type: 'string', minLength: 1, maxLength: 2000 },
        palette: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 100 } },
        typography: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 160 } },
        notes: { type: 'string', maxLength: 4000 },
      },
    },
    editableFieldKeys: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 255 } },
    assets: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'kind', 'role', 'source', 'quantity', 'status'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 255 },
          name: { type: 'string', minLength: 1, maxLength: 160 },
          kind: { type: 'string', enum: [...PROJECT_ASSET_REQUIREMENT_KINDS] },
          role: { type: 'string', minLength: 1, maxLength: 160 },
          source: { type: 'string', enum: [...PROJECT_ASSET_REQUIREMENT_SOURCES] },
          quantity: { type: 'integer', minimum: 1, maximum: 64 },
          status: { type: 'string', enum: [...PROJECT_ASSET_REQUIREMENT_STATUSES] },
          assetId: { type: 'string', maxLength: 255 },
          assetUrl: { type: 'string', maxLength: 20000 },
          prompt: { type: 'string', maxLength: 4000 },
          targetElementIds: { type: 'array', maxItems: 100, items: { type: 'string', minLength: 1, maxLength: 255 } },
          width: { type: 'number', exclusiveMinimum: 0, maximum: 20000 },
          height: { type: 'number', exclusiveMinimum: 0, maximum: 20000 },
          notes: { type: 'string', maxLength: 4000 },
        },
      },
    },
    copyNotes: { type: 'string', maxLength: 4000 },
  },
};

const fieldContractSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['key'],
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 255 },
    elementId: { type: 'string', maxLength: 255 },
    label: { type: 'string', maxLength: 255 },
    type: { type: 'string', enum: ['text', 'structuredRows', 'image'] },
    required: { type: 'boolean' },
    multiline: { type: 'boolean' },
    defaultValue: { type: 'string', maxLength: 20000 },
    description: { type: 'string', maxLength: 2000 },
    example: { type: 'string', maxLength: 20000 },
    maxLength: { type: 'integer', minimum: 1, maximum: 100000 },
    allowedFormatting: { type: 'array', maxItems: 16, items: { type: 'string', enum: ['bold', 'italic', 'underline', 'color', 'highlight', 'lists', 'rulesMarkers'] } },
    textAutoFit: { type: 'boolean' },
    minFontSizePx: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
    textColor: { type: 'string', maxLength: 255 },
    fontFamily: { type: 'string', maxLength: 255 },
    fontSizePx: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
    fontWeight: { type: 'string', enum: ['font-normal', 'font-medium', 'font-semibold', 'font-bold'] },
    fontStyle: { type: 'string', enum: ['normal', 'italic'] },
    textDecoration: { type: 'string', enum: ['none', 'underline', 'line-through'] },
    textAlign: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
    writingMode: { type: 'string', enum: ['horizontal-tb', 'vertical-rl', 'vertical-lr'] },
    lineHeight: { type: 'string', maxLength: 100 },
    letterSpacing: { type: 'string', maxLength: 100 },
  },
};

const elementSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 255 },
    type: { type: 'string', enum: [...CARDFORGE_FREEFORM_ELEMENT_TYPES] },
    name: { type: 'string', minLength: 1, maxLength: 160 },
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number', exclusiveMinimum: 0, maximum: 20000 },
    height: { type: 'number', exclusiveMinimum: 0, maximum: 20000 },
    rotation: { type: 'number' },
    flipX: { type: 'boolean' },
    flipY: { type: 'boolean' },
    opacity: { type: 'number', minimum: 0, maximum: 1 },
    zIndex: { type: 'number' },
    locked: { type: 'boolean' },
    parentId: { type: 'string', maxLength: 255 },
    visible: { type: 'boolean' },
    content: { type: 'string', maxLength: 20000 },
    imageSource: { type: 'string', maxLength: 20000 },
    iconImageSource: { type: 'string', maxLength: 20000 },
    iconName: { type: 'string', maxLength: 255 },
    shapeKind: { type: 'string', enum: [...CARDFORGE_FREEFORM_SHAPE_KINDS] },
    shapeRole: { type: 'string', enum: ['basic', 'panel', 'artFrame', 'rulesBox', 'titlePlate', 'statGem', 'costOrb', 'divider'] },
    textColor: { type: 'string', maxLength: 255 },
    backgroundColor: { type: 'string', maxLength: 255 },
    backgroundImageUrl: { type: 'string', maxLength: 20000 },
    fontFamily: { type: 'string', maxLength: 255 },
    fontSize: { type: 'string', enum: ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'] },
    fontSizePx: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
    fontWeight: { type: 'string', enum: ['font-normal', 'font-medium', 'font-semibold', 'font-bold'] },
    textAlign: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
    fontStyle: { type: 'string', enum: ['normal', 'italic'] },
    writingMode: { type: 'string', enum: ['horizontal-tb', 'vertical-rl', 'vertical-lr'] },
    letterSpacing: { type: 'string', maxLength: 100 },
    lineHeight: { type: 'string', maxLength: 100 },
    textTransform: { type: 'string', enum: ['none', 'uppercase', 'lowercase', 'capitalize'] },
    textDecoration: { type: 'string', enum: ['none', 'underline', 'line-through'] },
    generatorFieldKind: { type: 'string', enum: ['text', 'structuredRows'] },
    generatorFieldRequired: { type: 'boolean' },
    textAutoFit: { type: 'boolean' },
    textMinFontSizePx: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
    padding: { type: 'string', maxLength: 100 },
    borderColor: { type: 'string', maxLength: 255 },
    borderWidth: { type: 'string', maxLength: 100 },
    borderRadius: { type: 'string', maxLength: 100 },
    minHeight: { type: 'string', maxLength: 100 },
    imageObjectFit: { type: 'string', enum: ['cover', 'contain', 'fill', 'none'] },
    imageObjectPositionX: { type: 'string', maxLength: 100 },
    imageObjectPositionY: { type: 'string', maxLength: 100 },
    imageScale: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
    imageOffsetX: { type: 'number' },
    imageOffsetY: { type: 'number' },
    imageRotation: { type: 'number' },
    fillColor: { type: 'string', maxLength: 255 },
    strokeColor: { type: 'string', maxLength: 255 },
    strokeWidth: { type: 'number', minimum: 0, maximum: 100 },
    appearance: appearanceSchema,
  },
};

const templateSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'aspectRatio'],
  properties: {
    id: { type: ['string', 'null'], maxLength: 255 },
    name: { type: 'string', minLength: 1, maxLength: 160 },
    aspectRatio: { type: 'string', minLength: 1, maxLength: 40 },
    formatId: { type: 'string', enum: ['poker', 'bridge', 'tarot', 'us-business', 'event-badge', 'ttrpg-reference', 'custom'] },
    trimWidthMm: { type: 'number', exclusiveMinimum: 0, maximum: 10000 },
    trimHeightMm: { type: 'number', exclusiveMinimum: 0, maximum: 10000 },
    templateUsage: { type: 'string', enum: ['standard', 'back-preset'] },
    templateCategory: { type: 'string', maxLength: 160 },
    templateDescription: { type: 'string', maxLength: 4000 },
    frameStyle: { type: 'string', maxLength: 255 },
    baseBackgroundColor: { type: 'string', maxLength: 255 },
    baseTextColor: { type: 'string', maxLength: 255 },
    cardBackgroundImageUrl: { type: 'string', maxLength: 20000 },
    cardBorderImageSource: { type: 'string', maxLength: 20000 },
    defaultElementBorderColor: { type: 'string', maxLength: 255 },
    cardBorderColor: { type: 'string', maxLength: 255 },
    cardBorderWidth: { type: 'string', maxLength: 100 },
    cardBorderStyle: { type: 'string', enum: ['solid', 'dashed', 'dotted', 'double', 'none', '_default_'] },
    cardBorderRadius: { type: 'string', maxLength: 100 },
    appearance: appearanceSchema,
    fieldContracts: { type: 'array', maxItems: 100, items: fieldContractSchema },
    freeformCanvas: {
      type: 'object',
      additionalProperties: false,
      required: ['width', 'height', 'elements'],
      properties: {
        width: { type: 'number', minimum: 1, maximum: 5000 },
        height: { type: 'number', minimum: 1, maximum: 5000 },
        gridSize: { type: 'number', exclusiveMinimum: 0, maximum: 1000 },
        elements: { type: 'array', maxItems: 200, items: elementSchema },
      },
    },
  },
};

const createInputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'productionPlan', 'template'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 160 },
    productionPlan: productionPlanSchema,
    template: templateSchema,
  },
};

export const createTemplateInputSchema = fromJsonSchema<GptTemplateDraftInput>(createInputJsonSchema);

export type UpdateEditableTemplateInput = GptTemplateDraftInput & {
  documentId: string;
  expectedRevision: number;
};

export const updateTemplateInputSchema = fromJsonSchema<UpdateEditableTemplateInput>({
  ...createInputJsonSchema,
  required: ['documentId', 'expectedRevision', 'title', 'productionPlan', 'template'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    expectedRevision: { type: 'integer', minimum: 1 },
    ...createInputJsonSchema.properties,
  },
});

export const documentIdInputSchema = fromJsonSchema<{ documentId: string }>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
  },
});

export const pipelineInputSchema = fromJsonSchema<{ documentId: string; templateId?: string }>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: {
    documentId: { type: 'string', format: 'uuid' },
    templateId: { type: 'string', minLength: 1 },
  },
});

export interface SearchStudioLibraryInput {
  query?: string;
  kinds?: StudioCreationLibraryKind[];
  limit?: number;
}

export const searchStudioLibraryInputSchema = fromJsonSchema<SearchStudioLibraryInput>({
  type: 'object',
  additionalProperties: false,
  properties: {
    query: { type: 'string', maxLength: 160 },
    kinds: {
      type: 'array',
      maxItems: STUDIO_CREATION_LIBRARY_KINDS.length,
      items: { type: 'string', enum: [...STUDIO_CREATION_LIBRARY_KINDS] },
    },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
  },
});
