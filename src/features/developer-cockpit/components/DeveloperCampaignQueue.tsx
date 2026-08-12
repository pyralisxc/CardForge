"use client";

import { useMemo, useState } from 'react';
import { CalendarClock, Loader2, RefreshCw, Search, Send, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  loadBufferChannels,
  loadDeveloperCockpit,
  mutateCampaign,
  mutateDeveloperCockpit,
  type BufferChannelView,
  type DeveloperCockpitView,
  type ProviderChannelBinding,
} from '@/features/developer-cockpit/client/api';
import {
  getCampaignStatusGuidance,
  getCampaignStatusLabel,
  matchesCampaignQueueFilter,
  type CampaignQueueFilter,
} from '@/features/developer-cockpit/client/campaignWorkflow';
import { CockpitConfirmationDialog } from '@/features/developer-cockpit/components/CockpitConfirmationDialog';
import { toLocalDateTime } from '@/features/developer-cockpit/components/DeveloperCampaignComposer';
import { DeveloperCampaignPackageDetails } from '@/features/developer-cockpit/components/DeveloperCampaignPackageDetails';
import {
  SOCIAL_SERVICE_LABELS,
  canTransitionCampaign,
  type SocialCampaign,
} from '@/features/developer-cockpit/model';

const fieldClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]';

export function DeveloperCampaignQueue({
  cockpit,
  onChange,
  onEdit,
  onMessage,
  onError,
}: {
  cockpit: DeveloperCockpitView;
  onChange: (cockpit: DeveloperCockpitView) => void;
  onEdit: (campaign: SocialCampaign) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const canApprove = cockpit.scopes.includes('campaigns.approve');
  const canPublish = cockpit.scopes.includes('campaigns.publish');
  const [filter, setFilter] = useState<CampaignQueueFilter>(
    cockpit.isOwner ? 'needs_action' : 'active',
  );
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<BufferChannelView[]>([]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});
  const [channelsLoading, setChannelsLoading] = useState(false);

  const jobsByCampaign = useMemo(() => {
    const map = new Map<string, DeveloperCockpitView['publishJobs']>();
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
      onChange(await loadDeveloperCockpit());
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
  ) => run(`${action}:${campaign.id}`, success, () => mutateCampaign('PATCH', {
    action,
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    reviewNote: reviewNotes[campaign.id] ?? '',
  }));

  const loadChannels = async () => {
    setChannelsLoading(true);
    onError('');
    try {
      setChannels(await loadBufferChannels());
      onMessage('Connected Buffer channels refreshed.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unable to load Buffer channels.');
    } finally {
      setChannelsLoading(false);
    }
  };

  const campaignBindings = (campaign: SocialCampaign): ProviderChannelBinding[] => campaign.variants.flatMap((variant) => {
    const channelId = bindings[`${campaign.id}:${variant.service}`];
    return channelId ? [{ service: variant.service, channelId }] : [];
  });

  const providerAction = (campaign: SocialCampaign, mode: 'draft' | 'schedule') => {
    const scheduleValue = scheduleTimes[campaign.id] ?? toLocalDateTime(campaign.requestedPublishAt);
    return run(`${mode}:${campaign.id}`, mode === 'draft' ? 'Buffer drafts created.' : 'Campaign scheduled in Buffer.', () => mutateDeveloperCockpit('provider', 'POST', {
      action: 'publish',
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      mode,
      dueAt: scheduleValue ? new Date(scheduleValue).toISOString() : campaign.requestedPublishAt,
      bindings: campaignBindings(campaign),
    }));
  };

  return (
    <section className="space-y-3" aria-labelledby="campaign-queue-heading">
      <div className="border border-[#5f4526] bg-[#15100a] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">Campaign packages</p>
            <h2 id="campaign-queue-heading" className="font-serif text-2xl text-[#fff1c7]">{cockpit.isOwner ? 'Campaign review and delivery' : 'Your campaign packages'}</h2>
          </div>
          <p className="text-sm text-[#c7b288]">{campaigns.length} shown / {cockpit.campaigns.length} total</p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="relative">
            <span className="sr-only">Search campaign packages</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#a98a55]" />
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
        <article className="border border-dashed border-[#5f4526] bg-[#100c08] p-6 text-center"><p className="text-sm text-[#c7b288]">{cockpit.campaigns.length ? 'No packages match this queue view.' : 'No campaign packages yet.'}</p></article>
      ) : campaigns.map((campaign) => {
        const reviewNote = reviewNotes[campaign.id] ?? '';
        const ownCampaign = campaign.contributorId === cockpit.currentUserId;
        const canEdit = ownCampaign && (campaign.status === 'draft' || campaign.status === 'changes_requested');
        const providerReady = ['approved', 'provider_draft', 'failed'].includes(campaign.status);
        const canCancel = (ownCampaign || cockpit.isOwner)
          && canTransitionCampaign(campaign.status, 'cancelled', cockpit.isOwner ? 'owner' : 'contributor');
        const cancelLabel = campaign.status === 'submitted' ? 'Withdraw submission' : campaign.status === 'draft' || campaign.status === 'changes_requested' ? 'Cancel draft' : 'Archive package';
        const jobs = jobsByCampaign.get(campaign.id) ?? [];
        const selectedBindings = campaignBindings(campaign);
        const scheduleValue = scheduleTimes[campaign.id] ?? toLocalDateTime(campaign.requestedPublishAt);
        const providerActionDisabled = !cockpit.provider.publishingEnabled
          || Boolean(busy)
          || selectedBindings.length === 0;

        return (
          <article key={campaign.id} className="border border-[#5f4526] bg-[#15100a] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-xl text-[#fff1c7]">{campaign.title}</h3><StatusBadge status={campaign.status} /></div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">{campaign.objective}</p>
                <p className="mt-2 text-xs text-[#a98a55]">
                  {campaign.contributorName ?? campaign.contributorEmail ?? campaign.contributorId}
                  {' / '}
                  version {campaign.version}
                  {' / '}
                  {campaign.variants.length} social post{campaign.variants.length === 1 ? '' : 's'}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#d2b77e]">
                  {getCampaignStatusGuidance(campaign.status, cockpit.isOwner)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? <Button type="button" className="min-h-11" variant="outline" onClick={() => onEdit(campaign)}>Edit</Button> : null}
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

            {campaign.reviewNote ? <p className="mt-3 border border-[#8c6436] bg-[#1b1209] p-3 text-sm text-[#f0bd75]">Owner note: {campaign.reviewNote}</p> : null}
            <DeveloperCampaignPackageDetails campaign={campaign} jobs={jobs} />

            {canApprove && campaign.status === 'submitted' ? (
              <div className="mt-4 border border-[#8c6436] bg-[#1b1209] p-4">
                <textarea aria-label={`Review note for ${campaign.title}`} className={`${fieldClassName} min-h-24`} value={reviewNote} onChange={(event) => setReviewNotes((current) => ({ ...current, [campaign.id]: event.target.value }))} placeholder="Owner review note or requested changes" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" className="min-h-11" variant="outline" disabled={Boolean(busy) || !reviewNote.trim()} onClick={() => void workflow(campaign, 'request_changes', 'Campaign returned with requested changes.')}>Request changes</Button>
                  <CockpitConfirmationDialog
                    trigger={<Button type="button" className="min-h-11" disabled={Boolean(busy)}><ShieldCheck className="mr-2 h-4 w-4" />Approve package and make media public</Button>}
                    title="Approve this package and its media?"
                    description={<><p>This promotes {campaign.variants.reduce((count, variant) => count + variant.attachments.length, 0)} protected image attachment(s) through stable public derivatives and unlocks owner publishing controls.</p><p className="mt-2">It does not send anything to Buffer yet.</p></>}
                    actionLabel="Approve package"
                    onConfirm={() => void workflow(campaign, 'approve', 'Campaign package and media approved.')}
                  />
                </div>
              </div>
            ) : null}

            {canPublish && providerReady ? (
              <div className="mt-4 border border-[#4a3823] bg-[#100c08] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.14em] text-[#e2aa4a]">Owner publishing controls</p><Button type="button" className="min-h-11" variant="outline" onClick={() => void loadChannels()} disabled={channelsLoading || !cockpit.provider.configured}>{channelsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Load Buffer channels</Button></div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {campaign.variants.map((variant) => <label key={variant.service} className="grid gap-1 text-xs text-[#c7b288]">{SOCIAL_SERVICE_LABELS[variant.service]} channel<select className={fieldClassName} value={bindings[`${campaign.id}:${variant.service}`] ?? ''} onChange={(event) => setBindings((current) => ({ ...current, [`${campaign.id}:${variant.service}`]: event.target.value }))}><option value="">Choose connected channel</option>{channels.filter((channel) => channel.service === variant.service).map((channel) => <option key={channel.id} value={channel.id}>{channel.displayName}{channel.isQueuePaused ? ' (paused)' : ''}</option>)}</select></label>)}
                  <label className="grid gap-1 text-xs text-[#c7b288]">Schedule time<input type="datetime-local" className={fieldClassName} value={scheduleTimes[campaign.id] ?? toLocalDateTime(campaign.requestedPublishAt)} onChange={(event) => setScheduleTimes((current) => ({ ...current, [campaign.id]: event.target.value }))} /></label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {campaign.status !== 'provider_draft' ? <CockpitConfirmationDialog trigger={<Button type="button" className="min-h-11" variant="outline" disabled={providerActionDisabled}>Create Buffer drafts</Button>} title="Create drafts in Buffer?" description={`This sends the approved copy and public media to ${selectedBindings.length} selected Buffer channel(s) as drafts. Nothing will be scheduled.`} actionLabel="Create Buffer drafts" onConfirm={() => void providerAction(campaign, 'draft')} /> : null}
                  <CockpitConfirmationDialog trigger={<Button type="button" className="min-h-11" disabled={providerActionDisabled || !scheduleValue}><CalendarClock className="mr-2 h-4 w-4" />Schedule approved package</Button>} title="Schedule this package in Buffer?" description={`This schedules the approved package for ${scheduleValue} across ${selectedBindings.length} selected channel(s).`} actionLabel="Schedule in Buffer" onConfirm={() => void providerAction(campaign, 'schedule')} />
                </div>
                {selectedBindings.length === 0 && cockpit.provider.publishingEnabled ? <p className="mt-3 text-xs leading-5 text-[#f0bd75]">Choose at least one connected channel before creating drafts or scheduling.</p> : null}
                {!cockpit.provider.publishingEnabled ? <p className="mt-3 text-xs leading-5 text-[#f0bd75]">Publishing remains disabled until the production provider checklist is complete.</p> : null}
              </div>
            ) : null}

            {jobs.length && canPublish ? (
              <div className="mt-3">
                <Button
                  type="button"
                  className="min-h-11"
                  variant="ghost"
                  onClick={() => void run(
                    `refresh:${campaign.id}`,
                    'Buffer delivery status refreshed.',
                    () => mutateDeveloperCockpit('provider', 'POST', {
                      action: 'refresh',
                      campaignId: campaign.id,
                    }),
                  )}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh delivery status
                </Button>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function StatusBadge({ status }: { status: SocialCampaign['status'] }) {
  return <span className="border border-[#6d4f2b] bg-[#100c08] px-2 py-1 text-xs uppercase tracking-[0.12em] text-[#e2aa4a]">{getCampaignStatusLabel(status)}</span>;
}
