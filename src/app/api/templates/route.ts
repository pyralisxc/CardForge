import type { TCGCardTemplate } from '@/domain/templates';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  templatePayloadSchema,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  archivePipelineRegistryAsset,
  DeveloperAssetRegistryCommandError,
  isRepositoryTemplate,
  submitTemplateRevision,
  toRepositoryAssetFileName,
} from '@/features/developer-assets/server';
import { getCachedCardForgeCatalog, revalidateCardForgeCatalog } from '@/features/developer-assets/server/catalogCache';
import {
  DeveloperCockpitAccessError,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-access/server';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse((await getCachedCardForgeCatalog(entitlement.accessMode)).templates);
  } catch (error) {
    console.error('Failed to load template library:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to load template library.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'library.submit');

    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const validation = templatePayloadSchema.safeParse(parsedBody.data);
    if (!validation.success || !isRepositoryTemplate(validation.data)) {
      const details = validation.success ? ['Template payload is missing required fields.'] : formatZodIssues(validation.error.issues);
      return createApiErrorResponse(400, 'invalid_template_payload', 'Invalid template payload.', details);
    }

    const template = validation.data as TCGCardTemplate;
    const source = template.templateSource === 'default' ? 'default' : 'user';
    const fileName = toRepositoryAssetFileName(template.id || template.name, 'template');
    if (source !== 'default') {
      return createApiErrorResponse(
        400,
        'personal_library_is_local',
        'Personal templates are saved in the browser library, not the server filesystem.',
      );
    }
    const submissionKey = request.headers.get('Idempotency-Key')?.trim() || '';
    if (!submissionKey || submissionKey.length > 160) {
      return createApiErrorResponse(400, 'invalid_idempotency_key', 'A valid revision submission key is required.');
    }
    const revision = await submitTemplateRevision({
      template: { ...template, id: template.id!, templateSource: 'default' },
      developerId: access.user.id,
      developerEmail: access.email,
      expectedRevision: Number.isInteger(template.templateRevision) && Number(template.templateRevision) >= 0
        ? Number(template.templateRevision)
        : 0,
      submissionKey,
    });
    revalidateCardForgeCatalog();

    return createNoStoreJsonResponse({
      ok: true,
      fileName,
      revision,
      template: { ...template, templateSource: source, templateRegistryStatus: 'submitted' },
    }, { status: 202 });
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'developer_access_required',
        error.message,
      );
    }
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'template_library_unavailable', error.message);
    }
    console.error('Failed to save template:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to save template.'
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'library.publish');

    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const body = parsedBody.data as { id?: unknown; source?: unknown };
    const id = typeof body?.id === 'string' ? body.id : null;
    const source = body?.source === 'default' ? 'default' : 'user';

    if (!id || id.trim().length === 0) {
      return createApiErrorResponse(400, 'invalid_template_id', 'Template id is required.');
    }

    const fileName = toRepositoryAssetFileName(id, 'template');
    if (source !== 'default') {
      return createApiErrorResponse(
        400,
        'personal_library_is_local',
        'Personal templates are deleted from the browser library, not the server filesystem.',
      );
    }
    await archivePipelineRegistryAsset(id);
    revalidateCardForgeCatalog();

    return createNoStoreJsonResponse({ ok: true, fileName });
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'developer_access_required',
        error.message,
      );
    }
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'template_library_unavailable', error.message);
    }
    console.error('Failed to delete template:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to delete template.'
    );
  }
}
