import type { JsonSchemaType } from '@modelcontextprotocol/server';

// Display metadata is separate from immutable canonical artifact metadata.
export const displayImagesJsonSchema: JsonSchemaType = {
  type: 'array',
  maxItems: 12,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['artifactId', 'representation', 'mimeType', 'byteLength', 'width', 'height'],
    properties: {
      artifactId: { type: 'string' },
      representation: { type: 'string', enum: ['canonical', 'reduced'] },
      mimeType: { type: 'string', enum: ['image/png'] },
      byteLength: { type: 'integer', minimum: 1 },
      width: { type: 'integer', minimum: 1 },
      height: { type: 'integer', minimum: 1 },
    },
  },
};
