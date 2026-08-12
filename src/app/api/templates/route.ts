import { promises as fs } from 'fs';
import path from 'path';

import type { TCGCardTemplate } from '@/domain/templates';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  templatePayloadSchema,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  archivePipelineRegistryAsset,
  canCurrentAccountWriteShippedLibrary,
  DeveloperAssetRegistryCommandError,
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
  upsertPipelineRegistryAsset,
} from '@/features/developer-assets/server';

const DEFAULT_TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'default-templates');
const PIPELINE_OWNER_EMAIL = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL?.trim() || null;
const PIPELINE_CONTRIBUTOR_NAME = PIPELINE_OWNER_EMAIL || 'CardForge Studio';
type TemplateWithRequiredIdentity = TCGCardTemplate & { id: string; name: string; aspectRatio: string };

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

const isLegacyRelicDemoTemplate = (template: TCGCardTemplate): boolean => {
  const searchableText = [
    template.id,
    template.name,
    template.templateDescription,
    template.templateCategory,
    JSON.stringify(template.templatePreviewData ?? {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return searchableText.includes('forge demo 202605260814 relic duel')
    || searchableText.includes('ashen relic')
    || searchableText.includes('arcane relic');
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
          templateAccessTier: templateSource === 'default' ? 'free' : undefined,
          templateRegistryStatus: templateSource === 'default' ? 'published' : 'localOnly',
          templateContributorName: templateSource === 'default' ? PIPELINE_CONTRIBUTOR_NAME : undefined,
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
      templateContributorName: template.templateContributorName || PIPELINE_CONTRIBUTOR_NAME,
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

const mergeTemplatesById = (
  baseTemplates: TCGCardTemplate[],
  overrideTemplates: TCGCardTemplate[],
): TCGCardTemplate[] => {
  const merged = new Map<string, TCGCardTemplate>();

  [...baseTemplates, ...overrideTemplates].forEach((template) => {
    if (!template.id) return;
    merged.set(template.id, template);
  });

  return Array.from(merged.values()).sort((a, b) => {
    const orderA = typeof a.templateOrder === 'number' ? a.templateOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.templateOrder === 'number' ? b.templateOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
};

const syncDefaultTemplateToRegistry = async (template: TCGCardTemplate) => {
  if (!template.id || !template.name) return;

  await upsertPipelineRegistryAsset({
    assetId: template.id,
    name: template.name,
    submissionAssetType: 'templates',
    registryAssetType: 'template',
    url: `/api/templates#${template.id}`,
    fileSizeBytes: Buffer.byteLength(JSON.stringify(template)),
    description: template.templateDescription ?? 'Starter template maintained through the Forge Pipeline.',
    metadata: {
      sourceKind: 'pipeline-owner-edit',
      template: {
        ...template,
        templateSource: 'default' as const,
        templateLibrarySource: 'pipeline' as const,
        templateAccessTier: 'free' as const,
        templateRegistryStatus: 'published' as const,
        templateContributorName: PIPELINE_CONTRIBUTOR_NAME,
      },
    },
  });
};

export async function GET() {
  try {
    const [localDefaults, registryDefaults] = await Promise.all([
      readTemplatesFromDirectory(DEFAULT_TEMPLATE_LIBRARY_DIR, 'default'),
      readTemplatesFromRegistry(),
    ]);
    const visibleDefaults = mergeTemplatesById(localDefaults, registryDefaults)
      .filter((template) => !isLegacyRelicDemoTemplate(template));
    return createNoStoreJsonResponse({ defaults: visibleDefaults, userTemplates: [] });
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
    if (source !== 'default') {
      return createApiErrorResponse(
        400,
        'personal_library_is_local',
        'Personal templates are saved in the browser library, not the server filesystem.',
      );
    }
    await syncDefaultTemplateToRegistry({ ...template, templateSource: 'default' });

    return createNoStoreJsonResponse({ ok: true, fileName, template: { ...template, templateSource: source } });
  } catch (error) {
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'template_library_unavailable', error.message);
    }
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
    if (source !== 'default') {
      return createApiErrorResponse(
        400,
        'personal_library_is_local',
        'Personal templates are deleted from the browser library, not the server filesystem.',
      );
    }
    await archivePipelineRegistryAsset(id);

    return createNoStoreJsonResponse({ ok: true, fileName });
  } catch (error) {
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'template_library_unavailable', error.message);
    }
    console.error('Failed to delete template:', error);
    return createApiErrorResponse(
      500,
      'template_library_unavailable',
      'Unable to delete template.'
    );
  }
}
