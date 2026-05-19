import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { cardAssetMetadataOverrideSchema, formatZodIssues } from '@/lib/apiValidation';
import { buildDiscoveredCardAsset, type CardAssetMetadataOverride, type CardAssetOption } from '@/lib/cardAssets';

const PUBLIC_CARD_ASSET_DIR = path.join(process.cwd(), 'public', 'card-assets');
const TEXTURE_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'textures');
const DIVIDER_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'dividers');
const ASSET_METADATA_DIR = path.join(process.cwd(), 'data', 'assets');
const TEXTURE_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'textures');
const DIVIDER_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'dividers');
const ALLOWED_ASSET_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);

const walkAssetFiles = async (directory: string, baseDirectory: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        results.push(...await walkAssetFiles(fullPath, baseDirectory));
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_ASSET_EXTENSIONS.has(extension)) continue;
      results.push(path.relative(baseDirectory, fullPath));
    }

    return results;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') return [];
    throw error;
  }
};

const readMetadataOverride = async (
  metadataBaseDirectory: string,
  relativeAssetPath: string,
): Promise<CardAssetMetadataOverride | undefined> => {
  const metadataPath = path.join(
    metadataBaseDirectory,
    relativeAssetPath.replace(/\.[^.]+$/, '.json'),
  );

  try {
    const contents = await fs.readFile(metadataPath, 'utf8');
    const parsedJson = JSON.parse(contents) as unknown;
    const parsed = cardAssetMetadataOverrideSchema.safeParse(parsedJson);
    if (parsed.success) return parsed.data;
    console.warn(
      `Skipping invalid asset metadata ${metadataPath}: ${formatZodIssues(parsed.error.issues).join('; ')}`
    );
    return undefined;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') return undefined;
    console.warn(`Skipping invalid asset metadata ${metadataPath}:`, error);
    return undefined;
  }
};

const discoverAssets = async (
  assetDirectory: string,
  metadataDirectory: string,
  kind: 'texture' | 'divider',
): Promise<CardAssetOption[]> => {
  const relativePaths = await walkAssetFiles(assetDirectory, assetDirectory);
  const assets = await Promise.all(relativePaths.map(async (relativePath) => {
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    const metadata = await readMetadataOverride(metadataDirectory, normalizedRelativePath);
    return buildDiscoveredCardAsset({
      url: `/card-assets/${kind === 'texture' ? 'textures' : 'dividers'}/${normalizedRelativePath}`,
      kind,
      relativePath: normalizedRelativePath,
      metadata,
    });
  }));

  return assets.sort((a, b) => a.name.localeCompare(b.name));
};

export async function GET() {
  const [textures, dividers] = await Promise.all([
    discoverAssets(TEXTURE_ASSET_DIR, TEXTURE_METADATA_DIR, 'texture'),
    discoverAssets(DIVIDER_ASSET_DIR, DIVIDER_METADATA_DIR, 'divider'),
  ]);

  return NextResponse.json({ textures, dividers });
}
