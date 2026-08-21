import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPERIENCE_SETTINGS,
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
} from '@/features/experience-settings/client';

describe('experience settings', () => {
  it('launches with safe access, consent, and presentation defaults', () => {
    expect(DEFAULT_EXPERIENCE_SETTINGS).toEqual({
      projectFileAccess: 'creator_pass',
      analyticsConsentPresentation: 'required_popup',
      presentationPalette: 'forge',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
    });
  });

  it('hydrates only known public values and otherwise uses safe launch defaults', () => {
    expect(hydrateExperienceSettings({
      project_file_access: 'free',
      analytics_consent_presentation: 'banner',
      presentation_palette: 'slate',
      presentation_accent: 'arcane',
      presentation_corners: 'soft',
      presentation_contrast: 'high',
    })).toEqual({
      projectFileAccess: 'free',
      analyticsConsentPresentation: 'banner',
      presentationPalette: 'slate',
      presentationAccent: 'arcane',
      presentationCorners: 'soft',
      presentationContrast: 'high',
    });
    expect(hydrateExperienceSettings({
      project_file_access: 'unexpected',
      analytics_consent_presentation: null,
      presentation_palette: 'custom',
      presentation_accent: 'custom',
      presentation_corners: 'custom',
      presentation_contrast: 'custom',
    })).toEqual(DEFAULT_EXPERIENCE_SETTINGS);
  });

  it('rejects unsupported owner writes instead of coercing them', () => {
    expect(() => normalizeExperienceSettingsInput({
      projectFileAccess: 'enterprise',
      analyticsConsentPresentation: 'hidden',
      presentationPalette: 'forge',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
    })).toThrow('Choose whether project files are free or require Creator Pass.');

    expect(() => normalizeExperienceSettingsInput({
      projectFileAccess: 'creator_pass',
      analyticsConsentPresentation: 'required_popup',
      presentationPalette: 'custom',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
    })).toThrow('Choose Forge, Obsidian, or Slate for the presentation palette.');
  });
});
