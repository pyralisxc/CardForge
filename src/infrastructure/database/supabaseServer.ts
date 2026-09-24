import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseServerConfigStatus {
  configured: boolean;
  missing: string[];
}

let cachedClient: SupabaseClient | null = null;

const getSupabaseServerSecret = (): string | null => (
  process.env.SUPABASE_SECRET_KEY?.trim()
  || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  || null
);

/** PostgREST can briefly reject a valid secret-key request after a gateway refresh. */
export const fetchSupabaseServerRead: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  let response = await fetch(input, init);
  if (method !== 'GET') return response;

  for (let attempt = 0; attempt < 2 && response.status === 401; attempt += 1) {
    const error = await response.clone().json().catch(() => null) as { code?: string; message?: string } | null;
    if (error?.code !== 'PGRST303' || error.message !== 'JWT issued at future') break;
    await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    response = await fetch(input, { ...init, cache: 'no-store' });
  }
  return response;
};

export const getSupabaseServerConfigStatus = (): SupabaseServerConfigStatus => {
  const requiredValues: Array<[string, string | null | undefined]> = [
    ['SUPABASE_URL', process.env.SUPABASE_URL],
    ['SUPABASE_SECRET_KEY', getSupabaseServerSecret()],
  ];
  const missing = requiredValues
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return {
    configured: missing.length === 0,
    missing,
  };
};

export const getSupabaseServerClient = (): SupabaseClient | null => {
  const status = getSupabaseServerConfigStatus();
  const secret = getSupabaseServerSecret();
  if (!status.configured || !secret) return null;

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL!,
      secret,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        global: { fetch: fetchSupabaseServerRead },
      }
    );
  }

  return cachedClient;
};
