import {
  DEVELOPER_ASSET_STATUSES,
  type DeveloperAssetAccessTier,
  type DeveloperAssetStatus,
  type DeveloperAssetType,
} from '@/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';
import type { CardAssetOption } from '@/lib/cardAssets';
import {
  getDeveloperAssetStatusDescription,
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierDescription,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/lib/pipelineAssetTaxonomy';

export type DeveloperAssetSubmission = DeveloperAssetProgramView['submissions'][number];
export type VoteFilter = 'all' | 'unvoted' | 'upvoted' | 'downvoted';
export type PersonalLibraryFilter = DeveloperAssetType | 'all';

export interface PersonalLibraryItem {
  id: string;
  name: string;
  sourceLabel: string;
  assetType: DeveloperAssetType;
  fileName: string;
  helperText: string;
  previewUrl?: string;
  createFile: () => Promise<File>;
}

export interface DeveloperAssetSubmissionGuidance {
  destination: string;
  sourceLabel: string;
  sourceHelp: string;
  acceptedFileTypes: string;
  accept: string;
  notesHelp: string;
  checklist: [string, string, string];
}

export const reviewQueueHelp = 'All voteable assets live in one lane. Use status, tier, family, and vote filters to narrow new uploads, publish candidates, live library assets, and recoverable archived assets.';

export const developerAssetSubmissionGuidance: Record<DeveloperAssetType, DeveloperAssetSubmissionGuidance> = {
  templates: {
    destination: 'Layout Studio template library',
    sourceLabel: 'Template JSON',
    sourceHelp: 'Submit a saved CardForge template JSON so reviewers can inspect the full canvas, layers, sample text, and generator-ready fields.',
    acceptedFileTypes: 'JSON template export',
    accept: '.json,application/json',
    notesHelp: 'Mention the card genre, intended generator fields, readable text constraints, and any layout assumptions.',
    checklist: ['Complete layout', 'Readable sample text', 'Generator fields named clearly'],
  },
  elementPresets: {
    destination: 'Layout Studio recipe and preset tools',
    sourceLabel: 'Preset or style JSON',
    sourceHelp: 'Submit a structured recipe, appearance style, or element preset JSON that can apply predictably to a specific element role.',
    acceptedFileTypes: 'JSON recipe or style export',
    accept: '.json,application/json',
    notesHelp: 'Mention which element roles it applies to, what visual state it creates, and when creators should use it.',
    checklist: ['Specific element role', 'Visible style change', 'Reusable naming'],
  },
  textures: {
    destination: 'Texture swatches and fills',
    sourceLabel: 'Texture image',
    sourceHelp: 'Submit a tileable or full-surface texture image that can be applied to panels, frames, shapes, or backgrounds.',
    acceptedFileTypes: 'PNG, JPG, WEBP, or SVG',
    accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
    notesHelp: 'Mention tile behavior, best surfaces, color range, and whether the texture should repeat or stretch.',
    checklist: ['Works at small size', 'Clear repeat/stretch intent', 'Readable behind text'],
  },
  dividers: {
    destination: 'Divider rails and section breaks',
    sourceLabel: 'Divider image',
    sourceHelp: 'Submit a horizontal or decorative divider asset that separates rules text, stats, titles, or card sections.',
    acceptedFileTypes: 'SVG, PNG, or WEBP',
    accept: '.svg,.png,.webp,image/svg+xml,image/png,image/webp',
    notesHelp: 'Mention orientation, ideal width, whether it stretches, and which card sections it is meant to separate.',
    checklist: ['Clear at narrow widths', 'Stretch intent noted', 'Section role described'],
  },
  icons: {
    destination: 'Icon picker and symbol controls',
    sourceLabel: 'Icon image',
    sourceHelp: 'Submit a clean icon or symbol that remains readable at small sizes in stats, labels, costs, and badges.',
    acceptedFileTypes: 'SVG, PNG, or WEBP',
    accept: '.svg,.png,.webp,image/svg+xml,image/png,image/webp',
    notesHelp: 'Mention semantic use, minimum readable size, color expectations, and whether it should be recolorable.',
    checklist: ['Readable at small size', 'Semantic use named', 'Transparent background preferred'],
  },
  imageAssets: {
    destination: 'Image asset picker',
    sourceLabel: 'Image asset',
    sourceHelp: 'Submit reusable illustration, placeholder, or image-frame content that creators can place directly on a card.',
    acceptedFileTypes: 'PNG, JPG, WEBP, or SVG',
    accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
    notesHelp: 'Mention intended crop, aspect ratio, visual style, and whether the asset is a placeholder or finished art.',
    checklist: ['Crop intent clear', 'Aspect ratio noted', 'Source rights described'],
  },
  parts: {
    destination: 'Overlay asset and frame-part picker',
    sourceLabel: 'Overlay image',
    sourceHelp: 'Submit a reusable ornament, frame piece, plate, flourish, or overlay that can sit on top of layouts.',
    acceptedFileTypes: 'SVG, PNG, or WEBP',
    accept: '.svg,.png,.webp,image/svg+xml,image/png,image/webp',
    notesHelp: 'Mention target placement, stacking behavior, resize constraints, and which element or card surface it decorates.',
    checklist: ['Transparent edges', 'Placement intent clear', 'Scales without artifacts'],
  },
};

export const assetTierOrder: DeveloperAssetAccessTier[] = ['hidden', 'free', 'paid', 'developer'];

export const tierClasses: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'border-[#4a3823] text-[#8f95a3]',
  free: 'border-[#5f7f54] text-[#bde3a8]',
  paid: 'border-[#8a642f] text-[#f0c568]',
  developer: 'border-[#35445a] text-[#b9d5ff]',
};

export const statusGlossary = DEVELOPER_ASSET_STATUSES.map((status) => ({
  label: getDeveloperAssetStatusLabel(status),
  body: getDeveloperAssetStatusDescription(status),
}));

export const tierGlossary = assetTierOrder.map((tier) => ({
  label: getDeveloperAssetTierLabel(tier),
  body: getDeveloperAssetTierDescription(tier),
}));

export const getReviewProgressLabel = (
  submission: Pick<DeveloperAssetSubmission, 'positiveVotes' | 'negativeVotes'>,
  minimumVotes: number,
) => {
  const totalVotes = Math.max(0, submission.positiveVotes) + Math.max(0, submission.negativeVotes);
  if (totalVotes >= minimumVotes) return `${totalVotes}/${minimumVotes} votes ready`;
  return `${Math.max(0, minimumVotes - totalVotes)} more vote${minimumVotes - totalVotes === 1 ? '' : 's'} needed`;
};

export const getReviewProgressPercent = (
  submission: Pick<DeveloperAssetSubmission, 'positiveVotes' | 'negativeVotes'>,
  minimumVotes: number,
) => {
  const totalVotes = Math.max(0, submission.positiveVotes) + Math.max(0, submission.negativeVotes);
  return Math.min(100, Math.round((totalVotes / Math.max(1, minimumVotes)) * 100));
};

export const getSubmissionNextStep = (
  submission: DeveloperAssetSubmission,
  program: Pick<DeveloperAssetProgramView, 'settings'>,
) => {
  const totalVotes = Math.max(0, submission.positiveVotes) + Math.max(0, submission.negativeVotes);
  const needsVotes = totalVotes < program.settings.minimumVotesForGrading
    || totalVotes < program.settings.minimumVotesForTierAssignment;

  if (submission.status === 'published') {
    return 'Live in the shared library. Developers can still vote, and future rule/cap changes can re-rank it.';
  }
  if (submission.status === 'archived') {
    return 'Archived from active use. Strong recovery voting can help the owner consider bringing it back.';
  }
  if (submission.status === 'rejected') {
    return 'Closed by owner review. Use the notes and submit a stronger version if it still belongs in the library.';
  }
  if (needsVotes) {
    return `Needs more developer signal before the pipeline can grade status and tier. ${getReviewProgressLabel(submission, Math.max(program.settings.minimumVotesForGrading, program.settings.minimumVotesForTierAssignment))}.`;
  }
  if (submission.status === 'publish_candidate') {
    return program.settings.ownerFinalReviewRequired
      ? 'Meets vote signal and is waiting on owner review or an open library slot.'
      : 'Meets vote signal and can publish when there is room in the matching library cap.';
  }
  if (submission.calculatedAccessTier === 'hidden') {
    return 'Vote quality is below the current threshold, so it is not visible to creators yet.';
  }
  return 'Gathering review signal. Votes, quality threshold, and open caps decide where it goes next.';
};

export const getApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const isEditableSubmission = (submission: DeveloperAssetSubmission, currentUserId: string) => (
  submission.developerId === currentUserId
  && submission.status !== 'published'
  && submission.status !== 'rejected'
);

export const isCurrentContributorSubmission = (
  submission: DeveloperAssetSubmission,
  program: DeveloperAssetProgramView,
) => program.currentContributorIds.includes(submission.developerId);

export const getSearchableSubmissionText = (submission: DeveloperAssetSubmission) => [
  submission.name,
  submission.description,
  submission.developerEmail ?? '',
  submission.developerDisplayName ?? '',
  submission.developerFirstName ?? '',
  submission.developerLastName ?? '',
  getDeveloperAssetTypeLabel(submission.assetType, { plural: false }),
  getDeveloperAssetStatusLabel(submission.status),
  getDeveloperAssetTierLabel(submission.calculatedAccessTier),
  submission.tierDecisionReason ?? '',
  submission.decisionReason ?? '',
].join(' ').toLowerCase();

export const getContributorLabel = (submission: DeveloperAssetSubmission) => {
  if (submission.developerDisplayName) return submission.developerDisplayName;
  return submission.developerEmail ?? submission.developerId;
};

export const canRenderImagePreview = (submission: DeveloperAssetSubmission) => (
  Boolean(submission.previewUrl)
  && !submission.previewUrl.startsWith('/api/templates')
  && !submission.previewUrl.startsWith('/api/styles')
);

export const getTemplatePreviewId = (submission: DeveloperAssetSubmission): string | null => {
  if (submission.assetType !== 'templates') return null;
  const templateUrl = [submission.previewUrl, submission.sourceUrl]
    .find((url) => url?.startsWith('/api/templates#'));
  return templateUrl?.split('#')[1] || null;
};

export const slugifyFileName = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
};

export const getExtensionForMimeType = (mimeType: string) => {
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'application/json') return 'json';
  return 'bin';
};

export const getExtensionForAssetUrl = (url: string) => {
  if (url.startsWith('data:')) {
    const mimeType = url.match(/^data:([^;,]+)/)?.[1] ?? '';
    return getExtensionForMimeType(mimeType);
  }
  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  return extension && ['svg', 'png', 'jpg', 'jpeg', 'webp', 'json'].includes(extension) ? extension : 'asset';
};

export const readStoredCardAssets = (storageKey: string): CardAssetOption[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as CardAssetOption[] : [];
  } catch {
    return [];
  }
};

export const createJsonFile = (payload: unknown, fileName: string) => (
  new File([JSON.stringify(payload, null, 2)], fileName, { type: 'application/json' })
);

export const createAssetFile = async (asset: CardAssetOption, fileNameStem: string) => {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`Unable to read ${asset.name}.`);
  const blob = await response.blob();
  const mimeType = blob.type || (asset.url.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'application/octet-stream');
  const extension = getExtensionForMimeType(mimeType);
  return new File([blob], `${fileNameStem}.${extension}`, { type: mimeType });
};
