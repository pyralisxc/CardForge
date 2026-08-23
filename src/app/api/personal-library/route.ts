import {
  isPersonalLibraryProvider,
  isPersonalLibraryRole,
  listPersonalLibraryItems,
  registerGoogleDrivePersonalLibraryFiles,
} from '@/features/personal-library/server';
import {
  getPersonalLibraryAccount,
  parsePersonalLibraryJson,
  toPersonalLibraryErrorResponse,
} from './_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { ownerUserId } = await getPersonalLibraryAccount();
    return Response.json(await listPersonalLibraryItems(ownerUserId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return toPersonalLibraryErrorResponse(error, 'Unable to load the personal library.');
  }
}

export async function POST(request: Request) {
  try {
    const { ownerUserId } = await getPersonalLibraryAccount();
    const body = await parsePersonalLibraryJson(request);
    const provider = body.provider;
    const role = body.role;
    const fileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter((value): value is string => typeof value === 'string')
      : [];
    if (!isPersonalLibraryProvider(provider)) throw new Error('A supported connected-library provider is required.');
    if (!isPersonalLibraryRole(role)) throw new Error('A supported personal-library role is required.');
    if (provider !== 'google-drive') throw new Error('That personal-library provider is not available yet.');
    return Response.json(await registerGoogleDrivePersonalLibraryFiles({ ownerUserId, fileIds, role }), {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return toPersonalLibraryErrorResponse(error, 'Unable to add files to the personal library.');
  }
}
