import { describe, expect, it } from 'vitest';

import {
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
} from '@/features/experience-settings/model/experienceSettings';

const validInput = {
  projectFileAccess: 'creator_pass',
  analyticsConsentPresentation: 'required_popup',
  presentationPalette: 'forge',
  presentationAccent: 'brass',
  presentationCorners: 'subtle',
  presentationContrast: 'standard',
} as const;

describe('owner Studio default Template setting', () => {
  it('hydrates the optional published Template id without forcing a default', () => {
    expect(hydrateExperienceSettings(null).studioDefaultTemplateId).toBeNull();
    expect(hydrateExperienceSettings({ studio_default_template_id: '  template-b  ' }).studioDefaultTemplateId).toBe('template-b');
  });

  it('normalizes blank values to automatic mode and trims a selected Template id', () => {
    expect(normalizeExperienceSettingsInput({
      ...validInput,
      studioDefaultTemplateId: '',
    }).studioDefaultTemplateId).toBeNull();

    expect(normalizeExperienceSettingsInput({
      ...validInput,
      studioDefaultTemplateId: '  template-b  ',
    }).studioDefaultTemplateId).toBe('template-b');
  });

  it('rejects non-string Studio default values', () => {
    expect(() => normalizeExperienceSettingsInput({
      ...validInput,
      studioDefaultTemplateId: 42,
    })).toThrow('Choose a published Studio Template or use the automatic default.');
  });
});
