"use client";

import type { PipelineSubmission } from '@/features/pipeline/lib/pipelineProgram';
import { readApiError } from '@/infrastructure/http/clientResponses';

export const loadOwnPublishedPipelineSubmissions = async (): Promise<PipelineSubmission[]> => {
  const response = await fetch('/api/pipeline/my-published', { cache: 'no-store' });
  if (!response.ok) throw await readApiError(response, 'Your published Pipeline work is unavailable.');
  const payload = await response.json() as { submissions?: PipelineSubmission[] };
  return Array.isArray(payload.submissions) ? payload.submissions : [];
};
