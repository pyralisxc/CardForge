import type {
  AppearanceStyleLibrary,
  AppearanceStylePreset,
  TCGCardTemplate,
} from '@/domain/templates';
import {
  getPublishedRegistryContentRows,
  readRegistryContentAsset,
  type RegistryContentAssetRow,
  type RegistryViewerAccess,
} from '@/features/pipeline/lib/registryContentAssets';
import { upsertPipelineRegistryAsset } from '@/features/pipeline/lib/pipelineRegistryCommands';
import {
  isRepositoryStyle,
  isRepositoryTemplate,
} from '@/features/pipeline/lib/registryContentValidation';
import { hydratePipelineTemplateAssetReferences } from './pipelineTemplateAssets';

const getPipelineContributorName = (): string => 'Pyralis Cameron';

const sortTemplates = (templates: TCGCardTemplate[]): TCGCardTemplate[] =>
  templates.sort((left, right) => {
    const leftOrder = typeof left.templateOrder === 'number' ? left.templateOrder : Number.MAX_SAFE_INTEGER;
    const rightOrder = typeof right.templateOrder === 'number' ? right.templateOrder : Number.MAX_SAFE_INTEGER;
    return leftOrder === rightOrder ? left.name.localeCompare(right.name) : leftOrder - rightOrder;
  });

export const mapRegistryRowsToTemplateLibrary = async (
  rows: RegistryContentAssetRow[],
): Promise<TCGCardTemplate[]> => {
  const contributorName = getPipelineContributorName();
  const templates = await Promise.all(rows.map(async (row) => {
    const template = await readRegistryContentAsset<TCGCardTemplate>(
      row,
      [],
      isRepositoryTemplate,
    );
    if (!template) return null;
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    const revisionNumber = Number(metadata.revisionNumber);
    return {
      ...hydratePipelineTemplateAssetReferences(template),
      id: row.asset_id,
      name: template.name || row.name,
      templateSource: 'default' as const,
      templateLibrarySource: 'pipeline' as const,
      templateAccessTier: row.access_tier,
      templateRegistryStatus: row.status,
      templateContributorName: template.templateContributorName || contributorName,
      templateOrder: row.studio_sort_order ?? template.templateOrder,
      templateRevision: Number.isInteger(revisionNumber) && revisionNumber >= 0 ? revisionNumber : 0,
      templateRevisionId: typeof metadata.revisionId === 'string' ? metadata.revisionId : undefined,
    } satisfies TCGCardTemplate;
  }));
  return sortTemplates(templates.flatMap((template) => template ? [template] : []));
};

export const mapRegistryRowsToStyleLibrary = async (
  rows: RegistryContentAssetRow[],
): Promise<AppearanceStylePreset[]> => {
  const contributorName = getPipelineContributorName();
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
      studioDestinations: row.studio_destinations ?? style.studioDestinations,
      studioOrder: row.studio_sort_order ?? style.studioOrder,
      studioFeatured: row.studio_featured ?? style.studioFeatured,
      studioRoutingMode: row.studio_routing_mode === 'owner' ? 'owner' as const : 'automatic' as const,
    } : null;
  }));
  return styles.flatMap((style) => style ? [style] : []);
};

export const getRepositoryTemplateLibrary = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<TCGCardTemplate[]> => mapRegistryRowsToTemplateLibrary(
  await getPublishedRegistryContentRows('template', viewerAccess),
);

export const getRepositoryStyleLibrary = async (
  viewerAccess: RegistryViewerAccess = 'free',
): Promise<AppearanceStyleLibrary> => {
  return {
    version: 1,
    styles: (await mapRegistryRowsToStyleLibrary(
      await getPublishedRegistryContentRows('elementPreset', viewerAccess),
    ))
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
