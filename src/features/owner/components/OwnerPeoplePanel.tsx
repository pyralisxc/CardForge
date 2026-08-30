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

type PeopleFilter = 'all' | 'contributors' | 'active' | 'needs_attention';

type PersonDraft = {
  access: OwnerPerson['access'];
  owner: boolean;
  accountNote: string;
  profileStatus: NonNullable<OwnerPerson['profileStatus']>;
  canDraftCampaigns: boolean;
  canProposeSiteContent: boolean;
  monthlySubmissionLimitOverride: string;
  monthlyPublishedRequirementOverride: string;
  contributorNote: string;
};

const inputClassName = 'min-h-11 w-full border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)] outline-none focus:border-[var(--cf-accent)]';

const createDraft = (person: OwnerPerson): PersonDraft => ({
  access: person.access,
  owner: person.isOwner,
  accountNote: person.accountNote,
  profileStatus: person.profileStatus ?? 'active',
  canDraftCampaigns: person.canDraftCampaigns,
  canProposeSiteContent: person.canProposeSiteContent,
  monthlySubmissionLimitOverride: person.monthlySubmissionLimitOverride === null ? '' : String(person.monthlySubmissionLimitOverride),
  monthlyPublishedRequirementOverride: person.monthlyPublishedRequirementOverride === null ? '' : String(person.monthlyPublishedRequirementOverride),
  contributorNote: person.contributorNote,
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
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load people and contributor access.'));
      const body = await response.json() as { people: OwnerPeoplePage };
      setPeople(body.people);
      if (body.people.page !== page) setPage(body.people.page);
      setSelected((current) => current ? body.people.items.find((person) => person.id === current.id) ?? null : null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load people and contributor access.');
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
        description: warnings.length ? warnings.join(' ') : 'Account, contributor authority, and owner history are synchronized.',
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
      contributor: {
        status: draft.profileStatus,
        canDraftCampaigns: draft.canDraftCampaigns,
        canProposeSiteContent: draft.canProposeSiteContent,
        monthlySubmissionLimitOverride: draft.monthlySubmissionLimitOverride,
        monthlyPublishedRequirementOverride: draft.monthlyPublishedRequirementOverride,
        ownerNote: draft.contributorNote,
      },
    }, 'Person controls saved');
  };

  return (
    <section className="space-y-4">
      <header className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
        <div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Users className="h-5 w-5" aria-hidden="true" /><div><p className="text-xs uppercase tracking-[0.16em]">One people directory</p><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Accounts &amp; contributors</h2></div></div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">Clerk owns sign-in and account entitlement. CardForge owns contribution status, scopes, quotas, and history. A connected row shows both; a history-only row preserves attribution after its Clerk account was deleted.</p>
        {people ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><OwnerMetricTile label="Clerk accounts" value={String(people.summary.accounts)} /><OwnerMetricTile label="Active contributors" value={String(people.summary.activeContributors)} /><OwnerMetricTile label="History only" value={String(people.summary.historyOnly)} /><OwnerMetricTile label="Needs attention" value={String(people.summary.needsAttention)} /></div> : null}
      </header>

      <div className="border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryDraft.trim()); }}>
          <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Search name, email, or identity<input className={inputClassName} value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} /></label>
          <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Directory view<select className={inputClassName} value={filter} onChange={(event) => { setFilter(event.target.value as PeopleFilter); setPage(1); }}><option value="all">Everyone</option><option value="contributors">Contributor-linked</option><option value="active">Active profiles</option><option value="needs_attention">Needs attention</option></select></label>
          <Button type="submit" className="self-end bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"><Search className="mr-2 h-4 w-4" />Search</Button>
        </form>
      </div>

      {error ? <p role="alert" className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-4 text-sm text-[var(--cf-danger)]">{error}</p> : null}
      {loading && !people ? <p className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5 text-sm text-[var(--cf-text-muted)]">Loading people directory...</p> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="space-y-2">
          {people?.items.map((person) => {
            const attention = person.identityState === 'history_only' || (person.profileStatus === 'active' && person.access !== 'dev' && !person.isOwner) || (person.access === 'dev' && person.profileStatus === null);
            return <button key={person.id} type="button" onClick={() => setSelected(person)} className={`w-full border p-4 text-left transition-colors ${selected?.id === person.id ? 'border-[var(--cf-accent)] bg-[var(--cf-surface-hover)]' : 'border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] hover:border-[var(--cf-warning-border)]'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[var(--cf-accent-text)]">{person.name}</p><p className="mt-1 text-xs text-[var(--cf-text-subtle)]">{person.email ?? person.id}</p></div><div className="flex flex-wrap gap-2"><span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${attention ? 'border-[var(--cf-warning-border)] text-[var(--cf-warning)]' : 'border-[#497352] text-[#a8e7b8]'}`}>{identityLabel(person)}</span><span className="border border-[var(--cf-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">{person.isOwner ? 'Owner' : person.access}</span>{person.profileStatus ? <span className="border border-[var(--cf-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">{person.profileStatus}</span> : null}</div></div>
              <p className="mt-3 text-xs text-[var(--cf-text-muted)]">{person.submissions.total} submissions · {person.submissions.published} published · {person.submissions.inReview} in review · Last sign-in {formatOwnerDateTime(person.lastSignInAt)}</p>
            </button>;
          })}
          {people && people.items.length === 0 ? <p className="border border-dashed border-[var(--cf-border)] p-5 text-sm text-[var(--cf-text-muted)]">No people match this view.</p> : null}
          {people ? <div className="flex items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-xs text-[var(--cf-text-muted)]"><span>Page {people.page} of {totalPages} · {people.total} results</span><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={people.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button><Button type="button" size="sm" variant="outline" disabled={people.page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></div> : null}
        </div>

        <aside className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5 xl:sticky xl:top-4 xl:self-start">
          {!selected || !draft ? <div className="text-sm leading-6 text-[var(--cf-text-muted)]"><UserRoundCog className="mb-3 h-6 w-6 text-[var(--cf-accent-strong)]" /><h3 className="font-serif text-xl text-[var(--cf-text-strong)]">Choose a person</h3><p className="mt-2">Open one row to update account entitlement, contributor participation, contribution lanes, notes, or removal.</p></div> : <>
            <h3 className="font-serif text-xl text-[var(--cf-text-strong)]">{selected.name}</h3>
            <p className="mt-1 text-xs text-[var(--cf-text-subtle)]">{selected.email ?? selected.id}</p>
            {selected.identityState === 'history_only' ? <div className="mt-4 border border-[var(--cf-warning-border)] bg-[var(--cf-warning-surface)] p-3 text-sm leading-6 text-[var(--cf-warning)]"><AlertTriangle className="mr-2 inline h-4 w-4" />This Clerk account no longer exists. Contribution history remains intentionally attributed to this profile.</div> : null}

            {selected.identityState !== 'history_only' ? <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Account access<select className={inputClassName} value={draft.access} onChange={(event) => setDraft((current) => current ? { ...current, access: event.target.value as PersonDraft['access'] } : current)}><option value="free">Free</option><option value="paid">Creator Pass</option><option value="dev">Contributor</option></select></label>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-accent-text)]"><span>Owner authority<span className="mt-1 block text-[11px] text-[var(--cf-text-subtle)]">{selected.ownerSource === 'environment' ? 'Owned by the Vercel owner-email allowlist.' : 'Owned by Clerk private metadata.'}</span></span><input type="checkbox" checked={draft.owner} disabled={selected.id === currentOwnerId || selected.ownerSource === 'environment'} onChange={(event) => setDraft((current) => current ? { ...current, owner: event.target.checked } : current)} /></label>
              <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Account note<textarea className="min-h-20 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" value={draft.accountNote} onChange={(event) => setDraft((current) => current ? { ...current, accountNote: event.target.value } : current)} /></label>
            </div> : null}

            {(selected.profileStatus !== null || draft.access === 'dev' || draft.owner || selected.identityState === 'history_only') ? <div className="mt-4 grid gap-3 border-t border-[var(--cf-border-subtle)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-text-subtle)]">Contributor controls</p>
              <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Profile status<select className={inputClassName} value={draft.profileStatus} onChange={(event) => setDraft((current) => current ? { ...current, profileStatus: event.target.value as PersonDraft['profileStatus'] } : current)}><option value="active">Active</option><option value="invited">Invited</option><option value="suspended">Suspended</option><option value="inactive">Inactive</option></select></label>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-accent-text)]">Draft campaign packages<input type="checkbox" checked={draft.canDraftCampaigns} onChange={(event) => setDraft((current) => current ? { ...current, canDraftCampaigns: event.target.checked } : current)} /></label>
              <label className="flex min-h-11 items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-sm text-[var(--cf-accent-text)]">Propose public-site copy<input type="checkbox" checked={draft.canProposeSiteContent} onChange={(event) => setDraft((current) => current ? { ...current, canProposeSiteContent: event.target.checked } : current)} /></label>
              <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Monthly submission override<input className={inputClassName} inputMode="numeric" placeholder="Use program default" value={draft.monthlySubmissionLimitOverride} onChange={(event) => setDraft((current) => current ? { ...current, monthlySubmissionLimitOverride: event.target.value } : current)} /></label><label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Published requirement override<input className={inputClassName} inputMode="numeric" placeholder="Use program default" value={draft.monthlyPublishedRequirementOverride} onChange={(event) => setDraft((current) => current ? { ...current, monthlyPublishedRequirementOverride: event.target.value } : current)} /></label></div>
              <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Contributor note<textarea className="min-h-20 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" value={draft.contributorNote} onChange={(event) => setDraft((current) => current ? { ...current, contributorNote: event.target.value } : current)} /></label>
            </div> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {selected.identityState !== 'history_only' ? <Button type="button" disabled={busy} onClick={save} className="bg-[var(--cf-accent-strong)] text-[var(--cf-accent-contrast)] hover:bg-[var(--cf-accent)]"><Save className="mr-2 h-4 w-4" />Save controls</Button> : null}
              {selected.id !== currentOwnerId ? <Button type="button" disabled={busy} variant="outline" onClick={() => void mutate('PATCH', { action: selected.identityState === 'history_only' ? 'deactivate_history' : 'revoke', userId: selected.id }, selected.identityState === 'history_only' ? 'Retained profile deactivated' : 'Contributor access revoked')}><ShieldOff className="mr-2 h-4 w-4" />{selected.identityState === 'history_only' ? 'Deactivate retained profile' : 'Revoke contributor access'}</Button> : null}
            </div>

            {selected.identityState !== 'history_only' && selected.id !== currentOwnerId && !selected.isOwner ? <div className="mt-5 border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3">
              <p className="text-sm font-semibold text-[var(--cf-danger)]">Delete Clerk account</p><p className="mt-1 text-xs leading-5 text-[#e7b3a8]">This permanently removes sign-in. CardForge retains contribution and vote attribution, then marks the contributor profile inactive.</p>
              <label className="mt-3 grid gap-1 text-xs text-[#e7b3a8]">Type {selected.email ?? selected.id}<input className={inputClassName} value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
              <Button type="button" className="mt-3 bg-[#8f3024] text-white hover:bg-[#a93b2d]" disabled={busy || deleteConfirmation.trim().toLowerCase() !== (selected.email ?? selected.id).toLowerCase()} onClick={() => void mutate('DELETE', { userId: selected.id, confirmation: deleteConfirmation }, 'Clerk account deleted')}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>
            </div> : null}
          </>}
        </aside>
      </div>
    </section>
  );
}
