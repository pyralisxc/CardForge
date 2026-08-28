import {
  isGoogleDriveWorkId,
  prepareGoogleDriveProjectUpload,
  ProjectStorageProviderError,
} from '@/features/project/server';
import {
  getGoogleDriveProjectAccount,
  parseGoogleDriveProjectJson,
  toGoogleDriveProjectErrorResponse,
} from '../_helpers';

export const dynamic = 'force-dynamic';

const optionalString = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;

export async function POST(request: Request) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const body = await parseGoogleDriveProjectJson(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const size = typeof body.size === 'number' ? body.size : Number.NaN;
    const projectRevision = typeof body.projectRevision === 'string' ? body.projectRevision.trim() : '';
    const workId = optionalString(body.workId);
    if (workId && !isGoogleDriveWorkId(workId)) {
      throw new ProjectStorageProviderError('The CardForge work id is invalid.', 400, { kind: 'invalid' });
    }
    if (!name) throw new ProjectStorageProviderError('A project name is required.', 400, { kind: 'invalid' });
    const result = await prepareGoogleDriveProjectUpload({
      ownerUserId,
      name,
      size,
      projectRevision,
      fileId: optionalString(body.fileId),
      expectedProviderRevision: optionalString(body.expectedProviderRevision),
      expectedProjectRevision: optionalString(body.expectedProjectRevision),
      workId,
    });
    return Response.json(result);
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to prepare the Google Drive project upload.');
  }
}
