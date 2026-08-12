import { describe, expect, it } from 'vitest';

import {
  buildOrganicCampaignUrl,
  normalizeOrganicCampaignToken,
  sanitizeAnalyticsEventParameters,
} from '@/features/analytics/model';

describe('organic analytics model', () => {
  it('builds stable organic-social links without disturbing unrelated destination parameters', () => {
    const link = buildOrganicCampaignUrl({
      destinationUrl: 'https://cardforges.com/studio?view=generator',
      source: 'Facebook Groups',
      campaign: 'Creator Launch',
      content: 'Group Post 01',
    });

    expect(link).toBe(
      'https://cardforges.com/studio?view=generator&utm_source=facebook_groups&utm_medium=organic_social&utm_campaign=creator_launch&utm_content=group_post_01',
    );
  });

  it('normalizes campaign tokens and rejects empty tracking fields', () => {
    expect(normalizeOrganicCampaignToken('  Threads / Feature Preview  ')).toBe('threads_feature_preview');
    expect(() => buildOrganicCampaignUrl({
      destinationUrl: 'https://cardforges.com',
      source: ' ',
      campaign: 'launch',
    })).toThrow('source');
  });

  it('allows only anonymous, bounded event parameters', () => {
    expect(sanitizeAnalyticsEventParameters({
      export_kind: 'png_set',
      card_count: 4,
      success: true,
      email: 'visitor@example.test',
      card_title: 'Secret card title',
      oversized: 'x'.repeat(101),
    })).toEqual({
      export_kind: 'png_set',
      card_count: 4,
      success: true,
    });
  });
});
