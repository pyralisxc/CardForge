import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import type { AppearanceStyleLibrary, AppearanceStylePreset } from '@/types';
import { DEFAULT_APPEARANCE_LIBRARY } from '@/lib/appearance';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  stylePresetPayloadSchema,
} from '@/lib/apiValidation';

const STYLE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'styles');
const STYLE_LIBRARY_FILE = path.join(STYLE_LIBRARY_DIR, 'appearance-library.json');

const createErrorResponse = (
  status: number,
  code: string,
  message: string,
  details?: string[]
) => {
  const correlationId = crypto.randomUUID();
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
      correlationId,
    },
    {
      status,
      headers: {
        'x-correlation-id': correlationId,
      },
    }
  );
};

const ensureStyleDirectory = async () => {
  await fs.mkdir(STYLE_LIBRARY_DIR, { recursive: true });
};

const isStylePreset = (value: unknown): value is AppearanceStylePreset => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppearanceStylePreset>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.kind === 'string'
    && Array.isArray(candidate.targets)
    && !!candidate.appearance;
};

const readLibrary = async (): Promise<AppearanceStyleLibrary> => {
  await ensureStyleDirectory();
  try {
    const contents = await fs.readFile(STYLE_LIBRARY_FILE, 'utf8');
    const parsed = JSON.parse(contents) as Partial<AppearanceStyleLibrary>;
    if (Array.isArray(parsed.styles) && parsed.styles.every(isStylePreset)) {
      return { version: Number(parsed.version) || 1, styles: parsed.styles };
    }
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') console.warn('Unable to read style library:', error);
  }

  const fallback = { version: 1, styles: DEFAULT_APPEARANCE_LIBRARY };
  await fs.writeFile(STYLE_LIBRARY_FILE, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
  return fallback;
};

export async function GET() {
  return NextResponse.json(await readLibrary());
}

export async function POST(request: Request) {
  const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
  if (!parsedBody.ok) {
    return createErrorResponse(
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
    return createErrorResponse(
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

  const next = { version: current.version || 1, styles: merged };
  await fs.writeFile(STYLE_LIBRARY_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return NextResponse.json(next);
}

export async function DELETE(request: Request) {
  const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
  if (!parsedBody.ok) {
    return createErrorResponse(
      parsedBody.code === 'payload_too_large' ? 413 : 400,
      parsedBody.code,
      parsedBody.message
    );
  }

  const body = parsedBody.data as { id?: unknown };
  if (typeof body?.id !== 'string' || body.id.trim().length === 0) {
    return createErrorResponse(400, 'invalid_style_id', 'Style id is required.');
  }
  const current = await readLibrary();
  const next = { ...current, styles: current.styles.filter(style => style.id !== body.id) };
  await fs.writeFile(STYLE_LIBRARY_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return NextResponse.json(next);
}
