import {
  DeveloperCockpitAccessError,
  getCurrentDeveloperCockpitAccess,
} from '@/features/developer-access/server';
import {
  createDeveloperTemplateDraft,
  getCurrentStudioDocumentAccount,
  gptTemplateDraftInputSchema,
  StudioDocumentAccessError,
  StudioDocumentStoreError,
} from '@/features/studio-documents/server';
import {
  formatZodIssues,
  parseJsonBodyWithLimit,
  STUDIO_CONTENT_MAX_JSON_BODY_BYTES,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse, createRateLimitErrorResponse } from '@/infrastructure/http/apiResponses';
import { consumeRateLimit } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const developerAccess = await getCurrentDeveloperCockpitAccess();

    const rateLimit = await consumeRateLimit({
      action: 'studio-ai-draft',
      identity: developerAccess.user.id,
      limit: 60,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse('Too many AI Studio drafts.', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        resource: 'studio_ai_drafts',
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
    const validation = gptTemplateDraftInputSchema.safeParse(parsedBody.data);
    if (!validation.success) {
      return createApiErrorResponse(
        400,
        'studio_document_invalid',
        'Invalid editable template draft.',
        formatZodIssues(validation.error.issues),
      );
    }

    const account = await getCurrentStudioDocumentAccount();
    if (account.ownerUserId !== developerAccess.user.id) {
      return createApiErrorResponse(403, 'developer_access_required', 'Developer account ownership could not be verified.');
    }
    const document = await createDeveloperTemplateDraft(developerAccess, validation.data);

    return createNoStoreJsonResponse({
      document,
      watermark: account.watermark,
      openInStudioUrl: `/studio?document=${encodeURIComponent(document.id)}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'developer_access_required',
        error.message,
      );
    }
    if (error instanceof StudioDocumentAccessError) {
      return createApiErrorResponse(error.status, 'sign_in_required', error.message);
    }
    if (error instanceof StudioDocumentStoreError) {
      return createApiErrorResponse(error.status, 'studio_document_unavailable', error.message);
    }
    console.error('Failed to create an AI Studio draft:', error);
    return createApiErrorResponse(500, 'studio_document_unavailable', 'Unable to create the AI Studio draft.');
  }
}
