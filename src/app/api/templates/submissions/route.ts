import type { TCGCardTemplate } from '@/domain/templates';
import {
  createNewSharedTemplateId,
  createTemplatePipelineDraft,
  DeveloperAssetRegistryCommandError,
  isRepositoryTemplate,
} from '@/features/developer-assets/server';
import {
  DeveloperCockpitAccessError,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-access/server';
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
    const access = await getCurrentDeveloperCockpitAccess();
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
      developerId: access.user.id,
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
      developerId: access.user.id,
      developerEmail: access.email,
      submissionKey,
    });

    return createNoStoreJsonResponse({
      ok: true,
      draft,
      openInPipelineUrl: `/developer/cockpit?tab=library&submission=${encodeURIComponent(draft.id)}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'developer_access_required',
        error.message,
      );
    }
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'developer_asset_unavailable', error.message);
    }
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'developer_asset_unavailable', error.message);
    }
    console.error('Failed to create a Template Pipeline draft:', error);
    return createApiErrorResponse(500, 'developer_asset_unavailable', 'Unable to continue this Template in the Pipeline.');
  }
}
