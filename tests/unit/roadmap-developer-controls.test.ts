import { describe, expect, it } from 'vitest';

import {
  createRoadmapDeveloperFormState,
  isRoadmapDeveloperFormComplete,
} from '@/features/roadmap/components/RoadmapDeveloperControlsModel';

describe('roadmap developer controls', () => {
  it('gives owners checkpoint controls and developers shipped-update controls', () => {
    expect(createRoadmapDeveloperFormState(true, new Date('2026-08-11T12:00:00.000Z')))
      .toMatchObject({ itemType: 'roi_checkpoint', visibleMonth: '2026-08' });
    expect(createRoadmapDeveloperFormState(false, new Date('2026-08-11T12:00:00.000Z')))
      .toMatchObject({ itemType: 'shipped_update', visibleMonth: '2026-08' });
  });

  it('requires verified pricing fields only for expense checkpoints', () => {
    const shipped = {
      ...createRoadmapDeveloperFormState(false),
      title: 'Released better exports',
    };
    expect(isRoadmapDeveloperFormComplete(shipped)).toBe(true);

    const checkpoint = {
      ...createRoadmapDeveloperFormState(true),
      title: 'Supabase Pro',
      monthlyCostDollars: '25',
      expenseProvider: 'Supabase',
      expensePlan: 'Pro',
      expenseSourceUrl: 'https://supabase.com/pricing',
      expenseVerifiedAt: '2026-08-11',
    };
    expect(isRoadmapDeveloperFormComplete({ ...checkpoint, expensePlan: '' })).toBe(false);
    expect(isRoadmapDeveloperFormComplete(checkpoint)).toBe(true);
  });
});
