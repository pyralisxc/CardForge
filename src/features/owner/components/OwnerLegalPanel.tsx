"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, FileText, KeyRound, RotateCcw, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { DEFAULT_LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentSlug } from '@/features/legal/client/documents';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';

const pathBySlug: Record<LegalDocumentSlug, string> = {
  privacy: '/privacy',
  terms: '/terms',
  'creator-pass-terms': '/creator-pass-terms',
  'supporter-terms': '/supporter-terms',
  refund: '/refund',
  'developer-terms': '/developer-terms',
  contact: '/contact',
  accessibility: '/accessibility',
  'creator-pool': '/creator-pool',
};

export function OwnerLegalPanel({ consolePayload, onConsoleChange }: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [activeSlug, setActiveSlug] = useState<LegalDocumentSlug>('privacy');
  const [drafts, setDrafts] = useState<Record<LegalDocumentSlug, LegalDocument>>(() => toDrafts(consolePayload.legalDocuments));
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<LegalDocument[]>([]);
  const [historyError, setHistoryError] = useState('');
  useEffect(() => setDrafts(toDrafts(consolePayload.legalDocuments)), [consolePayload]);
  const documents = useMemo(() => DEFAULT_LEGAL_DOCUMENTS.map((document) => drafts[document.slug]).filter(Boolean), [drafts]);
  const active = drafts[activeSlug];
  const live = consolePayload.legalDocuments.find((document) => document.slug === activeSlug) ?? active;
  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      setHistoryError('');
      try {
        const response = await fetch(`/api/owner/legal-history?slug=${activeSlug}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load publication history.');
        const body = await response.json() as { history: LegalDocument[] };
        if (mounted) setHistory(body.history);
      } catch (error) {
        if (mounted) setHistoryError(error instanceof Error ? error.message : 'Unable to load publication history.');
      }
    };
    void loadHistory();
    return () => { mounted = false; };
  }, [activeSlug, consolePayload.legalDocuments]);

  const save = async () => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({
        kind: 'legal',
        legalDocument: {
          slug: active.slug,
          title: active.title,
          body: active.body,
          effectiveDate: active.effectiveDate,
          expectedBusinessIdentityVersion: consolePayload.businessIdentity.identityVersion,
        },
      }, 'Unable to save legal document.');
      onConsoleChange(next);
      toast({ title: 'Legal page published', description: `${active.title} is updated.` });
    } catch (error) {
      toast({ title: 'Legal page not saved', description: error instanceof Error ? error.message : 'Unable to save legal document.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="border border-[#5f4526] bg-[#15100a] p-6">
        <div className="flex items-center gap-3 text-[#e2aa4a]"><FileText className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">Legal center</h2></div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_1fr]">
          <div className="grid content-start gap-2">{documents.map((document) => <button key={document.slug} type="button" className={`border px-3 py-3 text-left text-sm ${activeSlug === document.slug ? 'border-[#e6b85c] bg-[#2b1d0e] text-[#ffe7ad]' : 'border-[#5f4526] bg-[#100c08] text-[#c7b288]'}`} onClick={() => setActiveSlug(document.slug)}>{document.title}</button>)}</div>
          <div className="grid gap-3">
            <input className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]" value={active.title} onChange={(event) => setDrafts((current) => ({ ...current, [activeSlug]: { ...active, title: event.target.value } }))} />
            <label className="grid gap-2 text-sm text-[#c7b288]">
              Effective date
              <input
                type="date"
                className="border border-[#5f4526] bg-[#0c0b09] p-3 text-[#ffe7ad]"
                value={active.effectiveDate}
                onChange={(event) => setDrafts((current) => ({
                  ...current,
                  [activeSlug]: { ...active, effectiveDate: event.target.value },
                }))}
              />
            </label>
            <p className="text-xs leading-5 text-[#a98a55]">
              Current publication v{live.version} · effective {live.effectiveDate} · identity v{live.businessIdentityVersion}
            </p>
            <textarea className="min-h-[22rem] border border-[#5f4526] bg-[#0c0b09] p-3 text-sm leading-6 text-[#ffe7ad]" value={active.body} onChange={(event) => setDrafts((current) => ({ ...current, [activeSlug]: { ...active, body: event.target.value } }))} />
            <details className="border border-[#4a3823] bg-[#100c08] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#ffe7ad]"><Eye className="mr-2 inline h-4 w-4" />Compare live publication and draft</summary>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <article><h3 className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">Live v{live.version}</h3><div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap border border-[#3c2c1b] bg-[#0c0b09] p-3 text-xs leading-5 text-[#c7b288]">{live.body}</div></article>
                <article><h3 className="text-xs uppercase tracking-[0.12em] text-[#a98a55]">Draft · {active.body.length - live.body.length >= 0 ? '+' : ''}{active.body.length - live.body.length} characters</h3><div className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap border border-[#3c2c1b] bg-[#0c0b09] p-3 text-xs leading-5 text-[#c7b288]">{active.body}</div></article>
              </div>
            </details>
            <div className="flex flex-wrap gap-3"><Button disabled={isSaving} onClick={save}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Publishing legal page...' : 'Publish legal page'}</Button><Button asChild variant="outline"><Link href={pathBySlug[active.slug]}>View public page</Link></Button></div>
            <section className="border border-[#4a3823] bg-[#100c08] p-3" aria-labelledby="legal-history-heading"><h3 id="legal-history-heading" className="text-sm font-semibold text-[#ffe7ad]">Publication history</h3><p className="mt-1 text-xs leading-5 text-[#a98a75]">Loading an older version changes only the draft. Publishing it creates a new version; history is never overwritten.</p>{historyError ? <p className="mt-2 text-xs text-[#f0bd75]">{historyError}</p> : null}<div className="mt-3 flex flex-wrap gap-2">{history.map((document) => <Button key={document.version} type="button" size="sm" variant="outline" disabled={document.version === live.version} onClick={() => setDrafts((current) => ({ ...current, [activeSlug]: { ...document, version: live.version, publishedAt: live.publishedAt, businessIdentityVersion: live.businessIdentityVersion } }))}><RotateCcw className="mr-2 h-3.5 w-3.5" />Use v{document.version} as draft</Button>)}</div></section>
          </div>
        </div>
      </section>
      <section className="border border-[#5f4526] bg-[#15100a] p-6"><div className="flex items-center gap-3 text-[#e2aa4a]"><KeyRound className="h-5 w-5" /><h2 className="font-serif text-2xl text-[#fff1c7]">API keys and secrets</h2></div><p className="mt-3 text-sm text-[#c7b288]">Provider-owned. No raw secrets are exposed here.</p></section>
    </div>
  );
}

const toDrafts = (documents: LegalDocument[]): Record<LegalDocumentSlug, LegalDocument> => (
  Object.fromEntries(documents.map((document) => [document.slug, document])) as Record<LegalDocumentSlug, LegalDocument>
);
