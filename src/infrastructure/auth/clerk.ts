export const isClerkPublicConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export const isClerkServerConfigPresent = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export type PublicAuthControlState = 'unconfigured' | 'connecting' | 'signed-out' | 'signed-in';
export type CardForgeAuthRoute = '/sign-in' | '/sign-up';

type ClerkEnvironment = Record<string, string | undefined>;

const normalizeAuthorizedParty = (value: string | undefined): string | null => {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(/^https?:\/\//iu.test(candidate) ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const getClerkAuthorizedParties = (
  env: ClerkEnvironment = process.env,
): string[] => {
  const parties = [
    normalizeAuthorizedParty(env.NEXT_PUBLIC_APP_URL),
    normalizeAuthorizedParty(env.VERCEL_PROJECT_PRODUCTION_URL),
    normalizeAuthorizedParty(env.VERCEL_URL),
    env.NODE_ENV === 'production' ? 'https://cardforges.com' : 'http://localhost:9002',
  ].filter((value): value is string => Boolean(value));

  return [...new Set(parties)];
};

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
  return `${route}?redirect_url=${encodeURIComponent(safeReturnTo)}`;
};
