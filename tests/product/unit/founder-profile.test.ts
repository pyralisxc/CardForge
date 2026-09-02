import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FOUNDER_PROFILE,
  normalizeFounderProfileInput,
} from '@/features/public-site/client';

const validInput = {
  heroEyebrow: '  Hey, welcome in. ',
  heroHeadline: ' I’m Cameron. ',
  introduction: ' I build CardForge Studio in Oregon. ',
  roadHeading: ' The road here ',
  roadBody: ' Time in Hawaii and hitchhiking taught me resourcefulness. ',
  currentHeading: ' What I’m building toward ',
  currentBody: ' CardForge is the first product in a larger journey. ',
  priorities: [' Make CardForge friendlier. ', ' Ship useful products. '],
  supportHeading: ' Help me keep building. ',
  supportIntroduction: ' Support creates room to keep working. ',
  supportUseSummary: ' Food, housing, transportation, and business costs. ',
  facebookUrl: 'https://www.facebook.com/cardforge',
  instagramUrl: '',
  discordUrl: 'https://discord.gg/cardforge',
};

describe('founder profile rules', () => {
  it('ships honest Cameron defaults without invented socials or portrait media', () => {
    expect(DEFAULT_FOUNDER_PROFILE.heroHeadline).toContain('Cameron');
    expect(DEFAULT_FOUNDER_PROFILE.introduction).toContain('Oregon');
    expect(DEFAULT_FOUNDER_PROFILE.roadBody).toContain('Hawaii');
    expect(DEFAULT_FOUNDER_PROFILE.roadBody).toContain('hitchhiking');
    expect(DEFAULT_FOUNDER_PROFILE.facebookUrl).toBeNull();
    expect(DEFAULT_FOUNDER_PROFILE.instagramUrl).toBeNull();
    expect(DEFAULT_FOUNDER_PROFILE.discordUrl).toBeNull();
  });

  it('trims bounded copy, priorities, and blank social URLs', () => {
    const result = normalizeFounderProfileInput(validInput);

    expect(result).toEqual({
      ok: true,
      value: {
        ...validInput,
        heroEyebrow: 'Hey, welcome in.',
        heroHeadline: 'I’m Cameron.',
        introduction: 'I build CardForge Studio in Oregon.',
        roadHeading: 'The road here',
        roadBody: 'Time in Hawaii and hitchhiking taught me resourcefulness.',
        currentHeading: 'What I’m building toward',
        currentBody: 'CardForge is the first product in a larger journey.',
        priorities: ['Make CardForge friendlier.', 'Ship useful products.'],
        supportHeading: 'Help me keep building.',
        supportIntroduction: 'Support creates room to keep working.',
        supportUseSummary: 'Food, housing, transportation, and business costs.',
        instagramUrl: null,
      },
    });
  });

  it('rejects unknown fields, malformed priorities, and unsafe or mismatched social URLs', () => {
    expect(normalizeFounderProfileInput({ ...validInput, surprise: true }).ok).toBe(false);
    expect(normalizeFounderProfileInput({ ...validInput, portraitStoragePath: null }).ok).toBe(false);
    expect(normalizeFounderProfileInput({ ...validInput, priorities: [] }).ok).toBe(false);
    expect(normalizeFounderProfileInput({
      ...validInput,
      priorities: Array.from({ length: 6 }, (_, index) => `Priority ${index}`),
    }).ok).toBe(false);
    expect(normalizeFounderProfileInput({ ...validInput, facebookUrl: 'http://facebook.com/cardforge' }).ok).toBe(false);
    expect(normalizeFounderProfileInput({ ...validInput, instagramUrl: 'https://example.com/cardforge' }).ok).toBe(false);
    expect(normalizeFounderProfileInput({ ...validInput, discordUrl: 'javascript:alert(1)' }).ok).toBe(false);
  });

  it('rejects overlong public copy', () => {
    expect(normalizeFounderProfileInput({
      ...validInput,
      introduction: 'x'.repeat(1201),
    }).ok).toBe(false);
  });
});
