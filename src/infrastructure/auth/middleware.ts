import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

import { getClerkAuthorizedParties } from './clerk';

const browserClerkHandler = clerkMiddleware({
  authorizedParties: getClerkAuthorizedParties(),
});
const oauthClerkHandler = clerkMiddleware();

export const cardforgeMiddleware = (
  request: NextRequest,
  event: Parameters<typeof browserClerkHandler>[1],
) => {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    || !process.env.CLERK_SECRET_KEY
  ) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === '/mcp') {
    return oauthClerkHandler(request, event);
  }

  return browserClerkHandler(request, event);
};
