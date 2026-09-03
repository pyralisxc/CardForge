import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { connectMetaAccounts } from '@/features/marketing-distribution/server';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export const dynamic = 'force-dynamic';

const safeStateMatch = (expected: string, received: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
};

const ownerRedirect = (status: string, message?: string) => {
  const url = new URL('/account', getPublicAppUrl());
  url.searchParams.set('section', 'library');
  url.searchParams.set('scope', 'campaigns');
  url.searchParams.set('meta', status);
  if (message) url.searchParams.set('message', message.slice(0, 240));
  const response = NextResponse.redirect(url);
  response.cookies.set('cardforge_meta_oauth_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/owner/marketing/meta',
    maxAge: 0,
  });
  return response;
};

export async function GET(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) return ownerRedirect('error', 'Owner access is required.');
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const expectedState = (await cookies()).get('cardforge_meta_oauth_state')?.value ?? '';
  if (!code || !state || !expectedState || !safeStateMatch(expectedState, state)) {
    return ownerRedirect('error', 'The Meta connection expired or failed its security check.');
  }
  try {
    const result = await connectMetaAccounts(code, owner.userId);
    await recordOwnerActivity({
      actorUserId: owner.userId,
      actorEmail: owner.email,
      action: 'marketing.meta.connect',
      targetType: 'marketing_provider',
      targetId: 'meta',
      summary: `Connected ${result.connectionCount} Facebook or Instagram destination(s).`,
      metadata: result,
    });
    return ownerRedirect('connected');
  } catch (error) {
    console.error('Meta callback failed:', error);
    return ownerRedirect('error', error instanceof Error ? error.message : 'Unable to connect Meta.');
  }
}
