import { fromJsonSchema } from '@modelcontextprotocol/server';

import {
  PERSONAL_LIBRARY_ROLES,
  type PersonalLibraryRole,
} from '../model';

export interface SearchPersonalLibraryInput {
  query?: string;
  role?: PersonalLibraryRole;
  limit?: number;
}

export const searchPersonalLibraryInputSchema = fromJsonSchema<SearchPersonalLibraryInput>({
  type: 'object',
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      maxLength: 160,
      description: 'Optional case-insensitive name search. Omit to browse recent authorized personal-library items.',
    },
    role: {
      type: 'string',
      enum: [...PERSONAL_LIBRARY_ROLES],
      description: 'Optional CardForge semantic asset role.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      description: 'Maximum matching items to return. Defaults to 20.',
    },
  },
});

export const personalLibrarySearchOutputSchema = fromJsonSchema<Record<string, unknown>>({
  type: 'object',
  additionalProperties: false,
  required: ['query', 'role', 'count', 'items', 'usageNote'],
  properties: {
    query: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    role: { anyOf: [{ type: 'string', enum: [...PERSONAL_LIBRARY_ROLES] }, { type: 'null' }] },
    count: { type: 'integer', minimum: 0 },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['itemId', 'provider', 'displayName', 'role', 'mimeType', 'byteSize', 'providerRevision', 'contentHash'],
        properties: {
          itemId: { type: 'string' },
          provider: { type: 'string', enum: ['google-drive'] },
          displayName: { type: 'string' },
          role: { type: 'string', enum: [...PERSONAL_LIBRARY_ROLES] },
          mimeType: { type: 'string' },
          byteSize: { type: 'number', minimum: 0 },
          providerRevision: { type: 'string' },
          contentHash: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
    usageNote: { type: 'string' },
  },
});
