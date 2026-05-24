import { promises as fs } from 'fs';
import path from 'path';

import type { AppearanceStyleLibrary, AppearanceStylePreset } from '@/types';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
} from '@/lib/apiValidation';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { canCurrentAccountWriteShippedLibrary } from '@/lib/serverProjectAccess';

const STYLE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'styles');
const STYLE_FILE_EXTENSION = '.json';

const ensureStyleDirectory = async () => {
  await fs.mkdir(STYLE_LIBRARY_DIR, { recursive: true });
};

const toSafeFileName = (value: string): string => {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return safe || 'style';
};

const styleFilePathForId = (id: string) =>
  path.join(STYLE_LIBRARY_DIR, `${toSafeFileName(id)}${STYLE_FILE_EXTENSION}`);

const isStylePreset = (value: unknown): value is AppearanceStylePreset => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppearanceStylePreset>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.kind === 'string'
    && Array.isArray(candidate.targets)
    && !!candidate.appearance;
};

const writeStylePresetFiles = async (styles: AppearanceStylePreset[]) => {
  await Promise.all(styles.map((style) =>
    fs.writeFile(styleFilePathForId(style.id), `${JSON.stringify(style, null, 2)}\n`, 'utf8')
  ));
};

const readLibrary = async (): Promise<AppearanceStyleLibrary> => {
  await ensureStyleDirectory();
  const entries = await fs.readdir(STYLE_LIBRARY_DIR, { withFileTypes: true });
  const styles: AppearanceStylePreset[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(STYLE_FILE_EXTENSION)) continue;

    const filePath = path.join(STYLE_LIBRARY_DIR, entry.name);
    try {
      const contents = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(contents);
      if (isStylePreset(parsed)) styles.push(parsed);
    } catch (error) {
      console.warn(`Skipping invalid style file ${entry.name}:`, error);
    }
  }

  return { version: 1, styles: styles.sort((a, b) => a.name.localeCompare(b.name)) };
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

    await writeStylePresetFiles(validStyles);
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
    try {
      await fs.unlink(styleFilePathForId(body.id));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'ENOENT') throw error;
    }
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
