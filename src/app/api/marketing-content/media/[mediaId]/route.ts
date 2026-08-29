import {
  createDeveloperCockpitErrorResponse,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import {
  assertDerivativeAccess,
  assertMediaAccess,
  getCampaignMediaRecord,
  purgeCampaignMedia,
  setCampaignMediaArchived,
} from '@/features/marketing-content/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'campaigns.draft');
    const { mediaId } = await params;
    const record = await getCampaignMediaRecord(mediaId);
    assertMediaAccess(record.row, access);

    const derivativeId = new URL(request.url).searchParams.get('derivativeId');
    const derivative = derivativeId ? record.derivatives.find((item) => item.id === derivativeId) : null;
    if (derivativeId && !derivative) return createApiErrorResponse(404, 'developer_cockpit_request_invalid', 'Campaign media derivative not found.');
    if (derivative) assertDerivativeAccess(record.row, derivative, access);

    const bucket = derivative?.storage_bucket ?? record.row.normalized_storage_bucket;
    const path = derivative?.storage_path ?? record.row.normalized_storage_path;
    const supabase = getSupabaseServerClient();
    if (!supabase) return createApiErrorResponse(503, 'developer_cockpit_unavailable', 'Campaign media storage is not configured.');
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return createApiErrorResponse(404, 'developer_cockpit_request_invalid', 'Campaign media not found.');

    return new Response(data, {
      status: 200,
      headers: {
        'Cache-Control': derivative?.exposure === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store',
        'Content-Type': data.type || 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to load campaign media.');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    if (!access.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to manage campaign media retention.');
    const { mediaId } = await params;
    const body = await request.json() as { archived?: unknown };
    if (typeof body.archived !== 'boolean') return createApiErrorResponse(400, 'developer_cockpit_request_invalid', 'Choose whether to retire or restore this media item.');
    await setCampaignMediaArchived({ mediaId, archived: body.archived, ownerId: access.user.id });
    return createNoStoreJsonResponse({ updated: true });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to update campaign media retention.');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  try {
    const access = await getCurrentDeveloperCockpitAccess();
    if (!access.isOwner) return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required to permanently delete campaign media.');
    const { mediaId } = await params;
    const body = await request.json() as { confirmationFilename?: unknown };
    if (typeof body.confirmationFilename !== 'string' || !body.confirmationFilename.trim()) return createApiErrorResponse(400, 'developer_cockpit_request_invalid', 'Type the exact filename to confirm permanent deletion.');
    await purgeCampaignMedia({ mediaId, confirmationFilename: body.confirmationFilename.trim() });
    return createNoStoreJsonResponse({ deleted: true });
  } catch (error) {
    return createDeveloperCockpitErrorResponse(error, 'Unable to permanently delete campaign media.');
  }
}
