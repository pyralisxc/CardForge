import { fromJsonSchema } from '@modelcontextprotocol/server';

export interface GetWorkingDocumentOperationStatusInput {
  documentId: string;
  operationId: string;
}

export const getWorkingDocumentOperationStatusInputSchema = fromJsonSchema<GetWorkingDocumentOperationStatusInput>({
  type: 'object',
  additionalProperties: false,
  required: ['documentId', 'operationId'],
  properties: {
    documentId: {
      type: 'string',
      format: 'uuid',
      description: 'Current CardForge working document id.',
    },
    operationId: {
      type: 'string',
      minLength: 1,
      maxLength: 255,
      pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$',
      description: 'Caller-generated operation id previously supplied to an atomic mutation.',
    },
  },
});
