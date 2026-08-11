import { describe, expect, it, vi } from 'vitest';

import {
  BufferPublisher,
  getBufferConfiguration,
  mapBufferPostStatus,
} from '@/features/social-publishing/server/bufferPublisher';

describe('Buffer publishing adapter', () => {
  it('stays disabled unless credentials, the switch, and an exact channel allowlist are present', () => {
    expect(getBufferConfiguration({})).toMatchObject({
      configured: false,
      publishingEnabled: false,
    });
    expect(getBufferConfiguration({
      BUFFER_API_KEY: 'secret',
      BUFFER_ORGANIZATION_ID: 'org-1',
      CARDFORGE_BUFFER_PUBLISHING_ENABLED: 'false',
    })).toMatchObject({
      configured: true,
      publishingEnabled: false,
    });
    expect(getBufferConfiguration({
      BUFFER_API_KEY: 'secret',
      BUFFER_ORGANIZATION_ID: 'org-1',
      CARDFORGE_BUFFER_PUBLISHING_ENABLED: 'true',
    })).toMatchObject({
      configured: true,
      publishingEnabled: false,
      allowedChannelIds: [],
    });
    expect(getBufferConfiguration({
      BUFFER_API_KEY: 'secret',
      BUFFER_ORGANIZATION_ID: 'org-1',
      CARDFORGE_BUFFER_ALLOWED_CHANNEL_IDS: 'channel-1, channel-2',
      CARDFORGE_BUFFER_PUBLISHING_ENABLED: 'true',
    })).toMatchObject({
      configured: true,
      publishingEnabled: true,
      allowedChannelIds: ['channel-1', 'channel-2'],
    });
  });

  it('maps provider lifecycle states into the CardForge job ledger', () => {
    expect(mapBufferPostStatus('draft')).toBe('provider_draft');
    expect(mapBufferPostStatus('buffer')).toBe('scheduled');
    expect(mapBufferPostStatus('sent')).toBe('published');
    expect(mapBufferPostStatus('error')).toBe('failed');
    expect(mapBufferPostStatus('unknown_future_status')).toBe('unknown');
  });

  it('creates drafts with public media URLs through a server-only GraphQL request', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      data: {
        createPost: {
          __typename: 'PostActionSuccess',
          post: {
            id: 'post-1',
            status: 'draft',
            dueAt: null,
            channelId: 'channel-1',
          },
        },
      },
    }), { status: 200 }));
    const publisher = new BufferPublisher({
      apiKey: 'secret',
      organizationId: 'org-1',
      fetcher,
    });

    await expect(publisher.createDraft({
      channelId: 'channel-1',
      text: 'Forge the set.',
      mediaUrls: ['https://cardforges.com/social/capture.webp'],
    })).resolves.toMatchObject({
      providerPostId: 'post-1',
      status: 'provider_draft',
    });

    const request = fetcher.mock.calls[0]?.[1];
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer secret',
    });
    expect(String(request?.body)).toContain('"saveToDraft":true');
    expect(String(request?.body)).toContain('https://cardforges.com/social/capture.webp');
  });
});
