import {
  getOwnerConsoleOverviewPayload,
  getOwnerIntegrationStatus,
  getOwnerSiteConsolePayload,
  getOwnerSiteControlPayload,
  recordOwnerActivity,
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

export async function GET(request: Request) {
  const timing = createServerTimingTracker();
  try {
    const owner = await timing.track('owner_access', requireOwner);
    if (!owner.ok) return owner.response;
    const scope = new URL(request.url).searchParams.get('scope');
    if (scope === 'site') {
      const siteControls = await timing.track('site_controls', getOwnerSiteControlPayload);
      const response = createNoStoreJsonResponse({ siteControls });
      response.headers.set('Server-Timing', timing.header());
      return response;
    }
    if (scope && scope !== 'overview') {
      return createApiErrorResponse(400, 'owner_request_invalid', 'Unknown owner console scope.');
    }

    const [integrationStatus, overview] = await Promise.all([
      timing.track('integration_status', async () => getOwnerIntegrationStatus()),
      timing.track('owner_overview', getOwnerConsoleOverviewPayload),
    ]);

    const response = createNoStoreJsonResponse({
      ownerAccess: owner.access,
      integrationStatus,
      overview,
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
  } catch (error) {
    console.error('Failed to load owner console:', error);
    return createApiErrorResponse(500, 'owner_console_unavailable', 'Unable to load owner console.');
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
    const respond = async ({ action, targetType, targetId, summary }: { action: string; targetType: string; targetId?: string | null; summary: string }) => {
      const activityRecorded = await recordOwnerActivity({
        actorUserId: owner.access.userId ?? 'owner',
        actorEmail: owner.access.email,
        action,
        targetType,
        targetId,
        summary,
      });
      return createNoStoreJsonResponse({ console: await getOwnerSiteConsolePayload(), activityRecorded });
    };

    if (body.kind === 'businessIdentity') {
      await updateBusinessIdentity(body.businessIdentity ?? {}, body.expectedIdentityVersion);
      revalidatePublicIdentityCache();
      return respond({ action: 'identity.update', targetType: 'business_identity', targetId: 'cardforge', summary: 'Updated public business identity and legal operator details.' });
    }

    if (body.kind === 'siteMechanics') {
      await updateRoadmapSettings(body.siteMechanics ?? {});
      return respond({ action: 'roadmap.settings.update', targetType: 'roadmap', targetId: 'settings', summary: 'Updated roadmap economics, limits, or presentation rules.' });
    }

    if (body.kind === 'siteContent') {
      const updatedBlocks = await updateSiteContentBlock(body.siteContentBlock ?? {});
      const updatedBlock = updatedBlocks.find(({ slug }) => slug === body.siteContentBlock?.slug);
      if (updatedBlock) {
        revalidateSiteContentCache();
        revalidatePath('/', 'layout');
      }
      return respond({ action: 'site.copy.publish', targetType: 'site_content', targetId: typeof body.siteContentBlock?.slug === 'string' ? body.siteContentBlock.slug : null, summary: 'Published an owner-authored public site copy block.' });
    }

    if (body.kind === 'founderProfile') {
      await updateFounderProfile(body.founderProfile ?? {});
      revalidateFounderProfile();
      revalidatePath('/cameron');
      revalidatePath('/', 'layout');
      return respond({ action: 'founder.profile.update', targetType: 'founder_profile', targetId: 'cameron', summary: 'Updated the public founder profile, priorities, or social destinations.' });
    }

    if (body.kind === 'legal') {
      const legalDocuments = await publishLegalDocument(body.legalDocument ?? {});
      const publishedDocument = legalDocuments.find(({ slug }) => slug === body.legalDocument?.slug);
      if (publishedDocument) revalidateLegalDocumentCache(publishedDocument.slug);
      return respond({ action: 'legal.publish', targetType: 'legal_document', targetId: typeof body.legalDocument?.slug === 'string' ? body.legalDocument.slug : null, summary: 'Published a new version of a CardForge legal document.' });
    }

    if (body.kind === 'roadmapStatus') {
      await updateRoadmapAdminItemStatus(body.roadmapItem ?? {});
      return respond({ action: 'roadmap.item.status.update', targetType: 'roadmap_item', targetId: typeof body.roadmapItem?.itemId === 'string' ? body.roadmapItem.itemId : null, summary: 'Updated an owner-controlled roadmap item status.' });
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
    return createApiErrorResponse(500, 'owner_request_invalid', 'Unable to update owner console.');
  }
}
