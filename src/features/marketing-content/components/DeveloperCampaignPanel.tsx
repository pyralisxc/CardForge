"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Megaphone, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  mutateMarketingContent,
} from '@/features/marketing-content/client/api';
import {
  createEmptyCampaignDraft,
  DeveloperCampaignComposer,
  getCampaignPayload,
  toCampaignDraft,
  type CampaignDraft,
} from '@/features/marketing-content/components/DeveloperCampaignComposer';
import { DeveloperCampaignQueue } from '@/features/marketing-content/components/DeveloperCampaignQueue';
import type {
  MarketingContentWorkspaceView,
  MarketingContentPackage as SocialCampaign,
} from '@/features/marketing-content/model';

export function DeveloperCampaignPanel({
  cockpit,
  onRefresh,
}: {
  cockpit: MarketingContentWorkspaceView;
  onRefresh: () => Promise<void> | void;
}) {
  const canDraft = cockpit.scopes.includes('campaigns.draft');
  const [showComposer, setShowComposer] = useState(false);
  const createDraft = () => createEmptyCampaignDraft(
    cockpit.marketingCampaigns.find((campaign) => campaign.status === 'active')
      ?? cockpit.marketingCampaigns[0],
    cockpit.marketingStrategy,
  );
  const [draft, setDraft] = useState<CampaignDraft>(createDraft);
  const [editing, setEditing] = useState<SocialCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const composerRef = useRef<HTMLDivElement>(null);

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
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#5f4526] bg-[#15100a] p-4">
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-[#e2aa4a]" />
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">{cockpit.isOwner ? 'Owner review workspace' : 'Campaign packages'}</p>
            <p className="text-sm text-[#c7b288]">{cockpit.isOwner ? 'Review each candidate as your audience will see it, complete its media, and move only approved work toward publishing.' : 'Keep social copy, media, rights information, release context, approval, and delivery history together.'}</p>
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

      {error ? <p role="alert" className="border border-[#7d3d32] bg-[#1b0d09] p-3 text-sm text-[#ffd0c6]">{error}</p> : null}
      {message ? <p role="status" className="border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]">{message}</p> : null}

      {showComposer && canDraft ? (
        <div ref={composerRef} tabIndex={-1} className="scroll-mt-4 outline-none">
          <button type="button" className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-[#f1c875] underline-offset-4 hover:underline" onClick={resetComposer}>
            <ArrowLeft className="h-4 w-4" /> Back to candidate queue
          </button>
          <DeveloperCampaignComposer
            draft={draft}
            editing={editing}
            busy={busy}
            mediaLibrary={cockpit.campaignMedia}
            marketingCampaigns={cockpit.marketingCampaigns}
            marketingStrategy={cockpit.marketingStrategy}
            onDraftChange={setDraft}
            onCancel={resetComposer}
            onSave={() => void saveCampaign()}
            onError={showError}
          />
        </div>
      ) : null}

      {!canDraft ? (
        <article className="border border-[#7d5a2e] bg-[#181009] p-5">
          <h2 className="font-serif text-xl text-[#fff1c7]">Campaign drafting is not enabled</h2>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">The owner can enable this scope independently from asset-library access.</p>
        </article>
      ) : null}

      {canDraft && cockpit.marketingCampaigns.length === 0 ? (
        <article className="border border-[#7d5a2e] bg-[#181009] p-5">
          <h2 className="font-serif text-xl text-[#fff1c7]">A marketing campaign is required</h2>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">The owner needs to create or activate a campaign in the Marketing workspace before contributors can submit content.</p>
        </article>
      ) : null}

      {!showComposer ? (
        <DeveloperCampaignQueue
          cockpit={cockpit}
          onRefresh={onRefresh}
          onEdit={editCampaign}
          onMessage={setMessage}
          onError={showError}
        />
      ) : null}
    </section>
  );
}
