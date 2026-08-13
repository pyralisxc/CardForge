import {
  DEFAULT_EXPERIENCE_SETTINGS,
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
  type ExperienceSettings,
} from '@/features/experience-settings/client';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

import { ExperienceSettingsStoreError } from './ExperienceSettingsStoreError';

const EXPERIENCE_SETTING_COLUMNS = [
  'project_file_access',
  'analytics_consent_presentation',
] as const;

export const getExperienceSettings = async (): Promise<ExperienceSettings> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) {
    return DEFAULT_EXPERIENCE_SETTINGS;
  }

  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select(EXPERIENCE_SETTING_COLUMNS.join(','))
    .eq('id', 'cardforge')
    .limit(1);

  if (error) {
    console.error('Failed to load experience settings:', error);
    return DEFAULT_EXPERIENCE_SETTINGS;
  }

  return hydrateExperienceSettings(data?.[0] as unknown as Record<string, unknown> | undefined);
};

export const updateExperienceSettings = async (
  input: Record<string, unknown>,
): Promise<ExperienceSettings> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ExperienceSettingsStoreError('Experience settings database is not configured yet.', 503);

  let normalized: ExperienceSettings;
  try {
    normalized = normalizeExperienceSettingsInput(input);
  } catch (error) {
    throw new ExperienceSettingsStoreError(
      error instanceof Error ? error.message : 'Experience settings are invalid.',
    );
  }

  const { error } = await supabase.from('cardforge_owner_settings').upsert({
    id: 'cardforge',
    project_file_access: normalized.projectFileAccess,
    analytics_consent_presentation: normalized.analyticsConsentPresentation,
  }, { onConflict: 'id' });

  if (error) {
    console.error('Failed to update experience settings:', error);
    throw new ExperienceSettingsStoreError('Unable to update experience settings.', 500);
  }

  return normalized;
};
