import type { AppearanceStyleLibrary, AppearanceStylePreset } from '@/types';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
} from '@/lib/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { canCurrentAccountWriteShippedLibrary } from '@/lib/serverProjectAccess';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
} from '@/lib/registryContentAssets';

const PIPELINE_OWNER_EMAIL = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL || 'cameron.r.locke96@gmail.com';

const isStylePreset = (value: unknown): value is AppearanceStylePreset => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppearanceStylePreset>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.kind === 'string'
    && Array.isArray(candidate.targets)
    && !!candidate.appearance;
};

const syncStylePresetToRegistry = async (style: AppearanceStylePreset) => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error('The Forge Pipeline database is not configured.');

  const { data: ownerProfiles } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email')
    .eq('email', PIPELINE_OWNER_EMAIL)
    .limit(1);
  const ownerProfile = ownerProfiles?.[0] as { clerk_user_id?: string; email?: string | null } | undefined;
  const ownerDeveloperId = ownerProfile?.clerk_user_id || PIPELINE_OWNER_EMAIL;
  const ownerEmail = ownerProfile?.email || PIPELINE_OWNER_EMAIL;
  const stylePayload: AppearanceStylePreset = {
    ...style,
    librarySource: 'developer',
    accessTier: 'free',
    registryStatus: 'published',
    contributorName: ownerEmail,
  };

  const { data: existingSubmissions } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id')
    .eq('registry_asset_id', style.id)
    .limit(1);
  const submissionPatch = {
    developer_id: ownerDeveloperId,
    developer_email: ownerEmail,
    asset_type: 'elementPresets',
    name: style.name,
    description: `${style.name} starter style maintained through the Forge Pipeline.`,
    preview_url: `/api/styles#${style.id}`,
    source_url: `/api/styles#${style.id}`,
    source_file_size_bytes: Buffer.byteLength(JSON.stringify(style)),
    source_mime_type: 'application/json',
    registry_asset_id: style.id,
    status: 'published',
    calculated_access_tier: 'free',
    owner_access_tier_override: null,
  };

  let submissionId = existingSubmissions?.[0]?.id as string | undefined;
  if (submissionId) {
    const { error } = await supabase
      .from('cardforge_developer_asset_submissions')
      .update(submissionPatch)
      .eq('id', submissionId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('cardforge_developer_asset_submissions')
      .insert(submissionPatch)
      .select('id')
      .single();
    if (error) throw error;
    submissionId = data.id;
  }

  const { error } = await supabase
    .from('cardforge_asset_registry')
    .upsert({
      asset_id: style.id,
      name: style.name,
      asset_type: 'elementPreset',
      url: `/api/styles#${style.id}`,
      preview_url: `/api/styles#${style.id}`,
      status: 'published',
      access_tier: 'free',
      library_source: 'developer',
      developer_submission_id: submissionId,
      file_size_bytes: Buffer.byteLength(JSON.stringify(style)),
      metadata: {
        sourceKind: 'pipeline-owner-edit',
        style: stylePayload,
      },
    }, { onConflict: 'asset_id' });
  if (error) throw error;
};

const readLibrary = async (): Promise<AppearanceStyleLibrary> => {
  const registryStyles = await readStylesFromRegistry();

  return {
    version: 1,
    styles: registryStyles.sort((a, b) => a.name.localeCompare(b.name)),
  };
};

const readStylesFromRegistry = async (): Promise<AppearanceStylePreset[]> => {
  const rows = await getPublishedRegistryContentRows('elementPreset');
  if (rows.length === 0) return [];

  const styles: Array<AppearanceStylePreset | null> = await Promise.all(rows.map(async (row) => {
    const style = await readRegistryContentAsset<AppearanceStylePreset>(
      row,
      ['style', 'elementPreset', 'payload'],
      isStylePreset,
    );

    if (!style) return null;
    return {
      ...style,
      id: style.id || row.asset_id,
      name: style.name || row.name,
      librarySource: row.library_source === 'developer' ? 'developer' as const : 'official' as const,
      accessTier: row.access_tier,
      registryStatus: row.status,
      contributorName: style.contributorName || PIPELINE_OWNER_EMAIL,
    };
  }));

  return styles.filter((style): style is AppearanceStylePreset => Boolean(style));
};

export async function GET() {
  try {
    return createNoStoreJsonResponse(await readLibrary());
  } catch (error) {
    console.error('Failed to load style library:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to load style library.'
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!await canCurrentAccountWriteShippedLibrary()) {
      return createApiErrorResponse(
        403,
        'library_writes_disabled',
        'Style library writes are disabled.'
      );
    }

    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const body = parsedBody.data;
    const current = await readLibrary();
    const bodyRecord = typeof body === 'object' && body !== null
      ? body as Record<string, unknown>
      : null;
    const incomingStyles: unknown[] = bodyRecord && Array.isArray(bodyRecord.styles)
      ? bodyRecord.styles
      : [body];
    const invalidStyleDetails: string[] = [];
    const validStyles: AppearanceStylePreset[] = [];

    incomingStyles.forEach((entry, index) => {
      const parsed = stylePresetPayloadSchema.safeParse(entry);
      if (!parsed.success) {
        invalidStyleDetails.push(...formatZodIssues(parsed.error.issues).map((message) => `styles[${index}].${message}`));
        return;
      }
      if (isStylePreset(parsed.data)) {
        validStyles.push(parsed.data);
      }
    });

    if (validStyles.length === 0) {
      return createApiErrorResponse(
        400,
        'invalid_style_payload',
        'A valid style preset is required.',
        invalidStyleDetails.length > 0 ? invalidStyleDetails : undefined
      );
    }

    const merged = [...current.styles];
    validStyles.forEach(style => {
      const index = merged.findIndex(existing => existing.id === style.id);
      if (index > -1) merged[index] = style;
      else merged.push(style);
    });

    await Promise.all(validStyles.map(syncStylePresetToRegistry));
    const next = { version: current.version || 1, styles: merged.sort((a, b) => a.name.localeCompare(b.name)) };
    return createNoStoreJsonResponse(next);
  } catch (error) {
    console.error('Failed to save style library:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to save style library.'
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await canCurrentAccountWriteShippedLibrary()) {
      return createApiErrorResponse(
        403,
        'library_writes_disabled',
        'Style library writes are disabled.'
      );
    }

    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const body = parsedBody.data as { id?: unknown };
    if (typeof body?.id !== 'string' || body.id.trim().length === 0) {
      return createApiErrorResponse(400, 'invalid_style_id', 'Style id is required.');
    }
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return createApiErrorResponse(503, 'style_library_unavailable', 'The Forge Pipeline database is not configured.');
    }
    await supabase
      .from('cardforge_developer_asset_submissions')
      .update({
        status: 'archived',
        calculated_access_tier: 'hidden',
        decision_reason: 'owner_deleted_from_library',
      })
      .eq('registry_asset_id', body.id);
    await supabase
      .from('cardforge_asset_registry')
      .update({
        status: 'archived',
        access_tier: 'hidden',
      })
      .eq('asset_id', body.id);
    const next = await readLibrary();
    return createNoStoreJsonResponse(next);
  } catch (error) {
    console.error('Failed to delete style:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to delete style.'
    );
  }
}
