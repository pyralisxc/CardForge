"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Pencil, Search, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { PIPELINE_STATUSES, PIPELINE_TYPES, type PipelineAccessTier, type PipelineStatus, type PipelineType } from '@/features/pipeline/lib/pipelineItems';
import type { PipelineProgramView } from '@/features/pipeline/lib/pipelineProgram';
import { isContributorPipelineReviewable } from '@/features/pipeline/lib/pipelineLibrary';
import { normalizeContentTaxonomyTags } from '@/features/pipeline/lib/contentTaxonomy';
import type { StudioAssetDestination } from '@/domain/templates';
import {
  getPipelineStudioDestinationLabel,
  getPipelineStudioDestinationOptions,
  getPipelineStatusLabel,
  getPipelineTierLabel,
  getPipelineTypeLabel,
} from '@/features/pipeline/lib/pipelineAssetTaxonomy';
import { usePipelineTemplatePreviews } from './usePipelineTemplatePreviews';
import {
  assetTierOrder,
  isCurrentContributorSubmission,
  isEditableSubmission,
  reviewQueueHelp,
  statusGlossary,
  tierGlossary,
  type PipelineSubmission,
  type VoteFilter,
} from '@/features/pipeline/components/PipelineContributionModel';
import { usePipelineReviewQueue } from '@/features/pipeline/components/usePipelineReviewQueue';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { AssetRow, EditSubmissionForm, QueuePager, VoteButtons } from '@/features/pipeline/components/PipelineSubmissionRows';
import { GlossaryPanel, PipelineMetric, ProgramRule, QueueSelect, Stat } from '@/features/pipeline/components/PipelineContributionUi';
import { PipelineSubmissionPanel } from '@/features/pipeline/components/PipelineSubmissionPanel';

interface PipelineItemsResponse { program: PipelineProgramView }

export function PipelineContributionPanel({
  compact = false,
  initialSubmissionId = null,
  initialSubmitSetId = null,
  submitOnly = false,
}: {
  compact?: boolean;
  initialSubmissionId?: string | null;
  initialSubmitSetId?: string | null;
  submitOnly?: boolean;
}) {
  const { toast } = useToast();
  const [program, setProgram] = useState<PipelineProgramView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPreviewUrl, setEditPreviewUrl] = useState('');
  const [editSourceNotes, setEditSourceNotes] = useState('');
  const [editSpecialtyTags, setEditSpecialtyTags] = useState('');
  const [editUseCaseTags, setEditUseCaseTags] = useState('');
  const [editRequestedStudioDestination, setEditRequestedStudioDestination] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState(initialSubmissionId ? 'pipeline' : 'submit');
  const previewSubmissions = useMemo(() => program
    ? [...program.submissions, ...program.votingQueue]
    : undefined, [program]);
  const templatePreviews = usePipelineTemplatePreviews(previewSubmissions);
  const {
    statusCounts: reviewStatusCounts,
    visibleSubmissions: visibleReviewSubmissions,
    search: reviewSearch,
    setSearch: setReviewSearch,
    type: reviewType,
    setType: setReviewType,
    status: reviewStatus,
    setStatus: setReviewStatus,
    tier: reviewTier,
    setTier: setReviewTier,
    voteFilter: reviewVoteFilter,
    setVoteFilter: setReviewVoteFilter,
    pageSize: reviewPageSize,
    setPageSize: setReviewPageSize,
    page: reviewPage,
    setPage: setReviewPage,
    pageCount: reviewPageCount,
  } = usePipelineReviewQueue(program);
  const [ownPage, setOwnPage] = useState(1);
  const hasLoadedRef = useRef(false);
  const hasOpenedInitialSubmissionRef = useRef(false);

  const ownSubmissions = program?.submissions ?? [];
  const liveLibraryCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.publishedCount, 0) ?? 0;
  const openDefaultSlotCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.openPublishSlots, 0) ?? 0;

  const loadProgram = useCallback(async (attempt = 0) => {
    if (!hasLoadedRef.current) setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(ownPage),
        pageSize: '12',
        reviewQuery: reviewSearch,
        reviewAssetType: reviewType,
        reviewStatus: reviewStatus,
        reviewTier: reviewTier,
        reviewVote: reviewVoteFilter,
        reviewPage: String(reviewPage),
        reviewPageSize: String(reviewPageSize),
      });
      const response = await fetch(`/api/pipeline?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load the Contributor Pipeline.'));
      const body = await response.json() as PipelineItemsResponse;
      setProgram(body.program);
      hasLoadedRef.current = true;
      setIsLoading(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the Contributor Pipeline.';
      if (attempt < 2) {
        window.setTimeout(() => {
          void loadProgram(attempt + 1);
        }, 1200);
        return;
      }
      setLoadError(message);
      toast({ title: 'Contributor Pipeline unavailable', description: message, variant: 'destructive' });
      setIsLoading(false);
    }
  }, [ownPage, reviewPage, reviewPageSize, reviewSearch, reviewStatus, reviewTier, reviewType, reviewVoteFilter, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProgram(), 250);
    return () => window.clearTimeout(timer);
  }, [loadProgram]);

  const vote = async (submissionId: string, voteValue: 'positive' | 'negative') => {
    try {
      const response = await fetch(`/api/pipeline/${submissionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteValue }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to submit vote.'));
      await response.json() as PipelineItemsResponse;
      await loadProgram();
      toast({ title: 'Vote recorded', description: 'The submission score has been updated.' });
    } catch (error) {
      toast({
        title: 'Vote not saved',
        description: error instanceof Error ? error.message : 'Unable to submit vote.',
        variant: 'destructive',
      });
    }
  };

  const beginEdit = useCallback((submission: PipelineSubmission) => {
    setEditingSubmissionId(submission.id);
    setEditName(submission.name);
    setEditDescription(submission.description);
    setEditPreviewUrl(submission.previewUrl);
    setEditSourceNotes(submission.sourceNotes);
    setEditSpecialtyTags(submission.specialtyTags.join(', '));
    setEditUseCaseTags(submission.useCaseTags.join(', '));
    setEditRequestedStudioDestination(submission.requestedStudioDestination ?? '');
    setExpandedSubmissionId(submission.id);
  }, []);

  const cancelEdit = () => {
    setEditingSubmissionId(null);
    setEditName('');
    setEditDescription('');
    setEditPreviewUrl('');
    setEditSourceNotes('');
    setEditSpecialtyTags('');
    setEditUseCaseTags('');
    setEditRequestedStudioDestination('');
  };

  useEffect(() => {
    if (!initialSubmissionId || hasOpenedInitialSubmissionRef.current || !program) return;
    const submission = program.submissions.find((candidate) => candidate.id === initialSubmissionId);
    if (!submission) return;
    hasOpenedInitialSubmissionRef.current = true;
    setActiveWorkspaceTab('pipeline');
    beginEdit(submission);
  }, [beginEdit, initialSubmissionId, program]);

  const saveEdit = async (submissionId: string) => {
    setIsEditing(true);
    try {
      const response = await fetch(`/api/pipeline/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          previewUrl: editPreviewUrl,
          sourceNotes: editSourceNotes,
          specialtyTags: normalizeContentTaxonomyTags(editSpecialtyTags),
          useCaseTags: normalizeContentTaxonomyTags(editUseCaseTags),
          requestedStudioDestination: editRequestedStudioDestination,
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to edit asset.'));
      await response.json() as PipelineItemsResponse;
      await loadProgram();
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

  const submitDraft = async (submissionId: string) => {
    setIsEditing(true);
    try {
      const response = await fetch(`/api/pipeline/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          previewUrl: editPreviewUrl,
          sourceNotes: editSourceNotes,
          specialtyTags: normalizeContentTaxonomyTags(editSpecialtyTags),
          useCaseTags: normalizeContentTaxonomyTags(editUseCaseTags),
          requestedStudioDestination: editRequestedStudioDestination,
        }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to submit Template draft.'));
      await response.json() as PipelineItemsResponse;
      await loadProgram();
      cancelEdit();
      toast({ title: 'Template sent for owner review', description: 'Its authored details and confirmed classification are now in the review pipeline.' });
    } catch (error) {
      toast({
        title: 'Template draft not submitted',
        description: error instanceof Error ? error.message : 'Unable to submit Template draft.',
        variant: 'destructive',
      });
    } finally {
      setIsEditing(false);
    }
  };

  if (isLoading) {
    return (
      <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
        <div className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-6 text-[var(--cf-text-muted)]">Loading Contributor Pipeline...</div>
      </section>
    );
  }

  if (!program) {
    return (
      <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
        <div className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-6 md:p-8">
          <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
            <UploadCloud className="h-6 w-6" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">Forge Review</span>
          </div>
          <h2 className="mt-4 font-serif text-2xl text-[var(--cf-text-strong)]">Asset hub needs a refresh</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">
            {loadError ?? 'The Contributor Pipeline did not finish loading yet.'}
          </p>
          <Button
            className="mt-5 bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"
            onClick={() => void loadProgram()}
            disabled={isLoading}
          >
            {isLoading ? 'Reloading...' : 'Retry asset hub'}
          </Button>
        </div>
      </section>
    );
  }

  if (submitOnly) {
    return (
      <TooltipProvider>
        <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
          <PipelineSubmissionPanel
            program={program}
            onSubmitted={loadProgram}
            initialSetId={initialSubmitSetId}
            embedded
          />
        </section>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
    <section className={compact ? '' : 'mx-auto max-w-7xl px-5 pb-14 md:px-8'}>
      <div className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface)] p-4 md:p-6">
        <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]">
          <UploadCloud className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-[0.2em]">Forge Review</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-px bg-[var(--cf-border)] p-px sm:grid-cols-4">
          <Stat label="Submitted this month" value={program.contributionStats.submitted} help="Assets you uploaded into the site pipeline this calendar month." />
          <Stat label="Published this month" value={program.contributionStats.published} help="Your assets that reached published status this calendar month." />
          <Stat label="Required published" value={program.effectiveMonthlyPublishedRequirement} help="Your current monthly published asset expectation. Owners can set a base rule and adjust individual accounts." />
          <Stat label="Uploads left" value={program.remainingSubmissions} help="Uploads remaining before your monthly site-submission allowance is reached." />
        </div>

        <div className="mt-3 grid gap-x-5 gap-y-3 border-y border-[var(--cf-border)] py-3 sm:grid-cols-3">
          <PipelineMetric label="Live library" value={liveLibraryCount} body="Published Pipeline work available in CardForge." />
          <PipelineMetric label="Open slots" value={openDefaultSlotCount} body="Starter and Creator Pass publication capacity." />
          <PipelineMetric label="Shared work" value={program.totalVoteableCount} body="Candidates, published work, and recoverable history." />
        </div>

        {program.contributorOwnerNote ? (
          <p className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-3 text-xs leading-5 text-[var(--cf-text-subtle)]">
            Owner note: {program.contributorOwnerNote}
          </p>
        ) : null}

        <Tabs value={activeWorkspaceTab} onValueChange={setActiveWorkspaceTab} className="mt-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-2">
            <TabsTrigger value="submit" className="rounded-none border border-transparent px-4 py-2 text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-hover)] data-[state=active]:text-[var(--cf-accent-text)]">Submit</TabsTrigger>
            <TabsTrigger value="voting" className="rounded-none border border-transparent px-4 py-2 text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-hover)] data-[state=active]:text-[var(--cf-accent-text)]">Voting Lane</TabsTrigger>
            <TabsTrigger value="pipeline" className="rounded-none border border-transparent px-4 py-2 text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-hover)] data-[state=active]:text-[var(--cf-accent-text)]">My Pipeline</TabsTrigger>
            <TabsTrigger value="program" className="rounded-none border border-transparent px-4 py-2 text-[var(--cf-text-muted)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[var(--cf-surface-hover)] data-[state=active]:text-[var(--cf-accent-text)]">Program</TabsTrigger>
          </TabsList>

          <PipelineSubmissionPanel program={program} onSubmitted={loadProgram} initialSetId={initialSubmitSetId} />

          <TabsContent value="voting" className="mt-4">
            <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
              <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Continuous voting lane</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
                Vote on new uploads, publish candidates, live library assets, and archived assets in the same lane. Status badges explain what the signal currently means; filters only narrow the view.
              </p>
              <p className="mt-3 text-xs leading-5 text-[var(--cf-text-subtle)]">{reviewQueueHelp}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)] ${reviewStatus === 'all' ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)]' : ''}`}
                  onClick={() => setReviewStatus('all')}
                >
                  All ({program.totalVoteableCount})
                </Button>
                {PIPELINE_STATUSES
                  .filter((status) => status !== 'draft' && status !== 'rejected')
                  .map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`rounded-none border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)] ${reviewStatus === status ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)]' : ''}`}
                      onClick={() => setReviewStatus(status)}
                    >
                      {getPipelineStatusLabel(status)} ({reviewStatusCounts[status]})
                    </Button>
                  ))}
              </div>
              <div className="mt-4 grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3 lg:grid-cols-[minmax(14rem,1fr)_repeat(5,minmax(8rem,auto))]">
                <label className="grid gap-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
                  Search
                  <span className="flex items-center gap-2 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] px-3">
                    <Search className="h-4 w-4 text-[var(--cf-accent)]" />
                    <input
                      className="min-h-10 w-full bg-transparent text-sm normal-case tracking-normal text-[var(--cf-accent-text)] outline-none"
                      value={reviewSearch}
                      onChange={(event) => setReviewSearch(event.target.value)}
                    />
                  </span>
                </label>
                <QueueSelect label="Family" value={reviewType} onChange={(value) => setReviewType(value as PipelineType | 'all')}>
                  <option value="all">All types</option>
                  {PIPELINE_TYPES.map((type) => <option key={type} value={type}>{getPipelineTypeLabel(type, { plural: false })}</option>)}
                </QueueSelect>
                <QueueSelect label="Status" value={reviewStatus} onChange={(value) => setReviewStatus(value as PipelineStatus | 'all')}>
                  <option value="all">All statuses</option>
                  {PIPELINE_STATUSES.map((status) => <option key={status} value={status}>{getPipelineStatusLabel(status)}</option>)}
                </QueueSelect>
                <QueueSelect label="Tier" value={reviewTier} onChange={(value) => setReviewTier(value as PipelineAccessTier | 'all')}>
                  <option value="all">All tiers</option>
                  {assetTierOrder.map((tier) => <option key={tier} value={tier}>{getPipelineTierLabel(tier)}</option>)}
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
                  <p className="text-sm text-[var(--cf-text-muted)]">No assets match this queue view.</p>
                ) : visibleReviewSubmissions.map((submission) => (
                    <AssetRow
                      key={submission.id}
                      submission={submission}
                      program={program}
                      templatePreviews={templatePreviews}
                      expanded={expandedSubmissionId === submission.id}
                      onToggleExpanded={() => setExpandedSubmissionId(expandedSubmissionId === submission.id ? null : submission.id)}
                    >
                    {isContributorPipelineReviewable(submission) ? <VoteButtons submission={submission} onVote={vote} /> : null}
                  </AssetRow>
                ))}
              </div>
              <QueuePager
                page={Math.min(reviewPage, reviewPageCount)}
                pageCount={reviewPageCount}
                total={program.votingPage.total}
                pageSize={reviewPageSize}
                onPrevious={() => setReviewPage((page) => Math.max(1, page - 1))}
                onNext={() => setReviewPage((page) => Math.min(reviewPageCount, page + 1))}
              />
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="mt-4">
            <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
              <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Your pipeline</h3>
              <div className="mt-4 space-y-3">
                {ownSubmissions.length === 0 ? (
                  <p className="text-sm text-[var(--cf-text-muted)]">Your submitted assets will appear here.</p>
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
                        sourceNotes={editSourceNotes}
                        specialtyTags={editSpecialtyTags}
                        useCaseTags={editUseCaseTags}
                        requestedStudioDestination={editRequestedStudioDestination}
                        destinationOptions={getPipelineStudioDestinationOptions(submission.assetType).map((destination) => ({
                          value: destination,
                          label: getPipelineStudioDestinationLabel(destination as StudioAssetDestination),
                        }))}
                        isDraft={submission.status === 'draft'}
                        isSaving={isEditing}
                        onNameChange={setEditName}
                        onDescriptionChange={setEditDescription}
                        onPreviewUrlChange={setEditPreviewUrl}
                        onSourceNotesChange={setEditSourceNotes}
                        onSpecialtyTagsChange={setEditSpecialtyTags}
                        onUseCaseTagsChange={setEditUseCaseTags}
                        onRequestedStudioDestinationChange={setEditRequestedStudioDestination}
                        onCancel={cancelEdit}
                        onSave={() => saveEdit(submission.id)}
                        onSubmit={() => submitDraft(submission.id)}
                      />
                    ) : null}
                  >
                    {isCurrentContributorSubmission(submission, program) && isEditableSubmission(submission, submission.contributorId) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--cf-border)] bg-transparent text-[var(--cf-accent-text)]"
                        onClick={() => beginEdit(submission)}
                        aria-label={`Edit ${submission.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : submission.status === 'published' ? <Check className="h-5 w-5 text-[#8be0a4]" /> : null}
                  </AssetRow>
                ))}
              </div>
              <QueuePager
                page={program.submissionPage.page}
                pageCount={Math.max(1, Math.ceil(program.submissionPage.total / program.submissionPage.pageSize))}
                total={program.submissionPage.total}
                pageSize={program.submissionPage.pageSize}
                onPrevious={() => setOwnPage((page) => Math.max(1, page - 1))}
                onNext={() => setOwnPage((page) => Math.min(
                  Math.max(1, Math.ceil(program.submissionPage.total / program.submissionPage.pageSize)),
                  page + 1,
                ))}
              />
            </div>
          </TabsContent>

          <TabsContent value="program" className="mt-4">
            <div className="grid gap-3 border-y border-[var(--cf-border)] py-3 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">How work moves</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">
                  Votes, thresholds, and live-library capacity move work automatically. Published and retired revisions stay voteable; a visible owner override can pin a different status or tier until it is cleared.
                </p>
              </div>
              <div className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
                <PipelineMetric label="Votes to grade" value={program.settings.minimumVotesForGrading} body="Minimum votes before the Pipeline judges the current revision." />
                <PipelineMetric label="Starter / Pass" value={`${program.settings.freeAssetMinimumPositiveVotePercent}% / ${program.settings.paidAssetMinimumPositiveVotePercent}%`} body="Automatic publication thresholds after the minimum vote count." />
                <PipelineMetric label="Owner vote" value={`${program.settings.ownerVoteWeight}x`} body="Owner signal weight when the owner votes." />
                <PipelineMetric label="Self voting" value={program.settings.allowContributorSelfVoting ? 'On' : 'Off'} body="Whether your own work accepts your vote." />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ProgramRule label="Submission allowance" value={program.effectiveMonthlySubmissionLimit} body="Site-library candidates you can submit this calendar month. This may be the base rule or an account-specific owner adjustment." />
              <ProgramRule label="Required published" value={program.effectiveMonthlyPublishedRequirement} body="Monthly published expectation currently assigned to your Contributor profile." />
              <ProgramRule label="Votes to decide" value={program.settings.minimumVotesForGrading} body="Votes required before automatic status and tier selection begins." />
            </div>
            <div className="mt-3 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 text-sm leading-6 text-[var(--cf-text-muted)]">
              Shared library assets are part of the same review surface as every upload. Contributor votes and owner cap settings can move them between the live library, candidate review, and archive. Contribution history remains attributed to its contributor; CardForge does not currently operate a payout program.
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
