"use client";

import { useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  loadDeveloperCockpit,
  mutateCampaign,
  type DeveloperCockpitView,
} from '@/features/developer-cockpit/client/api';
import {
  createEmptyCampaignDraft,
  DeveloperCampaignComposer,
  getCampaignPayload,
  toCampaignDraft,
  type CampaignDraft,
} from '@/features/developer-cockpit/components/DeveloperCampaignComposer';
import { DeveloperCampaignQueue } from '@/features/developer-cockpit/components/DeveloperCampaignQueue';
import type { SocialCampaign } from '@/features/developer-cockpit/model';

export function DeveloperCampaignPanel({
  cockpit,
  onChange,
}: {
  cockpit: DeveloperCockpitView;
  onChange: (cockpit: DeveloperCockpitView) => void;
}) {
  const canDraft = cockpit.scopes.includes('campaigns.draft');
  const [showComposer, setShowComposer] = useState(canDraft && cockpit.campaigns.length === 0);
  const [draft, setDraft] = useState<CampaignDraft>(createEmptyCampaignDraft);
  const [editing, setEditing] = useState<SocialCampaign | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const resetComposer = () => {
    setEditing(null);
    setDraft(createEmptyCampaignDraft());
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
        ? mutateCampaign('PATCH', {
          action: 'save',
          campaignId: editing.id,
          expectedVersion: editing.version,
          campaign: payload,
        })
        : mutateCampaign('POST', payload));
      onChange(await loadDeveloperCockpit());
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
            <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">Campaign packages</p>
            <p className="text-sm text-[#c7b288]">A campaign package keeps social post copy, media, rights information, release context, approval, and delivery history together.</p>
          </div>
        </div>
        {canDraft && !showComposer ? (
          <Button type="button" className="min-h-11" onClick={() => {
            setEditing(null);
            setDraft(createEmptyCampaignDraft());
            setShowComposer(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />New campaign package
          </Button>
        ) : null}
      </div>

      {error ? <p role="alert" className="border border-[#7d3d32] bg-[#1b0d09] p-3 text-sm text-[#ffd0c6]">{error}</p> : null}
      {message ? <p role="status" className="border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]">{message}</p> : null}

      {showComposer && canDraft ? (
        <DeveloperCampaignComposer
          draft={draft}
          editing={editing}
          busy={busy}
          mediaLibrary={cockpit.campaignMedia}
          onDraftChange={setDraft}
          onCancel={resetComposer}
          onSave={() => void saveCampaign()}
          onError={showError}
        />
      ) : null}

      {!canDraft ? (
        <article className="border border-[#7d5a2e] bg-[#181009] p-5">
          <h2 className="font-serif text-xl text-[#fff1c7]">Campaign drafting is not enabled</h2>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">The owner can enable this scope independently from asset-library access.</p>
        </article>
      ) : null}

      <DeveloperCampaignQueue
        cockpit={cockpit}
        onChange={onChange}
        onEdit={editCampaign}
        onMessage={setMessage}
        onError={showError}
      />
    </section>
  );
}
