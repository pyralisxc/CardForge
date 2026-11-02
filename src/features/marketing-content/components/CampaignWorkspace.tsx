"use client";

import { campaignDraftMutationResult, campaignDraftReadResult, campaignDraftCreationReceipt } from '@/features/marketing-content/campaignDraftContract';
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
import { canSaveCampaignDraft, normalizeCampaignInput } from '@/features/marketing-content/model';
import type {
  MarketingContentWorkspaceView,
  MarketingContentPackage as SocialCampaign,
} from '@/features/marketing-content/model';

export function CampaignWorkspace({
  workspace,
  initialCampaignId,
  onRefresh,
  onDirtyChange,
  onCloseBlockedChange,
  searchQuery,
  onSearchQueryChange,
}: {
  workspace: MarketingContentWorkspaceView;
  onDirtyChange?: (dirty: boolean) => void;
  onCloseBlockedChange?: (reason: string | null) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  initialCampaignId?: string | null;
  onRefresh: () => Promise<void | boolean> | void | boolean;
}) {
  const canDraft = workspace.scopes.includes('campaigns.draft');
  const [showComposer, setShowComposer] = useState(false);
  const createDraft = useCallback(() => createEmptyCampaignDraft(
    workspace.marketingCampaigns.find((campaign) => campaign.status === 'active')
      ?? workspace.marketingCampaigns[0],
    workspace.marketingStrategy,
  ), [workspace.marketingCampaigns, workspace.marketingStrategy]);
  const [draft, setDraft] = useState<CampaignDraft>(createDraft);
  const [draftBaseline, setDraftBaseline] = useState(draft);
  const replaceDraft = useCallback((next: CampaignDraft) => { setDraftBaseline(next); setDraft(next); }, []);
  const [editing, setEditing] = useState<SocialCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [identityOnly, setIdentityOnly] = useState(false);
  const [attempt, setAttempt] = useState<{campaignId:string|null;idempotencyKey:string}|null>(null);
  const dirty = showComposer && (busy || JSON.stringify(draft) !== JSON.stringify(draftBaseline));
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => { onCloseBlockedChange?.(busy || unconfirmed || identityOnly ? 'Read the retained Campaign outcome before starting a Set.' : null); return () => onCloseBlockedChange?.(null); }, [busy, unconfirmed, identityOnly, onCloseBlockedChange]);
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
    replaceDraft(createDraft());
    setShowComposer(false);
  };

  const editCampaign = (campaign: SocialCampaign) => {
    setEditing(campaign);
    replaceDraft(toCampaignDraft(campaign));
    setShowComposer(true);
    setError('');
    setMessage('');
  };

  useEffect(() => {
    if (!initialCampaignId || openedInitialCampaignId.current === initialCampaignId) return;
    openedInitialCampaignId.current = initialCampaignId;
    if (initialCampaignId === 'new') {
      setEditing(null);
      replaceDraft(createDraft());
      setShowComposer(true);
      return;
    }
    const campaign = workspace.campaigns.find((candidate) => candidate.id === initialCampaignId);
    if (
      campaign
      && canSaveCampaignDraft(campaign, { isOwner: workspace.isOwner, user: { id: workspace.currentUserId } })
    ) {
      setEditing(campaign);
      replaceDraft(toCampaignDraft(campaign));
      setShowComposer(true);
      setError('');
      setMessage('');
    }
  }, [workspace.campaigns, workspace.currentUserId, workspace.isOwner, createDraft, initialCampaignId, replaceDraft]);

  const saveCampaign = async () => {
    if (busy || unconfirmed || identityOnly) return;
    setBusy(true);
    setAttempt({campaignId:editing?.id??null,idempotencyKey:draft.idempotencyKey});
    setError('');
    setMessage('');
    try {
      const payload = getCampaignPayload(draft);
      const result = await (editing
        ? mutateMarketingContent('PATCH', {
          action: 'save',
          campaignId: editing.id,
          expectedVersion: editing.version,
          campaign: payload,
        })
        : mutateMarketingContent('POST', payload));
      const parsed = campaignDraftMutationResult.safeParse(result);
      if (!parsed.success || !parsed.data.receipt.identityAcknowledged || (editing && (parsed.data.campaignId !== editing.id || parsed.data.receipt.committed !== true))) { setUnconfirmed(true); setError('Campaign outcome is unconfirmed. Read exact retained state; do not replay automatically.'); return; }
      setMessage((editing ? 'Campaign changes saved; native commit confirmed. ' : 'Native create acknowledged a retained Campaign identity; this does not prove newly created or changed content. ') + parsed.data.receipt.warnings.join(' '));
      const requested = normalizeCampaignInput(payload);
      const observed = parsed.data.campaign ? normalizeCampaignInput(parsed.data.campaign) : null;
      if (!editing && (!requested.ok || !observed?.ok || JSON.stringify(requested.value) !== JSON.stringify(observed.value))) {
        setIdentityOnly(true);
        setMessage(previous => previous + ' Attempted draft content remains here because retained content was not confirmed to match. Read retained state before any further edit.');
      } else resetComposer();
      try { const refreshed = await onRefresh(); if (refreshed === false) throw new Error('Refresh incomplete'); } catch { setMessage(previous => previous + ' Campaign refresh is incomplete. Do not repeat the acknowledged operation.'); }
    } catch (nextError) {
      if (!(nextError instanceof Error && 'status' in nextError && typeof nextError.status === 'number' && nextError.status < 500)) setUnconfirmed(true);
      setError(nextError instanceof Error ? nextError.message : 'Campaign outcome is unconfirmed. Read exact retained state; do not replay automatically.');
    } finally {
      setBusy(false);
    }
  };

  const readAttempt = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    try {
      const path = attempt.campaignId ? attempt.campaignId : `creation-receipt?idempotencyKey=${encodeURIComponent(attempt.idempotencyKey)}`;
      const response = await fetch(`/api/marketing-content/campaigns/${path}`, { cache:'no-store' });
      if (!response.ok) throw new Error('Exact retained Campaign state is unavailable; no absence was established.');
      const raw = await response.json();
      const parsed = attempt.campaignId ? campaignDraftReadResult.safeParse(raw) : campaignDraftCreationReceipt.safeParse(raw);
      if (!parsed.success || (attempt.campaignId && parsed.data.campaign?.id !== attempt.campaignId)) throw new Error('Retained Campaign readback identity could not be verified.');
      const result = parsed.data;
      if (result.campaign) setMessage(`Observed retained Campaign ${result.campaign.id}, version ${result.campaign.version}. Matching state does not prove the previous operation committed. No request was replayed.`);
      else if ('campaignId' in result && result.campaignId) setMessage(`Observed retained Campaign identity ${result.campaignId}; full readback is unavailable. This does not prove prior operation causation. No request was replayed.`);
      else setMessage('No retained Campaign identity was observed. An in-flight operation is not ruled out; do not replay automatically.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Retained Campaign read is unavailable.'); }
    finally { setBusy(false); }
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
            replaceDraft(createDraft());
            setShowComposer(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />New campaign package
          </Button>
        ) : null}
      </div>

      {error ? <p role="alert" className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]">{error}</p> : null}
      {unconfirmed || identityOnly ? <p role="alert">{unconfirmed ? 'Campaign outcome is unconfirmed. Do not replay automatically.' : 'A retained Campaign identity is acknowledged; attempted draft content has not been confirmed. Do not repeat Create.'} <Button disabled={busy} onClick={() => void readAttempt()}>Read retained Campaign state</Button></p> : null}
      {message ? <p role="status" className="border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]">{message}</p> : null}

      {showComposer && canDraft ? (
        <div ref={composerRef} tabIndex={-1} className="scroll-mt-4 outline-none">
          <button type="button" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-[#f1c875] underline-offset-4 hover:underline" onClick={resetComposer}>
            <ArrowLeft className="h-4 w-4" /> Back to campaigns
          </button>
          <CampaignComposer
            draft={draft}
            editing={editing}
            busy={busy || unconfirmed || identityOnly}
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
        <CampaignQueue searchQuery={searchQuery} onSearchQueryChange={onSearchQueryChange}
          workspace={workspace}
          onRefresh={async () => { await onRefresh(); }}
          onEdit={editCampaign}
          onMessage={setMessage}
          onError={showError}
        />
      ) : null}
    </section>
  );
}
