import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bootstrapGoogleAnalytics,
  completeSignUpIntent,
  configureGoogleAnalytics,
  trackAnalyticsPageView,
  trackCardCreated,
} from '@/features/analytics/client/tracking';
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_SIGN_UP_INTENT_KEY,
} from '@/features/analytics/model';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
};

describe('analytics tracking', () => {
  afterEach(() => vi.unstubAllGlobals());

  const setConsent = (value: 'granted' | 'denied' | '') => {
    vi.stubGlobal('document', {
      cookie: value ? `${ANALYTICS_CONSENT_COOKIE}=${value}` : '',
      referrer: 'https://www.facebook.com/groups/example?private=value',
      title: 'CardForge Studio',
    });
  };

  it('records anonymous card creation only after consent', () => {
    const sessionStorage = createStorage();
    const gtag = vi.fn();
    vi.stubGlobal('window', { sessionStorage, gtag, location: { href: 'https://cardforges.com/studio?utm_source=threads&secret=value' } });
    setConsent('');

    trackCardCreated('single', 1);
    expect(gtag).not.toHaveBeenCalled();

    setConsent('granted');
    trackCardCreated('bulk', 4);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'card_created', expect.objectContaining({
      creation_method: 'bulk',
      card_count: 4,
      page_location: 'https://cardforges.com/studio?utm_source=threads',
      page_referrer: 'https://www.facebook.com/groups/example',
    }));
  });

  it('counts signup completion only for an account created from the current intent', () => {
    const sessionStorage = createStorage();
    const gtag = vi.fn();
    vi.stubGlobal('window', { sessionStorage, gtag, location: { href: 'https://cardforges.com/account' } });
    setConsent('granted');

    sessionStorage.setItem(ANALYTICS_SIGN_UP_INTENT_KEY, String(Date.now()));
    completeSignUpIntent(new Date(Date.now() - 24 * 60 * 60 * 1000));
    expect(gtag).not.toHaveBeenCalled();

    sessionStorage.setItem(ANALYTICS_SIGN_UP_INTENT_KEY, String(Date.now()));
    completeSignUpIntent(new Date());
    expect(gtag).toHaveBeenCalledWith('event', 'sign_up', expect.objectContaining({ method: 'clerk' }));
  });

  it('queues a privacy-safe first page view immediately after tag initialization', () => {
    const sessionStorage = createStorage();
    const gtag = vi.fn();
    vi.stubGlobal('window', {
      sessionStorage,
      gtag,
      location: { href: 'https://cardforges.com/studio?utm_source=threads&secret=value' },
    });
    setConsent('granted');

    bootstrapGoogleAnalytics();
    configureGoogleAnalytics('G-TEST123');
    const pageLocation = trackAnalyticsPageView();

    expect(pageLocation).toBe('https://cardforges.com/studio?utm_source=threads');
    expect(gtag).toHaveBeenCalledWith('config', 'G-TEST123', expect.objectContaining({
      send_page_view: false,
      page_location: 'https://cardforges.com/studio?utm_source=threads',
    }));
    expect(gtag).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({
      page_location: 'https://cardforges.com/studio?utm_source=threads',
      page_referrer: 'https://www.facebook.com/groups/example',
    }));
    expect(gtag.mock.calls.map(([command]) => command)).toEqual([
      'consent',
      'js',
      'set',
      'config',
      'set',
      'event',
    ]);
  });
});
