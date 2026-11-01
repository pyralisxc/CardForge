import { z } from 'zod';

export const dependencyImpactSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  affectedCount: z.number().int().nonnegative(), privateAffectedCount: z.number().int().nonnegative(),
  coverageWarningCount: z.number().int().nonnegative(), confirmationRequired: z.boolean(),
  items: z.array(z.object({ origin: z.enum(['registry', 'submission', 'studio']), recordId: z.string().min(1),
    objectId: z.string().nullable(), submissionId: z.string().uuid().nullable(), name: z.string() }).strict()),
}).strict();
export type DependencyImpact = z.infer<typeof dependencyImpactSchema>;
export const dependencyImpactJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['fingerprint','affectedCount','privateAffectedCount','coverageWarningCount','confirmationRequired','items'],
  properties: { fingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' }, affectedCount: { type: 'integer', minimum: 0 },
    privateAffectedCount: { type: 'integer', minimum: 0 }, coverageWarningCount: { type: 'integer', minimum: 0 }, confirmationRequired: { type: 'boolean' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['origin','recordId','objectId','submissionId','name'],
      properties: { origin: { type: 'string', enum: ['registry','submission','studio'] }, recordId: { type: 'string' }, objectId: { type: ['string','null'] }, submissionId: { type: ['string','null'], format: 'uuid' }, name: { type: 'string' } } } },
  },
};
