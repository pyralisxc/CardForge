import {
  type RoadmapAdminItem,
  type RoadmapStatus,
} from '@/features/roadmap/model/roadmap';
import { RoadmapStoreError } from '@/features/roadmap/server/RoadmapStoreError';
import { isMissingSupabaseColumnError, isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type RoadmapAdminItemRow = {
  id: string;
  title: string;
  description: string | null;
  item_type: RoadmapAdminItem['itemType'] | null;
  status: RoadmapAdminItem['status'];
  source: RoadmapAdminItem['source'];
  visible_month: string | null;
  monthly_cost_cents: number | null;
  expense_provider?: string | null;
  expense_plan?: string | null;
  expense_source_url?: string | null;
  expense_verified_at?: string | null;
  shipped_at: string | null;
};

const roadmapStatuses: ReadonlySet<RoadmapStatus> = new Set([
  'planned',
  'in_progress',
  'testing',
  'shipped',
  'archived_negative_signal',
]);

export const normalizeRoadmapStatusInput = (value: unknown): RoadmapStatus | null =>
  roadmapStatuses.has(value as RoadmapStatus) ? value as RoadmapStatus : null;

const mapRoadmapAdminItemRow = (row: RoadmapAdminItemRow): RoadmapAdminItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  itemType: row.item_type ?? 'feature',
  status: row.status,
  source: row.source,
  visibleMonth: row.visible_month ?? '',
  monthlyCostCents: row.monthly_cost_cents,
  expenseProvider: row.expense_provider ?? null,
  expensePlan: row.expense_plan ?? null,
  expenseSourceUrl: row.expense_source_url ?? null,
  expenseVerifiedAt: row.expense_verified_at ?? null,
  shippedAt: row.shipped_at,
});

export const getRoadmapAdminItems = async (): Promise<RoadmapAdminItem[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  let { data, error } = await supabase
    .from('cardforge_roadmap_items')
    .select('id,title,description,item_type,status,source,visible_month,monthly_cost_cents,expense_provider,expense_plan,expense_source_url,expense_verified_at,shipped_at')
    .eq('source', 'official')
    .order('visible_month', { ascending: true })
    .order('sort_order', { ascending: true });

  if (isMissingSupabaseColumnError(error, [
    'expense_provider',
    'expense_plan',
    'expense_source_url',
    'expense_verified_at',
  ])) {
    const legacyResult = await supabase
      .from('cardforge_roadmap_items')
      .select('id,title,description,item_type,status,source,visible_month,monthly_cost_cents,shipped_at')
      .eq('source', 'official')
      .order('visible_month', { ascending: true })
      .order('sort_order', { ascending: true });
    data = legacyResult.data?.map((row) => ({
      ...row,
      expense_provider: null,
      expense_plan: null,
      expense_source_url: null,
      expense_verified_at: null,
    })) ?? null;
    error = legacyResult.error;
  }

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load roadmap administration items:', error);
    }
    return [];
  }

  return (data ?? []).map((row) => mapRoadmapAdminItemRow(row as RoadmapAdminItemRow));
};

export const updateRoadmapAdminItemStatus = async ({
  itemId,
  status,
}: {
  itemId?: unknown;
  status?: unknown;
}): Promise<RoadmapAdminItem[]> => {
  if (typeof itemId !== 'string' || itemId.trim().length === 0) {
    throw new RoadmapStoreError('Roadmap item is required.', 400);
  }

  const normalizedStatus = normalizeRoadmapStatusInput(status);
  if (!normalizedStatus) throw new RoadmapStoreError('Choose a supported roadmap status.', 400);

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);

  const { error } = await supabase.from('cardforge_roadmap_items').update({
    status: normalizedStatus,
    shipped_at: normalizedStatus === 'shipped' ? new Date().toISOString() : null,
  }).eq('id', itemId).eq('source', 'official');

  if (error) {
    console.error('Failed to update roadmap status:', error);
    throw new RoadmapStoreError('Unable to update roadmap status.');
  }

  return getRoadmapAdminItems();
};
