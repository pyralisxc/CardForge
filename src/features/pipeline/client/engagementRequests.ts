"use client";
import { readApiError } from '@/infrastructure/http/clientResponses';
import { pipelineEngagementSchema, pipelineVoteReceiptSchema, pipelineHeartMetricSchema, pipelineHeartReceiptSchema, type PipelineEngagement } from '../lib/pipelineEngagement';

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

export const parsePipelineHeartReceipt = (value: unknown, lineageId: string, hearted: boolean) => {
  const parsed = pipelineHeartReceiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.lineageId !== lineageId) throw new Error('Heart acknowledgement is invalid. Read exact heart status before another action.');
  const receipt = parsed.data;
  if (receipt.outcome === 'committed' && (!receipt.metric || receipt.metric.lineageId !== lineageId || receipt.metric.hearted !== hearted)) {
    throw new Error('Heart acknowledgement is invalid. Read exact heart status before another action.');
  }
  if (receipt.outcome === 'uncertain' && receipt.metric !== null) throw new Error('Heart acknowledgement is invalid. Read exact heart status before another action.');
  return receipt;
};

export const loadPipelineHeartMetric = async (lineageId: string) => {
  const response = await fetch(`/api/pipeline/hearts?${new URLSearchParams({ lineageId })}`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Pipeline heart status is unavailable.');
  const payload = await response.json() as { metrics?: unknown };
  if (!Array.isArray(payload.metrics) || payload.metrics.length !== 1) throw new Error('Exact Pipeline heart status is unavailable.');
  const metric = pipelineHeartMetricSchema.parse(payload.metrics[0]);
  if (metric.lineageId !== lineageId) throw new Error('The exact Pipeline lineage changed.');
  return metric;
};
