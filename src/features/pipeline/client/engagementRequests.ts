"use client";
import { readApiError } from '@/infrastructure/http/clientResponses';
import type { PipelineEngagement } from '../lib/pipelineEngagement';

/** Invalidation only: each consumer reloads its own authoritative projection. */
export const PIPELINE_ENGAGEMENT_CHANGED = 'cardforge:pipeline-engagement-changed';
export const notifyPipelineEngagementChanged = () => window.dispatchEvent(new Event(PIPELINE_ENGAGEMENT_CHANGED));

export const loadPipelineEngagement = async (submissionId: string): Promise<PipelineEngagement> => {
  const response = await fetch(`/api/pipeline/engagement?${new URLSearchParams({ submissionId })}`, { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Pipeline source reactions are unavailable.');
  const result = await response.json() as PipelineEngagement;
  if (result.submissionId !== submissionId) throw new Error('The exact Pipeline source changed. Choose it again.');
  return result;
};
