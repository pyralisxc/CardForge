import { describe, expect, it } from 'vitest';

import {
  DEFAULT_EXPERIENCE_SETTINGS,
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
} from '@/features/experience-settings/client';

describe('experience settings', () => {
  it('launches with paid project files and a required analytics choice', () => {
    expect(DEFAULT_EXPERIENCE_SETTINGS).toEqual({
      projectFileAccess: 'creator_pass',
      analyticsConsentPresentation: 'required_popup',
    });
  });

  it('hydrates only known public values and otherwise uses safe launch defaults', () => {
    expect(hydrateExperienceSettings({
      project_file_access: 'free',
      analytics_consent_presentation: 'banner',
    })).toEqual({
      projectFileAccess: 'free',
      analyticsConsentPresentation: 'banner',
    });
    expect(hydrateExperienceSettings({
      project_file_access: 'unexpected',
      analytics_consent_presentation: null,
    })).toEqual(DEFAULT_EXPERIENCE_SETTINGS);
  });

  it('rejects unsupported owner writes instead of coercing them', () => {
    expect(() => normalizeExperienceSettingsInput({
      projectFileAccess: 'enterprise',
      analyticsConsentPresentation: 'hidden',
    })).toThrow('Choose whether project files are free or require Creator Pass.');
  });
});
