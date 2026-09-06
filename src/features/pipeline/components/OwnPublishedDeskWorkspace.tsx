"use client";

import { ExternalLink, FileCheck2, ImageIcon, PackageCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPipelineTypeLabel } from '@/features/pipeline/lib/pipelineAssetTaxonomy';
import { PIPELINE_TYPES, type PipelineType } from '@/features/pipeline/lib/pipelineItems';

const typeLabel = (assetType: string): string => (
  (PIPELINE_TYPES as readonly string[]).includes(assetType)
    ? getPipelineTypeLabel(assetType as PipelineType, { plural: false })
    : assetType.replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase())
);

export function OwnPublishedDeskWorkspace({ work, onCreateWorkingCopy }: { work: {
  assetType: string;
  description: string;
  name: string;
  previewUrl: string | null;
  publishedAt: string | null;
  revision: string | null;
  sourceNotes: string | null;
}; onCreateWorkingCopy?: () => void }) {
  const isSet = work.assetType === 'sets';
  const label = isSet ? 'Set' : typeLabel(work.assetType);
  return <section className="grid min-h-0 gap-4 md:grid-cols-[minmax(12rem,20rem),minmax(0,1fr)]" aria-label={`Published ${label} workspace`}>
    <div className="grid min-h-48 place-items-center overflow-hidden border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)]">
      {work.previewUrl ? <img src={work.previewUrl} alt="" className="max-h-72 w-full object-contain" /> : <ImageIcon className="h-9 w-9 text-[var(--cf-text-subtle)]" aria-hidden="true" />}
    </div>
    <div className="grid content-start gap-4">
      <div><p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Immutable publication</p><h3 className="mt-1 font-serif text-2xl text-[var(--cf-text-strong)]">{work.name}</h3><p className="mt-2 text-sm leading-6 text-[var(--cf-text-muted)]">{work.description || `Your published ${label.toLocaleLowerCase()} remains a distinct Pipeline identity.`}</p></div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3"><div className="border border-[var(--cf-border-subtle)] p-3"><dt className="text-xs text-[var(--cf-text-subtle)]">Published revision</dt><dd className="mt-1 text-[var(--cf-text-strong)]">{work.revision ?? 'Immutable revision'}</dd></div><div className="border border-[var(--cf-border-subtle)] p-3"><dt className="text-xs text-[var(--cf-text-subtle)]">Publication</dt><dd className="mt-1 text-[var(--cf-text-strong)]">{isSet ? 'Published Set container' : `Standalone ${label}`}</dd></div>{work.publishedAt ? <div className="border border-[var(--cf-border-subtle)] p-3"><dt className="text-xs text-[var(--cf-text-subtle)]">Published</dt><dd className="mt-1 text-[var(--cf-text-strong)]">{new Date(work.publishedAt).toLocaleDateString()}</dd></div> : null}</dl>
      <p className="flex items-start gap-2 text-sm leading-6 text-[var(--cf-text-muted)]"><PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cf-accent-strong)]" aria-hidden="true" />{isSet ? 'Open a local installed copy to edit it. A working copy remains independently visible in My work.' : 'This resource retains its own published identity; CardForge does not wrap it in a Set.'}</p>
      {work.sourceNotes ? <p className="flex items-start gap-2 text-sm leading-6 text-[var(--cf-text-muted)]"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cf-accent-strong)]" aria-hidden="true" />{work.sourceNotes}</p> : null}
      {work.previewUrl || onCreateWorkingCopy ? <div className="flex flex-wrap gap-2">{onCreateWorkingCopy ? <Button type="button" onClick={onCreateWorkingCopy}>Create editable Set copy</Button> : null}{work.previewUrl ? <Button type="button" variant="outline" onClick={() => window.open(work.previewUrl!, '_blank', 'noopener,noreferrer')}><ExternalLink className="mr-2 h-4 w-4" />View immutable preview</Button> : null}</div> : null}
    </div>
  </section>;
}
