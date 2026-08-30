import type { AppearanceStylePreset } from '@/domain/templates';
import { getCurrentCardforgeEntitlement } from '@/features/account/server';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  archivePipelineRegistryAsset,
  PipelineRegistryCommandError,
  getRepositoryStyleLibrary,
  isRepositoryStyle,
  publishRepositoryStyle,
} from '@/features/pipeline/server';
import { getCachedCardForgeCatalog, revalidateCardForgeCatalog } from '@/features/pipeline/server/catalogCache';
import {
  ContributorAccessError,
  getCurrentContributorAccess,
  requireContributionScope,
} from '@/features/contributor-access/server';

export async function GET() {
  try {
    const entitlement = await getCurrentCardforgeEntitlement();
    return createNoStoreJsonResponse((await getCachedCardForgeCatalog(entitlement.accessMode)).styles);
  } catch (error) {
    console.error('Failed to load style library:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to load style library.'
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await getCurrentContributorAccess();
    requireContributionScope(access, 'library.publish');

    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const body = parsedBody.data;
    const current = await getRepositoryStyleLibrary('dev');
    const bodyRecord = typeof body === 'object' && body !== null
      ? body as Record<string, unknown>
      : null;
    const incomingStyles: unknown[] = bodyRecord && Array.isArray(bodyRecord.styles)
      ? bodyRecord.styles
      : [body];
    const invalidStyleDetails: string[] = [];
    const validStyles: AppearanceStylePreset[] = [];

    incomingStyles.forEach((entry, index) => {
      const parsed = stylePresetPayloadSchema.safeParse(entry);
      if (!parsed.success) {
        invalidStyleDetails.push(...formatZodIssues(parsed.error.issues).map((message) => `styles[${index}].${message}`));
        return;
      }
      if (isRepositoryStyle(parsed.data)) {
        validStyles.push(parsed.data);
      }
    });

    if (validStyles.length === 0) {
      return createApiErrorResponse(
        400,
        'invalid_style_payload',
        'A valid style preset is required.',
        invalidStyleDetails.length > 0 ? invalidStyleDetails : undefined
      );
    }

    const merged = [...current.styles];
    validStyles.forEach(style => {
      const index = merged.findIndex(existing => existing.id === style.id);
      if (index > -1) merged[index] = style;
      else merged.push(style);
    });

    await Promise.all(validStyles.map(publishRepositoryStyle));
    revalidateCardForgeCatalog();
    const next = { version: current.version || 1, styles: merged.sort((a, b) => a.name.localeCompare(b.name)) };
    return createNoStoreJsonResponse(next);
  } catch (error) {
    if (error instanceof ContributorAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'contributor_access_required',
        error.message,
      );
    }
    if (error instanceof PipelineRegistryCommandError) {
      return createApiErrorResponse(error.status, 'style_library_unavailable', error.message);
    }
    console.error('Failed to save style library:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to save style library.'
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await getCurrentContributorAccess();
    requireContributionScope(access, 'library.publish');

    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const body = parsedBody.data as { id?: unknown };
    if (typeof body?.id !== 'string' || body.id.trim().length === 0) {
      return createApiErrorResponse(400, 'invalid_style_id', 'Style id is required.');
    }
    await archivePipelineRegistryAsset(body.id);
    revalidateCardForgeCatalog();
    const next = await getRepositoryStyleLibrary('dev');
    return createNoStoreJsonResponse(next);
  } catch (error) {
    if (error instanceof ContributorAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'contributor_access_required',
        error.message,
      );
    }
    if (error instanceof PipelineRegistryCommandError) {
      return createApiErrorResponse(error.status, 'style_library_unavailable', error.message);
    }
    console.error('Failed to delete style:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to delete style.'
    );
  }
}
