import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { connectGoogleDriveProjectStorage } from '@/features/project/server';
import { getSafeLocalReturnPath } from '@/infrastructure/auth/clerk';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';
import { getGoogleDriveProjectAccount } from '../_helpers';

export const dynamic = 'force-dynamic';

const safeStateMatch = (expected: string, received: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
};

const accountRedirect = (status: 'connected' | 'error', returnTo: string | undefined, message?: string) => {
  const url = new URL(getSafeLocalReturnPath(returnTo, '/account?section=library&tool=locations'), getPublicAppUrl());
  url.searchParams.set('storage', `google-drive-${status}`);
  if (message) url.searchParams.set('message', message.slice(0, 240));
  const response = NextResponse.redirect(url);
  response.cookies.set('cardforge_google_drive_oauth_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/project-sources/google-drive',
    maxAge: 0,
  });
  response.cookies.set('cardforge_google_drive_return_to', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/project-sources/google-drive',
    maxAge: 0,
  });
  return response;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const providerError = url.searchParams.get('error');
  const providerErrorDescription = url.searchParams.get('error_description');
  const expectedState = (await cookies()).get('cardforge_google_drive_oauth_state')?.value ?? '';
  const returnTo = (await cookies()).get('cardforge_google_drive_return_to')?.value;
  if (providerError) {
    return accountRedirect('error', returnTo, providerErrorDescription || providerError);
  }
  if (!code || !state || !expectedState || !safeStateMatch(expectedState, state)) {
    return accountRedirect('error', returnTo, 'The Google Drive connection expired or failed its security check.');
  }
  try {
    const { ownerUserId } = await getGoogleDriveProjectAccount();
    await connectGoogleDriveProjectStorage({ ownerUserId, code });
    return accountRedirect('connected', returnTo);
  } catch (error) {
    console.error('Google Drive project callback failed:', error);
    return accountRedirect('error', returnTo, error instanceof Error ? error.message : 'Unable to connect Google Drive.');
  }
}
