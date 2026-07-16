"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, KeyRound, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { DEFAULT_LEGAL_DOCUMENTS, type LegalDocument, type LegalDocumentSlug } from '@/features/legal/client/documents';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { updateOwnerConsole } from '@/features/owner/model/ownerConsoleClient';

const pathBySlug: Record<LegalDocumentSlug, string> = {
  privacy: '/privacy', terms: '/terms', refund: '/refund', contact: '/contact',
  'developer-terms': '/developer-terms', 'creator-pool': '/creator-pool',
};

export function OwnerLegalPanel({ consolePayload, onConsoleChange }: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [activeSlug, setActiveSlug] = useState<LegalDocumentSlug>('privacy');
  const [drafts, setDrafts] = useState<Record<LegalDocumentSlug, LegalDocument>>(() => toDrafts(consolePayload.legalDocuments));
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setDrafts(toDrafts(consolePayload.legalDocuments)), [consolePayload]);
  const documents = useMemo(() => DEFAULT_LEGAL_DOCUMENTS.map((document) => drafts[document.slug]).filter(Boolean), [drafts]);
  const active = drafts[activeSlug];

  const save = async () => {
    setIsSaving(true);
    try {
      const next = await updateOwnerConsole({ kind: 'legal', legalDocument: active }, 'Unable to save legal document.');
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
            <textarea className="min-h-[22rem] border border-[#5f4526] bg-[#0c0b09] p-3 text-sm leading-6 text-[#ffe7ad]" value={active.body} onChange={(event) => setDrafts((current) => ({ ...current, [activeSlug]: { ...active, body: event.target.value } }))} />
            <div className="flex flex-wrap gap-3"><Button disabled={isSaving} onClick={save}><Save className="mr-2 h-4 w-4" />{isSaving ? 'Publishing legal page...' : 'Publish legal page'}</Button><Button asChild variant="outline"><Link href={pathBySlug[active.slug]}>View public page</Link></Button></div>
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
