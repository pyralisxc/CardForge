import { materializePersonalLibraryItem } from '@/features/personal-library/server';
import {
  getPersonalLibraryAccount,
  toPersonalLibraryErrorResponse,
} from '../../_helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { ownerUserId } = await getPersonalLibraryAccount();
    const { itemId } = await params;
    const materialized = await materializePersonalLibraryItem(ownerUserId, itemId);
    const responseBytes = new Uint8Array(materialized.bytes.byteLength);
    responseBytes.set(materialized.bytes);
    return new Response(responseBytes.buffer, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': materialized.mimeType,
        'Content-Length': String(materialized.bytes.byteLength),
        'X-CardForge-Library-Item': materialized.item.id,
        'X-CardForge-Content-Hash': materialized.item.contentHash ?? '',
      },
    });
  } catch (error) {
    return toPersonalLibraryErrorResponse(error, 'Unable to materialize that personal-library item.');
  }
}
