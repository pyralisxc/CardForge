"use client";

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { SiteContentBlock } from '../model/siteContent';
import { getOwnerPublicationPresentation, type OwnerPublicationEnvironment } from '../model/ownerPublicationEnvironment';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export interface SiteContentPublicationReceipt {
  committed: true;
  refreshComplete: boolean;
  refreshFailures: string[];
  activityRecorded: boolean;
  retryable: false;
  nextAction: 'none' | 'reload';
  message: string;
}

export interface SiteContentPublicationResult {
  siteContentBlock: SiteContentBlock;
  receipt: SiteContentPublicationReceipt;
}

/** Shared with the rendered-page editor; the Owner server command is the sole writer. */
export const savePublicSiteContentBlock = async (
  block: Pick<SiteContentBlock, 'slug' | 'body' | 'updatedAt'>,
): Promise<SiteContentPublicationResult> => {
  const response = await fetch('/api/owner/operations', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'siteContent', siteContentBlock: block }),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to publish site copy.'));
  return response.json() as Promise<SiteContentPublicationResult>;
};

/** Only for non-rendered or structured fields: never a second full-page copy editor. */
export function PublicSiteCopyLiveEditor({
  block,
  busy,
  onPublish,
  onDirtyChange,
  publicationEnvironment,
}: {
  block: SiteContentBlock;
  busy: boolean;
  onPublish: (block: SiteContentBlock, body: string) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  publicationEnvironment: OwnerPublicationEnvironment;
}) {
  const [body, setBody] = useState(block.body);
  useEffect(() => { setBody(block.body); }, [block.body, block.slug, block.updatedAt]);
  const dirty = body !== block.body;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const publication = getOwnerPublicationPresentation(publicationEnvironment);

  return <section className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
      <span className="flex justify-between gap-2">
        {block.label}
        <span className="text-xs text-[var(--cf-text-subtle)]">{body.length}/{block.maxLength}</span>
      </span>
      {block.kind === 'long'
        ? <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" maxLength={block.maxLength} value={body} onChange={(event) => setBody(event.target.value)} />
        : <input className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" maxLength={block.maxLength} value={body} onChange={(event) => setBody(event.target.value)} />}
    </label>
    <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">Changes here affect this one original Owner copy block. Page markup and links remain unchanged.</p>
    <Button type="button" size="sm" className="w-fit" disabled={busy || !dirty || !body.trim()} onClick={() => void onPublish(block, body)}>
      <Check className="mr-2 h-4 w-4" />{busy ? publication.publishingActionLabel : publication.publishActionLabel}
    </Button>
  </section>;
}
