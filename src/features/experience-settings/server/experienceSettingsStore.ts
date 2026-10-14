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
  'analytics_consent_presentation',
  'presentation_palette',
  'presentation_accent',
  'presentation_corners',
  'presentation_contrast',
  'studio_default_template_id',
  'updated_at',
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
    throw new ExperienceSettingsStoreError('Experience settings are temporarily unavailable.', 503);
  }
  return hydrateExperienceSettings(data?.[0] as unknown as Record<string, unknown> | undefined);
};

export const updateExperienceSettings = async (
  input: Record<string, unknown>,
): Promise<ExperienceSettings> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new ExperienceSettingsStoreError('Experience settings database is not configured yet.', 503);
  if (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) {
    throw new ExperienceSettingsStoreError('Reload the current experience settings before publishing.', 409);
  }
  const fields = Object.keys(DEFAULT_EXPERIENCE_SETTINGS);
  if (Object.keys(input).some((key) => key !== 'updatedAt' && !fields.includes(key)) || fields.some((key) => !Object.hasOwn(input, key))) {
    throw new ExperienceSettingsStoreError('Provide all current experience settings and only supported fields.', 400);
  }
  let normalized: ExperienceSettings;
  try {
    normalized = normalizeExperienceSettingsInput(input);
  } catch (error) {
    throw new ExperienceSettingsStoreError(error instanceof Error ? error.message : 'Experience settings are invalid.', 400);
  }
  const { data, error } = await supabase.from('cardforge_owner_settings').update({
    analytics_consent_presentation: normalized.analyticsConsentPresentation,
    presentation_palette: normalized.presentationPalette,
    presentation_accent: normalized.presentationAccent,
    presentation_corners: normalized.presentationCorners,
    presentation_contrast: normalized.presentationContrast,
    studio_default_template_id: normalized.studioDefaultTemplateId,
  }).eq('id', 'cardforge').eq('updated_at', input.updatedAt).select(EXPERIENCE_SETTINGS_COLUMNS).limit(1);
  if (error) {
    console.error('Failed to update experience settings:', error);
    throw new ExperienceSettingsStoreError('Unable to update experience settings.');
  }
  if (!data?.[0]) throw new ExperienceSettingsStoreError('Experience settings changed in another session. Reload and review before publishing.', 409);
  return hydrateExperienceSettings(data[0] as unknown as Record<string, unknown>);
};
