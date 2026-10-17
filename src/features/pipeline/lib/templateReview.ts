import { z } from 'zod';
import { getAuthoredTemplatePayload, type TCGCardTemplate } from '@/domain/templates';

export const templateReviewBaseSchema = z.object({
  assetId: z.string().trim().min(1).max(200),
  parentSubmissionId: z.string().uuid(),
  lineageId: z.string().uuid(),
  baseRevisionNumber: z.number().int().positive(),
  revisionHighWater: z.number().int().positive(),
  parentContentVersion: z.string().regex(/^[a-f0-9]{32}$/u),
  registryContentVersion: z.string().regex(/^[a-f0-9]{32}$/u),
}).strict();

export const templateReviewReceiptSchema = z.object({
  id: z.string().uuid(), assetId: z.string(), revisionNumber: z.number().int().positive(),
  status: z.string(), editorialReviewStatus: z.string(), requestFingerprint: z.string(),
});
export type TemplateReviewReceipt = z.infer<typeof templateReviewReceiptSchema>;

/** Browser working-copy identity and retry bookkeeping do not change the provider asset. */
export const templateReviewPayload = (template: TCGCardTemplate): ReturnType<typeof getAuthoredTemplatePayload> => ({
  ...getAuthoredTemplatePayload(template),
  id: template.templatePipelineContext?.expectedBase.assetId ?? template.id,
});

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonical(entry)]))
    : value;

export const templateReviewRequestText = (template: TCGCardTemplate): string => JSON.stringify(canonical({
  expectedBase: template.templatePipelineContext?.expectedBase,
  template: templateReviewPayload(template),
}));
