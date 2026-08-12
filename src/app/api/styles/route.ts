import { promises as fs } from 'fs';
import path from 'path';

import type { AppearanceStyleLibrary, AppearanceStylePreset } from '@/domain/templates';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
} from '@/infrastructure/http/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  archivePipelineRegistryAsset,
  DeveloperAssetRegistryCommandError,
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
  upsertPipelineRegistryAsset,
} from '@/features/developer-assets/server';
import {
  DeveloperCockpitAccessError,
  getCurrentDeveloperCockpitAccess,
  requireContributionScope,
} from '@/features/developer-access/server';

const DEFAULT_STYLE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'styles');
const PIPELINE_OWNER_EMAIL = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL?.trim() || null;
const PIPELINE_CONTRIBUTOR_NAME = PIPELINE_OWNER_EMAIL || 'CardForge Studio';

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
  const stylePayload: AppearanceStylePreset = {
    ...style,
    librarySource: 'developer',
    accessTier: 'free',
    registryStatus: 'published',
    contributorName: PIPELINE_CONTRIBUTOR_NAME,
  };

  await upsertPipelineRegistryAsset({
    assetId: style.id,
    name: style.name,
    submissionAssetType: 'elementPresets',
    registryAssetType: 'elementPreset',
    url: `/api/styles#${style.id}`,
    description: `${style.name} starter style maintained through the Forge Pipeline.`,
    fileSizeBytes: Buffer.byteLength(JSON.stringify(style)),
    metadata: {
        sourceKind: 'pipeline-owner-edit',
        style: stylePayload,
    },
  });
};

const readLibrary = async (): Promise<AppearanceStyleLibrary> => {
  const [localStyles, registryStyles] = await Promise.all([
    readStylesFromDirectory(DEFAULT_STYLE_LIBRARY_DIR),
    readStylesFromRegistry(),
  ]);

  return {
    version: 1,
    styles: mergeStylesById(localStyles, registryStyles),
  };
};

const readStylesFromDirectory = async (directory: string): Promise<AppearanceStylePreset[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const styles: AppearanceStylePreset[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(directory, entry.name);
    try {
      const contents = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(contents);
      if (isStylePreset(parsed)) {
        styles.push({
          ...parsed,
          librarySource: 'official',
          accessTier: 'free',
          registryStatus: 'published',
          contributorName: PIPELINE_CONTRIBUTOR_NAME,
        });
      }
    } catch (error) {
      console.warn(`Skipping invalid style file ${entry.name}:`, error);
    }
  }

  return styles;
};

const mergeStylesById = (
  baseStyles: AppearanceStylePreset[],
  overrideStyles: AppearanceStylePreset[],
): AppearanceStylePreset[] => {
  const merged = new Map<string, AppearanceStylePreset>();

  [...baseStyles, ...overrideStyles].forEach((style) => {
    if (!style.id) return;
    merged.set(style.id, style);
  });

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
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
      contributorName: style.contributorName || PIPELINE_CONTRIBUTOR_NAME,
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
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'library.publish');

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
    if (error instanceof DeveloperCockpitAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'developer_access_required',
        error.message,
      );
    }
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'style_library_unavailable', error.message);
    }
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
    const access = await getCurrentDeveloperCockpitAccess();
    requireContributionScope(access, 'library.publish');

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
    await archivePipelineRegistryAsset(body.id);
    const next = await readLibrary();
    return createNoStoreJsonResponse(next);
  } catch (error) {
    if (error instanceof DeveloperCockpitAccessError) {
      return createApiErrorResponse(
        error.status,
        error.status === 401 ? 'sign_in_required' : 'developer_access_required',
        error.message,
      );
    }
    if (error instanceof DeveloperAssetRegistryCommandError) {
      return createApiErrorResponse(error.status, 'style_library_unavailable', error.message);
    }
    console.error('Failed to delete style:', error);
    return createApiErrorResponse(
      500,
      'style_library_unavailable',
      'Unable to delete style.'
    );
  }
}
