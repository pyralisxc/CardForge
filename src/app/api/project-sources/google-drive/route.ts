import {
  disconnectGoogleDriveProjectStorage,
  listGoogleDriveProjects,
} from '@/features/project/server';
import {
  getGoogleDriveProjectAccount,
  toGoogleDriveProjectErrorResponse,
} from './_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    return Response.json(await listGoogleDriveProjects(ownerUserId));
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to load Google Drive project storage.');
  }
}

export async function DELETE() {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    await disconnectGoogleDriveProjectStorage(ownerUserId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to disconnect Google Drive project storage.');
  }
}
