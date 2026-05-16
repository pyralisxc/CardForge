import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import type { TCGCardTemplate } from '@/types';
import {
  DEFAULT_MAX_JSON_BODY_BYTES,
  formatZodIssues,
  parseJsonBodyWithLimit,
  templatePayloadSchema,
} from '@/lib/apiValidation';

const TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'templates');

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

const ensureTemplateDirectory = async () => {
  await fs.mkdir(TEMPLATE_LIBRARY_DIR, { recursive: true });
};

const toSafeFileName = (value: string): string => {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return safe || 'template';
};

const isTemplateLike = (value: unknown): value is TCGCardTemplate => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TCGCardTemplate>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && typeof candidate.aspectRatio === 'string';
};

export async function GET() {
  await ensureTemplateDirectory();
  const entries = await fs.readdir(TEMPLATE_LIBRARY_DIR, { withFileTypes: true });
  const templates: TCGCardTemplate[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(TEMPLATE_LIBRARY_DIR, entry.name);
    try {
      const contents = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(contents);
      if (isTemplateLike(parsed)) templates.push(parsed);
    } catch (error) {
      console.warn(`Skipping invalid template file ${entry.name}:`, error);
    }
  }

  templates.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  await ensureTemplateDirectory();
  const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
  if (!parsedBody.ok) {
    return createErrorResponse(
      parsedBody.code === 'payload_too_large' ? 413 : 400,
      parsedBody.code,
      parsedBody.message
    );
  }

  const validation = templatePayloadSchema.safeParse(parsedBody.data);
  if (!validation.success || !isTemplateLike(validation.data)) {
    const details = validation.success ? ['Template payload is missing required fields.'] : formatZodIssues(validation.error.issues);
    return createErrorResponse(400, 'invalid_template_payload', 'Invalid template payload.', details);
  }

  const template = validation.data as TCGCardTemplate;
  const fileName = `${toSafeFileName(template.id || template.name)}.json`;
  const filePath = path.join(TEMPLATE_LIBRARY_DIR, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');

  return NextResponse.json({ ok: true, fileName, template });
}

export async function DELETE(request: Request) {
  await ensureTemplateDirectory();
  const parsedBody = await parseJsonBodyWithLimit(request, DEFAULT_MAX_JSON_BODY_BYTES);
  if (!parsedBody.ok) {
    return createErrorResponse(
      parsedBody.code === 'payload_too_large' ? 413 : 400,
      parsedBody.code,
      parsedBody.message
    );
  }

  const body = parsedBody.data as { id?: unknown };
  const id = typeof body?.id === 'string' ? body.id : null;

  if (!id || id.trim().length === 0) {
    return createErrorResponse(400, 'invalid_template_id', 'Template id is required.');
  }

  const fileName = `${toSafeFileName(id)}.json`;
  const filePath = path.join(TEMPLATE_LIBRARY_DIR, fileName);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') throw error;
  }

  return NextResponse.json({ ok: true, fileName });
}
