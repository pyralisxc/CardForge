import { revalidatePath } from 'next/cache';

import { isStudioAssetDestination } from '@/domain/templates';
import {
  DeveloperAssetRegistryCommandError,
  getOwnerStudioRoutingPage,
  revalidateCardForgeCatalog,
  updateOwnerStudioRouting,
} from '@/features/developer-assets/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

const requireOwner = async () => {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner) {
    return { ok: false as const, response: createApiErrorResponse(403, 'owner_access_required', 'Owner access is required for the Studio Map.') };
  }
  return { ok: true as const, owner };
};

export async function GET(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return owner.response;
    const url = new URL(request.url);
    const destinationValue = url.searchParams.get('destination');
    const destination = isStudioAssetDestination(destinationValue) ? destinationValue : null;
    const page = await getOwnerStudioRoutingPage({
      destination,
      query: url.searchParams.get('query') ?? '',
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 12),
    });
    return createNoStoreJsonResponse({ page });
  } catch (error) {
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'developer_asset_unavailable', error.message);
    }
    console.error('Unable to load owner Studio routing:', error);
    return createApiErrorResponse(500, 'developer_asset_unavailable', 'Unable to load the Studio Map.');
  }
}

export async function PUT(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return owner.response;
    const body = await request.json() as Record<string, unknown>;
    await updateOwnerStudioRouting({
      assetId: body.assetId,
      mode: body.mode,
      destinations: body.destinations,
      sortOrder: body.sortOrder,
      featured: body.featured,
    });
    revalidateCardForgeCatalog();
    revalidatePath('/studio');
    const assetId = typeof body.assetId === 'string' ? body.assetId : null;
    const activityRecorded = await recordOwnerActivity({
      actorUserId: owner.owner.userId ?? 'owner',
      actorEmail: owner.owner.email,
      action: 'pipeline.studio-routing.update',
      targetType: 'asset_registry',
      targetId: assetId,
      summary: body.mode === 'automatic'
        ? 'Restored automatic Studio placement for a Pipeline asset.'
        : 'Updated owner-controlled Studio placement for a Pipeline asset.',
    });
    return createNoStoreJsonResponse({ ok: true, activityRecorded });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return createApiErrorResponse(400, 'invalid_json', 'Request body must be valid JSON.');
    }
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, error.status === 400 ? 'owner_request_invalid' : 'developer_asset_unavailable', error.message);
    }
    console.error('Unable to update owner Studio routing:', error);
    return createApiErrorResponse(500, 'developer_asset_unavailable', 'Unable to update the Studio Map.');
  }
}
