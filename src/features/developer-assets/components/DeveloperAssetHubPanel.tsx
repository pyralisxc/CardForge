"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Check, FileUp, Library, Pencil, Search, UploadCloud, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { DEVELOPER_ASSET_STATUSES, DEVELOPER_ASSET_TYPES, type DeveloperAssetAccessTier, type DeveloperAssetStatus, type DeveloperAssetType } from '@/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';
import type { CardAssetOption } from '@/lib/cardAssets';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
} from '@/lib/projectDocument';
import {
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/lib/pipelineAssetTaxonomy';
import { useAppStore } from '@/store/appStore';
import type { TCGCardTemplate } from '@/types';
import {
  createAssetFile,
  createJsonFile,
  assetTierOrder,
  getApiErrorMessage,
  getExtensionForAssetUrl,
  getSearchableSubmissionText,
  getTemplatePreviewId,
  isCurrentContributorSubmission,
  isEditableSubmission,
  readStoredCardAssets,
  reviewLaneHelp,
  reviewLaneLabels,
  slugifyFileName,
  statusGlossary,
  tierGlossary,
  type DeveloperAssetSubmission,
  type PersonalLibraryFilter,
  type PersonalLibraryItem,
  type ReviewLane,
  type VoteFilter,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';
import { AssetRow, EditSubmissionForm, QueuePager, VoteButtons } from '@/features/developer-assets/components/DeveloperAssetRows';
import { FieldHelp, GlossaryPanel, GuidanceCard, PipelineMetric, ProgramRule, QueueSelect, Stat } from '@/features/developer-assets/components/DeveloperAssetHubUi';

interface DeveloperAssetsResponse {
  program: DeveloperAssetProgramView;
}

interface UploadedDeveloperAsset {
  bucket: string;
  path: string;
  sourceUrl: string;
  previewUrl: string;
  fileSizeBytes: number;
  mimeType: string | null;
  fileName: string;
}

interface TemplateLibraryResponse {
  defaults: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
}

export function DeveloperAssetHubPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const userTemplates = useAppStore((state) => state.userTemplates);
  const appearanceStyles = useAppStore((state) => state.appearanceStyles);
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [assetType, setAssetType] = useState<DeveloperAssetType>('icons');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<UploadedDeveloperAsset | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [personalLibraryFilter, setPersonalLibraryFilter] = useState<PersonalLibraryFilter>('all');
  const [personalLibraryAssets, setPersonalLibraryAssets] = useState<{
    textures: CardAssetOption[];
    dividers: CardAssetOption[];
    icons: CardAssetOption[];
    imageAssets: CardAssetOption[];
  }>({ textures: [], dividers: [], icons: [], imageAssets: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewLane, setReviewLane] = useState<ReviewLane>('uploads');
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewType, setReviewType] = useState<DeveloperAssetType | 'all'>('all');
  const [reviewStatus, setReviewStatus] = useState<DeveloperAssetStatus | 'all'>('all');
  const [reviewTier, setReviewTier] = useState<DeveloperAssetAccessTier | 'all'>('all');
  const [reviewVoteFilter, setReviewVoteFilter] = useState<VoteFilter>('all');
  const [reviewPageSize, setReviewPageSize] = useState(10);
  const [reviewPage, setReviewPage] = useState(1);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPreviewUrl, setEditPreviewUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [templatePreviews, setTemplatePreviews] = useState<Record<string, TCGCardTemplate>>({});

  const ownSubmissions = useMemo(() => (
    program?.submissions.filter((submission) => isCurrentContributorSubmission(submission, program)) ?? []
  ), [program]);
  const liveLibraryCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.publishedCount, 0) ?? 0;
  const openDefaultSlotCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.openPublishSlots, 0) ?? 0;
  const reviewCandidateCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.candidateCount, 0) ?? 0;
  const archiveCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.archiveCount, 0) ?? 0;

  useEffect(() => {
    const loadPersonalLibraryAssets = () => {
      setPersonalLibraryAssets({
        textures: readStoredCardAssets(CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
        dividers: readStoredCardAssets(CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
        icons: readStoredCardAssets(CUSTOM_ICON_ASSETS_STORAGE_KEY),
        imageAssets: readStoredCardAssets(CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
      });
    };

    loadPersonalLibraryAssets();
    window.addEventListener('focus', loadPersonalLibraryAssets);
    return () => window.removeEventListener('focus', loadPersonalLibraryAssets);
  }, []);

  const personalLibraryItems = useMemo<PersonalLibraryItem[]>(() => {
    const templateItems = userTemplates
      .filter((template) => template.id)
      .map((template) => {
        const fileNameStem = slugifyFileName(template.name || template.id || 'template', 'template');
        return {
          id: `template-${template.id}`,
          name: template.name || template.id || 'Untitled template',
          sourceLabel: 'Saved template',
          assetType: 'templates' as const,
          fileName: `${fileNameStem}.template.json`,
          helperText: 'Saved in this browser. Export a project file when you need a portable backup.',
          previewUrl: `/api/templates#${template.id}`,
          createFile: async () => createJsonFile(template, `${fileNameStem}.template.json`),
        };
      });

    const styleItems = appearanceStyles
      .filter((style) => style.id && !style.id.startsWith('default-'))
      .map((style) => {
        const fileNameStem = slugifyFileName(style.name || style.id, 'appearance-style');
        return {
          id: `style-${style.id}`,
          name: style.name || style.id,
          sourceLabel: 'Appearance style',
          assetType: 'elementPresets' as const,
          fileName: `${fileNameStem}.style.json`,
          helperText: 'Saved Appearance Studio preset from this browser.',
          createFile: async () => createJsonFile(style, `${fileNameStem}.style.json`),
        };
      });

    const assetItems = ([
      ['textures', 'Local texture', personalLibraryAssets.textures],
      ['dividers', 'Local divider', personalLibraryAssets.dividers],
      ['icons', 'Local icon', personalLibraryAssets.icons],
      ['imageAssets', 'Local image', personalLibraryAssets.imageAssets],
    ] as const).flatMap(([assetTypeValue, sourceLabel, assets]) => assets.map((asset) => {
      const fileNameStem = slugifyFileName(asset.name || asset.id, assetTypeValue);
      return {
        id: `${assetTypeValue}-${asset.id}`,
        name: asset.name || asset.id,
        sourceLabel,
        assetType: assetTypeValue,
        fileName: `${fileNameStem}.${getExtensionForAssetUrl(asset.url)}`,
        helperText: asset.packName ? `Local asset from ${asset.packName}.` : 'Saved local art from Studio.',
        previewUrl: asset.url,
        createFile: async () => createAssetFile(asset, fileNameStem),
      };
    }));

    return [...templateItems, ...styleItems, ...assetItems];
  }, [appearanceStyles, personalLibraryAssets, userTemplates]);

  const visiblePersonalLibraryItems = useMemo(() => (
    personalLibraryFilter === 'all'
      ? personalLibraryItems
      : personalLibraryItems.filter((item) => item.assetType === personalLibraryFilter)
  ), [personalLibraryFilter, personalLibraryItems]);

  const reviewLaneSubmissions = useMemo(() => {
    if (!program) return [];
    const reviewableSubmissions = program.settings.allowContributorSelfVoting
      ? program.submissions
      : program.submissions.filter((submission) => !isCurrentContributorSubmission(submission, program));
    if (reviewLane === 'archive') return reviewableSubmissions.filter((submission) => submission.status === 'archived');
    if (reviewLane === 'defaults') return reviewableSubmissions.filter((submission) => submission.status === 'published');
    return reviewableSubmissions.filter((submission) => (
      submission.status !== 'published'
      && submission.status !== 'archived'
      && submission.status !== 'rejected'
      && submission.calculatedAccessTier !== 'official'
    ));
  }, [program, reviewLane]);

  const filteredReviewSubmissions = useMemo(() => {
    const query = reviewSearch.trim().toLowerCase();
    return reviewLaneSubmissions.filter((submission) => {
      if (query && !getSearchableSubmissionText(submission).includes(query)) return false;
      if (reviewType !== 'all' && submission.assetType !== reviewType) return false;
      if (reviewStatus !== 'all' && submission.status !== reviewStatus) return false;
      if (reviewTier !== 'all' && submission.calculatedAccessTier !== reviewTier) return false;
      if (reviewVoteFilter === 'unvoted' && submission.currentUserVote) return false;
      if (reviewVoteFilter === 'upvoted' && submission.currentUserVote !== 'positive') return false;
      if (reviewVoteFilter === 'downvoted' && submission.currentUserVote !== 'negative') return false;
      return true;
    });
  }, [reviewLaneSubmissions, reviewSearch, reviewStatus, reviewTier, reviewType, reviewVoteFilter]);

  const reviewPageCount = Math.max(1, Math.ceil(filteredReviewSubmissions.length / reviewPageSize));
  const visibleReviewSubmissions = filteredReviewSubmissions.slice(
    (Math.min(reviewPage, reviewPageCount) - 1) * reviewPageSize,
    Math.min(reviewPage, reviewPageCount) * reviewPageSize
  );

  useEffect(() => {
    setReviewPage(1);
  }, [reviewLane, reviewPageSize, reviewSearch, reviewStatus, reviewTier, reviewType, reviewVoteFilter]);

  const loadProgram = useCallback(async (attempt = 0) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/developer-assets', { cache: 'no-store' });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to load developer asset hub.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setIsLoading(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load developer asset hub.';
      if (attempt < 2) {
        window.setTimeout(() => {
          void loadProgram(attempt + 1);
        }, 1200);
        return;
      }
      setLoadError(message);
      toast({ title: 'Developer asset hub unavailable', description: message, variant: 'destructive' });
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  useEffect(() => {
    if (!program?.submissions.some((submission) => getTemplatePreviewId(submission))) return;
    let isMounted = true;

    const loadTemplatePreviews = async () => {
      try {
        const response = await fetch('/api/templates', { cache: 'no-store' });
        if (!response.ok) return;
        const body = await response.json() as TemplateLibraryResponse;
        if (!isMounted) return;
        setTemplatePreviews(Object.fromEntries(
          [...body.defaults, ...body.userTemplates]
            .filter((template): template is TCGCardTemplate & { id: string } => Boolean(template.id))
            .map((template) => [template.id, template])
        ));
      } catch {
        if (isMounted) setTemplatePreviews({});
      }
    };

    void loadTemplatePreviews();
    return () => {
      isMounted = false;
    };
  }, [program]);

  const selectCandidateFile = useCallback((file: File | null) => {
    setSelectedFile(file);
    setUploadedAsset(null);
    if (file && !name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, ''));
    }
  }, [name]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectCandidateFile(event.target.files?.[0] ?? null);
  };

  const handleCandidateDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    selectCandidateFile(event.dataTransfer.files?.[0] ?? null);
  };

  const choosePersonalLibraryItem = async (item: PersonalLibraryItem) => {
    try {
      const file = await item.createFile();
      setAssetType(item.assetType);
      setName((currentName) => currentName.trim() ? currentName : item.name);
      setDescription((currentDescription) => currentDescription.trim() ? currentDescription : item.helperText);
      setPreviewUrl((currentPreviewUrl) => currentPreviewUrl.trim() ? currentPreviewUrl : item.previewUrl ?? '');
      setSelectedFile(file);
      setUploadedAsset(null);
      setFileInputKey((key) => key + 1);
      toast({
        title: 'Personal library item selected',
        description: `${item.name} is ready to send through Forge Review.`,
      });
    } catch (error) {
      toast({
        title: 'Library item unavailable',
        description: error instanceof Error ? error.message : 'Unable to prepare that library item.',
        variant: 'destructive',
      });
    }
  };

  const uploadSelectedFile = async (): Promise<UploadedDeveloperAsset> => {
    if (!selectedFile) {
      throw new Error('Choose a source file before submitting.');
    }

    const formData = new FormData();
    formData.set('assetType', assetType);
    formData.set('file', selectedFile);

    const response = await fetch('/api/developer-assets/upload', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to upload source file.'));
    return response.json() as Promise<UploadedDeveloperAsset>;
  };

  const submitAsset = async () => {
    setIsSaving(true);
    try {
      if (!name.trim()) throw new Error('Name the asset before submitting.');
      const uploaded = selectedFile ? await uploadSelectedFile() : uploadedAsset;
      if (!uploaded) throw new Error('Choose a source file before submitting.');
      setUploadedAsset(uploaded);
      if (selectedFile) {
        setSelectedFile(null);
        setFileInputKey((key) => key + 1);
      }

      const response = await fetch('/api/developer-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType,
          name,
          description,
          previewUrl: previewUrl.trim() || uploaded.previewUrl,
          sourceUrl: uploaded.sourceUrl,
          sourceFileSizeBytes: uploaded.fileSizeBytes,
          sourceMimeType: uploaded.mimeType,
          sourceStorageBucket: uploaded.bucket,
          sourceStoragePath: uploaded.path,
        }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to submit asset.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      setName('');
      setDescription('');
      setPreviewUrl('');
      setSelectedFile(null);
      setUploadedAsset(null);
      setFileInputKey((key) => key + 1);
      toast({ title: 'Asset submitted', description: 'Your asset is now in the developer voting pipeline.' });
    } catch (error) {
      toast({
        title: 'Asset not submitted',
        description: error instanceof Error ? error.message : 'Unable to submit asset.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const vote = async (submissionId: string, voteValue: 'positive' | 'negative') => {
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteValue }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to submit vote.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      toast({ title: 'Vote recorded', description: 'The submission score has been updated.' });
    } catch (error) {
      toast({
        title: 'Vote not saved',
        description: error instanceof Error ? error.message : 'Unable to submit vote.',
        variant: 'destructive',
      });
    }
  };

  const beginEdit = (submission: DeveloperAssetSubmission) => {
    setEditingSubmissionId(submission.id);
    setEditName(submission.name);
    setEditDescription(submission.description);
    setEditPreviewUrl(submission.previewUrl);
    setExpandedSubmissionId(submission.id);
  };

  const cancelEdit = () => {
    setEditingSubmissionId(null);
    setEditName('');
    setEditDescription('');
    setEditPreviewUrl('');
  };

  const saveEdit = async (submissionId: string) => {
    setIsEditing(true);
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          previewUrl: editPreviewUrl,
        }),
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response, 'Unable to edit asset.'));
      const body = await response.json() as DeveloperAssetsResponse;
      setProgram(body.program);
      cancelEdit();
      toast({ title: 'Asset updated', description: 'Your submission details were saved.' });
    } catch (error) {
      toast({
        title: 'Asset not updated',
        description: error instanceof Error ? error.message : 'Unable to edit asset.',
        variant: 'destructive',
      });
    } finally {
      setIsEditing(false);
    }
  };

  if (isLoading) {
    return (
      <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
        <div className="border border-[#5f4526] bg-[#15100a] p-6 text-[#c7b288]">Loading developer asset hub...</div>
      </section>
    );
  }

  if (!program) {
    return (
      <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
        <div className="border border-[#7d5a2e] bg-[#181009] p-6 md:p-8">
          <div className="flex items-center gap-3 text-[#e2aa4a]">
            <UploadCloud className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Developer Asset Hub</span>
          </div>
          <h2 className="mt-4 font-serif text-2xl text-[#fff1c7]">Asset hub needs a refresh</h2>
          <p className="mt-3 text-sm leading-6 text-[#c7b288]">
            {loadError ?? 'The developer asset hub did not finish loading yet.'}
          </p>
          <Button
            className="mt-5 bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"
            onClick={() => void loadProgram()}
            disabled={isLoading}
          >
            {isLoading ? 'Reloading...' : 'Retry asset hub'}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <TooltipProvider>
    <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
      <div className="border border-[#7d5a2e] bg-[#15100a] p-6 md:p-8">
        <div className="flex items-center gap-3 text-[#e2aa4a]">
          <UploadCloud className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Developer Asset Hub</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Stat label="Submitted this month" value={program.developerStats.submitted} help="Assets you uploaded into the site pipeline this calendar month." />
          <Stat label="Published this month" value={program.developerStats.published} help="Your assets that reached published status this calendar month." />
          <Stat label="Required published" value={program.effectiveMonthlyPublishedRequirement} help="Your current monthly published asset expectation. Owners can set a base rule and adjust individual accounts." />
          <Stat label="Uploads left" value={program.remainingSubmissions} help="Uploads remaining before your monthly site-submission allowance is reached." />
        </div>

        <div className="mt-4 grid gap-3 border border-[#5f4526] bg-[#100c08] p-4 md:grid-cols-3">
          <ProgramRule label="Current defaults" value={liveLibraryCount} body="Published pipeline assets currently feeding the live site library." />
          <ProgramRule label="Open default slots" value={openDefaultSlotCount} body="Available published slots across all asset types before candidates have to wait." />
          <ProgramRule label="Review candidates" value={reviewCandidateCount} body="Uploads and publish candidates collecting signal before live library placement." />
        </div>

        <div className="mt-4 border border-[#5f4526] bg-[#100c08] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">Start here</p>
              <h3 className="mt-1 font-serif text-xl text-[#fff1c7]">Your developer loop is submit, review, track, improve.</h3>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
              onClick={() => void loadProgram()}
            >
              Refresh pipeline
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <GuidanceCard
              eyebrow="1. Submit"
              title={program.remainingSubmissions > 0 ? `${program.remainingSubmissions} uploads left` : 'Limit reached'}
              body={program.remainingSubmissions > 0
                ? 'Choose saved browser work or local files, then send the candidate through Forge Review.'
                : 'Your monthly submission allowance is used. Review and polish existing work until the next cycle.'}
              tone={program.remainingSubmissions > 0 ? 'ready' : 'warning'}
            />
            <GuidanceCard
              eyebrow="2. Review"
              title={`${reviewCandidateCount} candidates`}
              body={program.settings.allowContributorSelfVoting
                ? 'Self-voting is enabled, so you can review your own uploads and peer work.'
                : 'Self-voting is off, so your own uploads are hidden from your review queue.'}
            />
            <GuidanceCard
              eyebrow="3. Track"
              title={`${ownSubmissions.length} owned assets`}
              body="Use My Pipeline to expand previews, edit eligible uploads, and see why each asset is waiting, live, or archived."
            />
            <GuidanceCard
              eyebrow="4. Improve"
              title={`${archiveCount} archived`}
              body="Archived assets still accept voting signal, so strong recovered work can become worth another owner look."
            />
          </div>
        </div>

        <div className="mt-4 border border-[#5f4526] bg-[#100c08] p-4">
          <h3 className="font-serif text-xl text-[#fff1c7]">Future creator pool</h3>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">
            CardForge plans to reserve {program.settings.profitSharePoolPercent}% of eligible profit for approved active developers once the platform, payout systems, and terms are ready. The current plan is an even split among eligible contributors for the payout period; this is a roadmap commitment, not an active payout system yet.
          </p>
          <p className={`mt-2 text-xs ${program.profitShareEligible ? 'text-[#bde3a8]' : 'text-[#f0bd75]'}`}>
            Your current planning flag: {program.profitShareEligible ? 'eligible for future creator-pool tracking' : 'paused from future creator-pool tracking'}.
          </p>
          {program.developerOwnerNote ? (
            <p className="mt-2 border border-[#3c2c1b] bg-[#15100a] p-2 text-xs leading-5 text-[#a98a55]">
              Owner note: {program.developerOwnerNote}
            </p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-[#5f4526] bg-[#100c08] p-4">
            <h3 className="font-serif text-xl text-[#fff1c7]">How assets move</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Votes create quality signal, owner rules set the thresholds, and publish caps decide how many assets can be live in each family. Published assets stay voteable, archived assets can still earn recovery signal, and owner overrides are visible as tier reasons.
            </p>
          </div>
          <div className="grid gap-2 border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">
            <PipelineMetric label="Votes to grade" value={program.settings.minimumVotesForGrading} body="Minimum votes before the pipeline can judge pass/fail signal." />
            <PipelineMetric label="Positive threshold" value={`${program.settings.minimumPositiveVotePercent}%`} body="Quality score needed before an asset can become a publish candidate." />
            <PipelineMetric label="Starter / Pass" value={`${program.settings.freeAssetMinimumPositiveVotePercent}% / ${program.settings.paidAssetMinimumPositiveVotePercent}%`} body="Tier thresholds after the minimum tier-vote count is met." />
            <PipelineMetric label="Owner vote" value={`${program.settings.ownerVoteWeight}x`} body="Owner signal weight when the owner votes." />
            <PipelineMetric label="Self voting" value={program.settings.allowContributorSelfVoting ? 'On' : 'Off'} body="Controls whether your own assets appear in your review queue." />
            <PipelineMetric label="Owner review" value={program.settings.ownerFinalReviewRequired ? 'Required' : 'Automatic'} body="Controls whether passing candidates need final owner approval." />
          </div>
        </div>

        <Tabs defaultValue="submit" className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
            <TabsTrigger value="submit" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Submit</TabsTrigger>
            <TabsTrigger value="voting" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Review Queue</TabsTrigger>
            <TabsTrigger value="pipeline" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">My Pipeline</TabsTrigger>
            <TabsTrigger value="program" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Program</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
            <h3 className="font-serif text-xl text-[#fff1c7]">Submit a Library Candidate</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Site submissions enter the shared CardForge review pipeline. Local browser uploads remain private in your own workspace.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <GuidanceCard
                eyebrow="Before upload"
                title="Use the right family"
                body="Templates, recipes, textures, dividers, icons, images, and overlays each publish into different studio surfaces."
              />
              <GuidanceCard
                eyebrow="Before upload"
                title="Attach the real source"
                body="The source file is what the pipeline stores, previews, votes on, and eventually publishes."
              />
              <GuidanceCard
                eyebrow="Before upload"
                title="Explain the use case"
                body="Notes should tell reviewers where the asset belongs and what makes it useful."
              />
            </div>
            <div className="mt-4 grid gap-3">
              <label htmlFor="developer-asset-family" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Asset family
                  <FieldHelp text="Choose the accepted asset folder/type this submission belongs to so owners can cap and publish it correctly." />
                </span>
                <select
                  id="developer-asset-family"
                  className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value as DeveloperAssetType)}
                >
                  {DEVELOPER_ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>{getDeveloperAssetTypeLabel(type, { plural: false })}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="developer-asset-name" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Name
                  <FieldHelp text="Use a short library-facing name. This is what owners and peer reviewers see in queues." />
                </span>
                <input id="developer-asset-name" className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <div className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Candidate source
                  <FieldHelp text="Choose from your browser library, drag a local file here, or browse your file directory. All three routes submit through the same review pipeline." />
                </span>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                  <div className="border border-[#5f4526] bg-[#0c0b09] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[#ffe7ad]">
                        <Library className="h-4 w-4 text-[#d7b469]" />
                        <span className="font-medium">Personal Library</span>
                      </div>
                      <select
                        className="border border-[#5f4526] bg-[#100c08] px-2 py-1 text-xs text-[#ffe7ad]"
                        value={personalLibraryFilter}
                        onChange={(event) => setPersonalLibraryFilter(event.target.value as PersonalLibraryFilter)}
                      >
                        <option value="all">All saved</option>
                        {DEVELOPER_ASSET_TYPES.map((type) => (
                          <option key={type} value={type}>{getDeveloperAssetTypeLabel(type)}</option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#a98a55]">
                      Pull saved templates, Appearance Studio styles, and local art into Forge Review. Export a project file when you need to move this browser library to another device.
                    </p>
                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                      {visiblePersonalLibraryItems.length === 0 ? (
                        <p className="border border-dashed border-[#3c2c1b] p-3 text-xs leading-5 text-[#a98a55]">
                          Save a template or upload local art in Studio first, then it will appear here as a review candidate source.
                        </p>
                      ) : visiblePersonalLibraryItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="grid w-full grid-cols-[2.75rem,minmax(0,1fr)] gap-3 border border-[#3c2c1b] bg-[#100c08] p-2 text-left hover:border-[#d8b365] hover:bg-[#1e160d]"
                          onClick={() => void choosePersonalLibraryItem(item)}
                        >
                          <span className="grid h-11 w-11 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a]">
                            {item.previewUrl && !item.previewUrl.startsWith('/api/templates') ? (
                              <img src={item.previewUrl} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <FileUp className="h-4 w-4 text-[#d7b469]" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-[#ffe7ad]">{item.name}</span>
                            <span className="block text-xs text-[#a98a55]">{item.sourceLabel} - {getDeveloperAssetTypeLabel(item.assetType, { plural: false })}</span>
                            <span className="block truncate text-xs text-[#6f5b3a]">{item.fileName}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label
                    className={`grid min-h-56 cursor-pointer place-items-center border border-dashed p-5 text-center transition-colors ${isDragActive ? 'border-[#d8b365] bg-[#2a1b0d]' : 'border-[#5f4526] bg-[#0c0b09]'}`}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setIsDragActive(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={handleCandidateDrop}
                  >
                    <span className="grid gap-3">
                      <span className="mx-auto grid h-12 w-12 place-items-center border border-[#5f4526] bg-[#15100a] text-[#d7b469]">
                        <UploadCloud className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-medium text-[#ffe7ad]">Drop a file or browse</span>
                      <span className="text-xs leading-5 text-[#a98a55]">
                        SVG, PNG, JPG, WEBP, and JSON up to 10 MB.
                      </span>
                      <input
                        key={fileInputKey}
                        type="file"
                        aria-label="Asset source file"
                        accept=".svg,.png,.jpg,.jpeg,.webp,.json,image/svg+xml,image/png,image/jpeg,image/webp,application/json"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </span>
                  </label>
                </div>
                <span className="text-xs text-[#a98a55]">
                  {selectedFile
                    ? `${selectedFile.name} - ${Math.ceil(selectedFile.size / 1024)} KB selected`
                    : uploadedAsset
                      ? `${uploadedAsset.fileName} uploaded`
                      : 'No source selected yet.'}
                </span>
              </div>
              <label htmlFor="developer-asset-preview-url" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Preview URL (optional)
                  <FieldHelp text="Optional. Leave blank to use the uploaded source file as the visual preview." />
                </span>
                <input id="developer-asset-preview-url" className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
              </label>
              <label htmlFor="developer-asset-notes" className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Notes
                  <FieldHelp text="Mention intended use, style, licensing/source context, and anything reviewers need to know." />
                </span>
                <textarea id="developer-asset-notes" className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving || program.remainingSubmissions <= 0} onClick={submitAsset}>
                {isSaving ? 'Uploading...' : 'Send to Forge Review'}
              </Button>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="voting" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#fff1c7]">Continuous review queue</h3>
              <p className="mt-2 text-sm leading-6 text-[#c7b288]">
                Vote on candidate uploads, live library assets, and archived assets. Assets graduate into the shared library when there is room or enough vote signal, and archive votes can surface recovery candidates.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(reviewLaneLabels) as ReviewLane[]).map((lane) => (
                  <Button
                    key={lane}
                    size="sm"
                    variant="outline"
                    className={`border-[#5f4526] bg-transparent text-[#c7b288] hover:border-[#d8b365] hover:bg-[#1e160d] ${reviewLane === lane ? 'border-[#d8b365] bg-[#2a1b0d] text-[#ffe7ad]' : ''}`}
                    onClick={() => setReviewLane(lane)}
                  >
                    {reviewLaneLabels[lane]}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[#a98a55]">{reviewLaneHelp[reviewLane]}</p>
              <div className="mt-4 grid gap-3 border border-[#3c2c1b] bg-[#0c0b09] p-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(5,minmax(8rem,auto))]">
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
                  Search
                  <span className="flex items-center gap-2 border border-[#5f4526] bg-[#100c08] px-3">
                    <Search className="h-4 w-4 text-[#d7b469]" />
                    <input
                      className="min-h-10 w-full bg-transparent text-sm normal-case tracking-normal text-[#ffe7ad] outline-none"
                      value={reviewSearch}
                      onChange={(event) => setReviewSearch(event.target.value)}
                    />
                  </span>
                </label>
                <QueueSelect label="Family" value={reviewType} onChange={(value) => setReviewType(value as DeveloperAssetType | 'all')}>
                  <option value="all">All types</option>
                  {DEVELOPER_ASSET_TYPES.map((type) => <option key={type} value={type}>{getDeveloperAssetTypeLabel(type, { plural: false })}</option>)}
                </QueueSelect>
                <QueueSelect label="Status" value={reviewStatus} onChange={(value) => setReviewStatus(value as DeveloperAssetStatus | 'all')}>
                  <option value="all">All statuses</option>
                  {DEVELOPER_ASSET_STATUSES.map((status) => <option key={status} value={status}>{getDeveloperAssetStatusLabel(status)}</option>)}
                </QueueSelect>
                <QueueSelect label="Tier" value={reviewTier} onChange={(value) => setReviewTier(value as DeveloperAssetAccessTier | 'all')}>
                  <option value="all">All tiers</option>
                  {assetTierOrder.map((tier) => <option key={tier} value={tier}>{getDeveloperAssetTierLabel(tier)}</option>)}
                </QueueSelect>
                <QueueSelect label="Vote" value={reviewVoteFilter} onChange={(value) => setReviewVoteFilter(value as VoteFilter)}>
                  <option value="all">All votes</option>
                  <option value="unvoted">Unvoted</option>
                  <option value="upvoted">Upvoted</option>
                  <option value="downvoted">Downvoted</option>
                </QueueSelect>
                <QueueSelect label="Per page" value={String(reviewPageSize)} onChange={(value) => setReviewPageSize(Number(value))}>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </QueueSelect>
              </div>
              <div className="mt-4 space-y-3">
                {visibleReviewSubmissions.length === 0 ? (
                  <p className="text-sm text-[#c7b288]">No assets match this queue view.</p>
                ) : visibleReviewSubmissions.map((submission) => (
                    <AssetRow
                      key={submission.id}
                      submission={submission}
                      program={program}
                      templatePreviews={templatePreviews}
                      expanded={expandedSubmissionId === submission.id}
                      onToggleExpanded={() => setExpandedSubmissionId(expandedSubmissionId === submission.id ? null : submission.id)}
                    >
                    <VoteButtons submission={submission} onVote={vote} />
                  </AssetRow>
                ))}
              </div>
              <QueuePager
                page={Math.min(reviewPage, reviewPageCount)}
                pageCount={reviewPageCount}
                total={filteredReviewSubmissions.length}
                pageSize={reviewPageSize}
                onPrevious={() => setReviewPage((page) => Math.max(1, page - 1))}
                onNext={() => setReviewPage((page) => Math.min(reviewPageCount, page + 1))}
              />
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#fff1c7]">Your pipeline</h3>
              <div className="mt-4 space-y-3">
                {ownSubmissions.length === 0 ? (
                  <p className="text-sm text-[#c7b288]">Your submitted assets will appear here.</p>
                ) : ownSubmissions.map((submission) => (
                    <AssetRow
                      key={submission.id}
                      submission={submission}
                      program={program}
                      templatePreviews={templatePreviews}
                      expanded={expandedSubmissionId === submission.id}
                      onToggleExpanded={() => setExpandedSubmissionId(expandedSubmissionId === submission.id ? null : submission.id)}
                      editForm={editingSubmissionId === submission.id ? (
                      <EditSubmissionForm
                        name={editName}
                        description={editDescription}
                        previewUrl={editPreviewUrl}
                        isSaving={isEditing}
                        onNameChange={setEditName}
                        onDescriptionChange={setEditDescription}
                        onPreviewUrlChange={setEditPreviewUrl}
                        onCancel={cancelEdit}
                        onSave={() => saveEdit(submission.id)}
                      />
                    ) : null}
                  >
                    {isCurrentContributorSubmission(submission, program) && isEditableSubmission(submission, submission.developerId) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
                        onClick={() => beginEdit(submission)}
                        aria-label={`Edit ${submission.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : submission.status === 'published' ? <Check className="h-5 w-5 text-[#8be0a4]" /> : null}
                  </AssetRow>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="program" className="mt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <ProgramRule label="Submission allowance" value={program.effectiveMonthlySubmissionLimit} body="Site-library candidates you can submit this calendar month. This may be the base rule or an account-specific owner adjustment." />
              <ProgramRule label="Required published" value={program.effectiveMonthlyPublishedRequirement} body="Monthly published expectation currently assigned to your developer account." />
              <ProgramRule label="Minimum tier votes" value={program.settings.minimumVotesForTierAssignment} body="Votes required before an asset can move beyond Forge Review." />
            </div>
            <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-4 text-sm leading-6 text-[#c7b288]">
              Shared library assets are part of the same review surface as every upload. Developer votes and owner cap settings can move them between live library, candidate review, and archive. The planned creator pool is {program.settings.profitSharePoolPercent}% of eligible profit, split evenly among eligible active developers after the financial launch systems are ready.
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <GlossaryPanel title="Statuses" items={statusGlossary} />
              <GlossaryPanel title="Tiers" items={tierGlossary} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
    </TooltipProvider>
  );
}
