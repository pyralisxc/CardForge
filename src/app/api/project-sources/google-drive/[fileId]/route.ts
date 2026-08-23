import {
  deleteGoogleDriveProject,
  getGoogleDriveProject,
  GOOGLE_DRIVE_PROJECT_MIME_TYPE,
} from '@/features/project/server';
import {
  getGoogleDriveProjectAccount,
  parseGoogleDriveProjectJson,
  toGoogleDriveProjectErrorResponse,
} from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const { fileId } = await context.params;
    const project = await getGoogleDriveProject({ ownerUserId, fileId });
    const bytes = new Uint8Array(project.bytes.byteLength);
    bytes.set(project.bytes);
    return new Response(new Blob([bytes.buffer], { type: GOOGLE_DRIVE_PROJECT_MIME_TYPE }), {
      status: 200,
      headers: {
        'Content-Type': GOOGLE_DRIVE_PROJECT_MIME_TYPE,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(project.summary.name)}`,
        'Cache-Control': 'private, no-store',
        'X-CardForge-Provider-Revision': project.summary.providerRevision,
        'X-CardForge-Project-Revision': project.summary.projectRevision ?? '',
        'X-CardForge-Project-Modified-At': project.summary.modifiedAt,
      },
    });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to download the Google Drive project.');
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    const { fileId } = await context.params;
    const body = await parseGoogleDriveProjectJson(request);
    const expectedProviderRevision = typeof body.expectedProviderRevision === 'string' ? body.expectedProviderRevision.trim() : '';
    const expectedProjectRevision = typeof body.expectedProjectRevision === 'string' ? body.expectedProjectRevision.trim() : '';
    const deleted = await deleteGoogleDriveProject({
      ownerUserId,
      fileId,
      expectedProviderRevision,
      expectedProjectRevision,
    });
    return Response.json({ deleted });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to delete the Google Drive project.');
  }
}
