import type { CardAssetOption } from '@/features/pipeline/lib/cardAssets';
import {
  getStudioAssetDestinationDefinition,
  type StudioAssetDestination,
} from '@/domain/templates';
import type {
  PipelineAccessTier,
  PipelineStatus,
  PipelineType,
} from '@/features/pipeline/lib/pipelineItems';

export type RegistryCreationAssetKind = Extract<
  CardAssetOption['kind'],
  'texture' | 'divider' | 'icon' | 'image' | 'template' | 'elementPreset'
> | 'font';

export type PipelineRegistryObjectKind = RegistryCreationAssetKind | 'set';

const assetKindLabels: Record<CardAssetOption['kind'] | 'font' | 'set', { singular: string; plural: string }> = {
  texture: { singular: 'Texture', plural: 'Textures' },
  divider: { singular: 'Divider', plural: 'Dividers' },
  border: { singular: 'Border', plural: 'Borders' },
  frame: { singular: 'Frame', plural: 'Frames' },
  icon: { singular: 'Icon', plural: 'Icons' },
  image: { singular: 'Image', plural: 'Images' },
  template: { singular: 'Template', plural: 'Templates' },
  elementPreset: { singular: 'Style', plural: 'Styles' },
  font: { singular: 'Font', plural: 'Fonts' },
  set: { singular: 'Set', plural: 'Sets' },
};

export const pipelineTypeToRegistryAssetKind = (
  assetType: PipelineType
): PipelineRegistryObjectKind => {
  if (assetType === 'templates') return 'template';
  if (assetType === 'elementPresets') return 'elementPreset';
  if (assetType === 'textures') return 'texture';
  if (assetType === 'dividers') return 'divider';
  if (assetType === 'icons') return 'icon';
  if (assetType === 'imageAssets') return 'image';
  if (assetType === 'fonts') return 'font';
  return 'set';
};

export const getAssetKindLabel = (
  kind: CardAssetOption['kind'] | 'font' | 'set',
  options: { plural?: boolean } = {},
): string => {
  const labels = assetKindLabels[kind];
  return options.plural ? labels.plural : labels.singular;
};

export const getPipelineTypeLabel = (
  assetType: PipelineType,
  options: { plural?: boolean } = { plural: true },
): string => getAssetKindLabel(pipelineTypeToRegistryAssetKind(assetType), options);

export const getPipelineStudioDestinationOptions = (
  assetType: PipelineType,
): StudioAssetDestination[] => {
  if (assetType === 'templates') return ['template.front', 'template.back'];
  if (assetType === 'elementPresets') {
    return ['style.material', 'style.border', 'style.textFrame', 'style.shape', 'style.divider', 'style.icon'];
  }
  if (assetType === 'textures') return ['appearance.texture'];
  if (assetType === 'dividers') return ['element.divider'];
  if (assetType === 'icons') return ['element.icon'];
  if (assetType === 'imageAssets') {
    return ['image.picture', 'image.frame.front', 'image.frame.back', 'image.border.front', 'image.border.back'];
  }
  if (assetType === 'fonts') return ['typography.font'];
  return [];
};

export const getDefaultPipelineStudioDestination = (
  assetType: PipelineType,
): StudioAssetDestination | null => getPipelineStudioDestinationOptions(assetType)[0] ?? null;

export const getPipelineStudioDestinationLabel = (
  destination: StudioAssetDestination,
): string => getStudioAssetDestinationDefinition(destination).label;

export const getPipelineStatusLabel = (status: PipelineStatus | 'localOnly'): string => {
  if (status === 'publish_candidate') return 'Publish Candidate';
  if (status === 'localOnly') return 'Local only';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

export const getPipelineStatusDescription = (status: PipelineStatus | 'localOnly'): string => {
  if (status === 'draft') return 'Work started but not ready for review.';
  if (status === 'submitted') return 'Received by the pipeline and waiting for active review.';
  if (status === 'voting') return 'Open for Contributor thumbs-up and thumbs-down signals.';
  if (status === 'publish_candidate') return 'Has enough signal to be considered for a live library slot.';
  if (status === 'published') return 'Currently available through the shared CardForge library.';
  if (status === 'archived') return 'Retired from active use, but still visible for recovery voting.';
  if (status === 'rejected') return 'Closed by owner review and no longer moving through the pipeline.';
  return 'Stored only in this browser workspace and not submitted to Forge Review.';
};

export const getPipelineTierLabel = (tier: PipelineAccessTier): string => {
  if (tier === 'free') return 'Starter Library';
  if (tier === 'paid') return 'Creator Pass';
  if (tier === 'developer') return 'Pipeline Only';
  return 'Not Live';
};

export const getPipelineTierDescription = (tier: PipelineAccessTier): string => {
  if (tier === 'free') return 'Published into the free Starter Library.';
  if (tier === 'paid') return 'Published into the paid Creator Pass library.';
  if (tier === 'developer') return 'Kept inside the Contributor Pipeline and not loaded into creator-facing Studio libraries.';
  return 'Archived, rejected, or owner-held outside the creator-facing Studio libraries.';
};

const pipelineDecisionReasonLabels: Record<string, string> = {
  contributor_review: 'Gathering contributor review signal.',
  needs_more_votes: 'Gathering contributor review signal.',
  below_free_threshold: 'Below the current Starter Library signal.',
  paid_candidate: 'Qualifies for Creator Pass placement.',
  free_candidate: 'Qualifies for Starter Library placement.',
  tier_cap_full: 'Waiting for room in a published tier.',
  hidden_status: 'Hidden because this submission is not currently published.',
  owner_forced_hidden: 'The CardForge owner placed this work outside the shared Library.',
  owner_forced_free: 'The CardForge owner placed this work in the Starter Library.',
  owner_forced_paid: 'The CardForge owner placed this work in Creator Pass.',
  owner_forced_official: 'The CardForge owner classified this as official CardForge content.',
  owner_status_override: 'The CardForge owner set the current lifecycle.',
  pipeline_owner_edit: 'Submission details were updated by the CardForge owner.',
  superseded_revision: 'A newer revision now represents this work.',
  owner_deleted_from_library: 'The CardForge owner removed this work from the shared Library.',
  published: 'Published after CardForge review.',
};

export const getPipelineDecisionReasonLabel = (reason: string | null | undefined): string => (
  reason ? pipelineDecisionReasonLabels[reason] ?? 'Placement reflects the current Pipeline rules.' : 'Gathering contributor review signal.'
);

export const getLibrarySourceLabel = (source?: CardAssetOption['librarySource']): string => {
  if (source === 'local') return 'Local only';
  if (source === 'developer') return 'Contributor upload';
  return 'Forge Library';
};

export const isLocalOnlyAsset = (asset: Pick<CardAssetOption, 'librarySource' | 'registryStatus'>): boolean =>
  asset.librarySource === 'local' || asset.registryStatus === 'localOnly';

export const normalizeLocalLibraryAsset = (asset: CardAssetOption): CardAssetOption => ({
  ...asset,
  librarySource: 'local',
  accessTier: undefined,
  registryStatus: 'localOnly',
});

export const getAssetBadgeSummary = (asset: CardAssetOption): string[] => {
  if (isLocalOnlyAsset(asset)) {
    return ['Local only', getAssetKindLabel(asset.kind)];
  }

  return [
    getLibrarySourceLabel(asset.librarySource),
    getAssetKindLabel(asset.kind),
    asset.packName,
  ].filter((label): label is string => Boolean(label));
};
