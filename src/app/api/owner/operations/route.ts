import {
  getOwnerOperationsOverviewPayload,
  getOwnerIntegrationStatus,
  getOwnerSiteOperationsPayload,
  getOwnerSiteControlPayload,
} from '@/features/owner/server';
import {
  BusinessIdentityStoreError,
} from '@/features/business-identity/server';
import {
  FounderProfileStoreError,
  PublicSiteStoreError,
} from '@/features/public-site/server';
import {
  LegalDocumentStoreError,
} from '@/features/legal/server';
import {
  RoadmapStoreError, getWebsiteReleaseRecords,
} from '@/features/roadmap/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { createServerTimingTracker } from '@/infrastructure/http/serverTiming';
import { publishOwnerSiteContentBlock, publishOwnerBusinessIdentity, publishOwnerFounderProfile, publishOwnerLegalDocument, publishOwnerRoadmapSettings, publishOwnerRoadmapStatus, publishOwnerWebsiteRelease } from '@/features/owner/server/ownerSiteCommands';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const access = await getCurrentOwnerAccess();
  if (!access.isOwner) {
    return {
      ok: false as const,
      response: createApiErrorResponse(
        403,
        'owner_access_required',
        'Owner access is required for these operations.'
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
    if (scope === 'websiteReleases') return createNoStoreJsonResponse({items:await getWebsiteReleaseRecords()});
    if (scope === 'site') {
      const siteControls = await timing.track('site_controls', getOwnerSiteControlPayload);
      const response = createNoStoreJsonResponse({ siteControls });
      response.headers.set('Server-Timing', timing.header());
      return response;
    }
    if (scope && scope !== 'overview') {
      return createApiErrorResponse(400, 'owner_request_invalid', 'Unknown owner operations scope.');
    }

    const [integrationStatus, overview] = await Promise.all([
      timing.track('integration_status', async () => getOwnerIntegrationStatus()),
      timing.track('owner_overview', getOwnerOperationsOverviewPayload),
    ]);

    const response = createNoStoreJsonResponse({
      ownerAccess: owner.access,
      integrationStatus,
      overview,
    });
    response.headers.set('Server-Timing', timing.header());
    return response;
  } catch (error) {
    console.error('Failed to load owner operations:', error);
    return createApiErrorResponse(500, 'owner_operations_unavailable', 'Unable to load owner operations.');
  }
}

export async function PUT(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return owner.response;

    const body = await request.json() as {
      kind?: unknown;
      websiteRelease?: unknown;
      businessIdentity?: Record<string, unknown>;
      expectedIdentityVersion?: unknown;
      expectedUpdatedAt?: unknown;
      siteMechanics?: Record<string, unknown>;
      siteContentBlock?: { slug?: unknown; body?: unknown; updatedAt?: unknown };
      founderProfile?: Record<string, unknown>;
      legalDocument?: {
        slug?: unknown;
        title?: unknown;
        body?: unknown;
        effectiveDate?: unknown;
        expectedBusinessIdentityVersion?: unknown;
        expectedVersion?: unknown;
      };
      roadmapItem?: { itemId?: unknown; status?: unknown; expectedUpdatedAt?: unknown };
    };
    const respondPublication = async (publication: { value: unknown; receipt: import('@/features/owner/server/ownerSiteCommands').OwnerCommittedMutationReceipt }) => {
      try { return createNoStoreJsonResponse({ publication, operations: await getOwnerSiteOperationsPayload() }); }
      catch (error) {
        console.error('Owner publication committed; combined view unavailable:', error);
        return createNoStoreJsonResponse({ publication, operations: null });
      }
    };
    const actor = { userId: owner.access.userId ?? 'owner', email: owner.access.email };
    if (body.kind === 'businessIdentity') {
      return respondPublication(await publishOwnerBusinessIdentity({ actor, input: body.businessIdentity ?? {},
        expectedIdentityVersion: body.expectedIdentityVersion as number }));
    }

    if (body.kind === 'siteMechanics') return respondPublication(await publishOwnerRoadmapSettings({ actor, input: body.siteMechanics ?? {} }));

    if (body.kind === 'siteContent') {
      const publication = await publishOwnerSiteContentBlock({
        actor: {
          userId: owner.access.userId ?? 'owner',
          email: owner.access.email,
        },
        input: body.siteContentBlock
          ? {
              slug: body.siteContentBlock.slug,
              body: body.siteContentBlock.body,
              expectedUpdatedAt: body.siteContentBlock.updatedAt,
            }
          : {},
      });
      return createNoStoreJsonResponse(publication);
    }

    if (body.kind === 'founderProfile') {
      return respondPublication(await publishOwnerFounderProfile({ actor, input: body.founderProfile ?? {},
        expectedUpdatedAt: body.expectedUpdatedAt as string | null }));
    }

    if (body.kind === 'legal') return respondPublication(await publishOwnerLegalDocument({ actor, input: body.legalDocument ?? {} }));
    if (body.kind === 'websiteRelease') return respondPublication(await publishOwnerWebsiteRelease({actor,input:body.websiteRelease}));
    if (body.kind === 'roadmapStatus') return respondPublication(await publishOwnerRoadmapStatus({ actor, input: body.roadmapItem ?? {} }));

    return createApiErrorResponse(400, 'owner_request_invalid', 'Unknown owner operations update.');
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
          ? 'owner_operations_unavailable'
          : error.status === 409
            ? 'owner_operations_conflict'
            : 'owner_request_invalid',
        error.message
      );
    }

    console.error('Failed to update owner operations:', error);
    return createApiErrorResponse(500, 'owner_request_invalid', 'Unable to update owner operations.');
  }
}