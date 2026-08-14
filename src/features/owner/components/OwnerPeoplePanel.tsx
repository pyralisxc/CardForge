"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Save, Search, ShieldOff, Trash2, UserRoundCog, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type {
  OwnerPeoplePage,
  OwnerPerson,
} from '@/features/owner/model/ownerConsoleClient';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { formatOwnerDateTime, OwnerMetricTile } from './OwnerPanelPrimitives';

type PeopleFilter = 'all' | 'developers' | 'active' | 'needs_attention';

type PersonDraft = {
  access: OwnerPerson['access'];
  owner: boolean;
  accountNote: string;
  profileStatus: NonNullable<OwnerPerson['profileStatus']>;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
  monthlySubmissionLimitOverride: string;
  monthlyPublishedRequirementOverride: string;
  profitShareEligible: boolean;
  developerNote: string;
};

const inputClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 text-[#ffe7ad] outline-none focus:border-[#d8b365]';

const createDraft = (person: OwnerPerson): PersonDraft => ({
  access: person.access,
  owner: person.isOwner,
  accountNote: person.accountNote,
  profileStatus: person.profileStatus ?? 'active',
  canDraftCampaigns: person.canDraftCampaigns,
  canProposeSiteContent: person.canProposeSiteContent,
  monthlySubmissionLimitOverride: person.monthlySubmissionLimitOverride === null ? '' : String(person.monthlySubmissionLimitOverride),
  monthlyPublishedRequirementOverride: person.monthlyPublishedRequirementOverride === null ? '' : String(person.monthlyPublishedRequirementOverride),
  profitShareEligible: person.profitShareEligible,
  developerNote: person.developerNote,
});

const identityLabel = (person: OwnerPerson) => {
  if (person.identityState === 'history_only') return 'History only';
  if (person.identityState === 'account_only') return 'Account only';
  return 'Connected';
};

export function OwnerPeoplePanel({ currentOwnerId }: { currentOwnerId: string | null }) {
  const { toast } = useToast();
  const [people, setPeople] = useState<OwnerPeoplePage | null>(null);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<OwnerPerson | null>(null);
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ query, filter, page: String(page), pageSize: '12' });
      const response = await fetch(`/api/owner/people?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load people and developer access.'));
      const body = await response.json() as { people: OwnerPeoplePage };
      setPeople(body.people);
      if (body.people.page !== page) setPage(body.people.page);
      setSelected((current) => current ? body.people.items.find((person) => person.id === current.id) ?? null : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load people and developer access.');
    } finally {
      setLoading(false);
    }
  }, [filter, page, query]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setDraft(selected ? createDraft(selected) : null);
    setDeleteConfirmation('');
  }, [selected]);

  const totalPages = useMemo(() => people ? Math.max(1, Math.ceil(people.total / people.pageSize)) : 1, [people]);

  const mutate = async (method: 'PATCH' | 'DELETE', body: Record<string, unknown>, successTitle: string) => {
    setBusy(true);
    try {
      const response = await fetch('/api/owner/people', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update this person.'));
      const result = await response.json() as { warnings?: string[] };
      const warnings = result.warnings ?? [];
      toast({
        title: successTitle,
        description: warnings.length ? warnings.join(' ') : 'Account, developer authority, and owner history are synchronized.',
        variant: warnings.length ? 'destructive' : 'default',
      });
      setSelected(null);
      await load();
    } catch (nextError) {
      toast({ title: 'Person not updated', description: nextError instanceof Error ? nextError.message : 'Unable to update this person.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!selected || !draft) return;
    void mutate('PATCH', {
      action: 'update',
      userId: selected.id,
      account: { access: draft.access, owner: draft.owner, note: draft.accountNote },
      developer: {
        status: draft.profileStatus,
        canDraftCampaigns: draft.canDraftCampaigns,
        canProposeSiteContent: draft.canProposeSiteContent,
        monthlySubmissionLimitOverride: draft.monthlySubmissionLimitOverride,
        monthlyPublishedRequirementOverride: draft.monthlyPublishedRequirementOverride,
        profitShareEligible: draft.profitShareEligible,
        ownerNote: draft.developerNote,
      },
    }, 'Person controls saved');
  };

  return (
    <section className="space-y-4">
      <header className="border border-[#5f4526] bg-[#15100a] p-5">
        <div className="flex items-center gap-3 text-[#e2aa4a]"><Users className="h-5 w-5" aria-hidden="true" /><div><p className="text-xs uppercase tracking-[0.16em]">One people directory</p><h2 className="font-serif text-2xl text-[#fff1c7]">Accounts &amp; developers</h2></div></div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#c7b288]">Clerk owns sign-in and account entitlement. CardForge owns contribution status, scopes, quotas, and history. A connected row shows both; a history-only row preserves attribution after its Clerk account was deleted.</p>
        {people ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><OwnerMetricTile label="Clerk accounts" value={String(people.summary.accounts)} /><OwnerMetricTile label="Active developers" value={String(people.summary.activeDevelopers)} /><OwnerMetricTile label="History only" value={String(people.summary.historyOnly)} /><OwnerMetricTile label="Needs attention" value={String(people.summary.needsAttention)} /></div> : null}
      </header>

      <div className="border border-[#5f4526] bg-[#100c08] p-4">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryDraft.trim()); }}>
          <label className="grid gap-1 text-xs text-[#c7b288]">Search name, email, or identity<input className={inputClassName} value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} /></label>
          <label className="grid gap-1 text-xs text-[#c7b288]">Directory view<select className={inputClassName} value={filter} onChange={(event) => { setFilter(event.target.value as PeopleFilter); setPage(1); }}><option value="all">Everyone</option><option value="developers">Developer-linked</option><option value="active">Active profiles</option><option value="needs_attention">Needs attention</option></select></label>
          <Button type="submit" className="self-end bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"><Search className="mr-2 h-4 w-4" />Search</Button>
        </form>
      </div>

      {error ? <p role="alert" className="border border-[#7d3d32] bg-[#1b0d09] p-4 text-sm text-[#ffd0c6]">{error}</p> : null}
      {loading && !people ? <p className="border border-[#5f4526] bg-[#15100a] p-5 text-sm text-[#c7b288]">Loading people directory...</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-2">
          {people?.items.map((person) => {
            const attention = person.identityState === 'history_only' || (person.profileStatus === 'active' && person.access !== 'dev' && !person.isOwner) || (person.access === 'dev' && person.profileStatus === null);
            return <button key={person.id} type="button" onClick={() => setSelected(person)} className={`w-full border p-4 text-left transition-colors ${selected?.id === person.id ? 'border-[#d8b365] bg-[#2a1b0d]' : 'border-[#4a3823] bg-[#15100a] hover:border-[#8c6436]'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#ffe7ad]">{person.name}</p><p className="mt-1 text-xs text-[#a98a75]">{person.email ?? person.id}</p></div><div className="flex flex-wrap gap-2"><span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${attention ? 'border-[#8c6436] text-[#f0bd75]' : 'border-[#497352] text-[#a8e7b8]'}`}>{identityLabel(person)}</span><span className="border border-[#5f4526] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#d8c49a]">{person.isOwner ? 'Owner' : person.access}</span>{person.profileStatus ? <span className="border border-[#5f4526] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#d8c49a]">{person.profileStatus}</span> : null}</div></div>
              <p className="mt-3 text-xs text-[#c7b288]">{person.submissions.total} submissions · {person.submissions.published} published · {person.submissions.inReview} in review · Last sign-in {formatOwnerDateTime(person.lastSignInAt)}</p>
            </button>;
          })}
          {people && people.items.length === 0 ? <p className="border border-dashed border-[#5f4526] p-5 text-sm text-[#c7b288]">No people match this view.</p> : null}
          {people ? <div className="flex items-center justify-between gap-3 border border-[#4a3823] bg-[#100c08] p-3 text-xs text-[#c7b288]"><span>Page {people.page} of {totalPages} · {people.total} results</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={people.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button><Button type="button" size="sm" variant="outline" disabled={people.page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></div> : null}
        </div>

        <aside className="border border-[#5f4526] bg-[#15100a] p-5 xl:sticky xl:top-4 xl:self-start">
          {!selected || !draft ? <div className="text-sm leading-6 text-[#c7b288]"><UserRoundCog className="mb-3 h-6 w-6 text-[#e2aa4a]" /><h3 className="font-serif text-xl text-[#fff1c7]">Choose a person</h3><p className="mt-2">Open one row to update account entitlement, developer participation, contribution lanes, notes, or removal.</p></div> : <>
            <h3 className="font-serif text-xl text-[#fff1c7]">{selected.name}</h3>
            <p className="mt-1 text-xs text-[#a98a75]">{selected.email ?? selected.id}</p>
            {selected.identityState === 'history_only' ? <div className="mt-4 border border-[#8c6436] bg-[#1b1209] p-3 text-sm leading-6 text-[#f0bd75]"><AlertTriangle className="mr-2 inline h-4 w-4" />This Clerk account no longer exists. Contribution history remains intentionally attributed to this profile.</div> : null}

            {selected.identityState !== 'history_only' ? <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-[#c7b288]">Account access<select className={inputClassName} value={draft.access} onChange={(event) => setDraft((current) => current ? { ...current, access: event.target.value as PersonDraft['access'] } : current)}><option value="free">Free</option><option value="paid">Creator Pass</option><option value="dev">Developer</option></select></label>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]"><span>Owner authority<span className="mt-1 block text-[11px] text-[#a98a75]">{selected.ownerSource === 'environment' ? 'Owned by the Vercel owner-email allowlist.' : 'Owned by Clerk private metadata.'}</span></span><input type="checkbox" checked={draft.owner} disabled={selected.id === currentOwnerId || selected.ownerSource === 'environment'} onChange={(event) => setDraft((current) => current ? { ...current, owner: event.target.checked } : current)} /></label>
              <label className="grid gap-1 text-xs text-[#c7b288]">Account note<textarea className="min-h-20 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={draft.accountNote} onChange={(event) => setDraft((current) => current ? { ...current, accountNote: event.target.value } : current)} /></label>
            </div> : null}

            {(selected.profileStatus !== null || draft.access === 'dev' || draft.owner || selected.identityState === 'history_only') ? <div className="mt-4 grid gap-3 border-t border-[#4a3823] pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a98a55]">Developer contribution controls</p>
              <label className="grid gap-1 text-xs text-[#c7b288]">Profile status<select className={inputClassName} value={draft.profileStatus} onChange={(event) => setDraft((current) => current ? { ...current, profileStatus: event.target.value as PersonDraft['profileStatus'] } : current)}><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">Draft campaign packages<input type="checkbox" checked={draft.canDraftCampaigns} onChange={(event) => setDraft((current) => current ? { ...current, canDraftCampaigns: event.target.checked } : current)} /></label>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">Propose public-site copy<input type="checkbox" checked={draft.canProposeSiteContent} onChange={(event) => setDraft((current) => current ? { ...current, canProposeSiteContent: event.target.checked } : current)} /></label>
              <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-[#c7b288]">Monthly submission override<input className={inputClassName} inputMode="numeric" placeholder="Use program default" value={draft.monthlySubmissionLimitOverride} onChange={(event) => setDraft((current) => current ? { ...current, monthlySubmissionLimitOverride: event.target.value } : current)} /></label><label className="grid gap-1 text-xs text-[#c7b288]">Published requirement override<input className={inputClassName} inputMode="numeric" placeholder="Use program default" value={draft.monthlyPublishedRequirementOverride} onChange={(event) => setDraft((current) => current ? { ...current, monthlyPublishedRequirementOverride: event.target.value } : current)} /></label></div>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">Future creator-pool eligible<input type="checkbox" checked={draft.profitShareEligible} onChange={(event) => setDraft((current) => current ? { ...current, profitShareEligible: event.target.checked } : current)} /></label>
              <label className="grid gap-1 text-xs text-[#c7b288]">Developer note<textarea className="min-h-20 border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={draft.developerNote} onChange={(event) => setDraft((current) => current ? { ...current, developerNote: event.target.value } : current)} /></label>
            </div> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {selected.identityState !== 'history_only' ? <Button type="button" disabled={busy} onClick={save} className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]"><Save className="mr-2 h-4 w-4" />Save controls</Button> : null}
              {selected.id !== currentOwnerId ? <Button type="button" disabled={busy} variant="outline" onClick={() => void mutate('PATCH', { action: selected.identityState === 'history_only' ? 'deactivate_history' : 'revoke', userId: selected.id }, selected.identityState === 'history_only' ? 'Retained profile deactivated' : 'Developer access revoked')}><ShieldOff className="mr-2 h-4 w-4" />{selected.identityState === 'history_only' ? 'Deactivate retained profile' : 'Revoke developer access'}</Button> : null}
            </div>

            {selected.identityState !== 'history_only' && selected.id !== currentOwnerId && !selected.isOwner ? <div className="mt-5 border border-[#7d3d32] bg-[#1b0d09] p-3">
              <p className="text-sm font-semibold text-[#ffd0c6]">Delete Clerk account</p><p className="mt-1 text-xs leading-5 text-[#e7b3a8]">This permanently removes sign-in. CardForge retains contribution and vote attribution, then marks the developer profile inactive.</p>
              <label className="mt-3 grid gap-1 text-xs text-[#e7b3a8]">Type {selected.email ?? selected.id}<input className={inputClassName} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
              <Button type="button" className="mt-3 bg-[#8f3024] text-white hover:bg-[#a93b2d]" disabled={busy || deleteConfirmation.trim().toLowerCase() !== (selected.email ?? selected.id).toLowerCase()} onClick={() => void mutate('DELETE', { userId: selected.id, confirmation: deleteConfirmation }, 'Clerk account deleted')}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>
            </div> : null}
          </>}
        </aside>
      </div>
    </section>
  );
}
