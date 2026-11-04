import { z } from 'zod/v4';
import { PIPELINE_STATUSES } from './pipelineItems';

/** Shared read projection; native commands remain mutation authority. */
export const pipelineEngagementSchema = z.object({
  submissionId: z.string().uuid(), lineageId: z.string().uuid().nullable(), name: z.string(),
  revisionNumber: z.number().int().nonnegative().nullable(), status: z.enum(PIPELINE_STATUSES),
  trashedAt: z.string().nullable(), purgeState: z.literal('pending').nullable(),
  positiveVotes: z.number().int().nonnegative(), negativeVotes: z.number().int().nonnegative(),
  currentUserVote: z.enum(['positive', 'negative']).nullable(), voteIssue: z.string().nullable(),
  heart: z.object({ count: z.number().int().nonnegative(), hearted: z.boolean() }).strict().nullable(),
  heartIssue: z.string().nullable(),
}).strict();
export type PipelineEngagement = z.infer<typeof pipelineEngagementSchema>;

export const pipelineVoteReceiptSchema = z.object({
  submissionId: z.string().uuid(), outcome: z.enum(['committed', 'uncertain']), warnings: z.array(z.string()),
});

export interface PipelineDesignSource {
  localTemplateId: string;
  submissionId: string;
}
