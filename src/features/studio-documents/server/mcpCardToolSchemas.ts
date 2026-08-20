import { fromJsonSchema } from '@modelcontextprotocol/server';

import {
  EMBEDDED_TEMPLATE_ASSET_MIME_TYPES,
  MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
  type EmbeddedTemplateAssetMimeType,
} from './embeddedTemplateAssets';

export interface CardGenerationContractInput {
  documentId: string;
  setId?: string;
}

export interface UpsertCardSetInput {
  documentId: string;
  expectedRevision: number;
  setId?: string;
  name: string;
  frontTemplateId?: string;
  backingTemplateId?: string;
}

export interface McpCardInput {
  cardId?: string;
  data: Record<string, string | number>;
  backingData?: Record<string, string | number>;
}

export interface UpsertCardInput {
  documentId: string;
  expectedRevision: number;
  setId: string;
  card: McpCardInput;
}

export interface UpsertCardsInput {
  documentId: string;
  expectedRevision: number;
  setId: string;
  cards: McpCardInput[];
}

export interface AttachCardArtworkInput {
  documentId: string;
  expectedRevision: number;
  cardId: string;
  fieldKey: string;
  face: 'front' | 'back';
  mimeType: EmbeddedTemplateAssetMimeType;
  data: string;
}

export interface GetCardSetInput {
  documentId: string;
  setId: string;
}

const documentId = { type: 'string', format: 'uuid' } as const;
const expectedRevision = { type: 'integer', minimum: 1 } as const;
const setId = { type: 'string', minLength: 1, maxLength: 255 } as const;
const cardData = {
  type: 'object',
  minProperties: 1,
  maxProperties: 200,
  additionalProperties: {
    oneOf: [
      { type: 'string', maxLength: 20000 },
      { type: 'number' },
    ],
  },
} as const;
const cardInput = {
  type: 'object',
  additionalProperties: false,
  required: ['data'],
  properties: {
    cardId: { type: 'string', minLength: 1, maxLength: 255 },
    data: cardData,
    backingData: cardData,
  },
} as const;

export const cardGenerationContractInputSchema = fromJsonSchema<CardGenerationContractInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId'],
  properties: { documentId, setId },
});

export const upsertCardSetInputSchema = fromJsonSchema<UpsertCardSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'name'],
  properties: {
    documentId,
    expectedRevision,
    setId,
    name: { type: 'string', minLength: 1, maxLength: 160 },
    frontTemplateId: { type: 'string', minLength: 1, maxLength: 255 },
    backingTemplateId: { type: 'string', minLength: 1, maxLength: 255 },
  },
});

export const upsertCardInputSchema = fromJsonSchema<UpsertCardInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'setId', 'card'],
  properties: { documentId, expectedRevision, setId, card: cardInput },
});

export const upsertCardsInputSchema = fromJsonSchema<UpsertCardsInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'setId', 'cards'],
  properties: {
    documentId,
    expectedRevision,
    setId,
    cards: { type: 'array', minItems: 1, maxItems: 100, items: cardInput },
  },
});

export const attachCardArtworkInputSchema = fromJsonSchema<AttachCardArtworkInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'expectedRevision', 'cardId', 'fieldKey', 'face', 'mimeType', 'data'],
  properties: {
    documentId,
    expectedRevision,
    cardId: { type: 'string', minLength: 1, maxLength: 255 },
    fieldKey: { type: 'string', minLength: 1, maxLength: 255 },
    face: { type: 'string', enum: ['front', 'back'] },
    mimeType: { type: 'string', enum: [...EMBEDDED_TEMPLATE_ASSET_MIME_TYPES] },
    data: {
      type: 'string',
      minLength: 1,
      maxLength: MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
      description: 'Raw base64 image bytes only. Do not include a data: URL prefix.',
    },
  },
});

export const getCardSetInputSchema = fromJsonSchema<GetCardSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'setId'],
  properties: { documentId, setId },
});
