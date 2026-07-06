import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';
import { DEFAULT_OWNER_SETTINGS, DEFAULT_SITE_MECHANICS_SETTINGS, type SiteMechanicsSettings } from '@/lib/ownerConsole';
import { getOwnerConsolePayload } from '@/lib/ownerConsoleStore';
import {
  calculateMrrUnlockTargetCents,
  normalizeRoadmapSuggestion,
  type RoadmapItem,
  type RoadmapItemType,
  type RoadmapPayload,
  type RoadmapSource,
  type RoadmapStatus,
  type RoadmapVoteValue,
  shouldArchiveUserRoadmapItem,
} from '@/lib/roadmap';

export const DEVELOPER_REQUEST_EMAIL = DEFAULT_OWNER_SETTINGS.supportEmail;

type RoadmapItemRow = {
  id: string;
  title: string;
  description: string | null;
  item_type: RoadmapItemType | null;
  status: RoadmapStatus;
  source: RoadmapSource;
  visible_month: string | null;
  target_mrr_cents: number | null;
  monthly_cost_cents: number | null;
  shipped_at: string | null;
  created_at: string;
  sort_order: number;
};

type RoadmapVoteRow = {
  item_id: string;
  user_id: string;
  vote: RoadmapVoteValue;
};

export class RoadmapStoreError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

const validStatuses: ReadonlySet<RoadmapStatus> = new Set([
  'planned',
  'in_progress',
  'testing',
  'shipped',
  'archived_negative_signal',
]);

const validItemTypes: ReadonlySet<RoadmapItemType> = new Set([
  'roi_checkpoint',
  'feature',
  'shipped_update',
]);

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeVisibleMonth = (value: unknown): string => {
  if (typeof value === 'string' && /^\d{4}-\d{2}$/.test(value)) return value;
  const date = new Date();
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const normalizeCents = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
};

const toRoadmapVotingRules = (settings: SiteMechanicsSettings) => ({
  negativeSignalMinTotalVotes: settings.roadmapNegativeSignalMinTotalVotes,
  negativeSignalMinDownvotePercent: settings.roadmapNegativeSignalMinDownvotePercent,
});

const getSiteMechanicsSettings = async (): Promise<SiteMechanicsSettings> => {
  try {
    return (await getOwnerConsolePayload()).siteMechanics;
  } catch (error) {
    console.error('Failed to load owner site mechanics:', error);
    return DEFAULT_SITE_MECHANICS_SETTINGS;
  }
};

const createUnavailablePayload = (settings: SiteMechanicsSettings = DEFAULT_SITE_MECHANICS_SETTINGS): RoadmapPayload => ({
  configured: false,
  items: [],
  activeUserSuggestionCount: 0,
  maxActiveUserSuggestions: settings.maxActiveUserRoadmapItems,
  maxSuggestionLength: settings.maxRoadmapSuggestionLength,
  currentProfitCents: 0,
  developerRequestEmail: DEVELOPER_REQUEST_EMAIL,
});

const mapRoadmapPayload = ({
  configured,
  rows,
  votes,
  activeUserSuggestionCount,
  userId,
  settings,
}: {
  configured: boolean;
  rows: RoadmapItemRow[];
  votes: RoadmapVoteRow[];
  activeUserSuggestionCount: number;
  userId: string | null;
  settings: SiteMechanicsSettings;
}): RoadmapPayload => {
  const votesByItem = votes.reduce<Record<string, { upVotes: number; downVotes: number; userVote: RoadmapVoteValue | null }>>(
    (accumulator, vote) => {
      const summary = accumulator[vote.item_id] ?? { upVotes: 0, downVotes: 0, userVote: null };
      if (vote.vote === 'up') {
        summary.upVotes += 1;
      } else {
        summary.downVotes += 1;
      }
      if (userId && vote.user_id === userId) {
        summary.userVote = vote.vote;
      }
      accumulator[vote.item_id] = summary;
      return accumulator;
    },
    {}
  );

  return {
    configured,
    items: rows.map((row): RoadmapItem => {
      const voteSummary = votesByItem[row.id] ?? { upVotes: 0, downVotes: 0, userVote: null };
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        itemType: row.item_type ?? (row.status === 'shipped' ? 'shipped_update' : 'feature'),
        status: row.status,
        source: row.source,
        visibleMonth: row.visible_month ?? row.created_at.slice(0, 7),
        targetMrrCents: row.target_mrr_cents,
        monthlyCostCents: row.monthly_cost_cents,
        shippedAt: row.shipped_at,
        createdAt: row.created_at,
        upVotes: voteSummary.upVotes,
        downVotes: voteSummary.downVotes,
        userVote: voteSummary.userVote,
      };
    }),
    activeUserSuggestionCount,
    maxActiveUserSuggestions: settings.maxActiveUserRoadmapItems,
    maxSuggestionLength: settings.maxRoadmapSuggestionLength,
    currentProfitCents: 0,
    developerRequestEmail: DEVELOPER_REQUEST_EMAIL,
  };
};

export const getRoadmapForUser = async (userId: string | null): Promise<RoadmapPayload> => {
  const config = getSupabaseServerConfigStatus();
  const supabase = getSupabaseServerClient();
  const settings = await getSiteMechanicsSettings();
  if (!config.configured || !supabase) return createUnavailablePayload(settings);

  const { data: rows, error: rowsError } = await supabase
    .from('cardforge_roadmap_items')
    .select('id,title,description,item_type,status,source,visible_month,target_mrr_cents,monthly_cost_cents,shipped_at,created_at,sort_order')
    .neq('status', 'archived_negative_signal')
    .order('visible_month', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (rowsError) {
    console.error('Failed to load roadmap items:', rowsError);
    return createUnavailablePayload(settings);
  }

  const itemRows = (rows ?? []) as RoadmapItemRow[];
  const itemIds = itemRows.map((item) => item.id);

  const { count: activeUserSuggestionCount, error: countError } = await supabase
    .from('cardforge_roadmap_items')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'user')
    .neq('status', 'archived_negative_signal');

  if (countError) {
    console.error('Failed to count roadmap suggestions:', countError);
    return createUnavailablePayload(settings);
  }

  if (itemIds.length === 0) {
    return mapRoadmapPayload({
      configured: true,
      rows: itemRows,
      votes: [],
      activeUserSuggestionCount: activeUserSuggestionCount ?? 0,
      userId,
      settings,
    });
  }

  const { data: votes, error: votesError } = await supabase
    .from('cardforge_roadmap_votes')
    .select('item_id,user_id,vote')
    .in('item_id', itemIds);

  if (votesError) {
    console.error('Failed to load roadmap votes:', votesError);
    return createUnavailablePayload(settings);
  }

  return mapRoadmapPayload({
    configured: true,
    rows: itemRows,
    votes: (votes ?? []) as RoadmapVoteRow[],
    activeUserSuggestionCount: activeUserSuggestionCount ?? 0,
    userId,
    settings,
  });
};

export const createRoadmapSuggestion = async ({
  userId,
  userEmail,
  title,
}: {
  userId: string;
  userEmail: string | null;
  title: unknown;
}): Promise<RoadmapPayload> => {
  const settings = await getSiteMechanicsSettings();
  const normalized = normalizeRoadmapSuggestion(title, settings);
  if (!normalized.ok) {
    throw new RoadmapStoreError(normalized.message, 400);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);
  }

  const { count, error: countError } = await supabase
    .from('cardforge_roadmap_items')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'user')
    .neq('status', 'archived_negative_signal');

  if (countError) {
    console.error('Failed to count active roadmap suggestions:', countError);
    throw new RoadmapStoreError('Roadmap database is not ready yet.', 503);
  }

  if ((count ?? 0) >= settings.maxActiveUserRoadmapItems) {
    throw new RoadmapStoreError('The public feature board is full. Please send detailed feedback by email.', 409);
  }

  const { error: insertError } = await supabase
    .from('cardforge_roadmap_items')
    .insert({
      title: normalized.value,
      description: null,
      item_type: 'feature',
      source: 'user',
      status: 'planned',
      visible_month: normalizeVisibleMonth(null),
      created_by_user_id: userId,
      created_by_email: userEmail,
      sort_order: 500,
    });

  if (insertError) {
    console.error('Failed to create roadmap suggestion:', insertError);
    throw new RoadmapStoreError('Unable to create feature suggestion.', 500);
  }

  return getRoadmapForUser(userId);
};

export const createDeveloperRoadmapItem = async ({
  userId,
  userEmail,
  title,
  description,
  itemType,
  status,
  visibleMonth,
  targetMrrCents,
  monthlyCostCents,
}: {
  userId: string;
  userEmail: string | null;
  title: unknown;
  description?: unknown;
  itemType?: unknown;
  status?: unknown;
  visibleMonth?: unknown;
  targetMrrCents?: unknown;
  monthlyCostCents?: unknown;
}): Promise<RoadmapPayload> => {
  const settings = await getSiteMechanicsSettings();
  const normalizedTitle = normalizeRoadmapSuggestion(title, settings);
  if (!normalizedTitle.ok) {
    throw new RoadmapStoreError(normalizedTitle.message, 400);
  }

  const normalizedItemType = validItemTypes.has(itemType as RoadmapItemType)
    ? itemType as RoadmapItemType
    : 'feature';
  const normalizedStatus = validStatuses.has(status as RoadmapStatus)
    ? status as RoadmapStatus
    : 'planned';
  const normalizedMonthlyCostCents = normalizeCents(monthlyCostCents);
  const normalizedTargetMrrCents = normalizeCents(targetMrrCents)
    ?? (normalizedMonthlyCostCents !== null ? calculateMrrUnlockTargetCents(normalizedMonthlyCostCents) : null);

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);
  }

  const { error: insertError } = await supabase
    .from('cardforge_roadmap_items')
    .insert({
      title: normalizedTitle.value,
      description: normalizeOptionalText(description, 420),
      item_type: normalizedItemType,
      source: 'official',
      status: normalizedStatus,
      visible_month: normalizeVisibleMonth(visibleMonth),
      target_mrr_cents: normalizedTargetMrrCents,
      monthly_cost_cents: normalizedMonthlyCostCents,
      shipped_at: normalizedStatus === 'shipped' ? new Date().toISOString() : null,
      created_by_user_id: userId,
      created_by_email: userEmail,
      sort_order: normalizedItemType === 'roi_checkpoint' ? 100 : 300,
    });

  if (insertError) {
    console.error('Failed to create developer roadmap item:', insertError);
    throw new RoadmapStoreError('Unable to create roadmap item.', 500);
  }

  return getRoadmapForUser(userId);
};

export const deleteDeveloperRoadmapItem = async ({
  userId,
  itemId,
}: {
  userId: string;
  itemId: unknown;
}): Promise<RoadmapPayload> => {
  if (typeof itemId !== 'string' || !itemId) {
    throw new RoadmapStoreError('Roadmap item is required.', 400);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);
  }

  const { error } = await supabase
    .from('cardforge_roadmap_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Failed to delete developer roadmap item:', error);
    throw new RoadmapStoreError('Unable to delete roadmap item.', 500);
  }

  return getRoadmapForUser(userId);
};

export const voteRoadmapItem = async ({
  userId,
  itemId,
  vote,
}: {
  userId: string;
  itemId: unknown;
  vote: unknown;
}): Promise<RoadmapPayload> => {
  if (typeof itemId !== 'string' || !itemId) {
    throw new RoadmapStoreError('Roadmap item is required.', 400);
  }
  if (vote !== 'up' && vote !== 'down') {
    throw new RoadmapStoreError('Vote must be thumbs up or not for me.', 400);
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);
  }

  const { data: item, error: itemError } = await supabase
    .from('cardforge_roadmap_items')
    .select('id,source,status')
    .eq('id', itemId)
    .maybeSingle();

  if (itemError) {
    console.error('Failed to load roadmap item for voting:', itemError);
    throw new RoadmapStoreError('Roadmap database is not ready yet.', 503);
  }
  if (!item || item.status === 'archived_negative_signal') {
    throw new RoadmapStoreError('Roadmap item is no longer available for voting.', 404);
  }

  const { error: voteError } = await supabase
    .from('cardforge_roadmap_votes')
    .upsert({
      item_id: itemId,
      user_id: userId,
      vote,
    }, {
      onConflict: 'item_id,user_id',
    });

  if (voteError) {
    console.error('Failed to save roadmap vote:', voteError);
    throw new RoadmapStoreError('Unable to save vote.', 500);
  }

  const { data: votes, error: votesError } = await supabase
    .from('cardforge_roadmap_votes')
    .select('vote')
    .eq('item_id', itemId);

  if (votesError) {
    console.error('Failed to recalculate roadmap votes:', votesError);
    throw new RoadmapStoreError('Unable to recalculate vote totals.', 500);
  }

  const totals = (votes ?? []).reduce(
    (accumulator, row) => ({
      upVotes: accumulator.upVotes + (row.vote === 'up' ? 1 : 0),
      downVotes: accumulator.downVotes + (row.vote === 'down' ? 1 : 0),
    }),
    { upVotes: 0, downVotes: 0 }
  );

  if (shouldArchiveUserRoadmapItem({
    source: item.source as RoadmapSource,
    upVotes: totals.upVotes,
    downVotes: totals.downVotes,
    rules: toRoadmapVotingRules(await getSiteMechanicsSettings()),
  })) {
    const { error: archiveError } = await supabase
      .from('cardforge_roadmap_items')
      .update({
        status: 'archived_negative_signal',
        archived_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (archiveError) {
      console.error('Failed to archive roadmap item:', archiveError);
      throw new RoadmapStoreError('Unable to update feature board status.', 500);
    }
  }

  return getRoadmapForUser(userId);
};
