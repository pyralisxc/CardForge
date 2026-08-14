import type {
  OwnerActivityEvent,
  OwnerActivityOutcome,
} from '@/features/owner/lib/ownerActivity';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

type OwnerActivityRow = {
  id: string;
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  summary: string;
  outcome: OwnerActivityOutcome;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const mapRow = (row: OwnerActivityRow): OwnerActivityEvent => ({
  id: row.id,
  actorUserId: row.actor_user_id,
  actorEmail: row.actor_email,
  action: row.action,
  targetType: row.target_type,
  targetId: row.target_id,
  summary: row.summary,
  outcome: row.outcome,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
});

const normalizeText = (value: string | null | undefined, maxLength: number): string => (
  typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ').slice(0, maxLength) : ''
);

export const recordOwnerActivity = async ({
  actorUserId,
  actorEmail,
  action,
  targetType,
  targetId,
  summary,
  outcome = 'succeeded',
  metadata = {},
}: {
  actorUserId: string;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  outcome?: OwnerActivityOutcome;
  metadata?: Record<string, unknown>;
}): Promise<boolean> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase.from('cardforge_owner_activity').insert({
    actor_user_id: normalizeText(actorUserId, 160),
    actor_email: normalizeText(actorEmail, 320) || null,
    action: normalizeText(action, 120),
    target_type: normalizeText(targetType, 80),
    target_id: normalizeText(targetId, 200) || null,
    summary: normalizeText(summary, 500),
    outcome,
    metadata,
  });
  if (error) {
    console.error('Failed to record owner activity:', error);
    return false;
  }
  return true;
};

export const getOwnerActivity = async ({
  page = 1,
  pageSize = 20,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<{ items: OwnerActivityEvent[]; total: number; page: number; pageSize: number }> => {
  const supabase = getSupabaseServerClient();
  const safePage = Math.max(1, Math.trunc(page));
  const safePageSize = Math.min(50, Math.max(5, Math.trunc(pageSize)));
  if (!supabase) throw new Error('Owner activity storage is not configured.');
  const from = (safePage - 1) * safePageSize;
  const { data, error, count } = await supabase
    .from('cardforge_owner_activity')
    .select('id,actor_user_id,actor_email,action,target_type,target_id,summary,outcome,metadata,created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + safePageSize - 1);
  if (error) {
    console.error('Failed to load owner activity:', error);
    throw new Error('Unable to load owner activity.');
  }
  return {
    items: (data ?? []).map((row) => mapRow(row as OwnerActivityRow)),
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
};
