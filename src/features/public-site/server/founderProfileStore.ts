import {
  DEFAULT_FOUNDER_PROFILE,
  FOUNDER_PROFILE_ID,
  normalizeFounderProfileInput,
  type FounderProfile,
  type FounderProfileInput,
} from '../model/founderProfile';
import { isMissingSupabaseTableError } from '@/infrastructure/database/supabaseErrors';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';

interface FounderProfileRow {
  hero_eyebrow: string;
  hero_headline: string;
  introduction: string;
  road_heading: string;
  road_body: string;
  current_heading: string;
  current_body: string;
  priorities: unknown;
  support_heading: string;
  support_introduction: string;
  support_use_summary: string;
  facebook_url: string | null;
  instagram_url: string | null;
  discord_url: string | null;
  updated_at: string | null;
}

export class FounderProfileStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const rowToInput = (row: FounderProfileRow): FounderProfileInput => ({
  heroEyebrow: row.hero_eyebrow,
  heroHeadline: row.hero_headline,
  introduction: row.introduction,
  roadHeading: row.road_heading,
  roadBody: row.road_body,
  currentHeading: row.current_heading,
  currentBody: row.current_body,
  priorities: row.priorities as string[],
  supportHeading: row.support_heading,
  supportIntroduction: row.support_introduction,
  supportUseSummary: row.support_use_summary,
  facebookUrl: row.facebook_url,
  instagramUrl: row.instagram_url,
  discordUrl: row.discord_url,
});

const inputToRow = (profile: FounderProfileInput) => ({
  id: FOUNDER_PROFILE_ID,
  hero_eyebrow: profile.heroEyebrow,
  hero_headline: profile.heroHeadline,
  introduction: profile.introduction,
  road_heading: profile.roadHeading,
  road_body: profile.roadBody,
  current_heading: profile.currentHeading,
  current_body: profile.currentBody,
  priorities: profile.priorities,
  support_heading: profile.supportHeading,
  support_introduction: profile.supportIntroduction,
  support_use_summary: profile.supportUseSummary,
  facebook_url: profile.facebookUrl,
  instagram_url: profile.instagramUrl,
  discord_url: profile.discordUrl,
  updated_at: new Date().toISOString(),
});

export const getFounderProfile = async (): Promise<FounderProfile> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) return DEFAULT_FOUNDER_PROFILE;

  const { data, error } = await supabase
    .from('cardforge_founder_profile')
    .select('hero_eyebrow,hero_headline,introduction,road_heading,road_body,current_heading,current_body,priorities,support_heading,support_introduction,support_use_summary,facebook_url,instagram_url,discord_url,updated_at')
    .eq('id', FOUNDER_PROFILE_ID)
    .maybeSingle<FounderProfileRow>();

  if (error || !data) {
    if (error && !isMissingSupabaseTableError(error)) {
      console.error('Failed to load founder profile:', error);
    }
    return DEFAULT_FOUNDER_PROFILE;
  }

  const normalized = normalizeFounderProfileInput(rowToInput(data));
  return normalized.ok
    ? { ...normalized.value, updatedAt: data.updated_at }
    : DEFAULT_FOUNDER_PROFILE;
};

export const updateFounderProfile = async (value: unknown): Promise<FounderProfile> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new FounderProfileStoreError('Founder profile database is not configured yet.', 503);

  const normalized = normalizeFounderProfileInput(value);
  if (!normalized.ok) throw new FounderProfileStoreError(normalized.message, 400);

  const row = inputToRow(normalized.value);
  const { error } = await supabase
    .from('cardforge_founder_profile')
    .upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Failed to update founder profile:', error);
    throw new FounderProfileStoreError('Unable to update the founder profile.');
  }

  return { ...normalized.value, updatedAt: row.updated_at };
};
