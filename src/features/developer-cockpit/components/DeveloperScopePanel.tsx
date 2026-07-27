"use client";

import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  mutateDeveloperCockpit,
  type DeveloperCockpitView,
} from '@/features/developer-cockpit/client/api';

type ScopeDraft = {
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
};

const createDrafts = (cockpit: DeveloperCockpitView): Record<string, ScopeDraft> => Object.fromEntries(
  cockpit.profiles.map((profile) => [
    profile.developerId,
    {
      canDraftCampaigns: profile.canDraftCampaigns,
      canProposeSiteContent: profile.canProposeSiteContent,
    },
  ]),
);

export function DeveloperScopePanel({
  cockpit,
  onChange,
}: {
  cockpit: DeveloperCockpitView;
  onChange: (cockpit: DeveloperCockpitView) => void;
}) {
  const [drafts, setDrafts] = useState(() => createDrafts(cockpit));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDrafts(createDrafts(cockpit));
  }, [cockpit]);

  const save = async (developerId: string) => {
    const draft = drafts[developerId];
    if (!draft) return;
    setBusy(developerId);
    setError('');
    setMessage('');
    try {
      onChange(await mutateDeveloperCockpit('scopes', 'PATCH', { developerId, ...draft }));
      setMessage('Contributor access updated successfully.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update contributor access.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="border border-[#5f4526] bg-[#15100a] p-5">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <ShieldCheck className="h-5 w-5" />
        <div><p className="text-xs uppercase tracking-[0.16em]">Owner-only</p><h2 className="font-serif text-2xl text-[#fff1c7]">Contributor access</h2></div>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c7b288]">Asset submission and peer review remain part of active developer access. Grant campaign drafting and site proposals independently; neither grant includes approval or publication.</p>
      {!cockpit.extendedContributionsEnabled ? <p className="mt-3 border border-[#8c6436] bg-[#1b1209] p-3 text-sm text-[#f0bd75]">Saved grants remain inactive until the updated contribution terms and privacy disclosure are published and extended contributions are enabled.</p> : null}
      {error ? <p role="alert" className="mt-3 border border-[#7d3d32] bg-[#1b0d09] p-3 text-sm text-[#ffd0c6]">{error}</p> : null}
      {message ? <p role="status" className="mt-3 border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]">{message}</p> : null}

      <div className="mt-4 space-y-3">
        {cockpit.profiles.map((profile) => {
          const draft = drafts[profile.developerId] ?? {
            canDraftCampaigns: profile.canDraftCampaigns,
            canProposeSiteContent: profile.canProposeSiteContent,
          };
          const active = profile.status === 'active';
          const dirty = draft.canDraftCampaigns !== profile.canDraftCampaigns
            || draft.canProposeSiteContent !== profile.canProposeSiteContent;
          return (
            <article key={profile.developerId} className="grid gap-3 border border-[#4a3823] bg-[#100c08] p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold text-[#ffe7ad]">{profile.displayName ?? profile.email ?? profile.developerId}</p>
                <p className="mt-1 text-xs text-[#a98a55]">{profile.email ?? profile.developerId} · <span className="capitalize">{profile.status}</span></p>
                {!active ? <p className="mt-1 text-xs text-[#f0bd75]">Reactivate this profile in developer administration before changing grants.</p> : null}
              </div>
              <label className={`flex min-h-11 items-center gap-2 text-sm ${active ? 'text-[#d8c49a]' : 'text-[#766b55]'}`}>
                <input className="h-5 w-5" type="checkbox" disabled={!active} checked={draft.canDraftCampaigns} onChange={(event) => setDrafts((current) => ({ ...current, [profile.developerId]: { ...draft, canDraftCampaigns: event.target.checked } }))} />
                Draft campaign packages
              </label>
              <label className={`flex min-h-11 items-center gap-2 text-sm ${active ? 'text-[#d8c49a]' : 'text-[#766b55]'}`}>
                <input className="h-5 w-5" type="checkbox" disabled={!active} checked={draft.canProposeSiteContent} onChange={(event) => setDrafts((current) => ({ ...current, [profile.developerId]: { ...draft, canProposeSiteContent: event.target.checked } }))} />
                Propose public-site copy
              </label>
              <Button type="button" className="min-h-11" size="sm" onClick={() => void save(profile.developerId)} disabled={busy === profile.developerId || !active || !dirty}>
                {busy === profile.developerId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save changes
              </Button>
            </article>
          );
        })}
        {cockpit.profiles.length === 0 ? <p className="border border-dashed border-[#5f4526] p-5 text-sm text-[#c7b288]">No developer profiles are available yet.</p> : null}
      </div>
    </section>
  );
}
