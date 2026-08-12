import type { ProjectFileAccessPolicy } from '@/domain/entitlements';

export const PROJECT_FILE_ACCESS_POLICIES = ['free', 'creator_pass'] as const;
export const ANALYTICS_CONSENT_PRESENTATIONS = ['required_popup', 'popup', 'banner'] as const;

export type AnalyticsConsentPresentation = typeof ANALYTICS_CONSENT_PRESENTATIONS[number];

export interface ExperienceSettings {
  projectFileAccess: ProjectFileAccessPolicy;
  analyticsConsentPresentation: AnalyticsConsentPresentation;
}

export const DEFAULT_EXPERIENCE_SETTINGS: ExperienceSettings = {
  projectFileAccess: 'creator_pass',
  analyticsConsentPresentation: 'required_popup',
};

const isProjectFileAccessPolicy = (value: unknown): value is ProjectFileAccessPolicy =>
  typeof value === 'string' && PROJECT_FILE_ACCESS_POLICIES.includes(value as ProjectFileAccessPolicy);

const isAnalyticsConsentPresentation = (value: unknown): value is AnalyticsConsentPresentation =>
  typeof value === 'string' && ANALYTICS_CONSENT_PRESENTATIONS.includes(value as AnalyticsConsentPresentation);

export const hydrateExperienceSettings = (
  row: Record<string, unknown> | null | undefined,
): ExperienceSettings => ({
  projectFileAccess: isProjectFileAccessPolicy(row?.project_file_access)
    ? row.project_file_access
    : DEFAULT_EXPERIENCE_SETTINGS.projectFileAccess,
  analyticsConsentPresentation: isAnalyticsConsentPresentation(row?.analytics_consent_presentation)
    ? row.analytics_consent_presentation
    : DEFAULT_EXPERIENCE_SETTINGS.analyticsConsentPresentation,
});

export const normalizeExperienceSettingsInput = (
  input: Record<string, unknown>,
): ExperienceSettings => {
  if (!isProjectFileAccessPolicy(input.projectFileAccess)) {
    throw new Error('Choose whether project files are free or require Creator Pass.');
  }
  if (!isAnalyticsConsentPresentation(input.analyticsConsentPresentation)) {
    throw new Error('Choose required popup, current popup, or quiet banner for analytics consent.');
  }
  return {
    projectFileAccess: input.projectFileAccess,
    analyticsConsentPresentation: input.analyticsConsentPresentation,
  };
};
