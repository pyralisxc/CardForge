import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import type { AppearanceStyleLibrary, AppearanceStylePreset } from '@/types';
import { DEFAULT_APPEARANCE_LIBRARY } from '@/lib/appearance';

const STYLE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'styles');
const STYLE_LIBRARY_FILE = path.join(STYLE_LIBRARY_DIR, 'appearance-library.json');

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
  const body = await request.json();
  const current = await readLibrary();
  const incomingStyles: unknown[] = Array.isArray(body?.styles) ? body.styles : [body];
  const validStyles = incomingStyles.filter(isStylePreset);

  if (validStyles.length === 0) {
    return NextResponse.json({ error: 'A valid style preset is required.' }, { status: 400 });
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
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: 'Style id is required.' }, { status: 400 });
  const current = await readLibrary();
  const next = { ...current, styles: current.styles.filter(style => style.id !== body.id) };
  await fs.writeFile(STYLE_LIBRARY_FILE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return NextResponse.json(next);
}
