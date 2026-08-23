import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { buildGoogleDriveProjectAuthorizationUrl } from '@/features/project/server';
import { getGoogleDriveProjectAccount, toGoogleDriveProjectErrorResponse } from '../_helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await getGoogleDriveProjectAccount();
    const state = randomBytes(32).toString('base64url');
    const cookieStore = await cookies();
    cookieStore.set('cardforge_google_drive_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/project-sources/google-drive',
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(buildGoogleDriveProjectAuthorizationUrl(state));
  } catch (error) {
    return toGoogleDriveProjectErrorResponse(error, 'Unable to start Google Drive authorization.');
  }
}
