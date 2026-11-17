"use client";

import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import type { TemplatePreviewRenderer } from './templatePreviewRenderer';
import { openSetTemplateUpdateReview, type OpenTemplateUpdateReview } from '../client/setTemplateUpdateReview';
import { useSetTemplateUpdates, type SetTemplateUpdate } from '../hooks/useSetTemplateUpdates';
import { TemplateUpdateReviewDialog } from './TemplateUpdateReviewDialog';

export function SetUpdates({ setId, renderPreview }: { setId: string; renderPreview: TemplatePreviewRenderer }) {
  const updates = useSetTemplateUpdates(setId);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pending' | 'decisions'>('pending');
  const [review, setReview] = useState<OpenTemplateUpdateReview | null>(null);
  const [opening, setOpening] = useState(false);
  const request = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  useEffect(() => () => request.current?.abort(), [setId]);
  const close = () => { request.current?.abort(); request.current = null; setOpening(false); setOpen(false); setReview(null); };
  const beginReview = async (item: SetTemplateUpdate) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setOpening(true);
    try { setReview(await openSetTemplateUpdateReview(setId, item.template.id!, item.source.id!, controller.signal)); }
    catch (error) {
      if (!controller.signal.aborted) toast({ title: 'Review unavailable', description: error instanceof Error ? error.message : 'The source could not be read.', variant: 'destructive' });
    } finally { if (request.current === controller) { request.current = null; setOpening(false); } }
  };
  if (!updates.set) return null;
  const set = updates.set;
  return <>
    <Dialog open={open && !review} onOpenChange={(next) => { if (next) setOpen(true); else close(); }}>
      <DialogTrigger asChild><Button ref={trigger} type="button" variant="ghost" size="sm" className="gap-1.5" aria-label={`Updates for ${set.name}`}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />Updates{updates.checking ? <span className="sr-only"> · Checking</span> : updates.pending ? <span className="rounded-full bg-primary/15 px-1.5 text-xs">{updates.pending}</span> : null}
      </Button></DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden" onCloseAutoFocus={(event) => { if (review) event.preventDefault(); else trigger.current?.focus(); }}>
        <DialogHeader><DialogTitle>Updates · {set.name}</DialogTitle><DialogDescription>Review related designs and keep your choices with this Set.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex gap-1" aria-label="Update views"><Button size="sm" variant={tab === 'pending' ? 'secondary' : 'ghost'} aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>To review{!updates.checking ? ` · ${updates.pending}` : ''}</Button><Button size="sm" variant={tab === 'decisions' ? 'secondary' : 'ghost'} aria-pressed={tab === 'decisions'} onClick={() => setTab('decisions')}>Review decisions</Button></div>
          <Button size="sm" variant="outline" disabled={updates.checking || opening} onClick={updates.refresh}>Check available revisions</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {updates.checking ? <p role="status" className="py-5 text-sm text-muted-foreground">Checking designs in this workspace…</p> : tab === 'pending' ? <>
            {updates.items.filter((item) => !item.reviewed).map((item) => <article key={`${item.template.id}:${item.source.id}`} className="space-y-3 rounded-lg border p-4">
              <div><h3 className="font-medium">{item.template.name}</h3><p className="mt-1 text-sm text-muted-foreground">Compare with {item.source.name}{item.source.templateRevision ? ` · revision ${item.source.templateRevision}` : ''}</p></div>
              {item.error ? <p className="text-sm text-destructive">{item.error}</p> : null}
              <Button size="sm" disabled={opening || Boolean(item.error)} onClick={() => void beginReview(item)}>{opening ? 'Opening…' : 'Review Update'}</Button>
            </article>)}
            {updates.unavailable.map((record) => <article key={`${record.templateId}:${record.sourceLineageId}:${record.sourceRevisionId}`} className="space-y-2 rounded-lg border p-4">
              <h3 className="font-medium">Deferred review · source not loaded</h3><p className="text-sm text-muted-foreground">Your decisions are preserved. The related design must be available before you can compare it.</p>
            </article>)}
            {!updates.pending ? <div className="space-y-2 py-8 text-center"><Check className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" /><p className="font-medium">Nothing to review here</p><p className="text-sm text-muted-foreground">No unreviewed related revisions are available in this workspace.</p></div> : null}
          </> : <>
            {(set.updateReviews ?? []).map((record) => {
              const item = updates.items.find((candidate) => candidate.template.id === record.templateId && candidate.source.templateLineageId === record.sourceLineageId && candidate.source.templateRevisionId === record.sourceRevisionId);
              return <article key={`${record.templateId}:${record.sourceLineageId}:${record.sourceRevisionId}`} className="space-y-2 rounded-lg border p-4">
                <h3 className="font-medium">{item?.template.name ?? 'Recorded Template review'}</h3>
                <p className="text-sm">{record.outcome === 'reviewed' ? 'Reviewed' : 'Deferred'} · {record.decisions.filter((choice) => choice.decision === 'keep').length} kept · {record.decisions.filter((choice) => choice.decision === 'use').length} used · {record.decisions.filter((choice) => choice.decision === 'defer').length} deferred</p>
                <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Source reference</summary><p className="mt-1 break-all">{record.sourceRevisionId}</p></details>
                {item ? <Button size="sm" variant="outline" disabled={opening || Boolean(item.error)} onClick={() => void beginReview(item)}>Review again</Button> : <p className="text-xs text-muted-foreground">Source snapshot not available in this workspace.</p>}
              </article>;
            })}
            {!set.updateReviews?.length ? <p className="py-8 text-center text-sm text-muted-foreground">Your review decisions will appear here. Reviewing does not create a content-history archive.</p> : null}
          </>}
        </div>
        <p className="border-t pt-3 text-xs text-muted-foreground">Showing related snapshots already loaded in this workspace—not a live check of Pipeline or connected files.</p>
      </DialogContent>
    </Dialog>
    {open && review ? <TemplateUpdateReviewDialog key={`${review.current.id}:${review.incoming.id}`} review={review} cards={updates.cards} renderPreview={renderPreview} onClose={() => { setReview(null); updates.refresh(); }} /> : null}
  </>;
}
