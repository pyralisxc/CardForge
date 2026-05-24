import { describe, expect, it } from 'vitest';

import {
  MAX_ACTIVE_USER_ROADMAP_ITEMS,
  MAX_ROADMAP_SUGGESTION_LENGTH,
  DEFAULT_ROADMAP_VOTING_RULES,
  calculateMrrUnlockTargetCents,
  groupRoadmapTimelineItems,
  isChronicleTimelineItem,
  getCurrentTimelineWindow,
  normalizeRoadmapSuggestion,
  sortRoadmapFeatures,
  shouldArchiveUserRoadmapItem,
} from '@/lib/roadmap';

describe('roadmap rules', () => {
  it('normalizes compact roadmap suggestions for storage', () => {
    const result = normalizeRoadmapSuggestion('  Better   foil\nexport controls  ');

    expect(result).toEqual({
      ok: true,
      value: 'Better foil export controls',
    });
  });

  it('rejects empty or oversized roadmap suggestions', () => {
    expect(normalizeRoadmapSuggestion('    ')).toEqual({
      ok: false,
      message: 'Feature suggestion is required.',
    });

    expect(normalizeRoadmapSuggestion('x'.repeat(MAX_ROADMAP_SUGGESTION_LENGTH + 1))).toEqual({
      ok: false,
      message: `Feature suggestion must be ${MAX_ROADMAP_SUGGESTION_LENGTH} characters or fewer.`,
    });
  });

  it('keeps user roadmap suggestions capped to a small active board', () => {
    expect(MAX_ACTIVE_USER_ROADMAP_ITEMS).toBe(50);
  });

  it('archives user-created suggestions after enough negative signal', () => {
    expect(shouldArchiveUserRoadmapItem({ source: 'user', upVotes: 9, downVotes: 12 })).toBe(true);
    expect(shouldArchiveUserRoadmapItem({ source: 'user', upVotes: 10, downVotes: 10 })).toBe(false);
    expect(shouldArchiveUserRoadmapItem({ source: 'user', upVotes: 2, downVotes: 18 })).toBe(true);
    expect(shouldArchiveUserRoadmapItem({ source: 'official', upVotes: 9, downVotes: 12 })).toBe(false);
  });

  it('archives user-created suggestions using owner-configurable vote thresholds', () => {
    const strictRules = {
      ...DEFAULT_ROADMAP_VOTING_RULES,
      negativeSignalMinTotalVotes: 10,
      negativeSignalMinDownvotePercent: 75,
    };

    expect(shouldArchiveUserRoadmapItem({
      source: 'user',
      upVotes: 2,
      downVotes: 8,
      rules: strictRules,
    })).toBe(true);
    expect(shouldArchiveUserRoadmapItem({
      source: 'user',
      upVotes: 3,
      downVotes: 7,
      rules: strictRules,
    })).toBe(false);
  });

  it('calculates public MRR unlock targets as 10x annual upgrade cost', () => {
    expect(calculateMrrUnlockTargetCents(2500)).toBe(25000);
    expect(calculateMrrUnlockTargetCents(10000)).toBe(100000);
  });

  it('sorts feature board items by public voting modes', () => {
    const items = [
      { id: 'older-low', createdAt: '2026-01-01T00:00:00.000Z', upVotes: 1, downVotes: 4 },
      { id: 'newer-high', createdAt: '2026-03-01T00:00:00.000Z', upVotes: 8, downVotes: 1 },
      { id: 'middle-mid', createdAt: '2026-02-01T00:00:00.000Z', upVotes: 5, downVotes: 2 },
    ];

    expect(sortRoadmapFeatures(items, 'most_votes').map((item) => item.id)).toEqual([
      'newer-high',
      'middle-mid',
      'older-low',
    ]);
    expect(sortRoadmapFeatures(items, 'least_votes').map((item) => item.id)).toEqual([
      'older-low',
      'middle-mid',
      'newer-high',
    ]);
    expect(sortRoadmapFeatures(items, 'newest').map((item) => item.id)).toEqual([
      'newer-high',
      'middle-mid',
      'older-low',
    ]);
    expect(sortRoadmapFeatures(items, 'oldest').map((item) => item.id)).toEqual([
      'older-low',
      'middle-mid',
      'newer-high',
    ]);
  });

  it('splits the timeline into past, current, and future around the present month', () => {
    const window = getCurrentTimelineWindow([
      { id: 'past', visibleMonth: '2026-03', status: 'shipped' },
      { id: 'current', visibleMonth: '2026-05', status: 'in_progress' },
      { id: 'future', visibleMonth: '2026-08', status: 'planned' },
    ], '2026-05-22T00:00:00.000Z');

    expect(window.current.map((item) => item.id)).toEqual(['current']);
    expect(window.future.map((item) => item.id)).toEqual(['future']);
    expect(window.past.map((item) => item.id)).toEqual(['past']);
  });

  it('groups timeline items by week when dense and by month across quiet stretches', () => {
    const groups = groupRoadmapTimelineItems([
      { id: 'may-a', visibleMonth: '2026-05', createdAt: '2026-05-01T00:00:00.000Z' },
      { id: 'may-b', visibleMonth: '2026-05', createdAt: '2026-05-04T00:00:00.000Z' },
      { id: 'june', visibleMonth: '2026-06', createdAt: '2026-06-10T00:00:00.000Z' },
      { id: 'september', visibleMonth: '2026-09', createdAt: '2026-09-15T00:00:00.000Z' },
    ]);

    expect(groups.map((group) => ({
      label: group.label,
      ids: group.items.map((item) => item.id),
    }))).toEqual([
      { label: 'Week of May 1', ids: ['may-a', 'may-b'] },
      { label: 'June 2026', ids: ['june'] },
      { label: 'September 2026', ids: ['september'] },
    ]);
  });

  it('keeps feature items off the company Chronicle timeline', () => {
    expect(isChronicleTimelineItem({ source: 'official', itemType: 'roi_checkpoint' })).toBe(true);
    expect(isChronicleTimelineItem({ source: 'official', itemType: 'shipped_update' })).toBe(true);
    expect(isChronicleTimelineItem({ source: 'official', itemType: 'feature' })).toBe(false);
    expect(isChronicleTimelineItem({ source: 'user', itemType: 'feature' })).toBe(false);
  });
});
