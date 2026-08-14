import type {
  AppearanceStyleLibrary,
  AppearanceStylePreset,
  TCGCardTemplate,
} from '@/domain/templates';
import {
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
  type RegistryViewerAccess,
} from '@/features/developer-assets/lib/registryContentAssets';
import { upsertPipelineRegistryAsset } from '@/features/developer-assets/lib/developerAssetRegistryCommands';
import {
  isRepositoryStyle,
  isRepositoryTemplate,
} from '@/features/developer-assets/lib/registryContentValidation';

const getPipelineContributorName = (): string => 'CardForge Studio';

const sortTemplates = (templates: TCGCardTemplate[]): TCGCardTemplate[] =>
  templates.sort((left, right) => {
    const leftOrder = typeof left.templateOrder === 'number' ? left.templateOrder : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.templateOrder === 'number' ? right.templateOrder : Number.MAX_SAFE_INTEGER;
    return leftOrder === rightOrder ? left.name.localeCompare(right.name) : leftOrder - rightOrder;
  });

const readPublishedTemplates = async (viewerAccess: RegistryViewerAccess): Promise<TCGCardTemplate[]> => {
  const contributorName = getPipelineContributorName();
  const rows = await getPublishedRegistryContentRows('template', viewerAccess);
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
      id: row.asset_id,
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

const readPublishedStyles = async (viewerAccess: RegistryViewerAccess): Promise<AppearanceStylePreset[]> => {
  const contributorName = getPipelineContributorName();
  const rows = await getPublishedRegistryContentRows('elementPreset', viewerAccess);
  const styles = await Promise.all(rows.map(async (row) => {
    const style = await readRegistryContentAsset<AppearanceStylePreset>(
      row,
      ['style', 'elementPreset', 'payload'],
      isRepositoryStyle,
    );
    return style ? {
      ...style,
      id: row.asset_id,
      name: style.name || row.name,
      librarySource: row.library_source === 'developer' ? 'developer' as const : 'official' as const,
      accessTier: row.access_tier,
      registryStatus: row.status,
      contributorName: style.contributorName || contributorName,
    } : null;
  }));
  return styles.flatMap((style) => style ? [style] : []);
};

export const getRepositoryTemplateLibrary = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<TCGCardTemplate[]> => readPublishedTemplates(viewerAccess);

export const getRepositoryStyleLibrary = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<AppearanceStyleLibrary> => {
  return {
    version: 1,
    styles: (await readPublishedStyles(viewerAccess))
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
