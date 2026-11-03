import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';
import { getPersonalLibraryItem, removePersonalLibraryItem } from '@/features/personal-library/server';
import {
  getPersonalLibraryAccount,
  parsePersonalLibraryJson,
  toPersonalLibraryErrorResponse,
} from '../_helpers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { ownerUserId } = await getPersonalLibraryAccount();
    const { itemId } = await params;
    const body = await parsePersonalLibraryJson(request);
    const receipt = await removePersonalLibraryItem(ownerUserId, { ...body, itemId });
    if (receipt.outcome !== 'removed') {
      const status = receipt.outcome === 'absent' ? 404 : 503;
      const failure = createApiErrorResponse(status, status === 404 ? 'personal_library_not_found' : 'personal_library_unavailable', receipt.message, { kind: status === 404 ? 'not_found' : 'unavailable', retryable: false, nextAction: 'Read the exact index entry; do not automatically replay DELETE or infer operation causation from absence.' });
      return Response.json({ ...await failure.json(), receipt }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toPersonalLibraryErrorResponse(error, 'Unable to remove that personal-library item.');
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { ownerUserId } = await getPersonalLibraryAccount();
    const { itemId } = await params;
    return Response.json(await getPersonalLibraryItem(ownerUserId, itemId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return toPersonalLibraryErrorResponse(error, 'Unable to read that personal-library item.'); }
}
