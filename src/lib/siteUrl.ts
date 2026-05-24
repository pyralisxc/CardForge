type SiteUrlEnvironment = Record<string, string | undefined>;

const LOCAL_APP_URL = 'http://localhost:9002';
const BLOCKED_APP_HOST_SUFFIXES = ['.supabase.co'];

const normalizeUrlCandidate = (value: string | undefined): string | null => {
  const candidate = value?.trim();
  if (!candidate) return null;

  const urlText = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(urlText);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (BLOCKED_APP_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))) return null;
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};

export const getConfiguredPublicAppUrl = (env: SiteUrlEnvironment = process.env): string | null => (
  normalizeUrlCandidate(env.NEXT_PUBLIC_APP_URL) ??
  normalizeUrlCandidate(env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalizeUrlCandidate(env.VERCEL_URL)
);

export const getPublicAppUrl = (env: SiteUrlEnvironment = process.env): string => (
  getConfiguredPublicAppUrl(env) ??
  LOCAL_APP_URL
);
