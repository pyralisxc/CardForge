import {
  DEVELOPER_ASSET_STATUSES,
  type DeveloperAssetAccessTier,
  type DeveloperUploadAssetType,
} from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import type { CardAssetOption } from '@/features/developer-assets/lib/cardAssets';
import {
  getDeveloperAssetStatusDescription,
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierDescription,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/features/developer-assets/lib/pipelineAssetTaxonomy';

export type DeveloperAssetSubmission = DeveloperAssetProgramView['submissions'][number];
export type VoteFilter = 'all' | 'unvoted' | 'upvoted' | 'downvoted';
export type PersonalLibraryFilter = DeveloperUploadAssetType | 'all';

export interface PersonalLibraryItem {
  id: string;
  name: string;
  sourceLabel: string;
  assetType: DeveloperUploadAssetType;
  fileName: string;
  helperText: string;
  previewUrl?: string;
  createFile: () => Promise<File>;
}

export const deduplicatePersonalLibraryItems = (
  items: PersonalLibraryItem[],
): PersonalLibraryItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identity = `${item.assetType}:${item.id}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

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

export const developerAssetSubmissionGuidance: Record<DeveloperUploadAssetType, DeveloperAssetSubmissionGuidance> = {
  textures: {
    destination: 'Texture swatches and fills',
    sourceLabel: 'Texture image',
    sourceHelp: 'Submit a genuinely repeatable or scalable surface texture for fills. Finished card faces belong under Images as Front or Back Frames.',
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
    destination: 'Picture picker or front/back Frame library',
    sourceLabel: 'Picture or Frame image',
    sourceHelp: 'Submit ordinary artwork as a Picture, or a full-card visual surface as a Front or Back Frame. Templates remain the editable structure.',
    acceptedFileTypes: 'PNG, JPG, WEBP, or SVG',
    accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
    notesHelp: 'Mention intended crop, aspect ratio, visual style, and whether the asset is a placeholder or finished art.',
    checklist: ['Crop intent clear', 'Aspect ratio noted', 'Source rights described'],
  },
  fonts: {
    destination: 'Studio typography picker',
    sourceLabel: 'Font file',
    sourceHelp: 'Submit a web-usable font file that can become a reviewed text family in Template Studio after approval.',
    acceptedFileTypes: 'WOFF2, WOFF, TTF, or OTF',
    accept: '.woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf,application/font-woff,application/x-font-ttf,application/x-font-otf,application/octet-stream',
    notesHelp: 'Mention license rights, best text role, readable size range, category, and whether it is display-only or body-safe.',
    checklist: ['License rights clear', 'Readable sample role', 'Weights/styles noted'],
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
  const needsVotes = totalVotes < program.settings.minimumVotesForGrading;

  if (submission.status === 'published') {
    return submission.ownerStatusOverride
      ? 'Live in the shared library under an owner override. Voting still updates the automatic recommendation underneath.'
      : 'Live in the shared library through automatic ranking. Votes and capacity changes can re-rank it.';
  }
  if (submission.status === 'archived') {
    return submission.ownerStatusOverride
      ? 'Retired by an owner override. Voting still updates the automatic recommendation until the override is cleared.'
      : 'Automatically retired from active use. Stronger recovery voting can return it to the live library.';
  }
  if (submission.status === 'rejected') {
    return 'Closed by owner review. Use the notes and submit a stronger version if it still belongs in the library.';
  }
  if (submission.status === 'submitted' && submission.assetType === 'templates' && submission.revisionNumber != null) {
    return 'Waiting for the owner to compare and approve this Template revision. The current shared Template stays live until the owner publishes it.';
  }
  if (needsVotes) {
    return `Needs more developer signal before the pipeline can grade status and tier. ${getReviewProgressLabel(submission, program.settings.minimumVotesForGrading)}.`;
  }
  if (submission.status === 'publish_candidate') {
    return 'Meets vote signal and is waiting for room in the matching Starter or Creator Pass capacity.';
  }
  if (submission.calculatedAccessTier === 'hidden') {
    return 'Vote quality is below the current threshold, so it is not visible to creators yet.';
  }
  return 'Gathering review signal. Votes, quality threshold, and open caps decide where it goes next.';
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

export const getCandidateSourceEmptyMessage = (assetType: DeveloperUploadAssetType): string => {
  if (assetType === 'fonts') {
    return 'Fonts are submitted from a local font file. Use the font file drop zone or browse for WOFF2, WOFF, TTF, or OTF.';
  }
  return 'Save a template or upload local art in Studio first, then it will appear here as a review candidate source.';
};

export const getCandidateBrowseLabel = (assetType: DeveloperUploadAssetType): string => {
  if (assetType === 'fonts') return 'Drop or browse a font file';
  return 'Drop a file or browse';
};

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
  submission.automatedStatus,
  submission.ownerStatusOverride ?? '',
].join(' ').toLowerCase();

export const getContributorLabel = (submission: DeveloperAssetSubmission) => {
  if (submission.developerDisplayName) return submission.developerDisplayName;
  return submission.developerEmail ?? submission.developerId;
};

export const canRenderImagePreview = (submission: DeveloperAssetSubmission) => (
  Boolean(submission.previewUrl)
  && submission.assetType !== 'fonts'
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
  if (mimeType === 'font/woff2') return 'woff2';
  if (mimeType === 'font/woff' || mimeType === 'application/font-woff') return 'woff';
  if (mimeType === 'font/ttf' || mimeType === 'application/x-font-ttf') return 'ttf';
  if (mimeType === 'font/otf' || mimeType === 'application/x-font-otf') return 'otf';
  return 'bin';
};

export const getExtensionForAssetUrl = (url: string) => {
  if (url.startsWith('data:')) {
    const mimeType = url.match(/^data:([^;,]+)/)?.[1] ?? '';
    return getExtensionForMimeType(mimeType);
  }
  const extension = url.split('?')[0]?.split('.').pop()?.toLowerCase();
  return extension && ['svg', 'png', 'jpg', 'jpeg', 'webp', 'woff2', 'woff', 'ttf', 'otf'].includes(extension) ? extension : 'asset';
};

export const createAssetFile = async (asset: CardAssetOption, fileNameStem: string) => {
  const response = await fetch(asset.url);
  if (!response.ok) throw new Error(`Unable to read ${asset.name}.`);
  const blob = await response.blob();
  const mimeType = blob.type || (asset.url.startsWith('data:image/svg+xml') ? 'image/svg+xml' : 'application/octet-stream');
  const extension = getExtensionForMimeType(mimeType);
  return new File([blob], `${fileNameStem}.${extension}`, { type: mimeType });
};
