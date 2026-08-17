import { describe, expect, it, vi } from 'vitest';

import {
  decryptMarketingToken,
  encryptMarketingToken,
} from '@/features/marketing-distribution/server/marketingTokenCrypto';
import { buildMetaAuthorizationUrl } from '@/features/marketing-distribution/server/metaConnection';
import { publishToMeta } from '@/features/social-publishing/server/metaPublisher';

const key = Buffer.alloc(32, 7).toString('base64');

describe('native Meta publishing', () => {
  it('invokes the reviewed Facebook Login for Business configuration', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://cardforges.com';
    process.env.CARDFORGE_META_APP_ID = 'meta-app-id';
    process.env.CARDFORGE_META_APP_SECRET = 'meta-app-secret';
    process.env.CARDFORGE_META_LOGIN_CONFIGURATION_ID = 'login-configuration-id';
    process.env.CARDFORGE_META_GRAPH_API_VERSION = 'v25.0';
    process.env.CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY = key;

    const authorizationUrl = new URL(buildMetaAuthorizationUrl('oauth-state'));

    expect(authorizationUrl.origin).toBe('https://www.facebook.com');
    expect(authorizationUrl.pathname).toBe('/v25.0/dialog/oauth');
    expect(authorizationUrl.searchParams.get('client_id')).toBe('meta-app-id');
    expect(authorizationUrl.searchParams.get('config_id')).toBe('login-configuration-id');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe('https://cardforges.com/api/owner/marketing/meta/callback');
    expect(authorizationUrl.searchParams.get('state')).toBe('oauth-state');
    expect(authorizationUrl.searchParams.get('response_type')).toBe('code');
    expect(authorizationUrl.searchParams.has('scope')).toBe(false);
  });

  it('encrypts provider tokens with authenticated encryption', () => {
    const encrypted = encryptMarketingToken('page-token', key);
    expect(encrypted.ciphertext).not.toContain('page-token');
    expect(decryptMarketingToken(encrypted, key)).toBe('page-token');
    expect(() => decryptMarketingToken({ ...encrypted, authTag: Buffer.alloc(16).toString('base64') }, key)).toThrow();
  });

  it('publishes a Facebook Page link post through the selected Graph version', async () => {
    process.env.CARDFORGE_META_GRAPH_API_VERSION = 'v25.0';
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'page_123' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink_url: 'https://facebook.example/post/123' }), { status: 200 }));
    await expect(publishToMeta({
      service: 'facebook',
      accountId: 'page-id',
      accessToken: 'token',
      text: 'Build one card, then forge the set.',
      destinationUrl: 'https://cardforges.com/?utm_campaign=founder_beta',
      media: [],
    }, fetcher as typeof fetch)).resolves.toEqual({
      providerPostId: 'page_123',
      publicationUrl: 'https://facebook.example/post/123',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://graph.facebook.com/v25.0/page-id/feed',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses Instagram container creation followed by publication', async () => {
    process.env.CARDFORGE_META_GRAPH_API_VERSION = 'v25.0';
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'container-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status_code: 'FINISHED' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'ig-post-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ permalink_url: 'https://instagram.example/p/1' }), { status: 200 }));
    await expect(publishToMeta({
      service: 'instagram',
      accountId: 'ig-id',
      accessToken: 'token',
      text: 'A complete set from one design.',
      destinationUrl: 'https://cardforges.com/',
      media: [{ url: 'https://images.example/card.jpg', altText: 'A CardForge card set.' }],
    }, fetcher as typeof fetch)).resolves.toEqual({
      providerPostId: 'ig-post-1',
      publicationUrl: 'https://instagram.example/p/1',
    });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://graph.facebook.com/v25.0/ig-id/media');
    expect(fetcher.mock.calls[1]?.[0]).toBeInstanceOf(URL);
    expect((fetcher.mock.calls[1]?.[0] as URL).pathname).toBe('/v25.0/container-1');
    expect(fetcher.mock.calls[2]?.[0]).toBe('https://graph.facebook.com/v25.0/ig-id/media_publish');
    expect((fetcher.mock.calls[3]?.[0] as URL).pathname).toBe('/v25.0/ig-post-1');
  });
});
