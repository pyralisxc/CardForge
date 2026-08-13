"use client";

import type { PostHog } from 'posthog-js';

import {
  isAllowedPostHogHost,
  type AnalyticsEventParameters,
  type ProductAnalyticsEventName,
} from '../model';

let client: PostHog | null = null;
let initialization: Promise<PostHog | null> | null = null;
let authorizationEpoch = 0;
let analyticsAuthorized = false;

const isProductionBrowser = () => typeof window !== 'undefined'
  && !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

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
      });
      posthog.register({ $geoip_disable: true });
      if (!analyticsAuthorized || requestedEpoch !== authorizationEpoch) {
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
  client.reset();
  client.set_config({ disable_persistence: true });
};
