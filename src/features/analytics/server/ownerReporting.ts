import type { OwnerAnalyticsSnapshot } from '../model';
import { getGoogleOwnerAnalyticsSnapshot } from './googleReporting';
import { applyProductAnalyticsReporting } from './posthogReporting';

export const getOwnerAnalyticsSnapshot = async (): Promise<OwnerAnalyticsSnapshot> => {
  const snapshot = await getGoogleOwnerAnalyticsSnapshot();
  await applyProductAnalyticsReporting(snapshot);
  if (!snapshot.configuration.reportingConfigured
    && !snapshot.configuration.searchConsoleConfigured
    && !snapshot.configuration.interactionReportingConfigured) {
    snapshot.warnings = ['Analytics read-only reporting is not configured yet.'];
  }
  snapshot.warnings = Array.from(new Set(snapshot.warnings));
  return snapshot;
};
