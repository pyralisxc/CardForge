import {
  createGoogleDriveProjectFolder,
  disconnectGoogleDriveProjectStorage,
  getGoogleDriveDisconnectGeneration,
  inspectGoogleDriveDisconnect,
  removeGoogleDriveConnectionOnly,
  ProjectStorageProviderError,
  getGoogleDriveProjectConnection,
  getGoogleDriveSelectedProjectFolder,
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
    const params = new URL(request.url).searchParams;
    if (params.get('disconnect') === '1') return Response.json(await getGoogleDriveDisconnectGeneration(ownerUserId));
    if (params.get('connection') === '1') return Response.json(await getGoogleDriveProjectConnection(ownerUserId));
    const cursor = params.get('cursor');
    const library = await listGoogleDriveProjectsPage({ ownerUserId, pageToken: cursor });
    if (!library.connection.connected) return Response.json(library);

    const folder = await getGoogleDriveSelectedProjectFolder(ownerUserId);
    if (!folder) {
      return Response.json({
        ...library,
        connection: {
          ...library.connection,
          statusNote: library.connection.statusNote || 'Choose or create a project folder before saving to Google Drive.',
        },
        selectedFolder: null,
      });
    }
    const folderHealth = library.connection.statusNote
      || (folder.canAddChildren === false
        ? 'This Drive folder is read-only for the connected account.'
        : 'CardForge can reach this folder while your devices are offline.');

    return Response.json({
      ...library,
      connection: {
        ...library.connection,
        statusNote: `Project folder: “${folder.name}”. ${folderHealth}`,
      },
      selectedFolder: folder,
    });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to load Google Drive project storage.');
  }
}

export async function POST(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const body = await parseGoogleDriveProjectJson(request);
    if (body.action === 'inspect_disconnect') {
      const generation = typeof body.generation === 'string' ? body.generation : '';
      const receipt = typeof body.receipt === 'string' ? body.receipt : null;
      return Response.json(await inspectGoogleDriveDisconnect(ownerUserId, generation, receipt));
    }
    if (body.action === 'remove_connection_only') {
      if (body.acknowledged !== true) throw new ProjectStorageProviderError('Confirm removing the saved connection.', 400, { kind: 'invalid' });
      const generation = typeof body.generation === 'string' ? body.generation : '';
      return Response.json(await removeGoogleDriveConnectionOnly(ownerUserId, generation));
    }
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

export async function DELETE(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const generation = request.headers.get('x-cardforge-disconnect-generation') ?? '';
    const result = await disconnectGoogleDriveProjectStorage(ownerUserId, generation);
    return result ? Response.json(result, { status: 202 }) : new Response(null, { status: 204 });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to disconnect Google Drive project storage.');
  }
}
