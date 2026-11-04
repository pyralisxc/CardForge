"use client";
import { readApiError } from '@/infrastructure/http/clientResponses';
import { pipelineEngagementSchema, pipelineVoteReceiptSchema, type PipelineEngagement } from '../lib/pipelineEngagement';

export const parsePipelineVoteReceipt = (value: unknown, submissionId: string) => {
  const parsed = pipelineVoteReceiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.submissionId !== submissionId) throw new Error('Vote acknowledgement is invalid. Read exact engagement before any new vote.');
  return parsed.data;
};

/** Invalidation only: each consumer reloads its own authoritative projection. */
export const PIPELINE_ENGAGEMENT_CHANGED = 'cardforge:pipeline-engagement-changed';
export const notifyPipelineEngagementChanged = () => window.dispatchEvent(new Event(PIPELINE_ENGAGEMENT_CHANGED));

export const loadPipelineEngagement = async (submissionId: string): Promise<PipelineEngagement> => {
  const response = await fetch(`/api/pipeline/engagement?${new URLSearchParams({ submissionId })}`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Pipeline source reactions are unavailable.');
  const parsed = pipelineEngagementSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Exact Pipeline engagement is incomplete or invalid. The previous vote remains unconfirmed.');
  const result = parsed.data;
  if (result.submissionId !== submissionId) throw new Error('The exact Pipeline source changed. Choose it again.');
  return result;
};
