import { describe, expect, it, vi } from 'vitest';

import {
  consumeRateLimit,
  getRequestClientAddress,
  hashRateLimitIdentity,
  RateLimitExceededError,
} from '@/infrastructure/security/abuseProtection';

describe('abuse protection', () => {
  it('uses the first trusted proxy address and falls back safely', () => {
    expect(getRequestClientAddress(new Request('https://cardforges.com', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
    }))).toBe('203.0.113.7');
    expect(getRequestClientAddress(new Request('https://cardforges.com'))).toBe('unknown');
  });

  it('hashes identities deterministically without retaining the input', () => {
    const hashed = hashRateLimitIdentity('contact', '203.0.113.7');
    expect(hashed).toBe(hashRateLimitIdentity('contact', '203.0.113.7'));
    expect(hashed).not.toContain('203.0.113.7');
    expect(hashRateLimitIdentity('roadmap', '203.0.113.7')).not.toBe(hashed);
  });

  it('calls the server-only atomic limiter and returns its decision', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await expect(consumeRateLimit({
      action: 'contact',
      identity: '203.0.113.7',
      limit: 5,
      windowSeconds: 3600,
      client: { rpc },
    })).resolves.toEqual({ allowed: true, retryAfterSeconds: 3600 });
    expect(rpc).toHaveBeenCalledWith('cardforge_consume_rate_limit', expect.objectContaining({
      p_limit: 5,
      p_window_seconds: 3600,
    }));
  });

  it('fails closed when durable rate limiting is unavailable', async () => {
    await expect(consumeRateLimit({
      action: 'contact',
      identity: '203.0.113.7',
      limit: 5,
      windowSeconds: 3600,
      client: { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('offline') }) },
    })).rejects.toThrow('Rate limiting is temporarily unavailable');
  });

  it('carries a retry window and limit when a route needs to throw', () => {
    expect(new RateLimitExceededError(
      'Too many changes.',
      3600,
      { resource: 'changes', maximum: 60, unit: 'attempts_per_hour' },
    )).toMatchObject({
      status: 429,
      retryAfterSeconds: 3600,
      limit: { resource: 'changes', maximum: 60, unit: 'attempts_per_hour' },
    });
  });
});
