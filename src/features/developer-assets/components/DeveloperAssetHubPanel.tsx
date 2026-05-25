"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Archive, Check, ChevronLeft, ChevronRight, Eye, Info, Pencil, Save, Search, ThumbsDown, ThumbsUp, UploadCloud, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { CardPreview } from '@/components/card-forge/CardPreview';
import { TemplateThumbnail } from '@/components/card-forge/TemplateThumbnail';
import { DEVELOPER_ASSET_STATUSES, DEVELOPER_ASSET_TYPES, type DeveloperAssetAccessTier, type DeveloperAssetStatus, type DeveloperAssetType } from '@/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/lib/developerAssetStore';
import type { TCGCardTemplate } from '@/types';

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

type DeveloperAssetSubmission = DeveloperAssetProgramView['submissions'][number];
type ReviewLane = 'defaults' | 'uploads' | 'archive';
type VoteFilter = 'all' | 'unvoted' | 'upvoted' | 'downvoted';

const assetTypeLabels: Record<DeveloperAssetType, string> = {
  templates: 'Template',
  elementPresets: 'Element Preset',
  textures: 'Texture',
  dividers: 'Divider',
  icons: 'Icon',
  imageAssets: 'Image Asset',
  parts: 'Part',
};

const statusLabels: Record<DeveloperAssetStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  voting: 'Voting',
  publish_candidate: 'Publish Candidate',
  published: 'Published',
  archived: 'Archived',
  rejected: 'Rejected',
};

const reviewLaneLabels: Record<ReviewLane, string> = {
  defaults: 'Site Defaults',
  uploads: 'Candidate Uploads',
  archive: 'Archive',
};

const reviewLaneHelp: Record<ReviewLane, string> = {
  defaults: 'Published and official assets currently available to the site library. Developers can keep voting on them while they remain live.',
  uploads: 'New uploads and candidates gathering enough signal to fill open library caps or graduate into the default library.',
  archive: 'Retired or underperforming assets. Votes still count here so a strong recovery signal can surface them again.',
};

const tierLabels: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'Hidden',
  free: 'Starter Library',
  paid: 'Creator Pass',
  developer: 'Forge Review',
  official: 'Official Default',
};

const tierClasses: Record<DeveloperAssetAccessTier, string> = {
  hidden: 'border-[#4a3823] text-[#8f95a3]',
  free: 'border-[#5f7f54] text-[#bde3a8]',
  paid: 'border-[#8a642f] text-[#f0c568]',
  developer: 'border-[#35445a] text-[#b9d5ff]',
  official: 'border-[#d8b365] text-[#ffe7ad]',
};

const getApiErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await response.json() as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

const isEditableSubmission = (submission: DeveloperAssetSubmission, currentUserId: string) => (
  submission.developerId === currentUserId
  && submission.status !== 'published'
  && submission.status !== 'rejected'
);

const isCurrentContributorSubmission = (
  submission: DeveloperAssetSubmission,
  program: DeveloperAssetProgramView,
) => program.currentContributorIds.includes(submission.developerId);

const getSearchableSubmissionText = (submission: DeveloperAssetSubmission) => [
  submission.name,
  submission.description,
  submission.developerEmail ?? '',
  submission.developerDisplayName ?? '',
  submission.developerFirstName ?? '',
  submission.developerLastName ?? '',
  assetTypeLabels[submission.assetType],
  statusLabels[submission.status],
  tierLabels[submission.calculatedAccessTier],
  submission.tierDecisionReason ?? '',
  submission.decisionReason ?? '',
].join(' ').toLowerCase();

const getContributorLabel = (submission: DeveloperAssetSubmission) => {
  if (submission.developerDisplayName) return submission.developerDisplayName;
  if (submission.developerId === 'cardforge-official') return 'CardForge Owner';
  return submission.developerEmail ?? submission.developerId;
};

const canRenderImagePreview = (submission: DeveloperAssetSubmission) => (
  Boolean(submission.previewUrl)
  && !submission.previewUrl.startsWith('/api/templates')
  && !submission.previewUrl.startsWith('/api/styles')
);

const getTemplatePreviewId = (submission: DeveloperAssetSubmission): string | null => {
  if (submission.assetType !== 'templates') return null;
  const templateUrl = [submission.previewUrl, submission.sourceUrl]
    .find((url) => url?.startsWith('/api/templates#'));
  return templateUrl?.split('#')[1] || null;
};

export function DeveloperAssetHubPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [assetType, setAssetType] = useState<DeveloperAssetType>('icons');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<UploadedDeveloperAsset | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadedAsset(null);
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
          <Stat label="Required published" value={program.settings.monthlyPublishedRequirement} help="Owner-set monthly published asset expectation for active developers." />
          <Stat label="Uploads left" value={program.remainingSubmissions} help="Uploads remaining before your monthly site-submission allowance is reached." />
        </div>

        <div className="mt-4 grid gap-3 border border-[#5f4526] bg-[#100c08] p-4 md:grid-cols-3">
          <ProgramRule label="Current defaults" value={program.assetTypeSummaries.reduce((total, summary) => total + summary.publishedCount, 0)} body="Published assets currently feeding the site library from the registry." />
          <ProgramRule label="Open default slots" value={program.assetTypeSummaries.reduce((total, summary) => total + summary.openPublishSlots, 0)} body="Available published slots across all asset types before candidates have to wait." />
          <ProgramRule label="Owner defaults" value={program.assetTypeSummaries.reduce((total, summary) => total + summary.officialCount, 0)} body="Current site defaults credited to the CardForge Owner and governed by the same voting pipeline." />
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
            <h3 className="font-serif text-xl text-[#fff1c7]">Submit an asset</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Site submissions enter the shared CardForge review pipeline. Local browser uploads remain private in your own workspace.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Type
                  <FieldHelp text="Choose the accepted asset folder/type this submission belongs to so owners can cap and publish it correctly." />
                </span>
                <select
                  className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value as DeveloperAssetType)}
                >
                  {DEVELOPER_ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>{assetTypeLabels[type]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Name
                  <FieldHelp text="Use a short library-facing name. This is what owners and peer reviewers see in queues." />
                </span>
                <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Source file
                  <FieldHelp text="Upload the file that can become part of the shared CardForge library after voting and owner review." />
                </span>
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp,.json,image/svg+xml,image/png,image/jpeg,image/webp,application/json"
                  className="border border-dashed border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad] file:mr-3 file:border-0 file:bg-[#e4aa43] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[#140f0a]"
                  onChange={handleFileChange}
                />
                <span className="text-xs text-[#a98a55]">
                  {selectedFile
                    ? `${selectedFile.name} - ${Math.ceil(selectedFile.size / 1024)} KB selected`
                    : uploadedAsset
                      ? `${uploadedAsset.fileName} uploaded`
                      : 'Accepted: SVG, PNG, JPG, WEBP, and JSON up to 10 MB.'}
                </span>
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Preview override
                  <FieldHelp text="Optional. Leave blank to use the uploaded source file as the visual preview." />
                </span>
                <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={previewUrl} onChange={(event) => setPreviewUrl(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                <span className="flex items-center justify-between gap-2">
                  Notes
                  <FieldHelp text="Mention intended use, style, licensing/source context, and anything reviewers need to know." />
                </span>
                <textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving || program.remainingSubmissions <= 0} onClick={submitAsset}>
                {isSaving ? 'Uploading...' : 'Submit to voting'}
              </Button>
            </div>
          </div>
          </TabsContent>

          <TabsContent value="voting" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#fff1c7]">Continuous review queue</h3>
              <p className="mt-2 text-sm leading-6 text-[#c7b288]">
                Vote on candidate uploads, current site defaults, and archived assets. Assets graduate into defaults when there is room or enough vote signal, and archive votes can surface recovery candidates.
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
                <QueueSelect label="Type" value={reviewType} onChange={(value) => setReviewType(value as DeveloperAssetType | 'all')}>
                  <option value="all">All types</option>
                  {DEVELOPER_ASSET_TYPES.map((type) => <option key={type} value={type}>{assetTypeLabels[type]}</option>)}
                </QueueSelect>
                <QueueSelect label="Status" value={reviewStatus} onChange={(value) => setReviewStatus(value as DeveloperAssetStatus | 'all')}>
                  <option value="all">All statuses</option>
                  {DEVELOPER_ASSET_STATUSES.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </QueueSelect>
                <QueueSelect label="Tier" value={reviewTier} onChange={(value) => setReviewTier(value as DeveloperAssetAccessTier | 'all')}>
                  <option value="all">All tiers</option>
                  {(Object.keys(tierLabels) as DeveloperAssetAccessTier[]).map((tier) => <option key={tier} value={tier}>{tierLabels[tier]}</option>)}
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
              <ProgramRule label="Submission allowance" value={program.settings.monthlySubmissionLimit} body="Site-library candidates each developer can submit per calendar month." />
              <ProgramRule label="Required published" value={program.settings.monthlyPublishedRequirement} body="Owner-set monthly published expectation for active developers." />
              <ProgramRule label="Minimum tier votes" value={program.settings.minimumVotesForTierAssignment} body="Votes required before an asset can move beyond Forge Review." />
            </div>
            <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-4 text-sm leading-6 text-[#c7b288]">
              Current owner defaults are part of the same review surface as every upload. Developer votes and owner cap settings can move them between current defaults, candidate review, and archive.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
    </TooltipProvider>
  );
}

function FieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 shrink-0 place-items-center border border-[#5f4526] text-[#d7b469] hover:border-[#d8b365] hover:text-[#fff1c7]"
          aria-label="More information"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[#6d4f2b] bg-[#15100a] text-[#f7ead0]">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function Stat({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
        <FieldHelp text={help} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p>
    </div>
  );
}

function ProgramRule({ label, value, body }: { label: string; value: number; body: string }) {
  return (
    <div className="border border-[#5f4526] bg-[#100c08] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#a98a55]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#ffe7ad]">{value}</p>
      <p className="mt-2 text-sm leading-5 text-[#c7b288]">{body}</p>
    </div>
  );
}

function QueueSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
      {label}
      <select
        className="min-h-10 border border-[#5f4526] bg-[#100c08] px-3 text-sm normal-case tracking-normal text-[#ffe7ad]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function VoteButtons({
  submission,
  onVote,
}: {
  submission: DeveloperAssetSubmission;
  onVote: (submissionId: string, voteValue: 'positive' | 'negative') => void;
}) {
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`border-[#5f7f54] bg-transparent text-[#bde3a8] ${submission.currentUserVote === 'positive' ? 'bg-[#142416]' : ''}`}
        onClick={() => onVote(submission.id, 'positive')}
        aria-label={`Upvote ${submission.name}`}
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`border-[#7d3d32] bg-transparent text-[#ffd0c6] ${submission.currentUserVote === 'negative' ? 'bg-[#2a120d]' : ''}`}
        onClick={() => onVote(submission.id, 'negative')}
        aria-label={`Downvote ${submission.name}`}
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </>
  );
}

function QueuePager({
  page,
  pageCount,
  total,
  pageSize,
  onPrevious,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const start = total === 0 ? 0 : ((page - 1) * pageSize) + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#3c2c1b] pt-4 text-xs text-[#a98a55]">
      <span>{start}-{end} of {total} assets</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
          disabled={page <= 1}
          onClick={onPrevious}
          aria-label="Previous queue page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-20 text-center text-[#c7b288]">Page {page} / {pageCount}</span>
        <Button
          size="sm"
          variant="outline"
          className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
          disabled={page >= pageCount}
          onClick={onNext}
          aria-label="Next queue page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function EditSubmissionForm({
  name,
  description,
  previewUrl,
  isSaving,
  onNameChange,
  onDescriptionChange,
  onPreviewUrlChange,
  onCancel,
  onSave,
}: {
  name: string;
  description: string;
  previewUrl: string;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPreviewUrlChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-3 grid gap-3 border border-[#5f4526] bg-[#100c08] p-3">
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Name
        <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={name} onChange={(event) => onNameChange(event.target.value)} />
      </label>
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Preview URL
        <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={previewUrl} onChange={(event) => onPreviewUrlChange(event.target.value)} />
      </label>
      <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        Notes
        <textarea className="min-h-24 border border-[#5f4526] bg-[#0c0b09] p-3 text-sm normal-case tracking-normal text-[#ffe7ad]" value={description} onChange={(event) => onDescriptionChange(event.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={isSaving} onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" className="border-[#5f4526] bg-transparent text-[#ffe7ad]" disabled={isSaving} onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AssetRow({
  submission,
  templatePreviews,
  children,
  expanded = false,
  onToggleExpanded,
  editForm,
}: {
  submission: DeveloperAssetSubmission;
  templatePreviews: Record<string, TCGCardTemplate>;
  children?: ReactNode;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  editForm?: ReactNode;
}) {
  return (
    <div className="border border-[#4a3823] bg-[#0c0b09] p-3">
      <div className="grid gap-3 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
        <div className="grid h-16 w-16 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a]">
          <AssetPreview submission={submission} templatePreviews={templatePreviews} />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[#ffe7ad]">{submission.name}</p>
            <span className="border border-[#5f4526] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#d7b469]">
              {statusLabels[submission.status]}
            </span>
            <span className="border border-[#35445a] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[#b9d5ff]">
              {getContributorLabel(submission)}
            </span>
            <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${tierClasses[submission.calculatedAccessTier]}`}>
              {tierLabels[submission.calculatedAccessTier]}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#c7b288]">
            {assetTypeLabels[submission.assetType]} - +{submission.positiveVotes} / -{submission.negativeVotes} - quality {submission.qualityScore}%
          </p>
          <p className="mt-1 text-xs text-[#a98a55]">
            {(submission.tierDecisionReason ?? submission.decisionReason ?? 'developer_review').replaceAll('_', ' ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onToggleExpanded ? (
            <Button
              size="sm"
              variant="outline"
              className="border-[#5f4526] bg-transparent text-[#ffe7ad]"
              onClick={onToggleExpanded}
              aria-label={`${expanded ? 'Hide' : 'Show'} ${submission.name} preview`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          ) : null}
          {children ?? (submission.status === 'published' ? <Check className="h-5 w-5 text-[#8be0a4]" /> : null)}
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-3 border-t border-[#3c2c1b] pt-3 lg:grid-cols-[minmax(14rem,22rem)_1fr]">
          <div className="grid min-h-48 place-items-center overflow-hidden border border-[#5f4526] bg-[#15100a]">
            <AssetPreview submission={submission} templatePreviews={templatePreviews} expanded />
          </div>
          <div className="text-sm leading-6 text-[#c7b288]">
            <p>{submission.description || 'No notes were provided for this asset.'}</p>
            <dl className="mt-3 grid gap-2 text-xs text-[#a98a55] sm:grid-cols-2">
              <div><dt className="uppercase tracking-[0.12em]">Contributor</dt><dd className="break-all text-[#c7b288]">{getContributorLabel(submission)}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Email</dt><dd className="break-all text-[#c7b288]">{submission.developerEmail ?? 'Not provided'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Source</dt><dd className="break-all text-[#c7b288]">{submission.sourceUrl ?? 'Not attached'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Registry</dt><dd className="break-all text-[#c7b288]">{submission.registryAssetId ?? 'Not published'}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Submitted</dt><dd className="text-[#c7b288]">{new Date(submission.submittedAt).toLocaleDateString()}</dd></div>
              <div><dt className="uppercase tracking-[0.12em]">Updated</dt><dd className="text-[#c7b288]">{submission.updatedAt ? new Date(submission.updatedAt).toLocaleDateString() : 'Not updated'}</dd></div>
            </dl>
            {editForm}
          </div>
        </div>
      ) : editForm}
    </div>
  );
}

function AssetPreview({
  submission,
  templatePreviews,
  expanded = false,
}: {
  submission: DeveloperAssetSubmission;
  templatePreviews: Record<string, TCGCardTemplate>;
  expanded?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const templateId = getTemplatePreviewId(submission);
  const template = templateId ? templatePreviews[templateId] : undefined;

  useEffect(() => {
    setImageFailed(false);
  }, [submission.previewUrl]);

  if (template) {
    if (!expanded) return <TemplateThumbnail template={template} />;
    return (
      <div className="max-h-[26rem] w-full overflow-auto p-4">
        <CardPreview
          card={{ template, data: template.templatePreviewData ?? {}, uniqueId: `developer-preview-${template.id}` }}
          targetWidthPx={260}
          isEditorPreview
        />
      </div>
    );
  }

  if (canRenderImagePreview(submission) && !imageFailed) {
    return (
      <img
        src={submission.previewUrl}
        alt=""
        className={expanded ? 'max-h-80 w-full object-contain' : 'h-full w-full object-cover'}
        onError={() => setImageFailed(true)}
      />
    );
  }

  const isStructured = submission.previewUrl.startsWith('/api/templates') || submission.previewUrl.startsWith('/api/styles');
  const message = imageFailed
    ? 'Preview image could not be loaded.'
    : isStructured
      ? 'This asset uses structured data instead of a direct image preview.'
      : 'No preview file has been attached yet.';

  return (
    <div className={`grid h-full w-full place-items-center text-center text-[#c7b288] ${expanded ? 'gap-2 p-6' : 'px-2'}`}>
      {expanded ? <Archive className="mx-auto h-8 w-8 text-[#a98a55]" /> : null}
      <p className={`${expanded ? 'text-sm font-medium text-[#ffe7ad]' : 'text-[10px] uppercase tracking-[0.12em] text-[#a98a55]'}`}>
        {assetTypeLabels[submission.assetType]}
      </p>
      {expanded ? <p className="text-xs leading-5 text-[#a98a55]">{message}</p> : null}
    </div>
  );
}
