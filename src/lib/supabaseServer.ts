import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface SupabaseServerConfigStatus {
  configured: boolean;
  missing: string[];
}

let cachedClient: SupabaseClient | null = null;

export const getSupabaseServerConfigStatus = (): SupabaseServerConfigStatus => {
  const requiredValues: Array<[string, string | undefined]> = [
    ['SUPABASE_URL', process.env.SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
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
  if (!status.configured) return null;

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return cachedClient;
};
