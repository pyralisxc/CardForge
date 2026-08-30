import type { TCGCardTemplate } from '@/domain/templates';
import {
  createNewSharedTemplateId,
  createTemplatePipelineDraft,
  PipelineRegistryCommandError,
  isRepositoryTemplate,
} from '@/features/pipeline/server';
import {
  ContributorAccessError,
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';
import {
  formatZodIssues,
  parseJsonBodyWithLimit,
  STUDIO_CONTENT_MAX_JSON_BODY_BYTES,
  templatePayloadSchema,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const access = await getCurrentContributorAccess();
    requireContributionScope(access, 'library.submit');

    const rateLimit = await consumeRateLimit({
      action: 'template-pipeline-draft',
      identity: access.user.id,
      limit: 60,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many Pipeline draft handoffs.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'template_pipeline_handoffs',
        maximum: 60,
        unit: 'attempts_per_hour',
      });
    }

    const parsedBody = await parseJsonBodyWithLimit(request, STUDIO_CONTENT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message,
      );
    }

    const validation = templatePayloadSchema.safeParse(parsedBody.data);
    if (!validation.success || !isRepositoryTemplate(validation.data)) {
      const details = validation.success
        ? ['Template payload is missing required fields.']
        : formatZodIssues(validation.error.issues);
      return createApiErrorResponse(400, 'invalid_template_payload', 'Invalid Template payload.', details);
    }

    const localTemplate = validation.data as TCGCardTemplate;
    if (localTemplate.templateSource === 'default') {
      return createApiErrorResponse(
        409,
        'invalid_template_payload',
        'This Template already belongs to the shared library. Save it as a revision instead.',
      );
    }

    const submissionKey = request.headers.get('Idempotency-Key')?.trim() || '';
    if (!submissionKey || submissionKey.length > 160) {
      return createApiErrorResponse(400, 'invalid_idempotency_key', 'A valid Pipeline handoff key is required.');
    }

    const sharedTemplateId = createNewSharedTemplateId({
      contributorId: access.user.id,
      localTemplateId: localTemplate.id!,
      name: localTemplate.name,
    });
    const draft = await createTemplatePipelineDraft({
      template: {
        ...localTemplate,
        id: sharedTemplateId,
        templateSource: 'default',
        templateLibrarySource: 'pipeline',
        templateAccessTier: 'developer',
        templateRegistryStatus: 'draft',
        templateRevision: 0,
        templateRevisionId: undefined,
      },
      contributorId: access.user.id,
      contributorEmail: access.email,
      submissionKey,
    });

    return createNoStoreJsonResponse({
      ok: true,
      draft,
      openInPipelineUrl: `/account?section=library&scope=pipeline&tool=contribute&submission=${encodeURIComponent(draft.id)}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ContributorAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'contributor_access_required',
        error.message,
      );
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'pipeline_unavailable', error.message);
    }
    if (error instanceof PipelineRegistryCommandError) {
      return createApiErrorResponse(error.status, 'pipeline_unavailable', error.message);
    }
    console.error('Failed to create a Template Pipeline draft:', error);
    return createApiErrorResponse(500, 'pipeline_unavailable', 'Unable to continue this Template in the Pipeline.');
  }
}
