export const isClerkPublicConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const isClerkServerConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const CLERK_PAGE_PREFIXES = [
  '/account',
  '/profile',
  '/__clerk',
];

const CLERK_API_PREFIXES = [
  '/api/account',
  '/api/billing/checkout',
  '/api/billing/portal',
  '/api/developer-assets',
  '/api/founder-beta',
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
