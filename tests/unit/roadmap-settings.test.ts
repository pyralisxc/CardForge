import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ROADMAP_SETTINGS,
  normalizeRoadmapSettingsInput,
} from '@/features/roadmap/client';

describe('roadmap settings rules', () => {
  it('normalizes bounded owner-controlled guardrails', () => {
    expect(normalizeRoadmapSettingsInput({
      maxActiveUserRoadmapItems: '75',
      maxRoadmapSuggestionLength: '240',
      roadmapNegativeSignalMinTotalVotes: '12',
      roadmapNegativeSignalMinDownvotePercent: '65',
      roadmapEstimatedTaxPercent: '30',
      roadmapOperatingReservePercent: '20',
    })).toEqual({
      maxActiveUserRoadmapItems: 75,
      maxRoadmapSuggestionLength: 240,
      roadmapNegativeSignalMinTotalVotes: 12,
      roadmapNegativeSignalMinDownvotePercent: 65,
      roadmapEstimatedTaxPercent: 30,
      roadmapOperatingReservePercent: 20,
    });

    expect(normalizeRoadmapSettingsInput({
      maxActiveUserRoadmapItems: '0',
      maxRoadmapSuggestionLength: '9000',
      roadmapNegativeSignalMinTotalVotes: '-1',
      roadmapNegativeSignalMinDownvotePercent: 'bad',
    })).toEqual(DEFAULT_ROADMAP_SETTINGS);
  });
});
