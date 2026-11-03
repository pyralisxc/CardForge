import { getSupabaseServerClient } from './supabaseServer';

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
  outcome?: 'succeeded' | 'partial' | 'failed';
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
