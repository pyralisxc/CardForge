"use client";

import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_SIGN_UP_INTENT_KEY,
  sanitizeAnalyticsEventParameters,
  type AnalyticsConsentPreference,
  type CardForgeAnalyticsEventName,
} from '../model';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SIGN_UP_INTENT_TTL_MS = 30 * 60 * 1000;

export const getAnalyticsConsentPreference = (): AnalyticsConsentPreference | null => {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split(';')
    .map((entry) => entry.trim().split('='))
    .find(([name]) => name === ANALYTICS_CONSENT_COOKIE)?.[1];
  return value === 'granted' || value === 'denied' ? value : null;
};

export const trackCardForgeEvent = (
  eventName: CardForgeAnalyticsEventName,
  parameters: Record<string, unknown> = {},
) => {
  if (typeof window === 'undefined' || getAnalyticsConsentPreference() !== 'granted' || !window.gtag) return;
  const context = getSafeAnalyticsPageContext();
  window.gtag('event', eventName, {
    ...sanitizeAnalyticsEventParameters(parameters),
    ...context,
  });
};

export const getSafeAnalyticsPageContext = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return {};
  const location = new URL(window.location.href);
  const safeLocation = new URL(location.pathname, location.origin);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = location.searchParams.get(key);
    if (value) safeLocation.searchParams.set(key, value.slice(0, 100));
  }
  let safeReferrer = '';
  if (typeof document.referrer === 'string' && document.referrer) {
    try {
      const referrer = new URL(document.referrer);
      safeReferrer = `${referrer.origin}${referrer.pathname}`;
    } catch {
      safeReferrer = '';
    }
  }
  return {
    page_location: safeLocation.toString(),
    page_path: location.pathname,
    page_referrer: safeReferrer,
    page_title: String(document.title ?? '').slice(0, 100),
  };
};

export const markSignUpIntent = () => {
  if (typeof window === 'undefined' || getAnalyticsConsentPreference() !== 'granted' || !window.gtag) return;
  window.sessionStorage.setItem(ANALYTICS_SIGN_UP_INTENT_KEY, String(Date.now()));
};

export const completeSignUpIntent = (userCreatedAt?: Date | string | number | null) => {
  if (typeof window === 'undefined') return;
  const raw = window.sessionStorage.getItem(ANALYTICS_SIGN_UP_INTENT_KEY);
  if (!raw) return;
  window.sessionStorage.removeItem(ANALYTICS_SIGN_UP_INTENT_KEY);
  const startedAt = Number(raw);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt > SIGN_UP_INTENT_TTL_MS) return;
  const createdAt = userCreatedAt instanceof Date ? userCreatedAt.getTime() : new Date(userCreatedAt ?? '').getTime();
  if (!Number.isFinite(createdAt) || createdAt < startedAt - 60_000 || Date.now() - createdAt > SIGN_UP_INTENT_TTL_MS) return;
  trackCardForgeEvent('sign_up', { method: 'clerk' });
};

export const trackCardCreated = (creationMethod: 'single' | 'bulk', cardCount: number) =>
  trackCardForgeEvent('card_created', { creation_method: creationMethod, card_count: cardCount });

export const trackExportCompleted = (
  exportKind: 'image' | 'png_set' | 'pdf' | 'tabletop_simulator' | 'project' | 'social_image',
  cardCount?: number,
) => trackCardForgeEvent('export_completed', {
  export_kind: exportKind,
  ...(cardCount === undefined ? {} : { card_count: cardCount }),
  success: true,
});
