"use client";
import { readApiError, type ApiClientError } from '@/infrastructure/http/clientResponses';
import { pipelineEngagementSchema, pipelineVoteReceiptSchema, pipelineHeartMetricSchema, pipelineHeartReceiptSchema, type PipelineEngagement } from '../lib/pipelineEngagement';

export const parsePipelineVoteReceipt = (value: unknown, submissionId: string) => {
  const parsed = pipelineVoteReceiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.submissionId !== submissionId) throw new Error('Vote acknowledgement is invalid. Read exact engagement before any new vote.');
  return parsed.data;
};

/** Invalidation only: each consumer reloads its own authoritative projection. */
export const PIPELINE_ENGAGEMENT_CHANGED = 'cardforge:pipeline-engagement-changed';
export const notifyPipelineEngagementChanged = () => window.dispatchEvent(new Event(PIPELINE_ENGAGEMENT_CHANGED));

export const loadPipelineEngagement = async (submissionId: string, expected?: { lineageId: string; requireHeart?: boolean }): Promise<PipelineEngagement> => {
  const response = await fetch(`/api/pipeline/engagement?${new URLSearchParams({ submissionId })}`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Pipeline source reactions are unavailable.');
  const parsed = pipelineEngagementSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Exact Pipeline engagement is incomplete or invalid. The previous vote remains unconfirmed.');
  const result = parsed.data;
  if (result.submissionId !== submissionId || (expected && (result.lineageId !== expected.lineageId || (expected.requireHeart && !result.heart)))) throw new Error('The exact Pipeline source changed. Choose it again.');
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

/** Only application error codes known to represent a rejected Pipeline write settle it. */
export const isDefinitivePipelineFeedbackRejection = (error: ApiClientError, kind: 'vote' | 'heart'): boolean => {
  if (error.status === 400 && error.code === 'invalid_json') return true;
  if (error.status === 401 && error.code === 'sign_in_required') return true;
  if (error.status === 429 && error.code === 'rate_limited') return true;
  if (kind === 'heart') return (error.status === 400 && error.code === 'pipeline_reaction_invalid')
    || (error.status === 403 && error.code === 'pipeline_reaction_not_permitted')
    || (error.status === 404 && error.code === 'pipeline_reaction_not_found');
  return (error.status === 400 && error.code === 'pipeline_request_invalid')
    || (error.status === 403 && ['pipeline_not_permitted', 'contributor_access_required'].includes(error.code))
    || ([404, 409].includes(error.status) && error.code === 'pipeline_request_invalid');
};

/** Submit exactly once. Consumers own display and projection refresh, not write classification. */
export const submitPipelineVote = async (submissionId: string, voteValue: 'positive' | 'negative') => {
  try {
    const response = await fetch(`/api/pipeline/${encodeURIComponent(submissionId)}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voteValue }) });
    if (!response.ok) {
      const error = await readApiError(response, 'Vote acknowledgement is unavailable.');
      return isDefinitivePipelineFeedbackRejection(error, 'vote') ? { outcome: 'rejected' as const, message: error.message } : { outcome: 'uncertain' as const };
    }
    const payload = await response.json() as { receipt?: unknown; program?: unknown };
    const receipt = parsePipelineVoteReceipt(payload.receipt, submissionId);
    if (receipt.outcome !== 'committed') return { outcome: 'uncertain' as const };
    return { outcome: 'committed' as const, receipt, program: payload.program ?? null };
  } catch { return { outcome: 'uncertain' as const }; }
};
export const submitPipelineHeart = async (lineageId: string, hearted: boolean) => {
  try {
    const response = await fetch('/api/pipeline/hearts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lineageId, hearted }) });
    if (!response.ok) {
      const error = await readApiError(response, 'Heart acknowledgement is unavailable.');
      return isDefinitivePipelineFeedbackRejection(error, 'heart') ? { outcome: 'rejected' as const, message: error.message } : { outcome: 'uncertain' as const };
    }
    const payload = await response.json() as { receipt?: unknown };
    const receipt = parsePipelineHeartReceipt(payload.receipt, lineageId, hearted);
    if (receipt.outcome !== 'committed' || !receipt.metric) return { outcome: 'uncertain' as const };
    return { outcome: 'committed' as const, receipt, metric: receipt.metric };
  } catch { return { outcome: 'uncertain' as const }; }
};
