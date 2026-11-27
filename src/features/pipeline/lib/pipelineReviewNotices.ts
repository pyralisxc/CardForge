import { z } from 'zod/v4';

/** Closed metadata projection; notice reads do not authorize a revision action. */
export const pipelineReviewNoticeSchema = z.object({
  submissionId: z.string().uuid(), lineageId: z.string().uuid(), name: z.string().min(1),
  revisionNumber: z.number().int().nonnegative().nullable(), submittedAt: z.string().min(1),
}).strict();
export const pipelineReviewNoticesSchema = z.object({ items: z.array(pipelineReviewNoticeSchema) }).strict();
export type PipelineReviewNotice = z.infer<typeof pipelineReviewNoticeSchema>;
