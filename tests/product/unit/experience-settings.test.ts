import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPERIENCE_SETTINGS,
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
} from '@/features/experience-settings/client';

describe('experience settings', () => {
  it('launches with safe consent and presentation defaults', () => {
    expect(DEFAULT_EXPERIENCE_SETTINGS).toEqual({
      analyticsConsentPresentation: 'required_popup',
      presentationPalette: 'forge',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
      studioDefaultTemplateId: null,
    });
  });

  it('hydrates only known public values and otherwise uses safe launch defaults', () => {
    expect(hydrateExperienceSettings({
      analytics_consent_presentation: 'banner',
      presentation_palette: 'slate',
      presentation_accent: 'arcane',
      presentation_corners: 'soft',
      presentation_contrast: 'high',
    })).toEqual({
      analyticsConsentPresentation: 'banner',
      presentationPalette: 'slate',
      presentationAccent: 'arcane',
      presentationCorners: 'soft',
      presentationContrast: 'high',
      studioDefaultTemplateId: null,
    });
    expect(hydrateExperienceSettings({
      analytics_consent_presentation: null,
      presentation_palette: 'custom',
      presentation_accent: 'custom',
      presentation_corners: 'custom',
      presentation_contrast: 'custom',
    })).toEqual(DEFAULT_EXPERIENCE_SETTINGS);
  });

  it('rejects unsupported owner writes instead of coercing them', () => {
    expect(() => normalizeExperienceSettingsInput({
      analyticsConsentPresentation: 'hidden',
      presentationPalette: 'forge',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
    })).toThrow('Choose required popup, current popup, or quiet banner for analytics consent.');

    expect(() => normalizeExperienceSettingsInput({
      analyticsConsentPresentation: 'required_popup',
      presentationPalette: 'custom',
      presentationAccent: 'brass',
      presentationCorners: 'subtle',
      presentationContrast: 'standard',
    })).toThrow('Choose Forge, Obsidian, or Slate for the presentation palette.');
  });
});
