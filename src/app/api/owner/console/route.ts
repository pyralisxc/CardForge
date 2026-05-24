import {
  getOwnerConsolePayload,
  getOwnerIntegrationStatus,
  OwnerConsoleStoreError,
  updateLegalDocument,
  updateFounderBetaCampaign,
  updateOwnerSettings,
  updateOwnerRoadmapItemStatus,
  updateSiteMechanicsSettings,
} from '@/lib/ownerConsoleStore';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { getCurrentOwnerAccess } from '@/lib/serverOwnerAccess';

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
  try {
    const owner = await requireOwner();
    if (!owner.ok) return owner.response;

    return createNoStoreJsonResponse({
      ownerAccess: owner.access,
      integrationStatus: getOwnerIntegrationStatus(),
      console: await getOwnerConsolePayload(),
    });
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
      settings?: Record<string, unknown>;
      siteMechanics?: Record<string, unknown>;
      legalDocument?: { slug?: unknown; title?: unknown; body?: unknown };
      founderBetaCampaign?: Record<string, unknown>;
      roadmapItem?: { itemId?: unknown; status?: unknown };
    };

    if (body.kind === 'settings') {
      const payload = await updateOwnerSettings(body.settings ?? {});
      return createNoStoreJsonResponse({ console: payload });
    }

    if (body.kind === 'siteMechanics') {
      const payload = await updateSiteMechanicsSettings(body.siteMechanics ?? {});
      return createNoStoreJsonResponse({ console: payload });
    }

    if (body.kind === 'legal') {
      const payload = await updateLegalDocument(body.legalDocument ?? {});
      return createNoStoreJsonResponse({ console: payload });
    }

    if (body.kind === 'founderBeta') {
      const payload = await updateFounderBetaCampaign(body.founderBetaCampaign ?? {});
      return createNoStoreJsonResponse({ console: payload });
    }

    if (body.kind === 'roadmapStatus') {
      const payload = await updateOwnerRoadmapItemStatus(body.roadmapItem ?? {});
      return createNoStoreJsonResponse({ console: payload });
    }

    return createApiErrorResponse(400, 'owner_request_invalid', 'Unknown owner console update.');
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }

    if (error instanceof OwnerConsoleStoreError) {
      return createApiErrorResponse(
        error.status,
        error.status === 503 ? 'owner_console_unavailable' : 'owner_request_invalid',
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
