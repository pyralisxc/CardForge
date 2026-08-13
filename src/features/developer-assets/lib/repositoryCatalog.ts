import { promises as fs } from 'fs';
import path from 'path';

import type {
  AppearanceStyleLibrary,
  AppearanceStylePreset,
  TCGCardTemplate,
} from '@/domain/templates';
import {
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
} from '@/features/developer-assets/lib/registryContentAssets';
import { upsertPipelineRegistryAsset } from '@/features/developer-assets/lib/developerAssetRegistryCommands';

const DEFAULT_TEMPLATE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'default-templates');
const DEFAULT_STYLE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'styles');

const getPipelineContributorName = (): string =>
  process.env.CARDFORGE_PIPELINE_OWNER_EMAIL?.trim() || 'CardForge Studio';

type TemplateWithRequiredIdentity = TCGCardTemplate & {
  id: string;
  name: string;
  aspectRatio: string;
};

export const isRepositoryTemplate = (value: unknown): value is TemplateWithRequiredIdentity => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TCGCardTemplate>;
  return typeof candidate.id === 'string'
    && candidate.id.trim().length > 0
    && typeof candidate.name === 'string'
    && candidate.name.trim().length > 0
    && typeof candidate.aspectRatio === 'string';
};

export const isRepositoryStyle = (value: unknown): value is AppearanceStylePreset => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppearanceStylePreset>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.kind === 'string'
    && Array.isArray(candidate.targets)
    && Boolean(candidate.appearance);
};

const sortTemplates = (templates: TCGCardTemplate[]): TCGCardTemplate[] =>
  templates.sort((left, right) => {
    const leftOrder = typeof left.templateOrder === 'number' ? left.templateOrder : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.templateOrder === 'number' ? right.templateOrder : Number.MAX_SAFE_INTEGER;
    return leftOrder === rightOrder ? left.name.localeCompare(right.name) : leftOrder - rightOrder;
  });

const mergeById = <T extends { id?: string | null; name: string }>(base: T[], overrides: T[]): T[] => {
  const merged = new Map<string, T>();
  [...base, ...overrides].forEach((entry) => {
    if (entry.id) merged.set(entry.id, entry);
  });
  return Array.from(merged.values());
};

const readJsonFiles = async (directory: string): Promise<Array<{ fileName: string; value: unknown }>> => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const documents: Array<{ fileName: string; value: unknown }> = [];

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.json')) return;
    try {
      const value = JSON.parse(await fs.readFile(path.join(directory, entry.name), 'utf8')) as unknown;
      documents.push({ fileName: entry.name, value });
    } catch (error) {
      console.warn(`Skipping invalid repository catalog file ${entry.name}:`, error);
    }
  }));

  return documents.sort((left, right) => left.fileName.localeCompare(right.fileName));
};

const readBuiltInTemplates = async (): Promise<TCGCardTemplate[]> => {
  const contributorName = getPipelineContributorName();
  const documents = await readJsonFiles(DEFAULT_TEMPLATE_LIBRARY_DIR);
  return sortTemplates(documents.flatMap(({ value }) => isRepositoryTemplate(value) ? [{
    ...value,
    templateSource: 'default' as const,
    templateLibrarySource: 'base' as const,
    templateAccessTier: 'free' as const,
    templateRegistryStatus: 'published' as const,
    templateContributorName: contributorName,
  }] : []));
};

const readPublishedTemplates = async (): Promise<TCGCardTemplate[]> => {
  const contributorName = getPipelineContributorName();
  const rows = await getPublishedRegistryContentRows('template');
  const templates = await Promise.all(rows.map(async (row) => {
    const template = await readRegistryContentAsset<TCGCardTemplate>(
      row,
      ['template', 'payload'],
      isRepositoryTemplate,
    );
    if (!template) return null;
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const revisionNumber = Number(metadata.revisionNumber);
    return {
      ...template,
      id: template.id || row.asset_id,
      name: template.name || row.name,
      templateSource: 'default' as const,
      templateLibrarySource: 'pipeline' as const,
      templateAccessTier: row.access_tier,
      templateRegistryStatus: row.status,
      templateContributorName: template.templateContributorName || contributorName,
      templateRevision: Number.isInteger(revisionNumber) && revisionNumber >= 0 ? revisionNumber : 0,
      templateRevisionId: typeof metadata.revisionId === 'string' ? metadata.revisionId : undefined,
    } satisfies TCGCardTemplate;
  }));
  return sortTemplates(templates.flatMap((template) => template ? [template] : []));
};

const readStyleDocument = (value: unknown): AppearanceStylePreset[] => {
  if (isRepositoryStyle(value)) return [value];
  if (!value || typeof value !== 'object') return [];
  const styles = (value as { styles?: unknown }).styles;
  return Array.isArray(styles) ? styles.filter(isRepositoryStyle) : [];
};

const readBuiltInStyles = async (): Promise<AppearanceStylePreset[]> => {
  const contributorName = getPipelineContributorName();
  const documents = await readJsonFiles(DEFAULT_STYLE_LIBRARY_DIR);
  return documents
    .flatMap(({ value }) => readStyleDocument(value))
    .map((style) => ({
      ...style,
      librarySource: 'official' as const,
      accessTier: 'free' as const,
      registryStatus: 'published' as const,
      contributorName,
    }));
};

const readPublishedStyles = async (): Promise<AppearanceStylePreset[]> => {
  const contributorName = getPipelineContributorName();
  const rows = await getPublishedRegistryContentRows('elementPreset');
  const styles = await Promise.all(rows.map(async (row) => {
    const style = await readRegistryContentAsset<AppearanceStylePreset>(
      row,
      ['style', 'elementPreset', 'payload'],
      isRepositoryStyle,
    );
    return style ? {
      ...style,
      id: style.id || row.asset_id,
      name: style.name || row.name,
      librarySource: row.library_source === 'developer' ? 'developer' as const : 'official' as const,
      accessTier: row.access_tier,
      registryStatus: row.status,
      contributorName: style.contributorName || contributorName,
    } : null;
  }));
  return styles.flatMap((style) => style ? [style] : []);
};

export const getRepositoryTemplateLibrary = async (): Promise<TCGCardTemplate[]> => {
  const [builtIn, published] = await Promise.all([readBuiltInTemplates(), readPublishedTemplates()]);
  return sortTemplates(mergeById<TCGCardTemplate>(builtIn, published));
};

export const getRepositoryStyleLibrary = async (): Promise<AppearanceStyleLibrary> => {
  const [builtIn, published] = await Promise.all([readBuiltInStyles(), readPublishedStyles()]);
  return {
    version: 1,
    styles: mergeById<AppearanceStylePreset>(builtIn, published)
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
};

export const publishRepositoryStyle = async (style: AppearanceStylePreset): Promise<void> => {
  const contributorName = getPipelineContributorName();
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
      style: {
        ...style,
        librarySource: 'developer',
        accessTier: 'free',
        registryStatus: 'published',
        contributorName,
      },
    },
  });
};

export const toRepositoryAssetFileName = (value: string, fallback: string): string => {
  const safe = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${safe || fallback}.json`;
};
