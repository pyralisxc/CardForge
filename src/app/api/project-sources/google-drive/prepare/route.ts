import { prepareGoogleDriveProjectUpload } from '@/features/project/server';
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
    if (!name) throw new Error('A project name is required.');
    const result = await prepareGoogleDriveProjectUpload({
      ownerUserId,
      name,
      size,
      projectRevision,
      fileId: optionalString(body.fileId),
      expectedProviderRevision: optionalString(body.expectedProviderRevision),
      expectedProjectRevision: optionalString(body.expectedProjectRevision),
    });
    return Response.json(result);
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to prepare the Google Drive project upload.');
  }
}
