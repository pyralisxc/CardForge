import { describe, expect, it } from 'vitest';

import {
  createRoadmapContributorFormState,
  isRoadmapContributorFormComplete,
} from '@/features/roadmap/components/RoadmapContributorControlsModel';

describe('roadmap contributor controls', () => {
  it('gives owners checkpoint controls and contributors shipped-update controls', () => {
    expect(createRoadmapContributorFormState(true, new Date('2026-08-11T12:00:00.000Z')))
      .toMatchObject({ itemType: 'roi_checkpoint', visibleMonth: '2026-08' });
    expect(createRoadmapContributorFormState(false, new Date('2026-08-11T12:00:00.000Z')))
      .toMatchObject({ itemType: 'shipped_update', visibleMonth: '2026-08' });
  });

  it('requires verified pricing fields only for expense checkpoints', () => {
    const shipped = {
      ...createRoadmapContributorFormState(false),
      title: 'Released better exports',
    };
    expect(isRoadmapContributorFormComplete(shipped)).toBe(true);

    const checkpoint = {
      ...createRoadmapContributorFormState(true),
      title: 'Supabase Pro',
      monthlyCostDollars: '25',
      expenseProvider: 'Supabase',
      expensePlan: 'Pro',
      expenseSourceUrl: 'https://supabase.com/pricing',
      expenseVerifiedAt: '2026-08-11',
    };
    expect(isRoadmapContributorFormComplete({ ...checkpoint, expensePlan: '' })).toBe(false);
    expect(isRoadmapContributorFormComplete(checkpoint)).toBe(true);
  });
});
