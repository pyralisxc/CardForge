import {
  DEFAULT_ROADMAP_SETTINGS,
  normalizeRoadmapSettingsInput,
  type RoadmapSettings,
} from '@/features/roadmap/model/roadmap';
import { RoadmapStoreError } from '@/features/roadmap/server/RoadmapStoreError';
import { isMissingSupabaseColumnError, isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type RoadmapSettingsRow = {
  max_active_user_roadmap_items: number | null;
  max_roadmap_suggestion_length: number | null;
  roadmap_negative_signal_min_total_votes: number | null;
  roadmap_negative_signal_min_downvote_percent: number | null;
  roadmap_estimated_tax_percent: number | null;
  roadmap_operating_reserve_percent: number | null;
};

const mapRoadmapSettingsRow = (
  row: RoadmapSettingsRow | null | undefined,
): RoadmapSettings => row ? {
  maxActiveUserRoadmapItems: row.max_active_user_roadmap_items
    ?? DEFAULT_ROADMAP_SETTINGS.maxActiveUserRoadmapItems,
  maxRoadmapSuggestionLength: row.max_roadmap_suggestion_length
    ?? DEFAULT_ROADMAP_SETTINGS.maxRoadmapSuggestionLength,
  roadmapNegativeSignalMinTotalVotes: row.roadmap_negative_signal_min_total_votes
    ?? DEFAULT_ROADMAP_SETTINGS.roadmapNegativeSignalMinTotalVotes,
  roadmapNegativeSignalMinDownvotePercent: row.roadmap_negative_signal_min_downvote_percent
    ?? DEFAULT_ROADMAP_SETTINGS.roadmapNegativeSignalMinDownvotePercent,
  roadmapEstimatedTaxPercent: row.roadmap_estimated_tax_percent
    ?? DEFAULT_ROADMAP_SETTINGS.roadmapEstimatedTaxPercent,
  roadmapOperatingReservePercent: row.roadmap_operating_reserve_percent
    ?? DEFAULT_ROADMAP_SETTINGS.roadmapOperatingReservePercent,
} : DEFAULT_ROADMAP_SETTINGS;

export const getRoadmapSettings = async (): Promise<RoadmapSettings> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_ROADMAP_SETTINGS;
  }

  let { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select('max_active_user_roadmap_items,max_roadmap_suggestion_length,roadmap_negative_signal_min_total_votes,roadmap_negative_signal_min_downvote_percent,roadmap_estimated_tax_percent,roadmap_operating_reserve_percent')
    .eq('id', 'cardforge')
    .limit(1);

  if (isMissingSupabaseColumnError(error, [
    'roadmap_estimated_tax_percent',
    'roadmap_operating_reserve_percent',
  ])) {
    const legacyResult = await supabase
      .from('cardforge_owner_settings')
      .select('max_active_user_roadmap_items,max_roadmap_suggestion_length,roadmap_negative_signal_min_total_votes,roadmap_negative_signal_min_downvote_percent')
      .eq('id', 'cardforge')
      .limit(1);
    data = legacyResult.data?.map((row) => ({
      ...row,
      roadmap_estimated_tax_percent: null,
      roadmap_operating_reserve_percent: null,
    })) ?? null;
    error = legacyResult.error;
  }

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load roadmap settings:', error);
    }
    return DEFAULT_ROADMAP_SETTINGS;
  }

  return mapRoadmapSettingsRow(data?.[0] as RoadmapSettingsRow | undefined);
};

export const updateRoadmapSettings = async (
  input: Partial<Record<keyof RoadmapSettings, unknown>>,
): Promise<RoadmapSettings> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);

  const normalized = normalizeRoadmapSettingsInput(input);
  const { error } = await supabase.from('cardforge_owner_settings').upsert({
    id: 'cardforge',
    max_active_user_roadmap_items: normalized.maxActiveUserRoadmapItems,
    max_roadmap_suggestion_length: normalized.maxRoadmapSuggestionLength,
    roadmap_negative_signal_min_total_votes: normalized.roadmapNegativeSignalMinTotalVotes,
    roadmap_negative_signal_min_downvote_percent: normalized.roadmapNegativeSignalMinDownvotePercent,
    roadmap_estimated_tax_percent: normalized.roadmapEstimatedTaxPercent,
    roadmap_operating_reserve_percent: normalized.roadmapOperatingReservePercent,
  }, { onConflict: 'id' });

  if (error) {
    if (isMissingSupabaseColumnError(error, [
      'roadmap_estimated_tax_percent',
      'roadmap_operating_reserve_percent',
    ])) {
      throw new RoadmapStoreError('Roadmap financial settings are still deploying. Try again shortly.', 503);
    }
    console.error('Failed to update roadmap settings:', error);
    throw new RoadmapStoreError('Unable to update roadmap settings.');
  }

  return normalized;
};
