export const isClerkPublicConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const isClerkServerConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type PublicAuthControlState = 'unconfigured' | 'connecting' | 'signed-out' | 'signed-in';
export type CardForgeAuthRoute = '/sign-in' | '/sign-up';

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

export const getSafeLocalReturnPath = (
  value: string | undefined,
  fallback = '/account',
): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;

  try {
    const base = new URL('https://cardforge.local');
    const candidate = new URL(value, base);
    if (candidate.origin !== base.origin) return fallback;
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return fallback;
  }
};

export const createAuthRouteHref = (
  route: CardForgeAuthRoute,
  returnTo?: string,
  fallback = '/account',
): string => {
  const safeReturnTo = getSafeLocalReturnPath(returnTo, fallback);
  return `${route}?returnTo=${encodeURIComponent(safeReturnTo)}`;
};
