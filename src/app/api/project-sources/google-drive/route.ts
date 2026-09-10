import {
  createGoogleDriveProjectFolder,
  disconnectGoogleDriveProjectStorage,
  listGoogleDriveProjectsPage,
  selectGoogleDriveProjectFolder,
} from '@/features/project/server';
import {
  getGoogleDriveProjectAccount,
  parseGoogleDriveProjectJson,
  toGoogleDriveProjectErrorResponse,
} from './_helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const cursor = new URL(request.url).searchParams.get('cursor');
    return Response.json(await listGoogleDriveProjectsPage({ ownerUserId, pageToken: cursor }));
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to load Google Drive project storage.');
  }
}

export async function POST(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const body = await parseGoogleDriveProjectJson(request);
    const folderName = typeof body.folderName === 'string' ? body.folderName : '';
    return Response.json(await createGoogleDriveProjectFolder({ ownerUserId, name: folderName }), { status: 201 });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to create the Google Drive project folder.');
  }
}

export async function PATCH(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const body = await parseGoogleDriveProjectJson(request);
    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : '';
    const resourceKey = typeof body.resourceKey === 'string' ? body.resourceKey.trim() : null;
    return Response.json(await selectGoogleDriveProjectFolder({ ownerUserId, folderId, resourceKey }));
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
