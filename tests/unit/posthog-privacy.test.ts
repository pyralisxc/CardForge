import type { CapturedNetworkRequest } from 'posthog-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { maskReplayAttribute, redactReplayRequest } from '@/features/analytics/client/posthog';

const replayEntry = (input: Partial<CapturedNetworkRequest>): CapturedNetworkRequest => ({
  name: 'https://cardforges.com/',
  entryType: 'navigation',
  startTime: 0,
  duration: 0,
  ...input,
});

describe('PostHog replay privacy', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('removes inline content and strips URL state from DOM attributes', () => {
    vi.stubGlobal('window', { location: { origin: 'https://cardforges.com' } });
    expect(maskReplayAttribute('src', 'data:image/png;base64,sensitive')).toBe('');
    expect(maskReplayAttribute('src', 'blob:https://cardforges.com/sensitive')).toBe('');
    expect(maskReplayAttribute('style', 'background-image:url(data:image/png;base64,sensitive)')).toBe('');
    expect(maskReplayAttribute('href', '/studio?project=private#card')).toBe('/studio');
  });

  it('keeps sanitized replay navigation metadata but drops ordinary network entries', () => {
    vi.stubGlobal('window', { location: { origin: 'https://cardforges.com' } });
    expect(redactReplayRequest(replayEntry({ name: 'https://cardforges.com/about?private=value#section' })))
      .toMatchObject({ name: 'https://cardforges.com/about' });
    expect(redactReplayRequest(replayEntry({
      name: 'https://cardforges.com/api/private',
      method: 'GET',
      initiatorType: 'fetch',
    }))).toBeNull();
  });
});
