import {
  DEFAULT_EXPERIENCE_SETTINGS,
  hydrateExperienceSettings,
  normalizeExperienceSettingsInput,
  type ExperienceSettings,
} from '@/features/experience-settings/model/experienceSettings';
import {
  getSupabaseServerClient,
  getSupabaseServerConfigStatus,
} from '@/infrastructure/database/supabaseServer';

export class ExperienceSettingsStoreError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

const EXPERIENCE_SETTINGS_COLUMNS = [
  'project_file_access',
  'analytics_consent_presentation',
  'presentation_palette',
  'presentation_accent',
  'presentation_corners',
  'presentation_contrast',
  'studio_default_template_id',
].join(',');

export const getExperienceSettings = async (): Promise<ExperienceSettings> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return DEFAULT_EXPERIENCE_SETTINGS;
  const { data, error } = await supabase
    .from('cardforge_owner_settings')
    .select(EXPERIENCE_SETTINGS_COLUMNS)
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
    throw new ExperienceSettingsStoreError(error instanceof Error ? error.message : 'Experience settings are invalid.', 400);
  }
  const { error } = await supabase.from('cardforge_owner_settings').upsert({
    id: 'cardforge',
    project_file_access: normalized.projectFileAccess,
    analytics_consent_presentation: normalized.analyticsConsentPresentation,
    presentation_palette: normalized.presentationPalette,
    presentation_accent: normalized.presentationAccent,
    presentation_corners: normalized.presentationCorners,
    presentation_contrast: normalized.presentationContrast,
    studio_default_template_id: normalized.studioDefaultTemplateId,
  }, { onConflict: 'id' });
  if (error) {
    console.error('Failed to update experience settings:', error);
    throw new ExperienceSettingsStoreError('Unable to update experience settings.');
  }
  return normalized;
};
