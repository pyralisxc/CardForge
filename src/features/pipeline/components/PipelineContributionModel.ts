import { type PipelineAccessTier, type ContributorUploadAssetType } from '@/features/pipeline/lib/pipelineItems';
import type { PipelineProgramView } from '@/features/pipeline/lib/pipelineProgram';
import type { CardAssetOption } from '@/features/pipeline/lib/cardAssets';
import { getPipelineImagePreviewUrl } from '@/features/pipeline/lib/pipelineLibrary';
import {
  getPipelineStatusLabel,
  getPipelineTierLabel,
  getPipelineTypeLabel,
} from '@/features/pipeline/lib/pipelineAssetTaxonomy';

export type PipelineSubmission = PipelineProgramView['submissions'][number];
export type PersonalLibraryFilter = ContributorUploadAssetType | 'all';

export interface PersonalLibraryItem {
  id: string;
  name: string;
  sourceLabel: string;
  assetType: ContributorUploadAssetType;
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

export interface PipelineSubmissionGuidance {
  destination: string;
  sourceLabel: string;
  sourceHelp: string;
  acceptedFileTypes: string;
  accept: string;
  notesHelp: string;
  checklist: [string, string, string];
}

export const pipelineSubmissionGuidance: Record<ContributorUploadAssetType, PipelineSubmissionGuidance> = {
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
  sets: {
    destination: 'Published Set starters in Desk and Library',
    sourceLabel: 'Portable Set package',
    sourceHelp: 'Submit one complete Set as the exact portable .cardforge package creators will instantiate as independent work.',
    acceptedFileTypes: 'CardForge project package',
    accept: '.cardforge,application/vnd.cardforge.project+zip,application/octet-stream',
    notesHelp: 'Describe the Set’s purpose, card count, included Templates, specialties, and what a creator can safely customize.',
    checklist: ['One complete Set', 'Portable import verified', 'Editable contents reviewed'],
  },
};

export const tierClasses: Record<PipelineAccessTier, string> = {
  hidden: 'border-[#4a3823] text-[#8f95a3]',
  free: 'border-[#5f7f54] text-[#bde3a8]',
  paid: 'border-[#8a642f] text-[#f0c568]',
  developer: 'border-[#35445a] text-[#b9d5ff]',
};

export const getReviewProgressLabel = (
  submission: Pick<PipelineSubmission, 'positiveVotes' | 'negativeVotes'>,
  minimumVotes: number,
) => {
  const totalVotes = Math.max(0, submission.positiveVotes) + Math.max(0, submission.negativeVotes);
  if (totalVotes >= minimumVotes) return `${totalVotes}/${minimumVotes} votes ready`;
  return `${Math.max(0, minimumVotes - totalVotes)} more vote${minimumVotes - totalVotes === 1 ? '' : 's'} needed`;
};

export const getReviewProgressPercent = (
  submission: Pick<PipelineSubmission, 'positiveVotes' | 'negativeVotes'>,
  minimumVotes: number,
) => {
  const totalVotes = Math.max(0, submission.positiveVotes) + Math.max(0, submission.negativeVotes);
  return Math.min(100, Math.round((totalVotes / Math.max(1, minimumVotes)) * 100));
};

export const getSubmissionNextStep = (
  submission: PipelineSubmission,
  program: Pick<PipelineProgramView, 'settings'>,
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
    return `Needs more Contributor signal before the Pipeline can grade status and tier. ${getReviewProgressLabel(submission, program.settings.minimumVotesForGrading)}.`;
  }
  if (submission.status === 'publish_candidate') {
    return 'Meets vote signal and is waiting for room in the matching Starter or Creator Pass capacity.';
  }
  if (submission.calculatedAccessTier === 'hidden') {
    return 'Vote quality is below the current threshold, so it is not visible to creators yet.';
  }
  return 'Gathering review signal. Votes, quality threshold, and open caps decide where it goes next.';
};

export const getCandidateSourceEmptyMessage = (assetType: ContributorUploadAssetType): string => {
  if (assetType === 'sets') return 'Create a Set on Desk or in Studio first, then select its portable package here.';
  if (assetType === 'fonts') {
    return 'Fonts are submitted from a local font file. Use the font file drop zone or browse for WOFF2, WOFF, TTF, or OTF.';
  }
  return 'Save a template or upload local art in Studio first, then it will appear here as a review candidate source.';
};

export const getCandidateBrowseLabel = (assetType: ContributorUploadAssetType): string => {
  if (assetType === 'sets') return 'Choose a Set above or browse a .cardforge package';
  if (assetType === 'fonts') return 'Drop or browse a font file';
  return 'Drop a file or browse';
};

export const getSearchableSubmissionText = (submission: PipelineSubmission) => [
  submission.name,
  submission.description,
  submission.contributorEmail ?? '',
  submission.contributorDisplayName ?? '',
  submission.contributorFirstName ?? '',
  submission.contributorLastName ?? '',
  getPipelineTypeLabel(submission.assetType, { plural: false }),
  getPipelineStatusLabel(submission.status),
  getPipelineTierLabel(submission.calculatedAccessTier),
  submission.tierDecisionReason ?? '',
  submission.decisionReason ?? '',
  submission.automatedStatus,
  submission.ownerStatusOverride ?? '',
].join(' ').toLowerCase();

export const getContributorLabel = (submission: PipelineSubmission) => {
  if (submission.contributorDisplayName) return submission.contributorDisplayName;
  return submission.contributorEmail ?? submission.contributorId;
};

export const canRenderImagePreview = (submission: PipelineSubmission) => (
  submission.assetType !== 'fonts'
  && submission.assetType !== 'sets'
  && Boolean(getPipelineImagePreviewUrl(submission))
);

export const getTemplatePreviewId = (submission: PipelineSubmission): string | null => {
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
  if (mimeType === 'application/vnd.cardforge.project+zip') return 'cardforge';
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
