"use client";

import { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronLeft, ChevronRight, Mail, RefreshCw, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { ContactRequest } from '@/features/contact/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { formatOwnerDateTime, OwnerMetricTile } from './OwnerPanelPrimitives';

const PAGE_SIZE = 8;

export function OwnerInboxPanel() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('open');
  const [kind, setKind] = useState<'all' | ContactRequest['kind']>('all');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/owner/contact-requests', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load owner inbox.'));
      const body = await response.json() as { requests: ContactRequest[] };
      setRequests(body.requests);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load owner inbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (kind !== 'all' && request.kind !== kind) return false;
      if (status === 'open' && request.status === 'closed') return false;
      if (status === 'closed' && request.status !== 'closed') return false;
      if (normalizedQuery && ![request.name, request.email, request.subject, request.message].some((value) => value.toLowerCase().includes(normalizedQuery))) return false;
      return true;
    });
  }, [kind, query, requests, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const changeStatus = async (contact: ContactRequest, nextStatus: 'received' | 'closed') => {
    setBusyId(contact.id);
    try {
      const response = await fetch(`/api/owner/contact-requests/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update this message.'));
      const body = await response.json() as { activityRecorded: boolean };
      setRequests((current) => current.map((item) => item.id === contact.id ? { ...item, status: nextStatus } : item));
      toast({ title: nextStatus === 'closed' ? 'Message closed' : 'Message reopened', description: body.activityRecorded ? 'Inbox state and owner history were updated.' : 'Inbox state changed, but owner history was unavailable.', variant: body.activityRecorded ? 'default' : 'destructive' });
    } catch (error) {
      toast({ title: 'Message not updated', description: error instanceof Error ? error.message : 'Unable to update this message.', variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (loading && requests.length === 0) {
    return <section className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5 text-sm text-[var(--cf-text-muted)]" role="status">Loading owner inbox…</section>;
  }
  if (loadError && requests.length === 0) {
    return <section className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-5 text-sm text-[var(--cf-danger)]"><p>{loadError}</p><Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></section>;
  }

  return (
    <section className="space-y-4">
      <header className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 text-[var(--cf-accent-strong)]"><Mail className="h-5 w-5" aria-hidden="true" /><div><p className="text-xs uppercase tracking-[0.16em]">Owner inbox</p><h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">Support, contributor &amp; business requests</h2></div></div><Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div>
        <p className="mt-3 text-sm leading-6 text-[var(--cf-text-muted)]">Search the latest 50 recorded requests, reply through your mail client, and close work that is finished. Resend delivery state remains visible as provider history.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><OwnerMetricTile label="Recorded" value={String(requests.length)} /><OwnerMetricTile label="Open" value={String(requests.filter((item) => item.status !== 'closed').length)} /><OwnerMetricTile label="Contributor" value={String(requests.filter((item) => item.kind === 'contributor').length)} /><OwnerMetricTile label="Business" value={String(requests.filter((item) => item.kind === 'business').length)} /></div>
      </header>
      {loadError ? <p role="alert" className="border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]">{loadError}</p> : null}
      <div className="grid gap-3 border border-[var(--cf-border)] bg-[var(--cf-surface-inset)] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]"><span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search inbox</span><input className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Status<select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}><option value="open">Open</option><option value="closed">Closed</option><option value="all">All</option></select></label>
        <label className="grid gap-1 text-xs text-[var(--cf-text-muted)]">Type<select className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setPage(1); }}><option value="all">All</option><option value="support">Support</option><option value="contributor">Contributor</option><option value="business">Business</option></select></label>
      </div>
      <div className="space-y-2">
        {visible.map((contact) => <article key={contact.id} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[var(--cf-accent-text)]">{contact.subject}</p><p className="mt-1 text-xs text-[var(--cf-text-subtle)]">{contact.name} · {contact.email}</p></div><span className="border border-[var(--cf-border)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-muted)]">{contact.kind} · {contact.status}</span></div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--cf-text-muted)]">{contact.message}</p>
          <p className="mt-2 text-xs text-[var(--cf-text-subtle)]">{formatOwnerDateTime(contact.createdAt)}{contact.pageUrl ? ` · ${contact.pageUrl}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><a href={`mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(`Re: ${contact.subject}`)}`}><Mail className="mr-2 h-4 w-4" />Reply</a></Button>{contact.status === 'closed' ? <Button size="sm" variant="outline" disabled={busyId === contact.id} onClick={() => void changeStatus(contact, 'received')}><RotateCcw className="mr-2 h-4 w-4" />Reopen</Button> : <Button size="sm" variant="outline" disabled={busyId === contact.id} onClick={() => void changeStatus(contact, 'closed')}><Archive className="mr-2 h-4 w-4" />Close</Button>}</div>
        </article>)}
        {visible.length === 0 ? <p className="border border-dashed border-[var(--cf-border)] p-5 text-sm text-[var(--cf-text-muted)]">No messages match this view.</p> : null}
      </div>
      <div className="flex items-center justify-between gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3 text-xs text-[var(--cf-text-muted)]"><span>Page {safePage} of {totalPages} · {filtered.length} messages</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" />Previous</Button><Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div></div>
    </section>
  );
}
