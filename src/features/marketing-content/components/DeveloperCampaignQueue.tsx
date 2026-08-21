"use client";

import { useMemo, useState } from 'react';
import { Search, Send, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { mutateMarketingContent } from '@/features/marketing-content/client/api';
import {
  getCampaignPackageReadiness,
  getCampaignMediaExpectation,
  getCampaignStatusGuidance,
  getCampaignStatusLabel,
  matchesCampaignQueueFilter,
  type CampaignQueueFilter,
} from '@/features/marketing-content/client/campaignWorkflow';
import { ConfirmationDialog as CockpitConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { DeveloperCampaignPackageDetails } from '@/features/marketing-content/components/DeveloperCampaignPackageDetails';
import {
  canTransitionCampaign,
  type MarketingContentPackage as SocialCampaign,
  type MarketingContentWorkspaceView,
} from '@/features/marketing-content/model';

const fieldClassName = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 py-2 text-sm text-[var(--cf-accent-text)] placeholder:text-[#6f5b3a]';

export function DeveloperCampaignQueue({
  cockpit,
  onRefresh,
  onEdit,
  onMessage,
  onError,
}: {
  cockpit: MarketingContentWorkspaceView;
  onRefresh: () => Promise<void> | void;
  onEdit: (campaign: SocialCampaign) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const canApprove = cockpit.scopes.includes('campaigns.approve');
  const canPublish = cockpit.scopes.includes('campaigns.publish');
  const [filter, setFilter] = useState<CampaignQueueFilter>('active');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const jobsByCampaign = useMemo(() => {
    const map = new Map<string, MarketingContentWorkspaceView['publishJobs']>();
    cockpit.publishJobs.forEach((job) => map.set(job.campaignId, [...(map.get(job.campaignId) ?? []), job]));
    return map;
  }, [cockpit.publishJobs]);

  const campaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return cockpit.campaigns.filter((campaign) => {
      const matchesFilter = matchesCampaignQueueFilter(campaign, filter, {
        currentUserId: cockpit.currentUserId,
        isOwner: cockpit.isOwner,
      });
      const matchesQuery = !normalizedQuery || [
        campaign.title,
        campaign.objective,
        campaign.productionNote,
        ...campaign.associations.map((association) => association.titleSnapshot || association.externalKey),
        campaign.contributorName,
        campaign.contributorEmail,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      return matchesFilter && matchesQuery;
    });
  }, [
    cockpit.campaigns,
    cockpit.currentUserId,
    cockpit.isOwner,
    filter,
    query,
  ]);

  const run = async (key: string, success: string, action: () => Promise<unknown>) => {
    setBusy(key);
    onError('');
    try {
      await action();
      await onRefresh();
      onMessage(success);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to update the campaign.');
    } finally {
      setBusy(null);
    }
  };

  const workflow = (
    campaign: SocialCampaign,
    action: 'submit' | 'request_changes' | 'approve' | 'cancel',
    success: string,
  ) => run(`${action}:${campaign.id}`, success, () => mutateMarketingContent('PATCH', {
    action,
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    reviewNote: reviewNotes[campaign.id] ?? '',
  }));

  return (
    <section className="space-y-3" aria-labelledby="campaign-queue-heading">
      <div className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">{cockpit.isOwner ? 'Candidate queue' : 'Campaign packages'}</p>
            <h2 id="campaign-queue-heading" className="font-serif text-2xl text-[var(--cf-text-strong)]">{cockpit.isOwner ? 'Review the next CardForge story' : 'Your campaign packages'}</h2>
          </div>
          <p className="text-sm text-[var(--cf-text-muted)]">{campaigns.length} shown / {cockpit.campaigns.length} total</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="relative">
            <span className="sr-only">Search campaign packages</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--cf-text-subtle)]" />
            <input type="search" className={`${fieldClassName} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, objective, or contributor" />
          </label>
          <label>
            <span className="sr-only">Filter campaign packages</span>
            <select
              aria-label="Filter campaign packages"
              className={fieldClassName}
              value={filter}
              onChange={(event) => setFilter(event.target.value as CampaignQueueFilter)}
            >
              {cockpit.isOwner ? <option value="needs_action">Needs owner action</option> : null}
              {cockpit.isOwner ? <option value="review">Awaiting review</option> : null}
              <option value="active">Active work</option>
              <option value="published">Published</option>
              <option value="cancelled">Closed</option>
              <option value="all">All packages</option>
            </select>
          </label>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <article className="border border-dashed border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-6 text-center"><p className="text-sm text-[var(--cf-text-muted)]">{cockpit.campaigns.length ? 'No packages match this queue view.' : 'No campaign packages yet.'}</p></article>
      ) : campaigns.map((campaign) => {
        const reviewNote = reviewNotes[campaign.id] ?? '';
        const ownCampaign = campaign.contributorId === cockpit.currentUserId;
        const canEdit = ownCampaign && (campaign.status === 'draft' || campaign.status === 'changes_requested');
        const providerReady = ['approved', 'provider_draft', 'failed'].includes(campaign.status);
        const canCancel = (ownCampaign || cockpit.isOwner)
          && canTransitionCampaign(campaign.status, 'cancelled', cockpit.isOwner ? 'owner' : 'contributor');
        const cancelLabel = campaign.status === 'submitted' ? 'Withdraw submission' : campaign.status === 'draft' || campaign.status === 'changes_requested' ? 'Cancel draft' : 'Archive package';
        const jobs = jobsByCampaign.get(campaign.id) ?? [];
        const readiness = getCampaignPackageReadiness(campaign);
        const hasMedia = campaign.variants.some((variant) => variant.attachments.length > 0);
        const mediaExpectation = getCampaignMediaExpectation(campaign);

        return (
          <article key={campaign.id} className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-xl text-[var(--cf-text-strong)]">{campaign.title}</h3><StatusBadge status={campaign.status} /></div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cf-text-muted)]">{campaign.objective}</p>
                <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">
                  {campaign.contributorName ?? campaign.contributorEmail ?? campaign.contributorId}
                  {' / '}
                  version {campaign.version}
                  {' / '}
                  {campaign.variants.length} social post{campaign.variants.length === 1 ? '' : 's'}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#d2b77e]">
                  {getCampaignStatusGuidance(campaign.status, cockpit.isOwner)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2" aria-label={`Readiness for ${campaign.title}`}>
                  <span className="border border-[#4a6f51] bg-[#0e170f] px-2 py-1 text-xs text-[#a8e7b8]">
                    Copy ready
                  </span>
                  <span className={`border px-2 py-1 text-xs ${hasMedia ? 'border-[#4a6f51] bg-[#0e170f] text-[#a8e7b8]' : 'border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] text-[var(--cf-warning)]'}`}>
                    {hasMedia ? 'Media attached' : mediaExpectation.label}
                  </span>
                  <span className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] px-2 py-1 text-xs text-[var(--cf-text-muted)]">
                    {readiness.completed}/{readiness.total} ready
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? <Button type="button" className="min-h-11" variant="outline" onClick={() => onEdit(campaign)}>Open review editor</Button> : null}
                {canEdit ? <Button type="button" className="min-h-11" onClick={() => void workflow(campaign, 'submit', 'Campaign submitted for owner review.')} disabled={Boolean(busy)}><Send className="mr-2 h-4 w-4" />Submit for review</Button> : null}
                {canCancel ? (
                  <CockpitConfirmationDialog
                    trigger={<Button type="button" className="min-h-11" variant="ghost" disabled={Boolean(busy)}>{cancelLabel}</Button>}
                    title={cancelLabel}
                    description={campaign.status === 'submitted' ? 'This removes the package from the owner review queue. You can keep the historical record, but this submission cannot be edited afterward.' : 'This closes the package and keeps it in the audit history. This action cannot be undone.'}
                    actionLabel={cancelLabel}
                    destructive
                    onConfirm={() => void workflow(campaign, 'cancel', 'Campaign package cancelled.')}
                  />
                ) : null}
              </div>
            </div>

            {campaign.reviewNote ? <p className="mt-3 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3 text-sm text-[var(--cf-warning)]">Owner note: {campaign.reviewNote}</p> : null}
            <DeveloperCampaignPackageDetails campaign={campaign} jobs={jobs} />

            {canApprove && campaign.status === 'submitted' ? (
              <div className="mt-4 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-4">
                <textarea aria-label={`Review note for ${campaign.title}`} className={`${fieldClassName} min-h-24`} value={reviewNote} onChange={(event) => setReviewNotes((current) => ({ ...current, [campaign.id]: event.target.value }))} placeholder="Owner review note or requested changes" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" className="min-h-11" variant="outline" disabled={Boolean(busy) || !reviewNote.trim()} onClick={() => void workflow(campaign, 'request_changes', 'Campaign returned with requested changes.')}>Request changes</Button>
                  <CockpitConfirmationDialog
                    trigger={<Button type="button" className="min-h-11" disabled={Boolean(busy)}><ShieldCheck className="mr-2 h-4 w-4" />Approve package and make media public</Button>}
                    title="Approve this package and its media?"
                    description={<><p>This promotes {campaign.variants.reduce((count, variant) => count + variant.attachments.length, 0)} protected image attachment(s) through stable public derivatives and unlocks the Marketing distribution workspace.</p><p className="mt-2">Approval does not publish anything.</p></>}
                    actionLabel="Approve package"
                    onConfirm={() => void workflow(campaign, 'approve', 'Campaign package and media approved.')}
                  />
                </div>
              </div>
            ) : null}

            {canPublish && providerReady ? (
              <div className="mt-4 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Approved for distribution</p>
                <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">Choose an owned account or community in Owner Console → Marketing → Distribution. Delivery never begins from the review action itself.</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function StatusBadge({ status }: { status: SocialCampaign['status'] }) {
  return <span className="border border-[var(--cf-border-strong)] bg-[var(--cf-surface-inset)] px-2 py-1 text-xs uppercase tracking-[0.12em] text-[var(--cf-accent-strong)]">{getCampaignStatusLabel(status)}</span>;
}
