import type { NextFetchEvent, NextRequest } from 'next/server';

import { cardforgeMiddleware } from '@/infrastructure/auth/middleware';

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return cardforgeMiddleware(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/__clerk/(.*)', '/(api|trpc)(.*)',
  ],
};
