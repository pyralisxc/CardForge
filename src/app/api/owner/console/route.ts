import {
  getOwnerConsolePayload,
  getOwnerIntegrationStatus,
} from '@/features/owner/server';
import {
  BusinessIdentityStoreError,
  revalidatePublicIdentityCache,
  updateBusinessIdentity,
} from '@/features/business-identity/server';
import {
  FounderProfileStoreError,
  PublicSiteStoreError,
  revalidateFounderProfile,
  revalidateSiteContentCache,
  updateFounderProfile,
  updateSiteContentBlock,
} from '@/features/public-site/server';
import { revalidatePath } from 'next/cache';
import {
  LegalDocumentStoreError,
  publishLegalDocument,
  revalidateLegalDocumentCache,
} from '@/features/legal/server';
import {
  RoadmapStoreError,
  updateRoadmapAdminItemStatus,
  updateRoadmapSettings,
} from '@/features/roadmap/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const access = await getCurrentOwnerAccess();
  if (!access.isOwner) {
    return {
      ok: false as const,
      response: createApiErrorResponse(
        403,
        'owner_access_required',
        'Owner access is required for this console.'
      ),
    };
  }
  return { ok: true as const, access };
};

export async function GET() {
  const timing = createServerTimingTracker();
  try {
    const owner = await timing.track('owner_access', requireOwner);
    if (!owner.ok) return owner.response;

    const [integrationStatus, consolePayload] = await Promise.all([
      timing.track('integration_status', async () => getOwnerIntegrationStatus()),
      timing.track('owner_payload', getOwnerConsolePayload),
    ]);

    const response = createNoStoreJsonResponse({
      ownerAccess: owner.access,
      integrationStatus,
      console: consolePayload,
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
  } catch (error) {
    console.error('Failed to load owner console:', error);
    return createApiErrorResponse(
      500,
      'owner_console_unavailable',
      'Unable to load owner console.'
    );
  }
}

export async function PUT(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return owner.response;

    const body = await request.json() as {
      kind?: unknown;
      businessIdentity?: Record<string, unknown>;
      expectedIdentityVersion?: unknown;
      siteMechanics?: Record<string, unknown>;
      siteContentBlock?: { slug?: unknown; body?: unknown };
      founderProfile?: Record<string, unknown>;
      legalDocument?: {
        slug?: unknown;
        title?: unknown;
        body?: unknown;
        effectiveDate?: unknown;
        expectedBusinessIdentityVersion?: unknown;
      };
      roadmapItem?: { itemId?: unknown; status?: unknown };
    };

    if (body.kind === 'businessIdentity') {
      await updateBusinessIdentity(
        body.businessIdentity ?? {},
        body.expectedIdentityVersion,
      );
      revalidatePublicIdentityCache();
      return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
    }

    if (body.kind === 'siteMechanics') {
      await updateRoadmapSettings(body.siteMechanics ?? {});
      return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
    }

    if (body.kind === 'siteContent') {
      const updatedBlocks = await updateSiteContentBlock(body.siteContentBlock ?? {});
      const updatedBlock = updatedBlocks.find(
        ({ slug }) => slug === body.siteContentBlock?.slug,
      );
      if (updatedBlock) {
        revalidateSiteContentCache(updatedBlock.group);
        if (updatedBlock.group === 'landing') revalidatePath('/');
        if (updatedBlock.group === 'about') revalidatePath('/about');
      }
      return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
    }

    if (body.kind === 'founderProfile') {
      await updateFounderProfile(body.founderProfile ?? {});
      revalidateFounderProfile();
      revalidatePath('/cameron');
      revalidatePath('/', 'layout');
      return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
    }

    if (body.kind === 'legal') {
      const legalDocuments = await publishLegalDocument(body.legalDocument ?? {});
      const publishedDocument = legalDocuments.find(
        ({ slug }) => slug === body.legalDocument?.slug,
      );
      if (publishedDocument) revalidateLegalDocumentCache(publishedDocument.slug);
      return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
    }

    if (body.kind === 'roadmapStatus') {
      await updateRoadmapAdminItemStatus(body.roadmapItem ?? {});
      return createNoStoreJsonResponse({ console: await getOwnerConsolePayload() });
    }

    return createApiErrorResponse(400, 'owner_request_invalid', 'Unknown owner console update.');
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }

    if (
      error instanceof BusinessIdentityStoreError
      || error instanceof PublicSiteStoreError
      || error instanceof FounderProfileStoreError
      || error instanceof LegalDocumentStoreError
      || error instanceof RoadmapStoreError
    ) {
      return createApiErrorResponse(
        error.status,
        error.status === 503
          ? 'owner_console_unavailable'
          : error.status === 409
            ? 'owner_console_conflict'
            : 'owner_request_invalid',
        error.message
      );
    }

    console.error('Failed to update owner console:', error);
    return createApiErrorResponse(
      500,
      'owner_request_invalid',
      'Unable to update owner console.'
    );
  }
}
