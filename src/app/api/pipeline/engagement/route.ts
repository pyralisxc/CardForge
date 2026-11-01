import { readPipelineEngagement } from '@/features/pipeline/server/pipelineEngagement';
import { PipelineStoreError } from '@/features/pipeline/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    return createNoStoreJsonResponse(await readPipelineEngagement(new URL(request.url).searchParams.get('submissionId') ?? ''));
  } catch (error) {
    const status = error instanceof PipelineStoreError ? error.status : 503;
    return createApiErrorResponse(status, status === 400 ? 'pipeline_reaction_invalid' : status === 403 ? 'pipeline_reaction_not_permitted' : status === 404 ? 'pipeline_reaction_not_found' : 'pipeline_reaction_unavailable', error instanceof PipelineStoreError ? error.message : 'Pipeline reactions are unavailable.');
  }
}
