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


/** One focused text control for structured copy and site-configuration labels. */
export function PublicSiteFocusedTextEditor({
  label,
  value,
  maxLength,
  multiline = false,
  busy,
  onPublish,
  onDirtyChange,
  publicationEnvironment,
  help = 'Changes here affect only this selected field.',
}: {
  label: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  busy: boolean;
  onPublish: (value: string) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  publicationEnvironment: OwnerPublicationEnvironment;
  help?: string;
}) {
  const [body, setBody] = useState(value);
  useEffect(() => { setBody(value); }, [value]);
  const dirty = body !== value;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  const publication = getOwnerPublicationPresentation(publicationEnvironment);
  return <section className="grid gap-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
    <label className="grid gap-2 text-sm text-[var(--cf-text-muted)]">
      <span className="flex justify-between gap-2">
        {label}
        <span className="text-xs text-[var(--cf-text-subtle)]">{body.length}/{maxLength}</span>
      </span>
      {multiline
        ? <textarea className="min-h-24 border border-[var(--cf-border)] bg-[var(--cf-canvas)] p-3 text-[var(--cf-accent-text)]" maxLength={maxLength} value={body} onChange={(event) => setBody(event.target.value)} />
        : <input className="min-h-11 border border-[var(--cf-border)] bg-[var(--cf-canvas)] px-3 text-[var(--cf-accent-text)]" maxLength={maxLength} value={body} onChange={(event) => setBody(event.target.value)} />}
    </label>
    <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">{help}</p>
    <Button type="button" size="sm" className="w-fit" disabled={busy || !dirty || !body.trim()} onClick={() => void onPublish(body)}>
      <Check className="mr-2 h-4 w-4" />{busy ? publication.publishingActionLabel : publication.publishActionLabel}
    </Button>
  </section>;
}

/** Only for structured or non-rendered copy: no second full-page catalog. */
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
  return <PublicSiteFocusedTextEditor
    label={block.label}
    value={block.body}
    maxLength={block.maxLength}
    multiline={block.kind === 'long'}
    busy={busy}
    onPublish={(body) => onPublish(block, body)}
    onDirtyChange={onDirtyChange}
    publicationEnvironment={publicationEnvironment}
    help="This changes the original Owner copy block. The surrounding page markup and links remain intact."
  />;
}
