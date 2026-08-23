import {
  disconnectGoogleDriveProjectStorage,
  listGoogleDriveProjects,
  selectGoogleDriveProjectFolder,
} from '@/features/project/server';
import {
  getGoogleDriveProjectAccount,
  parseGoogleDriveProjectJson,
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

export async function PATCH(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const body = await parseGoogleDriveProjectJson(request);
    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : '';
    return Response.json(await selectGoogleDriveProjectFolder({ ownerUserId, folderId }));
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to select the Google Drive project folder.');
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
