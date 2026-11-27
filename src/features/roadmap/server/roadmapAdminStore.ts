import {
  normalizeRoadmapExpenseVerifiedAt,
  normalizeRoadmapSuggestion,
  type RoadmapAdminItem,
  type RoadmapStatus,
} from '@/features/roadmap/model/roadmap';
import { getRoadmapSettings } from './roadmapSettingsStore';
import { RoadmapStoreError } from '@/features/roadmap/server/RoadmapStoreError';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
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
  expense_provider: string | null;
  expense_plan: string | null;
  expense_source_url: string | null;
  expense_verified_at: string | null;
  expense_state: 'current' | 'planned' | null;
  shipped_at: string | null;
  updated_at: string;
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

export const updateRoadmapItemDetails = async (input: {
  itemId?: unknown; expectedUpdatedAt?: unknown; itemType?: unknown; title?: unknown;
  description?: unknown; visibleMonth?: unknown; monthlyCostCents?: unknown;
  expenseProvider?: unknown; expensePlan?: unknown; expenseSourceUrl?: unknown; expenseVerifiedAt?: unknown; expenseState?: unknown;
}): Promise<RoadmapAdminItem> => {
  if (typeof input.itemId !== 'string' || !input.itemId) throw new RoadmapStoreError('Roadmap item is required.', 400);
  if (typeof input.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(input.expectedUpdatedAt))) throw new RoadmapStoreError('Reload the current roadmap item before saving.', 409);
  if (input.itemType !== 'feature' && input.itemType !== 'shipped_update' && input.itemType !== 'roi_checkpoint') throw new RoadmapStoreError('Roadmap item type is required.', 400);
  const normalized = normalizeRoadmapSuggestion(input.title, await getRoadmapSettings());
  if (!normalized.ok) throw new RoadmapStoreError(normalized.message, 400);
  if (typeof input.description !== 'string' || input.description.length > 420) throw new RoadmapStoreError('Description must be 420 characters or fewer.', 400);
  if (typeof input.visibleMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.visibleMonth)) throw new RoadmapStoreError('Choose a valid month.', 400);
  const values: Record<string, unknown> = { title: normalized.value, description: input.description.trim() || null, visible_month: input.visibleMonth };
  if (input.itemType === 'roi_checkpoint') {
    const provider = typeof input.expenseProvider === 'string' ? input.expenseProvider.trim() : '';
    const plan = typeof input.expensePlan === 'string' ? input.expensePlan.trim() : '';
    const verified = normalizeRoadmapExpenseVerifiedAt(input.expenseVerifiedAt);
    let source = '';
    try { const url = new URL(String(input.expenseSourceUrl)); if (url.protocol === 'https:') source = url.toString(); } catch { /* invalid source */ }
    if (!Number.isSafeInteger(input.monthlyCostCents) || (input.monthlyCostCents as number) <= 0 || !provider || provider.length > 80 || !plan || plan.length > 80 || !source || !verified || (input.expenseState !== null && input.expenseState !== 'current' && input.expenseState !== 'planned')) throw new RoadmapStoreError('Expense checkpoints require a positive monthly cost, provider, plan, official HTTPS source, verification date, and valid status.', 400);
    Object.assign(values, { monthly_cost_cents: input.monthlyCostCents, expense_provider: provider, expense_plan: plan, expense_source_url: source, expense_verified_at: verified, expense_state: input.expenseState });
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);
  const { data, error } = await supabase.from('cardforge_roadmap_items').update(values)
    .eq('id', input.itemId).eq('item_type', input.itemType).eq('updated_at', input.expectedUpdatedAt).is('release_version', null)
    .select('id,title,description,item_type,status,source,visible_month,monthly_cost_cents,expense_provider,expense_plan,expense_source_url,expense_verified_at,expense_state,shipped_at,updated_at').maybeSingle();
  if (error) {
    if (error.code === '23505') throw new RoadmapStoreError('Another Roadmap item already uses that title.', 409);
    console.error('Failed to update roadmap details:', error);
    throw new RoadmapStoreError('Unable to update roadmap details.', 500);
  }
  if (!data) throw new RoadmapStoreError('This item changed, is unavailable, or is managed as a website release. Reload before editing.', 409);
  return mapRoadmapAdminItemRow(data as unknown as RoadmapAdminItemRow);
};

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
  expenseState: row.expense_state ?? null,
  shippedAt: row.shipped_at,
  updatedAt: row.updated_at,
});

export const getRoadmapAdminItems = async (): Promise<RoadmapAdminItem[]> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return [];

  const { data, error } = await supabase
    .from('cardforge_roadmap_items')
    .select('id,title,description,item_type,status,source,visible_month,monthly_cost_cents,expense_provider,expense_plan,expense_source_url,expense_verified_at,expense_state,shipped_at,updated_at')
    .eq('source', 'official')
    .order('visible_month', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load roadmap administration items:', error);
    }
    throw new RoadmapStoreError('Roadmap administration is temporarily unavailable.', 503);
  }

  return (data ?? []).map((row) => mapRoadmapAdminItemRow(row as RoadmapAdminItemRow));
};

export const updateRoadmapAdminItemStatus = async ({
  itemId,
  status,
  expectedUpdatedAt,
}: {
  itemId?: unknown;
  status?: unknown;
  expectedUpdatedAt?: unknown;
}): Promise<RoadmapAdminItem> => {
  if (typeof itemId !== 'string' || itemId.trim().length === 0) {
    throw new RoadmapStoreError('Roadmap item is required.', 400);
  }

  const normalizedStatus = normalizeRoadmapStatusInput(status);
  if (!normalizedStatus) throw new RoadmapStoreError('Choose a supported roadmap status.', 400);

  if (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new RoadmapStoreError('Reload the current roadmap item before publishing.', 409);
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);

  const { data, error } = await supabase.from('cardforge_roadmap_items').update({
    status: normalizedStatus,
    shipped_at: normalizedStatus === 'shipped' ? new Date().toISOString() : null,
  }).eq('id', itemId).eq('source', 'official').eq('updated_at', expectedUpdatedAt).select('id,title,description,item_type,status,source,visible_month,monthly_cost_cents,expense_provider,expense_plan,expense_source_url,expense_verified_at,expense_state,shipped_at,updated_at').maybeSingle();

  if (error) {
    if (error.message?.includes('website_release_published_immutable')) throw new RoadmapStoreError('Published website release facts are immutable. Use the update notes editor for narrative corrections.',409);
    console.error('Failed to update roadmap status:', error);
    throw new RoadmapStoreError('Unable to update roadmap status.');
  }

  if (!data) throw new RoadmapStoreError('Roadmap item changed or is no longer available. Reload and review before publishing.', 409);
  return mapRoadmapAdminItemRow(data as unknown as RoadmapAdminItemRow);
};
