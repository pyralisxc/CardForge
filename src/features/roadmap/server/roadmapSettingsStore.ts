import {
  DEFAULT_ROADMAP_SETTINGS,
  normalizeRoadmapSettingsInput,
  type RoadmapSettings,
} from '@/features/roadmap/model/roadmap';
import { RoadmapStoreError } from '@/features/roadmap/server/RoadmapStoreError';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

type RoadmapSettingsRow = {
  updated_at?: string;
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
  ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
} : DEFAULT_ROADMAP_SETTINGS;

export const getRoadmapSettings = async (): Promise<RoadmapSettings> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_ROADMAP_SETTINGS;
  }

  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select('max_active_user_roadmap_items,max_roadmap_suggestion_length,roadmap_negative_signal_min_total_votes,roadmap_negative_signal_min_downvote_percent,roadmap_estimated_tax_percent,roadmap_operating_reserve_percent,updated_at')
    .eq('id', 'cardforge')
    .limit(1);

  if (error) {
    if (!isMissingSupabaseTableError(error)) {
      console.error('Failed to load roadmap settings:', error);
    }
    throw new RoadmapStoreError('Roadmap settings are temporarily unavailable.', 503);
  }

  return mapRoadmapSettingsRow(data?.[0] as RoadmapSettingsRow | undefined);
};

export const updateRoadmapSettings = async (
  input: Partial<Record<keyof RoadmapSettings, unknown>>,
): Promise<RoadmapSettings> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new RoadmapStoreError('Roadmap database is not configured yet.', 503);

  if (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) throw new RoadmapStoreError('Reload current roadmap settings before publishing.', 409);
  const fields = Object.keys(DEFAULT_ROADMAP_SETTINGS);
  if (Object.keys(input).some((key) => key !== 'updatedAt' && !fields.includes(key))
    || fields.some((key) => typeof input[key as keyof RoadmapSettings] !== 'number' || !Number.isFinite(input[key as keyof RoadmapSettings]))) {
    throw new RoadmapStoreError('Provide all current roadmap settings and only supported fields.', 400);
  }
  const normalized = normalizeRoadmapSettingsInput(input);
  if (fields.some((key) => normalized[key as keyof RoadmapSettings] !== input[key as keyof RoadmapSettings])) {
    throw new RoadmapStoreError('Roadmap settings must use whole numbers within the supported ranges.', 400);
  }
  const { data, error } = await supabase.from('cardforge_owner_settings').update({
    max_active_user_roadmap_items: normalized.maxActiveUserRoadmapItems,
    max_roadmap_suggestion_length: normalized.maxRoadmapSuggestionLength,
    roadmap_negative_signal_min_total_votes: normalized.roadmapNegativeSignalMinTotalVotes,
    roadmap_negative_signal_min_downvote_percent: normalized.roadmapNegativeSignalMinDownvotePercent,
    roadmap_estimated_tax_percent: normalized.roadmapEstimatedTaxPercent,
    roadmap_operating_reserve_percent: normalized.roadmapOperatingReservePercent,
  }).eq('id', 'cardforge').eq('updated_at', input.updatedAt).select('max_active_user_roadmap_items,max_roadmap_suggestion_length,roadmap_negative_signal_min_total_votes,roadmap_negative_signal_min_downvote_percent,roadmap_estimated_tax_percent,roadmap_operating_reserve_percent,updated_at').limit(1);

  if (error) {
    console.error('Failed to update roadmap settings:', error);
    throw new RoadmapStoreError('Unable to update roadmap settings.');
  }

  if (!data?.[0]) throw new RoadmapStoreError('Roadmap settings changed in another session. Reload and review before publishing.', 409);
  return mapRoadmapSettingsRow(data[0] as unknown as RoadmapSettingsRow);
};
