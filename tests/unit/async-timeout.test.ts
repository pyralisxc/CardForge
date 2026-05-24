import { describe, expect, it } from 'vitest';

import { resolveWithTimeout } from '@/lib/asyncTimeout';

describe('resolveWithTimeout', () => {
  it('returns the fallback when a dependency does not settle quickly', async () => {
    const result = await resolveWithTimeout(new Promise<string>(() => undefined), {
      fallback: 'fallback',
      timeoutMs: 5,
    });

    expect(result).toBe('fallback');
  });

  it('returns the resolved value when the dependency completes before the timeout', async () => {
    const result = await resolveWithTimeout(Promise.resolve('value'), {
      fallback: 'fallback',
      timeoutMs: 50,
    });

    expect(result).toBe('value');
  });

  it('returns the fallback when the dependency rejects', async () => {
    const result = await resolveWithTimeout(Promise.reject(new Error('nope')), {
      fallback: 'fallback',
      timeoutMs: 50,
    });

    expect(result).toBe('fallback');
  });
});
