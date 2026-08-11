import {
  assertMediaAccess,
  createDeveloperCockpitErrorResponse,
  getCampaignMediaRecord,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-cockpit/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const access = await getCurrentDeveloperCockpitAccess(); requireContributionScope(access, 'campaigns.draft');
    const { mediaId } = await params; const record = await getCampaignMediaRecord(mediaId); assertMediaAccess(record.row, access);
    const derivativeId = new URL(request.url).searchParams.get('derivativeId');
    const derivative = derivativeId ? record.derivatives.find((item) => item.id === derivativeId) : null;
    if (derivativeId && !derivative) return createApiErrorResponse(404, 'developer_cockpit_request_invalid', 'Campaign media derivative not found.');
    const bucket = derivative?.storage_bucket ?? record.row.normalized_storage_bucket; const path = derivative?.storage_path ?? record.row.normalized_storage_path;
    const supabase = getSupabaseServerClient(); if (!supabase) return createApiErrorResponse(503, 'developer_cockpit_unavailable', 'Campaign media storage is not configured.');
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) return createApiErrorResponse(404, 'developer_cockpit_request_invalid', 'Campaign media not found.');
    return new Response(data, { status: 200, headers: { 'Cache-Control': derivative?.exposure === 'public' ? 'public, max-age=31536000, immutable' : 'private, no-store', 'Content-Type': data.type || 'image/webp', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return createDeveloperCockpitErrorResponse(error, 'Unable to load campaign media.'); }
}
