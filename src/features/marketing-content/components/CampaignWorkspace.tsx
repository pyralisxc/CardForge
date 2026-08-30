"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Megaphone, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  mutateMarketingContent,
} from '@/features/marketing-content/client/api';
import {
  createEmptyCampaignDraft,
  CampaignComposer,
  getCampaignPayload,
  toCampaignDraft,
  type CampaignDraft,
} from '@/features/marketing-content/components/CampaignComposer';
import { CampaignQueue } from '@/features/marketing-content/components/CampaignQueue';
import type {
  MarketingContentWorkspaceView,
  MarketingContentPackage as SocialCampaign,
} from '@/features/marketing-content/model';

export function CampaignWorkspace({
  workspace,
  initialCampaignId,
  onRefresh,
}: {
  workspace: MarketingContentWorkspaceView;
  initialCampaignId?: string | null;
  onRefresh: () => Promise<void> | void;
}) {
  const canDraft = workspace.scopes.includes('campaigns.draft');
  const [showComposer, setShowComposer] = useState(false);
  const createDraft = useCallback(() => createEmptyCampaignDraft(
    workspace.marketingCampaigns.find((campaign) => campaign.status === 'active')
      ?? workspace.marketingCampaigns[0],
    workspace.marketingStrategy,
  ), [workspace.marketingCampaigns, workspace.marketingStrategy]);
  const [draft, setDraft] = useState<CampaignDraft>(createDraft);
  const [editing, setEditing] = useState<SocialCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const composerRef = useRef<HTMLDivElement>(null);
  const openedInitialCampaignId = useRef<string | null>(null);

  useEffect(() => {
    if (!showComposer) return;
    composerRef.current?.focus({ preventScroll: true });
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showComposer, editing?.id]);

  const resetComposer = () => {
    setEditing(null);
    setDraft(createDraft());
    setShowComposer(false);
  };

  const editCampaign = (campaign: SocialCampaign) => {
    setEditing(campaign);
    setDraft(toCampaignDraft(campaign));
    setShowComposer(true);
    setError('');
    setMessage('');
  };

  useEffect(() => {
    if (!initialCampaignId || openedInitialCampaignId.current === initialCampaignId) return;
    openedInitialCampaignId.current = initialCampaignId;
    if (initialCampaignId === 'new') {
      setEditing(null);
      setDraft(createDraft());
      setShowComposer(true);
      return;
    }
    const campaign = workspace.campaigns.find((candidate) => candidate.id === initialCampaignId);
    if (
      campaign
      && campaign.contributorId === workspace.currentUserId
      && (campaign.status === 'draft' || campaign.status === 'changes_requested')
    ) {
      setEditing(campaign);
      setDraft(toCampaignDraft(campaign));
      setShowComposer(true);
      setError('');
      setMessage('');
    }
  }, [workspace.campaigns, workspace.currentUserId, createDraft, initialCampaignId]);

  const saveCampaign = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const payload = getCampaignPayload(draft);
      await (editing
        ? mutateMarketingContent('PATCH', {
          action: 'save',
          campaignId: editing.id,
          expectedVersion: editing.version,
          campaign: payload,
        })
        : mutateMarketingContent('POST', payload));
      await onRefresh();
      setMessage(editing ? 'Campaign changes saved.' : 'Campaign draft created.');
      resetComposer();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save the campaign.');
    } finally {
      setBusy(false);
    }
  };

  const showError = (nextError: string) => {
    setError(nextError);
    if (nextError) setMessage('');
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--cf-border)] py-3">
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-[var(--cf-accent-strong)]" />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">Campaign workflow</p>
            <p className="text-sm text-[var(--cf-text-muted)]">{workspace.isOwner ? 'Review candidates here; destination and delivery controls stay in Owner.' : 'Draft, revise, and submit campaign packages as normal Library work.'}</p>
          </div>
        </div>
        {canDraft && !showComposer ? (
          <Button type="button" className="min-h-11" onClick={() => {
            setEditing(null);
            setDraft(createDraft());
            setShowComposer(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />New campaign package
          </Button>
        ) : null}
      </div>

      {error ? <p role="alert" className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]">{error}</p> : null}
      {message ? <p role="status" className="border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]">{message}</p> : null}

      {showComposer && canDraft ? (
        <div ref={composerRef} tabIndex={-1} className="scroll-mt-4 outline-none">
          <button type="button" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-[#f1c875] underline-offset-4 hover:underline" onClick={resetComposer}>
            <ArrowLeft className="h-4 w-4" /> Back to campaigns
          </button>
          <CampaignComposer
            draft={draft}
            editing={editing}
            busy={busy}
            mediaLibrary={workspace.campaignMedia}
            marketingCampaigns={workspace.marketingCampaigns}
            marketingStrategy={workspace.marketingStrategy}
            onDraftChange={setDraft}
            onCancel={resetComposer}
            onSave={() => void saveCampaign()}
            onError={showError}
          />
        </div>
      ) : null}

      {!canDraft ? (
        <article className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-5">
          <h2 className="font-serif text-xl text-[var(--cf-text-strong)]">Campaign drafting is not enabled</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">The owner can enable this scope independently from asset-library access.</p>
        </article>
      ) : null}

      {canDraft && workspace.marketingCampaigns.length === 0 ? (
        <article className="border border-[var(--cf-warning-border)] bg-[var(--cf-surface-inset)] p-5">
          <h2 className="font-serif text-xl text-[var(--cf-text-strong)]">A marketing campaign is required</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">The owner needs to create or activate a campaign in the Marketing workspace before contributors can submit content.</p>
        </article>
      ) : null}

      {!showComposer ? (
        <CampaignQueue
          workspace={workspace}
          onRefresh={onRefresh}
          onEdit={editCampaign}
          onMessage={setMessage}
          onError={showError}
        />
      ) : null}
    </section>
  );
}
