import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

import { getClerkAuthorizedParties } from './clerk';

const clerkHandler = clerkMiddleware({
  authorizedParties: getClerkAuthorizedParties(),
});

export const cardforgeMiddleware = (
  request: NextRequest,
  event: Parameters<typeof clerkHandler>[1],
) => {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    || !process.env.CLERK_SECRET_KEY
  ) {
    return NextResponse.next();
  }

  return clerkHandler(request, event);
};
