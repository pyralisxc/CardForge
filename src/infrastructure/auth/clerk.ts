export const isClerkPublicConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const isClerkServerConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type PublicAuthControlState = 'unconfigured' | 'connecting' | 'signed-out' | 'signed-in';

export const getPublicAuthControlState = ({
  authConfigured,
  isLoaded,
  isSignedIn,
}: {
  authConfigured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
}): PublicAuthControlState => {
  if (!authConfigured) return 'unconfigured';
  if (!isLoaded) return 'connecting';
  return isSignedIn ? 'signed-in' : 'signed-out';
};

const CLERK_PAGE_PREFIXES = [
  '/account',
  '/profile',
  '/sign-in',
  '/__clerk',
];

const CLERK_API_PREFIXES = [
  '/api/account',
  '/api/billing/checkout',
  '/api/billing/portal',
  '/api/billing/support/checkout',
  '/api/developer-assets',
  '/api/developer-cockpit',
  '/api/owner',
  '/api/roadmap',
  '/api/roadmap/items',
  '/api/roadmap/votes',
];

const CLERK_MUTATION_API_PREFIXES = [
  '/api/styles',
  '/api/templates',
];

export const shouldRunClerkMiddlewareForRequest = (
  pathname: string,
  method: string
): boolean => {
  if (CLERK_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (CLERK_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  if (
    method.toUpperCase() !== 'GET'
    && CLERK_MUTATION_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return true;
  }

  return false;
};
