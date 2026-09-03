"use client";

import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_SESSION_CONSENT_KEY,
  ANALYTICS_SIGN_UP_INTENT_KEY,
  sanitizeAnalyticsEventParameters,
  type AnalyticsConsentPreference,
  type CardForgeAnalyticsEventName,
} from '../model';
import { captureProductAnalyticsEvent } from './posthog';
import { inferBoundaryFailureKind, type BoundaryFailureKind } from '@/shared/boundaryFailure';

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
  if (value === 'granted' || value === 'denied') return value;
  if (typeof window !== 'undefined' && window.sessionStorage?.getItem(ANALYTICS_SESSION_CONSENT_KEY) === 'granted') {
    return 'granted_once';
  }
  return null;
};

export const isAnalyticsConsentGranted = (
  preference: AnalyticsConsentPreference | null = getAnalyticsConsentPreference(),
): boolean => preference === 'granted' || preference === 'granted_once';

export const trackCardForgeEvent = (
  eventName: CardForgeAnalyticsEventName,
  parameters: Record<string, unknown> = {},
) => {
  if (typeof window === 'undefined' || !isAnalyticsConsentGranted()) return;
  trackGoogleCardForgeEvent(eventName, parameters);
  trackProductCardForgeEvent(eventName, parameters);
};

export type ProviderAnalyticsScope = 'google_drive' | 'pipeline';
export type ProviderAnalyticsAction =
  | 'disconnect'
  | 'folder_select'
  | 'personal_content'
  | 'personal_list'
  | 'personal_register'
  | 'personal_remove'
  | 'picker_config'
  | 'picker_load'
  | 'pipeline_submit'
  | 'pipeline_upload'
  | 'pipeline_upload_plan'
  | 'project_delete'
  | 'project_download'
  | 'project_list'
  | 'project_prepare'
  | 'project_upload';

export const trackProviderBoundaryFailure = (
  scope: ProviderAnalyticsScope,
  action: ProviderAnalyticsAction,
  boundaryKind: BoundaryFailureKind = 'unavailable',
) => trackCardForgeEvent('provider_boundary_outcome', {
  scope,
  provider_action: action,
  outcome: 'failure',
  boundary_kind: boundaryKind,
});

export const trackProviderBoundaryOutcome = (
  scope: ProviderAnalyticsScope,
  action: ProviderAnalyticsAction,
  response: Pick<Response, 'ok' | 'status'>,
) => trackCardForgeEvent('provider_boundary_outcome', {
  scope,
  provider_action: action,
  outcome: response.ok ? 'success' : 'failure',
  boundary_kind: response.ok ? 'none' : inferBoundaryFailureKind(response.status),
});

export const observeProviderBoundaryResponse = async (
  scope: ProviderAnalyticsScope,
  action: ProviderAnalyticsAction,
  request: () => Promise<Response>,
): Promise<Response> => {
  try {
    const response = await request();
    trackProviderBoundaryOutcome(scope, action, response);
    return response;
  } catch (error) {
    trackProviderBoundaryFailure(scope, action);
    throw error;
  }
};

export const trackGoogleCardForgeEvent = (
  eventName: CardForgeAnalyticsEventName,
  parameters: Record<string, unknown> = {},
) => {
  if (typeof window === 'undefined' || !isAnalyticsConsentGranted() || !window.gtag) return;
  const context = getSafeAnalyticsPageContext();
  const sanitized = sanitizeAnalyticsEventParameters(parameters);
  window.gtag('event', eventName, { ...sanitized, ...context });
};

export const trackProductCardForgeEvent = (
  eventName: CardForgeAnalyticsEventName,
  parameters: Record<string, unknown> = {},
) => {
  if (typeof window === 'undefined' || !isAnalyticsConsentGranted()) return;
  const context = getSafeAnalyticsPageContext();
  const sanitized = sanitizeAnalyticsEventParameters(parameters);
  captureProductAnalyticsEvent(eventName, {
    ...sanitized,
    path: typeof context.page_path === 'string' ? context.page_path : '/',
  });
};

export const bootstrapGoogleAnalytics = () => {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  // Google processes the canonical Arguments object differently from a rest-parameter array.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = window.gtag ?? function gtag() { window.dataLayer?.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
};

export const configureGoogleAnalytics = (
  measurementId: string,
  { sessionOnly = false }: { sessionOnly?: boolean } = {},
) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('js', new Date());
  const context = getSafeAnalyticsPageContext();
  window.gtag('set', context);
  window.gtag('config', measurementId, {
    send_page_view: false,
    cookie_expires: sessionOnly ? 0 : 63_072_000,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ignore_referrer: true,
    ...context,
  });
};

export const trackAnalyticsPageView = (lastTrackedLocation: string | null = null) => {
  if (typeof window === 'undefined' || !isAnalyticsConsentGranted() || !window.gtag) return null;
  const context = getSafeAnalyticsPageContext();
  if (!context.page_location || context.page_location === lastTrackedLocation) return null;
  window.gtag('set', context);
  window.gtag('event', 'page_view', context);
  return context.page_location;
};

export const trackProductAnalyticsPageView = (lastTrackedPath: string | null = null) => {
  if (typeof window === 'undefined' || !isAnalyticsConsentGranted()) return null;
  const context = getSafeAnalyticsPageContext();
  const path = typeof context.page_path === 'string' ? context.page_path : '/';
  if (path === lastTrackedPath) return null;
  captureProductAnalyticsEvent('page_viewed', {
    path,
  });
  return path;
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
  if (typeof window === 'undefined' || !isAnalyticsConsentGranted()) return;
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

export type AnalyticsExportKind = 'image' | 'png_set' | 'pdf' | 'tabletop_simulator' | 'project' | 'social_image';

export const trackExportStarted = (exportKind: AnalyticsExportKind, cardCount?: number) =>
  trackCardForgeEvent('export_started', {
    export_kind: exportKind,
    ...(cardCount === undefined ? {} : { card_count: cardCount }),
  });

export const trackExportFailed = (exportKind: AnalyticsExportKind, failureStage: string, cardCount?: number) =>
  trackCardForgeEvent('export_failed', {
    export_kind: exportKind,
    failure_stage: failureStage,
    ...(cardCount === undefined ? {} : { card_count: cardCount }),
    success: false,
  });

export const trackExportCompleted = (
  exportKind: AnalyticsExportKind,
  cardCount?: number,
) => trackCardForgeEvent('export_completed', {
  export_kind: exportKind,
  ...(cardCount === undefined ? {} : { card_count: cardCount }),
  success: true,
});
