import { promises as fs } from 'fs';
import path from 'path';

import type { TCGCardTemplate } from '@/types';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  templatePayloadSchema,
} from '@/lib/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { canCurrentAccountWriteShippedLibrary } from '@/lib/serverProjectAccess';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
} from '@/lib/registryContentAssets';

const DEFAULT_TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'default-templates');
const USER_TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'user-templates');
const PIPELINE_OWNER_EMAIL = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL || 'cameron.r.locke96@gmail.com';
type TemplateWithRequiredIdentity = TCGCardTemplate & { id: string; name: string; aspectRatio: string };

const ensureTemplateDirectory = async () => {
  await Promise.all([
    fs.mkdir(DEFAULT_TEMPLATE_LIBRARY_DIR, { recursive: true }),
    fs.mkdir(USER_TEMPLATE_LIBRARY_DIR, { recursive: true }),
  ]);
};

const toSafeFileName = (value: string): string => {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return safe || 'template';
};

const isTemplateLike = (value: unknown): value is TemplateWithRequiredIdentity => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TCGCardTemplate>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && typeof candidate.aspectRatio === 'string';
};

const readTemplatesFromDirectory = async (
  directory: string,
  templateSource: NonNullable<TCGCardTemplate['templateSource']>
): Promise<TCGCardTemplate[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const templates: TCGCardTemplate[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(directory, entry.name);
    try {
      const contents = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(contents);
      if (isTemplateLike(parsed)) {
        templates.push({
          ...parsed,
          templateSource,
          templateLibrarySource: templateSource === 'default' ? 'base' : 'personal',
          templateAccessTier: templateSource === 'default' ? 'official' : undefined,
          templateRegistryStatus: templateSource === 'default' ? 'published' : 'localOnly',
          templateContributorName: templateSource === 'default' ? PIPELINE_OWNER_EMAIL : undefined,
        });
      }
    } catch (error) {
      console.warn(`Skipping invalid template file ${entry.name}:`, error);
    }
  }

  return templates.sort((a, b) => {
    const orderA = typeof a.templateOrder === 'number' ? a.templateOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.templateOrder === 'number' ? b.templateOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
};

const readTemplatesFromRegistry = async (): Promise<TCGCardTemplate[]> => {
  const rows = await getPublishedRegistryContentRows('template');
  if (rows.length === 0) return [];

  const templates: TCGCardTemplate[] = [];

  await Promise.all(rows.map(async (row) => {
    const template = await readRegistryContentAsset<TCGCardTemplate>(
      row,
      ['template', 'payload'],
      isTemplateLike,
    );

    if (!template) return;
    templates.push({
      ...template,
      id: template.id || row.asset_id,
      name: template.name || row.name,
      templateSource: 'default' as const,
      templateLibrarySource: 'pipeline' as const,
      templateAccessTier: row.access_tier,
      templateRegistryStatus: row.status,
      templateContributorName: template.templateContributorName || PIPELINE_OWNER_EMAIL,
    });
  }));

  return templates
    .sort((a, b) => {
      const orderA = typeof a.templateOrder === 'number' ? a.templateOrder : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.templateOrder === 'number' ? b.templateOrder : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
};

const getTemplateDirectory = (source?: TCGCardTemplate['templateSource']) => (
  source === 'default' ? DEFAULT_TEMPLATE_LIBRARY_DIR : USER_TEMPLATE_LIBRARY_DIR
);

const syncDefaultTemplateToRegistry = async (template: TCGCardTemplate) => {
  if (!template.id || !template.name) return;

  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const { data: ownerProfiles } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email')
    .eq('email', PIPELINE_OWNER_EMAIL)
    .limit(1);
  const ownerProfile = ownerProfiles?.[0] as { clerk_user_id?: string; email?: string | null } | undefined;
  const ownerDeveloperId = ownerProfile?.clerk_user_id || PIPELINE_OWNER_EMAIL;
  const ownerEmail = ownerProfile?.email || PIPELINE_OWNER_EMAIL;

  const registryPatch = {
    name: template.name,
    asset_type: 'template',
    url: `/api/templates#${template.id}`,
    preview_url: `/api/templates#${template.id}`,
    status: 'published',
    access_tier: 'free',
    library_source: 'developer',
    metadata: {
      sourceKind: 'pipeline-owner-edit',
      template: {
        ...template,
        templateSource: 'default' as const,
        templateLibrarySource: 'pipeline' as const,
        templateAccessTier: 'free' as const,
        templateRegistryStatus: 'published' as const,
        templateContributorName: ownerEmail,
      },
    },
  };

  const { data: existingSubmissions } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id')
    .eq('registry_asset_id', template.id)
    .limit(1);
  const submissionPatch = {
    developer_id: ownerDeveloperId,
    developer_email: ownerEmail,
    asset_type: 'templates',
    name: template.name,
    preview_url: `/api/templates#${template.id}`,
    source_url: `/api/templates#${template.id}`,
    source_file_size_bytes: Buffer.byteLength(JSON.stringify(template)),
    source_mime_type: 'application/json',
    registry_asset_id: template.id,
    status: 'published',
    calculated_access_tier: 'free',
    owner_access_tier_override: null,
    description: template.templateDescription ?? 'Starter template maintained through the Forge Pipeline.',
  };
  let submissionId = existingSubmissions?.[0]?.id as string | undefined;
  if (submissionId) {
    const { error: submissionError } = await supabase
      .from('cardforge_developer_asset_submissions')
      .update(submissionPatch)
      .eq('id', submissionId);
    if (submissionError) {
      console.error('Failed to sync template submission:', submissionError);
    }
  } else {
    const { data: insertedSubmission, error: submissionError } = await supabase
      .from('cardforge_developer_asset_submissions')
      .insert(submissionPatch)
      .select('id')
      .single();
    if (submissionError) {
      console.error('Failed to create template submission:', submissionError);
    } else {
      submissionId = insertedSubmission.id;
    }
  }

  const { error: registryError } = await supabase
    .from('cardforge_asset_registry')
    .upsert({
      asset_id: template.id,
      ...registryPatch,
      developer_submission_id: submissionId,
    }, { onConflict: 'asset_id' });

  if (registryError) {
    console.error('Failed to sync default template to asset registry:', registryError);
    return;
  }

};

export async function GET() {
  try {
    await ensureTemplateDirectory();
    const [registryDefaults, userTemplates] = await Promise.all([
      readTemplatesFromRegistry(),
      readTemplatesFromDirectory(USER_TEMPLATE_LIBRARY_DIR, 'user'),
    ]);
    return createNoStoreJsonResponse({ defaults: registryDefaults, userTemplates });
  } catch (error) {
    console.error('Failed to load template library:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to load template library.'
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!await canCurrentAccountWriteShippedLibrary()) {
      return createApiErrorResponse(
        403,
        'library_writes_disabled',
        'Template library writes are disabled.'
      );
    }

    await ensureTemplateDirectory();
    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const validation = templatePayloadSchema.safeParse(parsedBody.data);
    if (!validation.success || !isTemplateLike(validation.data)) {
      const details = validation.success ? ['Template payload is missing required fields.'] : formatZodIssues(validation.error.issues);
      return createApiErrorResponse(400, 'invalid_template_payload', 'Invalid template payload.', details);
    }

    const template = validation.data as TCGCardTemplate;
    const source = template.templateSource === 'default' ? 'default' : 'user';
    const fileName = `${toSafeFileName(template.id || template.name)}.json`;
    if (source === 'default') {
      await syncDefaultTemplateToRegistry({ ...template, templateSource: 'default' });
    } else {
      const directory = getTemplateDirectory(source);
      const filePath = path.join(directory, fileName);
      await fs.writeFile(filePath, `${JSON.stringify({ ...template, templateSource: source }, null, 2)}\n`, 'utf8');
    }

    return createNoStoreJsonResponse({ ok: true, fileName, template: { ...template, templateSource: source } });
  } catch (error) {
    console.error('Failed to save template:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to save template.'
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!await canCurrentAccountWriteShippedLibrary()) {
      return createApiErrorResponse(
        403,
        'library_writes_disabled',
        'Template library writes are disabled.'
      );
    }

    await ensureTemplateDirectory();
    const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
    if (!parsedBody.ok) {
      return createApiErrorResponse(
        parsedBody.code === 'payload_too_large' ? 413 : 400,
        parsedBody.code,
        parsedBody.message
      );
    }

    const body = parsedBody.data as { id?: unknown; source?: unknown };
    const id = typeof body?.id === 'string' ? body.id : null;
    const source = body?.source === 'default' ? 'default' : 'user';

    if (!id || id.trim().length === 0) {
      return createApiErrorResponse(400, 'invalid_template_id', 'Template id is required.');
    }

    const fileName = `${toSafeFileName(id)}.json`;
    if (source === 'default') {
      const supabase = getSupabaseServerClient();
      if (!supabase) {
        return createApiErrorResponse(503, 'template_library_unavailable', 'The Forge Pipeline database is not configured.');
      }
      await supabase
        .from('cardforge_developer_asset_submissions')
        .update({
          status: 'archived',
          calculated_access_tier: 'hidden',
          decision_reason: 'owner_deleted_from_library',
        })
        .eq('registry_asset_id', id);
      await supabase
        .from('cardforge_asset_registry')
        .update({
          status: 'archived',
          access_tier: 'hidden',
        })
        .eq('asset_id', id);
    } else {
      const filePath = path.join(getTemplateDirectory(source), fileName);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code !== 'ENOENT') throw error;
      }
    }

    return createNoStoreJsonResponse({ ok: true, fileName });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to delete template.'
    );
  }
}
