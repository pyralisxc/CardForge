import { fromJsonSchema } from '@modelcontextprotocol/server';

import { STUDIO_MEDIA_KINDS, type StudioMediaKind } from '@/features/studio-media/model';

export interface UploadStudioMediaInput {
  name: string;
  kind: StudioMediaKind;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  imageBase64: string;
}

export const uploadStudioMediaInputSchema = fromJsonSchema<UploadStudioMediaInput>({
  type: 'object',
  additionalProperties: false,
  required: ['name', 'kind', 'mimeType', 'imageBase64'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 160 },
    kind: { type: 'string', enum: [...STUDIO_MEDIA_KINDS] },
    mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
    imageBase64: {
      type: 'string',
      minLength: 4,
      maxLength: 11184820,
      description: 'Raw base64 image bytes without a data: URL prefix.',
    },
  },
});
