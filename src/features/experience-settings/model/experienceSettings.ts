import type { ProjectFileAccessPolicy } from '@/domain/entitlements';

export const PROJECT_FILE_ACCESS_POLICIES = ['free', 'creator_pass'] as const;
export const ANALYTICS_CONSENT_PRESENTATIONS = ['required_popup', 'popup', 'banner'] as const;
export const PRESENTATION_PALETTES = ['forge', 'obsidian', 'slate'] as const;
export const PRESENTATION_ACCENTS = ['brass', 'ember', 'arcane'] as const;
export const PRESENTATION_CORNERS = ['square', 'subtle', 'soft'] as const;
export const PRESENTATION_CONTRASTS = ['standard', 'high'] as const;

export type AnalyticsConsentPresentation = typeof ANALYTICS_CONSENT_PRESENTATIONS[number];
export type PresentationPalette = typeof PRESENTATION_PALETTES[number];
export type PresentationAccent = typeof PRESENTATION_ACCENTS[number];
export type PresentationCorners = typeof PRESENTATION_CORNERS[number];
export type PresentationContrast = typeof PRESENTATION_CONTRASTS[number];

export interface ExperienceSettings {
  projectFileAccess: ProjectFileAccessPolicy;
  analyticsConsentPresentation: AnalyticsConsentPresentation;
  presentationPalette: PresentationPalette;
  presentationAccent: PresentationAccent;
  presentationCorners: PresentationCorners;
  presentationContrast: PresentationContrast;
}

export const DEFAULT_EXPERIENCE_SETTINGS: ExperienceSettings = {
  projectFileAccess: 'creator_pass',
  analyticsConsentPresentation: 'required_popup',
  presentationPalette: 'forge',
  presentationAccent: 'brass',
  presentationCorners: 'subtle',
  presentationContrast: 'standard',
};

const isProjectFileAccessPolicy = (value: unknown): value is ProjectFileAccessPolicy =>
  typeof value === 'string' && PROJECT_FILE_ACCESS_POLICIES.includes(value as ProjectFileAccessPolicy);

const isAnalyticsConsentPresentation = (value: unknown): value is AnalyticsConsentPresentation =>
  typeof value === 'string' && ANALYTICS_CONSENT_PRESENTATIONS.includes(value as AnalyticsConsentPresentation);

const isPresentationPalette = (value: unknown): value is PresentationPalette =>
  typeof value === 'string' && PRESENTATION_PALETTES.includes(value as PresentationPalette);

const isPresentationAccent = (value: unknown): value is PresentationAccent =>
  typeof value === 'string' && PRESENTATION_ACCENTS.includes(value as PresentationAccent);

const isPresentationCorners = (value: unknown): value is PresentationCorners =>
  typeof value === 'string' && PRESENTATION_CORNERS.includes(value as PresentationCorners);

const isPresentationContrast = (value: unknown): value is PresentationContrast =>
  typeof value === 'string' && PRESENTATION_CONTRASTS.includes(value as PresentationContrast);

export const hydrateExperienceSettings = (
  row: Record<string, unknown> | null | undefined,
): ExperienceSettings => ({
  projectFileAccess: isProjectFileAccessPolicy(row?.project_file_access)
    ? row.project_file_access
    : DEFAULT_EXPERIENCE_SETTINGS.projectFileAccess,
  analyticsConsentPresentation: isAnalyticsConsentPresentation(row?.analytics_consent_presentation)
    ? row.analytics_consent_presentation
    : DEFAULT_EXPERIENCE_SETTINGS.analyticsConsentPresentation,
  presentationPalette: isPresentationPalette(row?.presentation_palette)
    ? row.presentation_palette
    : DEFAULT_EXPERIENCE_SETTINGS.presentationPalette,
  presentationAccent: isPresentationAccent(row?.presentation_accent)
    ? row.presentation_accent
    : DEFAULT_EXPERIENCE_SETTINGS.presentationAccent,
  presentationCorners: isPresentationCorners(row?.presentation_corners)
    ? row.presentation_corners
    : DEFAULT_EXPERIENCE_SETTINGS.presentationCorners,
  presentationContrast: isPresentationContrast(row?.presentation_contrast)
    ? row.presentation_contrast
    : DEFAULT_EXPERIENCE_SETTINGS.presentationContrast,
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
  if (!isPresentationPalette(input.presentationPalette)) {
    throw new Error('Choose Forge, Obsidian, or Slate for the presentation palette.');
  }
  if (!isPresentationAccent(input.presentationAccent)) {
    throw new Error('Choose Brass, Ember, or Arcane for the accent character.');
  }
  if (!isPresentationCorners(input.presentationCorners)) {
    throw new Error('Choose square, subtle, or soft corners.');
  }
  if (!isPresentationContrast(input.presentationContrast)) {
    throw new Error('Choose standard or high contrast.');
  }
  return {
    projectFileAccess: input.projectFileAccess,
    analyticsConsentPresentation: input.analyticsConsentPresentation,
    presentationPalette: input.presentationPalette,
    presentationAccent: input.presentationAccent,
    presentationCorners: input.presentationCorners,
    presentationContrast: input.presentationContrast,
  };
};
