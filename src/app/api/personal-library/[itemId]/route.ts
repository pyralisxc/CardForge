import { removePersonalLibraryItem } from '@/features/personal-library/server';
import {
  getPersonalLibraryAccount,
  toPersonalLibraryErrorResponse,
} from '../_helpers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { ownerUserId } = await getPersonalLibraryAccount();
    const { itemId } = await params;
    await removePersonalLibraryItem(ownerUserId, itemId);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toPersonalLibraryErrorResponse(error, 'Unable to remove that personal-library item.');
  }
}
