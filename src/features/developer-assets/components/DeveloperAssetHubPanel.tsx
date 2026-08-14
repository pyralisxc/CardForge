"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Search, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { DEVELOPER_ASSET_STATUSES, DEVELOPER_ASSET_TYPES, type DeveloperAssetAccessTier, type DeveloperAssetStatus, type DeveloperAssetType } from '@/features/developer-assets/lib/developerAssets';
import type { DeveloperAssetProgramView } from '@/features/developer-assets/lib/developerAssetProgram';
import {
  getDeveloperAssetStatusLabel,
  getDeveloperAssetTierLabel,
  getDeveloperAssetTypeLabel,
} from '@/features/developer-assets/lib/pipelineAssetTaxonomy';
import { useDeveloperTemplatePreviews } from './useDeveloperTemplatePreviews';
import {
  assetTierOrder,
  isCurrentContributorSubmission,
  isEditableSubmission,
  reviewQueueHelp,
  statusGlossary,
  tierGlossary,
  type DeveloperAssetSubmission,
  type VoteFilter,
} from '@/features/developer-assets/components/DeveloperAssetHubModel';
import { useDeveloperReviewQueue } from '@/features/developer-assets/components/useDeveloperReviewQueue';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { AssetRow, EditSubmissionForm, QueuePager, VoteButtons } from '@/features/developer-assets/components/DeveloperAssetRows';
import { GlossaryPanel, GuidanceCard, PipelineMetric, ProgramRule, QueueSelect, Stat } from '@/features/developer-assets/components/DeveloperAssetHubUi';
import { DeveloperAssetSubmissionPanel } from '@/features/developer-assets/components/DeveloperAssetSubmissionPanel';

interface DeveloperAssetsResponse { program: DeveloperAssetProgramView }

export function DeveloperAssetHubPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [program, setProgram] = useState<DeveloperAssetProgramView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPreviewUrl, setEditPreviewUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const templatePreviews = useDeveloperTemplatePreviews(program?.submissions);
  const {
    submissions: reviewQueueSubmissions,
    statusCounts: reviewStatusCounts,
    filteredSubmissions: filteredReviewSubmissions,
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
  } = useDeveloperReviewQueue(program);

  const ownSubmissions = useMemo(() => (
    program?.submissions.filter((submission) => isCurrentContributorSubmission(submission, program)) ?? []
  ), [program]);
  const liveLibraryCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.publishedCount, 0) ?? 0;
  const openDefaultSlotCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.openPublishSlots, 0) ?? 0;
  const archiveCount = program?.assetTypeSummaries.reduce((total, summary) => total + summary.archiveCount, 0) ?? 0;

  const loadProgram = useCallback(async (attempt = 0) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/developer-assets', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load developer asset hub.'));
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

  const vote = async (submissionId: string, voteValue: 'positive' | 'negative') => {
    try {
      const response = await fetch(`/api/developer-assets/${submissionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteValue }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to submit vote.'));
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
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to edit asset.'));
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
          <ProgramRule label="Open live slots" value={openDefaultSlotCount} body="Available Starter and Creator Pass slots before passing assets have to wait in candidate review." />
          <ProgramRule label="Voting lane" value={reviewQueueSubmissions.length} body="Voteable uploads, publish candidates, live assets, and recoverable archived assets in one shared lane." />
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
              title={`${reviewQueueSubmissions.length} voteable assets`}
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

        {program.developerOwnerNote ? (
          <p className="mt-4 border border-[#3c2c1b] bg-[#15100a] p-3 text-xs leading-5 text-[#a98a55]">
            Owner note: {program.developerOwnerNote}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-[#5f4526] bg-[#100c08] p-4">
            <h3 className="font-serif text-xl text-[#fff1c7]">How assets move</h3>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              Votes, thresholds, and live-library capacity move assets automatically. Published and retired assets stay voteable, while a visible owner override can pin a different status or tier until it is cleared.
            </p>
          </div>
          <div className="grid gap-2 border border-[#5f4526] bg-[#100c08] p-4 text-sm text-[#c7b288]">
            <PipelineMetric label="Votes to grade" value={program.settings.minimumVotesForGrading} body="Minimum votes before the pipeline can judge pass/fail signal." />
            <PipelineMetric label="Starter / Pass" value={`${program.settings.freeAssetMinimumPositiveVotePercent}% / ${program.settings.paidAssetMinimumPositiveVotePercent}%`} body="Automatic tier thresholds after the minimum vote count is met." />
            <PipelineMetric label="Owner vote" value={`${program.settings.ownerVoteWeight}x`} body="Owner signal weight when the owner votes." />
            <PipelineMetric label="Self voting" value={program.settings.allowContributorSelfVoting ? 'On' : 'Off'} body="Controls whether your own assets appear in your review queue." />
            <PipelineMetric label="Operation" value="Automatic" body="Owner overrides can pin a different result without stopping automatic scoring." />
          </div>
        </div>

        <Tabs defaultValue="submit" className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2 rounded-none border border-[#5f4526] bg-[#100c08] p-2">
            <TabsTrigger value="submit" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Submit</TabsTrigger>
            <TabsTrigger value="voting" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Voting Lane</TabsTrigger>
            <TabsTrigger value="pipeline" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">My Pipeline</TabsTrigger>
            <TabsTrigger value="program" className="rounded-none border border-transparent px-4 py-2 text-[#c7b288] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#2a1b0d] data-[state=active]:text-[#ffe7ad]">Program</TabsTrigger>
          </TabsList>

          <DeveloperAssetSubmissionPanel program={program} onProgramChange={setProgram} />

          <TabsContent value="voting" className="mt-4">
            <div className="border border-[#5f4526] bg-[#100c08] p-4">
              <h3 className="font-serif text-xl text-[#fff1c7]">Continuous voting lane</h3>
              <p className="mt-2 text-sm leading-6 text-[#c7b288]">
                Vote on new uploads, publish candidates, live library assets, and archived assets in the same lane. Status badges explain what the signal currently means; filters only narrow the view.
              </p>
              <p className="mt-3 text-xs leading-5 text-[#a98a55]">{reviewQueueHelp}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad] ${reviewStatus === 'all' ? 'border-[#d8b365] bg-[#2a1b0d]' : ''}`}
                  onClick={() => setReviewStatus('all')}
                >
                  All ({reviewQueueSubmissions.length})
                </Button>
                {DEVELOPER_ASSET_STATUSES
                  .filter((status) => status !== 'draft' && status !== 'rejected')
                  .map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`rounded-none border-[#5f4526] bg-transparent text-[#ffe7ad] ${reviewStatus === status ? 'border-[#d8b365] bg-[#2a1b0d]' : ''}`}
                      onClick={() => setReviewStatus(status)}
                    >
                      {getDeveloperAssetStatusLabel(status)} ({reviewStatusCounts[status]})
                    </Button>
                  ))}
              </div>
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
              <ProgramRule label="Votes to decide" value={program.settings.minimumVotesForGrading} body="Votes required before automatic status and tier selection begins." />
            </div>
            <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-4 text-sm leading-6 text-[#c7b288]">
              Shared library assets are part of the same review surface as every upload. Developer votes and owner cap settings can move them between the live library, candidate review, and archive. Contribution history remains attributed to its developer; CardForge does not currently operate a payout program.
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
