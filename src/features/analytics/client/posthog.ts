"use client";

import type { CapturedNetworkRequest, PostHog } from 'posthog-js';

import {
  isAllowedPostHogHost,
  type AnalyticsEventParameters,
  type ProductAnalyticsEventName,
} from '../model';

const PUBLIC_REPLAY_PATHS = new Set([
  '/',
  '/about',
  '/accessibility',
  '/cameron',
  '/contact',
  '/creator-pass-terms',
  '/creator-pool',
  '/developer-terms',
  '/privacy',
  '/refund',
  '/roadmap',
  '/supporter-terms',
  '/terms',
]);

let client: PostHog | null = null;
let initialization: Promise<PostHog | null> | null = null;
let authorizationEpoch = 0;
let analyticsAuthorized = false;

const safePageUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return window.location.origin;
  }
};

export const maskReplayAttribute = (name: string, value: string): string => {
  const normalizedName = name.toLowerCase();
  if (['alt', 'aria-description', 'aria-label', 'placeholder', 'title', 'value'].includes(normalizedName)) {
    return value.replace(/\S/gu, '*');
  }
  if (normalizedName.startsWith('data-')) return '';
  if (normalizedName === 'style') return '';
  if (!['action', 'formaction', 'href', 'src'].includes(normalizedName)) return value;
  if (/^(mailto|tel):/iu.test(value)) return `${value.split(':')[0]}:redacted`;
  if (/^(blob|data):/iu.test(value)) return '';
  if (value.startsWith('#')) return '#';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.pathname : `${url.origin}${url.pathname}`;
  } catch {
    return '';
  }
};

export const redactReplayRequest = (request: CapturedNetworkRequest): CapturedNetworkRequest | null => {
  const isReplayNavigation = request.isInitial || (!request.method && !request.initiatorType);
  if (!isReplayNavigation) return null;
  return {
    ...request,
    name: safePageUrl(request.name),
    requestHeaders: undefined,
    requestBody: undefined,
    responseHeaders: undefined,
    responseBody: undefined,
  };
};

const isProductionBrowser = () => typeof window !== 'undefined'
  && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export const isPublicAnalyticsReplayPath = (pathname: string) => PUBLIC_REPLAY_PATHS.has(pathname);

export const initializeProductAnalytics = async ({
  apiHost,
  projectKey,
}: {
  apiHost: string;
  projectKey: string;
}): Promise<boolean> => {
  if (!isProductionBrowser() || !projectKey || !isAllowedPostHogHost(apiHost)) return false;
  analyticsAuthorized = true;
  const requestedEpoch = authorizationEpoch;
  if (client) {
    client.set_config({ disable_persistence: false });
    return true;
  }
  if (!initialization) {
    const currentInitialization = import('posthog-js').then(({ default: posthog }) => {
      if (!analyticsAuthorized || requestedEpoch !== authorizationEpoch) return null;
      posthog.init(projectKey, {
        api_host: apiHost,
        ui_host: apiHost.replace('.i.posthog.com', '.posthog.com'),
        defaults: '2026-05-30',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        advanced_disable_feature_flags: true,
        advanced_disable_feature_flags_on_first_load: true,
        disable_session_recording: true,
        person_profiles: 'never',
        persistence: 'sessionStorage',
        cross_subdomain_cookie: false,
        secure_cookie: true,
        save_referrer: false,
        save_campaign_params: false,
        property_denylist: [
          '$current_url',
          '$initial_current_url',
          '$referrer',
          '$initial_referrer',
          '$referring_domain',
          '$initial_referring_domain',
          '$session_entry_url',
          '$session_entry_referrer',
        ],
        session_recording: {
          blockSelector: '#cardforge-app-content[data-analytics-replay="blocked"]',
          captureCanvas: { recordCanvas: false },
          maskAllInputs: true,
          maskTextSelector: '*',
          maskAttributeFn: maskReplayAttribute,
          recordHeaders: false,
          recordBody: false,
          recordCrossOriginIframes: false,
          maskCapturedNetworkRequestFn: redactReplayRequest,
        },
      });
      posthog.register({ $geoip_disable: true });
      if (!analyticsAuthorized || requestedEpoch !== authorizationEpoch) {
        posthog.stopSessionRecording();
        posthog.reset();
        posthog.set_config({ disable_persistence: true });
        return null;
      }
      client = posthog;
      return posthog;
    }).catch((error) => {
      console.error('Unable to initialize product analytics:', error instanceof Error ? error.message : error);
      return null;
    }).finally(() => {
      if (initialization === currentInitialization) initialization = null;
    });
    initialization = currentInitialization;
  }
  return Boolean(await initialization);
};

export const setProductAnalyticsPath = (pathname: string) => {
  if (!client) return;
  if (!analyticsAuthorized) client.stopSessionRecording();
  else if (isPublicAnalyticsReplayPath(pathname)) client.startSessionRecording();
  else client.stopSessionRecording();
};

export const captureProductAnalyticsEvent = (
  eventName: ProductAnalyticsEventName,
  parameters: AnalyticsEventParameters,
) => {
  if (analyticsAuthorized) client?.capture(eventName, parameters);
};

export const disableProductAnalytics = () => {
  analyticsAuthorized = false;
  authorizationEpoch += 1;
  initialization = null;
  if (!client) return;
  client.stopSessionRecording();
  client.reset();
  client.set_config({ disable_persistence: true });
};
