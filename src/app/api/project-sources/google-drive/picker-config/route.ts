import { getGoogleDrivePickerConfiguration } from '@/features/project/server';
import {
  getGoogleDriveProjectAccount,
  toGoogleDriveProjectErrorResponse,
} from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    return Response.json(await getGoogleDrivePickerConfiguration(ownerUserId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to prepare the Google Drive folder picker.');
  }
}
