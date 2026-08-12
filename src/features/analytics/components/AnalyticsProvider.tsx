"use client";

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ANALYTICS_CONSENT_COOKIE, type AnalyticsConsentPreference } from '../model';
import { getAnalyticsConsentPreference, getSafeAnalyticsPageContext, trackCardForgeEvent } from '../client/tracking';

const PRIVATE_PATH_PREFIXES = ['/owner', '/developer/cockpit'] as const;

const deleteAnalyticsCookies = () => {
  const names = document.cookie.split(';').map((entry) => entry.split('=')[0]?.trim()).filter(Boolean);
  const hostnameParts = window.location.hostname.split('.');
  const rootDomain = hostnameParts.length > 2 ? hostnameParts.slice(-2).join('.') : window.location.hostname;
  for (const name of names) {
    if (!name.startsWith('_ga')) continue;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${rootDomain}; SameSite=Lax`;
  }
};

const saveConsentPreference = (value: AnalyticsConsentPreference) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${value}; Max-Age=15552000; path=/; SameSite=Lax${secure}`;
};

export function AnalyticsProvider() {
  const pathname = usePathname();
  const measurementId = process.env.NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID ?? '';
  const enabled = process.env.NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED === 'true' && /^G-[A-Z0-9]+$/u.test(measurementId);
  const trackablePath = !PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const [preference, setPreference] = useState<AnalyticsConsentPreference | null>(null);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tagReady, setTagReady] = useState(false);

  useEffect(() => {
    if (enabled) setPreference(getAnalyticsConsentPreference());
    setPreferenceReady(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !trackablePath || preference !== 'granted' || !tagReady || !window.gtag) return;
    const context = getSafeAnalyticsPageContext();
    window.gtag('set', context);
    window.gtag('event', 'page_view', context);
    if (pathname === '/studio') trackCardForgeEvent('open_studio', { placement: 'route_entry' });
  }, [enabled, pathname, preference, tagReady, trackablePath]);

  if (!enabled || !preferenceReady) return null;

  const choose = (next: AnalyticsConsentPreference) => {
    saveConsentPreference(next);
    setPreference(next);
    setShowSettings(false);
    if (next === 'denied') {
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      deleteAnalyticsCookies();
    } else if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
  };

  const initializeTag = () => {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    const context = getSafeAnalyticsPageContext();
    window.gtag('set', context);
    window.gtag('config', measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ignore_referrer: true,
      ...context,
    });
    setTagReady(true);
  };

  const decisionOpen = preference === null || showSettings;
  return (
    <>
      {preference === 'granted' && trackablePath ? (
        <Script
          id="cardforge-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onLoad={initializeTag}
        />
      ) : null}
      {decisionOpen ? (
        <aside className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl border border-[#8c6436] bg-[#15100a] p-4 text-[#f7ead0] shadow-2xl" role="dialog" aria-label="Analytics preference">
          <p className="font-serif text-lg text-[#fff1c7]">Help improve CardForge</p>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">Allow privacy-minimized Google Analytics measurement for page visits, Studio opens, account creation, card creation, and completed exports. Google uses a first-party identifier and basic device and approximate-location signals; Card content, names, and email addresses are never sent. Advertising tracking stays disabled.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => choose('granted')}>Allow analytics</Button>
            <Button type="button" variant="outline" onClick={() => choose('denied')}>{preference === 'granted' ? 'Turn analytics off' : 'Not now'}</Button>
            <Button asChild type="button" variant="ghost"><a href="/privacy">Privacy details</a></Button>
          </div>
        </aside>
      ) : (
        <button type="button" onClick={() => setShowSettings(true)} className="fixed bottom-3 left-3 z-50 border border-[#5f4526] bg-[#100c08] px-3 py-2 text-xs text-[#c7b288] hover:border-[#d8b365] hover:text-[#fff1c7]">Analytics settings</button>
      )}
    </>
  );
}
