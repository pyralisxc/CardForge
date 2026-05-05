import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import type { TCGCardTemplate } from '@/types';

const TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'templates');

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
  const body = await request.json();

  if (!isTemplateLike(body)) {
    return NextResponse.json({ error: 'Invalid template payload.' }, { status: 400 });
  }

  const template = body as TCGCardTemplate;
  const fileName = `${toSafeFileName(template.id || template.name)}.json`;
  const filePath = path.join(TEMPLATE_LIBRARY_DIR, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(template, null, 2)}\n`, 'utf8');

  return NextResponse.json({ ok: true, fileName, template });
}

export async function DELETE(request: Request) {
  await ensureTemplateDirectory();
  const body = await request.json().catch(() => null) as { id?: string } | null;
  const id = body?.id;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Template id is required.' }, { status: 400 });
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
