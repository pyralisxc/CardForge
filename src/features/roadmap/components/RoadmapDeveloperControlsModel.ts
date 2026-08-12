import type { RoadmapItemType, RoadmapStatus } from '@/features/roadmap/model/roadmap';

export interface RoadmapDeveloperFormState {
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

export const createRoadmapDeveloperFormState = (
  isOwner: boolean,
  now = new Date(),
): RoadmapDeveloperFormState => ({
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

export const isRoadmapDeveloperFormComplete = (
  form: RoadmapDeveloperFormState,
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
