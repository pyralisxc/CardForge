import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';

import { getCurrentOwnerAccess } from '@/features/owner/server';
import { buildMetaAuthorizationUrl } from '@/features/marketing-distribution/server';
import { createApiErrorResponse } from '@/infrastructure/http/apiResponses';

export const dynamic = 'force-dynamic';

export async function GET() {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) {
    return createApiErrorResponse(403, 'owner_access_required', 'Owner access is required.');
  }
  try {
    const state = randomBytes(32).toString('base64url');
    const response = NextResponse.redirect(buildMetaAuthorizationUrl(state));
    response.cookies.set('cardforge_meta_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/owner/marketing/meta',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error('Unable to start Meta connection:', error);
    return createApiErrorResponse(503, 'social_publishing_unavailable', error instanceof Error ? error.message : 'Meta connection is unavailable.');
  }
}
