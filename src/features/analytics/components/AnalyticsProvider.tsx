"use client";

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AnalyticsConsentPresentation } from '@/features/experience-settings/client';
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_SESSION_CONSENT_KEY,
  isAllowedPostHogHost,
  type AnalyticsConsentPreference,
} from '../model';
import {
  bootstrapGoogleAnalytics,
  configureGoogleAnalytics,
  getAnalyticsConsentPreference,
  isAnalyticsConsentGranted,
  trackAnalyticsPageView,
  trackGoogleCardForgeEvent,
  trackProductAnalyticsPageView,
  trackProductCardForgeEvent,
  trackCardForgeEvent,
} from '../client/tracking';
import {
  disableProductAnalytics,
  initializeProductAnalytics,
} from '../client/posthog';

const NON_TRACKABLE_PATH_PREFIXES = [
  '/owner',
  '/account',
  '/sign-in',
  '/sign-up',
  '/mcp-template-preview',
] as const;

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

const savePersistentConsentPreference = (value: 'granted' | 'denied') => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${value}; Max-Age=15552000; path=/; SameSite=Lax${secure}`;
};

const clearPersistentConsentPreference = () => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; path=/; SameSite=Lax${secure}`;
};

export function AnalyticsProvider({
  presentation,
}: {
  presentation: AnalyticsConsentPresentation;
}) {
  const pathname = usePathname();
  const measurementId = process.env.NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID ?? '';
  const posthogKey = process.env.NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY ?? '';
  const posthogHost = process.env.NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST ?? '';
  const collectionEnabled = process.env.NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED === 'true';
  const googleEnabled = collectionEnabled && /^G-[A-Z0-9]+$/u.test(measurementId);
  const productAnalyticsEnabled = collectionEnabled
    && posthogKey.trim().length > 0
    && isAllowedPostHogHost(posthogHost.trim());
  const enabled = googleEnabled || productAnalyticsEnabled;
  const trackablePath = !NON_TRACKABLE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const [preference, setPreference] = useState<AnalyticsConsentPreference | null>(null);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [tagReady, setTagReady] = useState(false);
  const [productAnalyticsAttempted, setProductAnalyticsAttempted] = useState(!productAnalyticsEnabled);
  const lastGoogleLocation = useRef<string | null>(null);
  const lastProductPath = useRef<string | null>(null);
  const acceptButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  const trackCurrentGooglePage = useCallback(() => {
    const location = trackAnalyticsPageView(lastGoogleLocation.current);
    if (!location) return;
    lastGoogleLocation.current = location;
    if (pathname === '/studio') trackGoogleCardForgeEvent('open_studio', { placement: 'route_entry' });
  }, [pathname]);

  const trackCurrentProductPage = useCallback(() => {
    const path = trackProductAnalyticsPageView(lastProductPath.current);
    if (!path) return;
    lastProductPath.current = path;
    if (pathname === '/studio') trackProductCardForgeEvent('open_studio', { placement: 'route_entry' });
  }, [pathname]);

  useEffect(() => {
    if (enabled && trackablePath) setPreference(getAnalyticsConsentPreference());
    setPreferenceReady(true);
  }, [enabled, trackablePath]);

  useEffect(() => {
    if (!googleEnabled || !trackablePath || !isAnalyticsConsentGranted(preference)) {
      setBootstrapReady(false);
      setTagReady(false);
      return;
    }
    bootstrapGoogleAnalytics();
    setBootstrapReady(true);
  }, [googleEnabled, preference, trackablePath]);

  useEffect(() => {
    let cancelled = false;
    if (!productAnalyticsEnabled || !trackablePath || !isAnalyticsConsentGranted(preference)) {
      setProductAnalyticsAttempted(!productAnalyticsEnabled || !isAnalyticsConsentGranted(preference));
      return;
    }
    setProductAnalyticsAttempted(false);
    void initializeProductAnalytics({ apiHost: posthogHost, projectKey: posthogKey }).then(() => {
      if (cancelled) return;
      setProductAnalyticsAttempted(true);
    });
    return () => { cancelled = true; };
  }, [posthogHost, posthogKey, preference, productAnalyticsEnabled, trackablePath]);

  useEffect(() => {
    if (!googleEnabled || !trackablePath || !isAnalyticsConsentGranted(preference) || !tagReady) return;
    trackCurrentGooglePage();
  }, [googleEnabled, preference, tagReady, trackablePath, trackCurrentGooglePage]);

  useEffect(() => {
    if (!productAnalyticsEnabled || !productAnalyticsAttempted || !trackablePath || !isAnalyticsConsentGranted(preference)) return;
    trackCurrentProductPage();
  }, [preference, productAnalyticsAttempted, productAnalyticsEnabled, trackablePath, trackCurrentProductPage]);

  useEffect(() => {
    if (!enabled || !trackablePath || !isAnalyticsConsentGranted(preference)) return;
    const trackNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[href]');
      if (!anchor) return;
      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (destination.origin !== window.location.origin) return;
      const placement = anchor.closest('header') ? 'header'
        : anchor.closest('footer') ? 'footer'
          : anchor.closest('nav') ? 'navigation'
            : 'content';
      trackCardForgeEvent('navigation_selected', { destination: destination.pathname, placement });
    };
    document.addEventListener('click', trackNavigation, true);
    return () => {
      document.removeEventListener('click', trackNavigation, true);
    };
  }, [enabled, preference, trackablePath]);

  const decisionOpen = preference === null || showSettings;
  const reviewingPrivacy = pathname === '/privacy';
  const requiredChoice = trackablePath
    && presentation === 'required_popup'
    && preference === null
    && !reviewingPrivacy;

  useEffect(() => {
    if (!enabled || !preferenceReady || !decisionOpen || !requiredChoice) return;
    acceptButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    const appContent = document.getElementById('cardforge-app-content');
    const wasInert = appContent?.hasAttribute('inert') ?? false;
    const previousAriaHidden = appContent?.getAttribute('aria-hidden') ?? null;
    document.body.style.overflow = 'hidden';
    appContent?.setAttribute('inert', '');
    appContent?.setAttribute('aria-hidden', 'true');
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keepFocusInside);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (!wasInert) appContent?.removeAttribute('inert');
      if (previousAriaHidden === null) appContent?.removeAttribute('aria-hidden');
      else appContent?.setAttribute('aria-hidden', previousAriaHidden);
      document.removeEventListener('keydown', keepFocusInside);
    };
  }, [decisionOpen, enabled, preferenceReady, requiredChoice]);

  if (!enabled || !preferenceReady || !trackablePath) return null;

  const choose = (next: AnalyticsConsentPreference) => {
    if (next === 'granted_once') {
      clearPersistentConsentPreference();
      deleteAnalyticsCookies();
      window.sessionStorage.setItem(ANALYTICS_SESSION_CONSENT_KEY, 'granted');
    } else {
      savePersistentConsentPreference(next);
      window.sessionStorage.removeItem(ANALYTICS_SESSION_CONSENT_KEY);
    }
    setPreference(next);
    setShowSettings(false);
    if (next === 'denied') {
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      lastGoogleLocation.current = null;
      lastProductPath.current = null;
      setTagReady(false);
      deleteAnalyticsCookies();
      disableProductAnalytics();
    } else if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      configureGoogleAnalytics(measurementId, { sessionOnly: next === 'granted_once' });
      lastGoogleLocation.current = null;
    }
  };

  const initializeTag = () => {
    configureGoogleAnalytics(measurementId, { sessionOnly: preference === 'granted_once' });
    setTagReady(true);
  };

  const presentationClassName = requiredChoice
    ? 'fixed inset-0 z-[100] grid place-items-center bg-black/75 p-4'
    : presentation === 'popup'
      ? 'fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl'
      : presentation === 'banner'
        ? 'fixed inset-x-0 bottom-0 z-[100]'
        : 'fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl';

  return (
    <>
      {googleEnabled && isAnalyticsConsentGranted(preference) && trackablePath && bootstrapReady ? (
        <Script
          id="cardforge-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
          strategy="afterInteractive"
          onReady={initializeTag}
        />
      ) : null}
      {decisionOpen ? (
        <div className={presentationClassName}>
          <aside
            ref={dialogRef}
            className={requiredChoice
              ? 'w-full max-w-2xl border border-[var(--cf-warning-border)] bg-[var(--cf-surface)] p-5 text-[var(--cf-text)] shadow-2xl'
              : 'border border-[var(--cf-warning-border)] bg-[var(--cf-surface)] p-4 text-[var(--cf-text)] shadow-2xl'}
            role="dialog"
            aria-modal={requiredChoice}
            aria-labelledby="analytics-consent-title"
            aria-describedby="analytics-consent-description"
          >
            <p id="analytics-consent-title" className="font-serif text-lg text-[var(--cf-text-strong)]">Help improve CardForge</p>
            <p id="analytics-consent-description" className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
              {productAnalyticsEnabled
                ? 'Allow privacy-minimized Google Analytics and PostHog measurement for page visits, basic browser and device context, and selected CardForge actions. PostHog receives only these allow-listed events—no session replay or page content. Card content, names, and email addresses are never sent, and advertising tracking stays disabled.'
                : 'Allow privacy-minimized Google Analytics measurement for page visits, basic browser and device context, and selected CardForge actions. Card content, names, and email addresses are never sent, and advertising tracking stays disabled.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button ref={acceptButtonRef} type="button" onClick={() => choose('granted')}>Accept</Button>
              <Button type="button" variant="outline" onClick={() => choose('granted_once')}>Accept once</Button>
              <Button type="button" variant="outline" onClick={() => choose('denied')}>Decline</Button>
              <Button asChild type="button" variant="ghost"><a href="/privacy">Privacy details</a></Button>
            </div>
          </aside>
        </div>
      ) : (
        <button type="button" onClick={() => setShowSettings(true)} className="fixed bottom-3 left-3 z-50 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3 py-2 text-xs text-[var(--cf-text-muted)] hover:border-[var(--cf-accent)] hover:text-[var(--cf-text-strong)]">Analytics settings</button>
      )}
    </>
  );
}
