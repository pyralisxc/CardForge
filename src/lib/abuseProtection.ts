import { createHash } from 'node:crypto';

import { getSupabaseServerClient } from '@/lib/supabaseServer';

interface RateLimitClient {
  rpc: (
    name: string,
    parameters: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super('Rate limiting is temporarily unavailable.');
    this.name = 'RateLimitUnavailableError';
  }
}

export const getRequestClientAddress = (request: Request): string => (
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  || request.headers.get('x-real-ip')?.trim()
  || 'unknown'
);

export const hashRateLimitIdentity = (action: string, identity: string): string => createHash('sha256')
  .update(`${action}:${identity}`)
  .digest('hex');

export const consumeRateLimit = async ({
  action,
  identity,
  limit,
  windowSeconds,
  client = getSupabaseServerClient(),
}: {
  action: string;
  identity: string;
  limit: number;
  windowSeconds: number;
  client?: RateLimitClient | null;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> => {
  if (!client) throw new RateLimitUnavailableError();

  const { data, error } = await client.rpc('cardforge_consume_rate_limit', {
    p_key_hash: hashRateLimitIdentity(action, identity),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error || typeof data !== 'boolean') {
    console.error('Durable rate limit check failed:', error);
    throw new RateLimitUnavailableError();
  }

  return { allowed: data, retryAfterSeconds: windowSeconds };
};
