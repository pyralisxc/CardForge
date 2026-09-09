import { getGoogleDriveProjectThumbnail } from '@/features/project/server';
import { getGoogleDriveProjectAccount, toGoogleDriveProjectErrorResponse } from '../../_helpers';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: Promise<{ fileId: string }> }) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const { fileId } = await context.params;
    const { bytes, mimeType } = await getGoogleDriveProjectThumbnail({ ownerUserId, fileId });
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to load the Drive preview. The document can still be opened.');
  }
}
