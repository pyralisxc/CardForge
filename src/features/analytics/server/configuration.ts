import type { AnalyticsConfigurationStatus } from '../model';

export const getAnalyticsConfigurationStatus = (): AnalyticsConfigurationStatus => {
  const measurementIdConfigured = Boolean(process.env.NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID);
  const propertyIdConfigured = Boolean(process.env.CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID);
  const serviceAccountEmailConfigured = Boolean(process.env.CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const serviceAccountPrivateKeyConfigured = Boolean(process.env.CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  const searchConsoleConfigured = Boolean(process.env.CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL)
    && serviceAccountEmailConfigured
    && serviceAccountPrivateKeyConfigured;
  return {
    collectionEnabled: process.env.NEXT_PUBLIC_CARDFORGE_ANALYTICS_ENABLED === 'true' && measurementIdConfigured,
    measurementIdConfigured,
    reportingConfigured: propertyIdConfigured && serviceAccountEmailConfigured && serviceAccountPrivateKeyConfigured,
    searchConsoleConfigured,
    missing: [
      !measurementIdConfigured ? 'NEXT_PUBLIC_CARDFORGE_GA_MEASUREMENT_ID' : null,
      !propertyIdConfigured ? 'CARDFORGE_GOOGLE_ANALYTICS_PROPERTY_ID' : null,
      !serviceAccountEmailConfigured ? 'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_EMAIL' : null,
      !serviceAccountPrivateKeyConfigured ? 'CARDFORGE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY' : null,
      !process.env.CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL ? 'CARDFORGE_GOOGLE_SEARCH_CONSOLE_SITE_URL' : null,
    ].filter((value): value is string => Boolean(value)),
  };
};
