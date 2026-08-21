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
  artwork?: McpCardArtworkInput[];
}

export interface McpCardArtworkInput {
  fieldKey: string;
  face: 'front' | 'back';
  mimeType: EmbeddedTemplateAssetMimeType;
  data?: string;
  sourceUrl?: string;
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

export interface GetCardSetInput {
  documentId: string;
  setId: string;
}

const documentId = {
  type: 'string',
  format: 'uuid',
  description: 'The current CardForge working document id. Reuse the same document while designing its Template, set, and cards.',
} as const;
const expectedRevision = {
  type: 'integer',
  minimum: 1,
  description: 'The exact current working-document revision. If CardForge reports a revision conflict, reload the document or card contract and retry with the new revision while reusing the same stable set/card ids.',
} as const;
const setId = {
  type: 'string',
  minLength: 1,
  maxLength: 255,
  description: 'Stable set id. Reuse the same id for revisions and retries so a transient connector failure cannot create another set.',
} as const;
const cardData = {
  type: 'object',
  minProperties: 1,
  maxProperties: 200,
  description: 'Card values keyed only by fields returned from get_card_generation_contract. Never invent field names.',
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
    cardId: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Stable card id. Reuse it whenever revising or retrying this card. If omitted for a new card, CardForge derives a deterministic id from the submitted card data; use the returned id for later edits.',
    },
    data: cardData,
    backingData: cardData,
    artwork: {
      type: 'array',
      maxItems: 12,
      description: 'Optional per-card artwork resolved in the same atomic card write. Use sourceUrl for a generated/uploaded HTTPS file when available; raw base64 data remains a bounded fallback. Use only image field keys from get_card_generation_contract.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fieldKey', 'face', 'mimeType'],
        oneOf: [
          { required: ['data'], not: { required: ['sourceUrl'] } },
          { required: ['sourceUrl'], not: { required: ['data'] } },
        ],
        properties: {
          fieldKey: {
            type: 'string',
            minLength: 1,
            maxLength: 255,
            description: 'Exact image field key returned by get_card_generation_contract for this face.',
          },
          face: { type: 'string', enum: ['front', 'back'] },
          mimeType: { type: 'string', enum: [...EMBEDDED_TEMPLATE_ASSET_MIME_TYPES] },
          data: {
            type: 'string',
            minLength: 1,
            maxLength: MAX_EMBEDDED_TEMPLATE_ASSET_BASE64_CHARS,
            description: 'Raw base64 image bytes without a data: prefix. Prefer sourceUrl when ChatGPT has an HTTPS generated/uploaded file reference.',
          },
          sourceUrl: {
            type: 'string',
            format: 'uri',
            maxLength: 4096,
            description: 'Short-lived or permanent public HTTPS URL for a generated/uploaded PNG, JPEG, or WebP. CardForge downloads it once, validates it, normalizes it, and stores a private copy.',
          },
        },
      },
    },
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
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 160,
      description: 'User-facing set name, for example “Clash of Fists”. If setId is omitted, CardForge safely reuses an existing set with the same name before creating another one.',
    },
    frontTemplateId: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Front Template id from the current working document. Omit to keep or resolve the current front Template.',
    },
    backingTemplateId: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      description: 'Optional compatible card-back Template id from the current working document.',
    },
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
    cards: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      description: 'One to 100 cards using the exact Template field keys. A single write may include up to 64 artwork files and 32 MB of aggregate artwork input; split larger artwork sets across revision-safe calls. Give each planned card a stable cardId when possible so retries and later revisions update instead of duplicate.',
      items: cardInput,
    },
  },
});

export const getCardSetInputSchema = fromJsonSchema<GetCardSetInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'setId'],
  properties: { documentId, setId },
});
