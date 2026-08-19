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
      }
    );
  }

  return cachedClient;
};
