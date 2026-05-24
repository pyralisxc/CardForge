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
import {
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
} from '@/lib/registryContentAssets';

const DEFAULT_TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'default-templates');
const USER_TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'user-templates');
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
      if (isTemplateLike(parsed)) templates.push({ ...parsed, templateSource });
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

export async function GET() {
  try {
    await ensureTemplateDirectory();
    const [fileDefaults, registryDefaults, userTemplates] = await Promise.all([
      readTemplatesFromDirectory(DEFAULT_TEMPLATE_LIBRARY_DIR, 'default'),
      readTemplatesFromRegistry(),
      readTemplatesFromDirectory(USER_TEMPLATE_LIBRARY_DIR, 'user'),
    ]);
    const defaultsById = new Map<string, TCGCardTemplate>();
    fileDefaults.forEach((template) => {
      if (template.id) defaultsById.set(template.id, template);
    });
    registryDefaults.forEach((template) => {
      if (template.id) defaultsById.set(template.id, template);
    });

    return createNoStoreJsonResponse({ defaults: Array.from(defaultsById.values()), userTemplates });
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
    const directory = getTemplateDirectory(source);
    const fileName = `${toSafeFileName(template.id || template.name)}.json`;
    const filePath = path.join(directory, fileName);
    await fs.writeFile(filePath, `${JSON.stringify({ ...template, templateSource: source }, null, 2)}\n`, 'utf8');

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
    const filePath = path.join(getTemplateDirectory(source), fileName);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') throw error;
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
