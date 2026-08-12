import {
  isAllowedPostHogHost,
  isValidPostHogProjectId,
  type AnalyticsConfigurationStatus,
} from '../model';

export const getAnalyticsConfigurationStatus = (): AnalyticsConfigurationStatus => {
  const interactionCollectionKey = process.env.NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY?.trim() ?? '';
  const interactionCollectionHost = process.env.NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST?.trim() ?? '';
  const interactionReportingKey = process.env.CARDFORGE_POSTHOG_PERSONAL_API_KEY?.trim() ?? '';
  const interactionProjectId = process.env.CARDFORGE_POSTHOG_PROJECT_ID?.trim() ?? '';
  const interactionAppHost = process.env.CARDFORGE_POSTHOG_APP_HOST?.trim() ?? '';
  const measurementIdConfigured = Boolean(process.env.NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID);
  const propertyIdConfigured = Boolean(process.env.CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID);
  const serviceAccountEmailConfigured = Boolean(process.env.CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const serviceAccountPrivateKeyConfigured = Boolean(process.env.CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const searchConsoleConfigured = Boolean(process.env.CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL)
    && serviceAccountEmailConfigured
    && serviceAccountPrivateKeyConfigured;
  const interactionCollectionConfigured = Boolean(interactionCollectionKey)
    && isAllowedPostHogHost(interactionCollectionHost);
  const interactionReportingConfigured = Boolean(interactionReportingKey)
    && isValidPostHogProjectId(interactionProjectId)
    && isAllowedPostHogHost(interactionAppHost);
  return {
    collectionEnabled: process.env.NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED === 'true'
      && (measurementIdConfigured || interactionCollectionConfigured),
    measurementIdConfigured,
    reportingConfigured: propertyIdConfigured && serviceAccountEmailConfigured && serviceAccountPrivateKeyConfigured,
    searchConsoleConfigured,
    interactionCollectionConfigured,
    interactionReportingConfigured,
    missing: [
      !measurementIdConfigured ? 'NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID' : null,
      !propertyIdConfigured ? 'CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID' : null,
      !serviceAccountEmailConfigured ? 'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL' : null,
      !serviceAccountPrivateKeyConfigured ? 'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY' : null,
      !process.env.CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL ? 'CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL' : null,
      !interactionCollectionKey ? 'NEXT_PUBLIC_CARDFORGE_POSTHOG_KEY' : null,
      !isAllowedPostHogHost(interactionCollectionHost) ? 'NEXT_PUBLIC_CARDFORGE_POSTHOG_HOST' : null,
      !interactionReportingKey ? 'CARDFORGE_POSTHOG_PERSONAL_API_KEY' : null,
      !isValidPostHogProjectId(interactionProjectId) ? 'CARDFORGE_POSTHOG_PROJECT_ID' : null,
      !isAllowedPostHogHost(interactionAppHost) ? 'CARDFORGE_POSTHOG_APP_HOST' : null,
    ].filter((value): value is string => Boolean(value)),
  };
};
