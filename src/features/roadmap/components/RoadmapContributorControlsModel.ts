import type { RoadmapItemType, RoadmapStatus } from '@/features/roadmap/model/roadmap';

export interface RoadmapContributorFormState {
  title: string;
  description: string;
  itemType: Exclude<RoadmapItemType, 'feature'>;
  status: RoadmapStatus;
  visibleMonth: string;
  monthlyCostDollars: string;
  expenseProvider: string;
  expensePlan: string;
  expenseSourceUrl: string;
  expenseVerifiedAt: string;
}

export const createRoadmapContributorFormState = (
  isOwner: boolean,
  now = new Date(),
): RoadmapContributorFormState => ({
  title: '',
  description: '',
  itemType: isOwner ? 'roi_checkpoint' : 'shipped_update',
  status: 'planned',
  visibleMonth: now.toISOString().slice(0, 7),
  monthlyCostDollars: '',
  expenseProvider: '',
  expensePlan: '',
  expenseSourceUrl: '',
  expenseVerifiedAt: now.toISOString().slice(0, 10),
});

export const isRoadmapContributorFormComplete = (
  form: RoadmapContributorFormState,
): boolean => form.title.trim().length > 0 && (
  form.itemType !== 'roi_checkpoint'
  || (
    form.monthlyCostDollars.trim().length > 0
    && form.expenseProvider.trim().length > 0
    && form.expensePlan.trim().length > 0
    && form.expenseSourceUrl.trim().length > 0
    && form.expenseVerifiedAt.length > 0
  )
);
