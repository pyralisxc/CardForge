import { promises as fs } from 'fs';
import path from 'path';

import { cardAssetMetadataOverrideSchema, formatZodIssues } from '@/lib/apiValidation';
import {
  buildDiscoveredCardAsset,
  type CardAssetMetadataOverride,
  type CardAssetOption,
} from '@/lib/cardAssets';
import { getSupabaseServerClient, getSupabaseServerConfigStatus } from '@/lib/supabaseServer';

const PUBLIC_CARD_ASSET_DIR = path.join(process.cwd(), 'public', 'card-assets');
const TEXTURE_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'textures');
const DIVIDER_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'dividers');
const PART_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'parts');
const ICON_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'icons');
const IMAGE_ASSET_DIR = path.join(PUBLIC_CARD_ASSET_DIR, 'images');
const ASSET_METADATA_DIR = path.join(process.cwd(), 'data', 'assets');
const TEXTURE_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'textures');
const DIVIDER_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'dividers');
const PART_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'parts');
const ICON_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'icons');
const IMAGE_METADATA_DIR = path.join(ASSET_METADATA_DIR, 'images');
const ALLOWED_ASSET_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);

type RegistryAssetKind = 'texture' | 'divider' | 'part' | 'icon' | 'image';

type AssetRegistryRow = {
  asset_id: string;
  name: string;
  asset_type: string;
  url: string;
  status: string;
  access_tier: string;
  library_source: string;
  file_size_bytes: number | null;
  metadata: unknown;
};

export interface AssetRegistryPayload {
  textures: CardAssetOption[];
  dividers: CardAssetOption[];
  parts: CardAssetOption[];
  icons: CardAssetOption[];
  imageAssets: CardAssetOption[];
  registry: {
    configured: boolean;
    source: 'database' | 'shipped-files';
    total: number;
  };
}

const isRegistryAssetKind = (value: unknown): value is RegistryAssetKind =>
  value === 'texture' || value === 'divider' || value === 'part' || value === 'icon' || value === 'image';

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

const discoverFileBackedAssets = async (
  assetDirectory: string,
  metadataDirectory: string,
  kind: RegistryAssetKind,
): Promise<CardAssetOption[]> => {
  const relativePaths = await walkAssetFiles(assetDirectory, assetDirectory);
  const assets = await Promise.all(relativePaths.map(async (relativePath) => {
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    const metadata = await readMetadataOverride(metadataDirectory, normalizedRelativePath);
    const stats = await fs.stat(path.join(assetDirectory, relativePath)).catch(() => null);
    return {
      ...buildDiscoveredCardAsset({
        url: `/card-assets/${kind === 'texture' ? 'textures' : kind === 'divider' ? 'dividers' : 'parts'}/${normalizedRelativePath}`,
        kind,
        relativePath: normalizedRelativePath,
        metadata,
      }),
      librarySource: 'official' as const,
      accessTier: 'official' as const,
      registryStatus: 'published' as const,
      fileSizeBytes: stats?.size,
    };
  }));

  return assets.sort((a, b) => a.name.localeCompare(b.name));
};

const getFileBackedAssetRegistry = async (): Promise<AssetRegistryPayload> => {
  const [textures, dividers, parts, icons, imageAssets] = await Promise.all([
    discoverFileBackedAssets(TEXTURE_ASSET_DIR, TEXTURE_METADATA_DIR, 'texture'),
    discoverFileBackedAssets(DIVIDER_ASSET_DIR, DIVIDER_METADATA_DIR, 'divider'),
    discoverFileBackedAssets(PART_ASSET_DIR, PART_METADATA_DIR, 'part'),
    discoverFileBackedAssets(ICON_ASSET_DIR, ICON_METADATA_DIR, 'icon'),
    discoverFileBackedAssets(IMAGE_ASSET_DIR, IMAGE_METADATA_DIR, 'image'),
  ]);

  return {
    textures,
    dividers,
    parts,
    icons,
    imageAssets,
    registry: {
      configured: false,
      source: 'shipped-files',
      total: textures.length + dividers.length + parts.length + icons.length + imageAssets.length,
    },
  };
};

const mapRegistryRowToAsset = (row: AssetRegistryRow): CardAssetOption | null => {
  if (!isRegistryAssetKind(row.asset_type)) return null;
  const parsedMetadata = cardAssetMetadataOverrideSchema.safeParse(row.metadata ?? {});
  const metadata = parsedMetadata.success ? parsedMetadata.data : undefined;
  const asset = buildDiscoveredCardAsset({
    url: row.url,
    kind: row.asset_type,
    relativePath: row.asset_id,
    metadata: {
      ...metadata,
      id: row.asset_id,
      name: row.name,
    },
  });

  return {
    ...asset,
    kind: row.asset_type === 'icon'
      ? 'icon'
      : row.asset_type === 'image'
        ? 'image'
        : asset.kind,
    librarySource: row.library_source === 'developer' ? 'developer' : 'official',
    accessTier: row.access_tier === 'paid'
      ? 'paid'
      : row.access_tier === 'free'
        ? 'free'
        : row.access_tier === 'developer'
          ? 'developer'
          : row.access_tier === 'hidden'
            ? 'hidden'
            : 'official',
    registryStatus: row.status === 'draft'
      || row.status === 'submitted'
      || row.status === 'voting'
      || row.status === 'publish_candidate'
      || row.status === 'archived'
      || row.status === 'rejected'
      ? row.status
      : 'published',
    fileSizeBytes: row.file_size_bytes ?? undefined,
  };
};

const getDatabaseAssetRegistry = async (): Promise<AssetRegistryPayload | null> => {
  const supabase = getSupabaseServerClient();
  if (!getSupabaseServerConfigStatus().configured || !supabase) return null;

  const { data, error } = await supabase
    .from('cardforge_asset_registry')
    .select('asset_id,name,asset_type,url,status,access_tier,library_source,file_size_bytes,metadata')
    .eq('status', 'published')
    .neq('access_tier', 'hidden')
    .order('asset_type', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if ((error as { code?: string }).code !== 'PGRST205') {
      console.error('Failed to load asset registry:', error);
    }
    return null;
  }

  const assets = (data ?? [])
    .map((row) => mapRegistryRowToAsset(row as AssetRegistryRow))
    .filter((asset): asset is CardAssetOption => Boolean(asset));

  if (assets.length === 0) return null;

  return {
    textures: assets.filter((asset) => asset.kind === 'texture'),
    dividers: assets.filter((asset) => asset.kind === 'divider'),
    parts: assets.filter((asset) => asset.kind === 'part'),
    icons: assets.filter((asset) => asset.kind === 'icon'),
    imageAssets: assets.filter((asset) => asset.kind === 'image'),
    registry: {
      configured: true,
      source: 'database',
      total: assets.length,
    },
  };
};

export const getAssetRegistryPayload = async (): Promise<AssetRegistryPayload> => {
  const databaseRegistry = await getDatabaseAssetRegistry();
  return databaseRegistry ?? getFileBackedAssetRegistry();
};
