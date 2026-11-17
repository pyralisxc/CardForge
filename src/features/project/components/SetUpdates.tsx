"use client";

import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import type { TemplatePreviewRenderer } from './templatePreviewRenderer';
import type { OpenTemplateUpdateReview } from '../client/setTemplateUpdateReview';
import { useSetTemplateUpdates, type SetTemplateUpdate } from '../hooks/useSetTemplateUpdates';
import { useWorkspaceUpdates } from '../hooks/useWorkspaceUpdates';
import { TemplateUpdateReviewDialog } from './TemplateUpdateReviewDialog';

export function UpdateAttentionFilter({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  const workspace = useWorkspaceUpdates();
  const count = workspace.sets.filter((set) => set.pending > 0).length;
  return <Button type="button" variant={active ? 'secondary' : 'ghost'} size="sm" className="gap-1.5" aria-label="Filter by Update review" aria-pressed={active}
    title="Show loaded Sets with unresolved Updates, including deferred reviews. Unopened files are not checked; reading a notice does not resolve a review."
    onClick={() => onChange(!active)}><RefreshCw className="h-4 w-4" aria-hidden="true" />Updates to review · {workspace.inspectionError ? 'Unavailable' : workspace.checking ? 'Checking' : `${count} ${count === 1 ? 'Set' : 'Sets'}`}</Button>;
}

export function SetUpdates({ setId }: { setId: string }) {
  const workspace = useWorkspaceUpdates();
  const set = workspace.sets.find((item) => item.set.id === setId);
  return <Button type="button" variant="ghost" size="sm" className="gap-1.5" aria-label={`Updates${set ? ` for ${set.set.name}` : ''}`} onClick={(event) => workspace.openSet(setId, event.currentTarget)}>
    <RefreshCw className="h-4 w-4" aria-hidden="true" />Updates{workspace.checking ? <span className="sr-only"> · Checking</span> : set?.pending ? <span className="rounded-full bg-primary/15 px-1.5 text-xs">{set.pending}</span> : null}
  </Button>;
}

export function UpdateSourceStatus() {
  const { source, sourceChecking, lastChecked } = useWorkspaceUpdates();
  const failureLabels = { authentication: 'Sign-in required', authorization: 'Source access not permitted', conflict: 'Source conflict', invalid: 'Invalid source response', not_found: 'Source not found', limit: 'Source check delayed', unavailable: 'Source unavailable' };
  return <div className="space-y-1 text-xs text-muted-foreground" role="status">
    <p>{sourceChecking ? 'Checking published Pipeline sources…' : source?.failure ? `${failureLabels[source.failure.kind]} · ${source.failure.message}` : lastChecked ? 'Published Pipeline sources checked.' : 'Published Pipeline sources have not been checked.'}</p>
    {source?.failure?.nextAction ? <p>{source.failure.nextAction}</p> : null}
    {lastChecked ? <p>Last checked <time dateTime={new Date(lastChecked).toISOString()} title={new Date(lastChecked).toLocaleString()}>{new Date(lastChecked).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>.</p> : null}
    <p>Related designs loaded on this device are also compared. Unopened connected files are not checked.</p>
  </div>;
}

export function SetUpdatesPanel({ setId, renderPreview, onClose }: { setId: string; renderPreview: TemplatePreviewRenderer; onClose: () => void }) {
  const updates = useSetTemplateUpdates(setId);
  const workspace = useWorkspaceUpdates();
  const [tab, setTab] = useState<'pending' | 'decisions'>('pending');
  const [review, setReview] = useState<OpenTemplateUpdateReview | null>(null);
  const [opening, setOpening] = useState(false);
  const request = useRef<AbortController | null>(null);
  const { toast } = useToast();
  useEffect(() => () => request.current?.abort(), [setId]);
  const close = () => { request.current?.abort(); request.current = null; setOpening(false); setReview(null); onClose(); };
  const beginReview = async (item: SetTemplateUpdate) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller; setOpening(true);
    try { setReview(await workspace.openReview(item, controller.signal)); }
    catch (error) {
      if (!controller.signal.aborted) toast({ title: 'Review unavailable', description: error instanceof Error ? error.message : 'The source could not be read.', variant: 'destructive' });
    } finally { if (request.current === controller) { request.current = null; setOpening(false); } }
  };
  if (!updates.set) return null;
  const set = updates.set;
  return <>
    <Dialog open={!review} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden" onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader><DialogTitle>Updates · {set.name}</DialogTitle><DialogDescription>Review related designs and keep your choices with this Set.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div className="flex gap-1" aria-label="Update views"><Button size="sm" variant={tab === 'pending' ? 'secondary' : 'ghost'} aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>To review{!updates.checking ? ` · ${updates.pending}` : ''}</Button><Button size="sm" variant={tab === 'decisions' ? 'secondary' : 'ghost'} aria-pressed={tab === 'decisions'} onClick={() => setTab('decisions')}>Review decisions</Button></div>
          <Button size="sm" variant="outline" disabled={workspace.sourceChecking || opening} onClick={() => { updates.refresh(); void workspace.checkSources(); }}>Check for updates</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {workspace.noticeError ? <p role="alert" className="text-sm text-destructive">{workspace.noticeError}</p> : null}
          {updates.error ? <p role="alert" className="text-sm text-destructive">{updates.error}</p> : updates.checking ? <p role="status" className="py-5 text-sm text-muted-foreground">Checking designs in this workspace…</p> : tab === 'pending' ? <>
            {updates.items.filter((item) => !item.reviewed).map((item) => <article key={item.key} className="space-y-3 rounded-lg border p-4">
              <div><h3 className="font-medium">{item.template.name}</h3><p className="mt-1 text-sm text-muted-foreground">Compare with {item.source.name}{item.source.templateRevision ? ` · revision ${item.source.templateRevision}` : ''}</p></div>
              {item.error ? <p className="text-sm text-destructive">{item.error}</p> : null}
              <Button size="sm" disabled={opening || Boolean(item.error)} onClick={() => void beginReview(item)}>{opening ? 'Opening…' : 'Review Update'}</Button>
            </article>)}
            {updates.unavailable.map((record) => <article key={`${record.templateId}:${record.sourceLineageId}:${record.sourceRevisionId}`} className="space-y-2 rounded-lg border p-4">
              <h3 className="font-medium">Deferred review · source not loaded</h3><p className="text-sm text-muted-foreground">Your decisions are preserved. The related design must be available before you can compare it.</p>
            </article>)}
            {!updates.pending ? <div className="space-y-2 py-8 text-center"><Check className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" /><p className="font-medium">No comparisons available</p><p className="text-sm text-muted-foreground">{workspace.source?.failure || !workspace.lastChecked ? 'Published sources may be unavailable or not checked. Your stored decisions are kept.' : 'No unreviewed related revisions are currently available in this workspace.'}</p></div> : null}
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
        <div className="border-t pt-3"><UpdateSourceStatus /></div>
      </DialogContent>
    </Dialog>
    {review ? <TemplateUpdateReviewDialog key={`${review.current.id}:${review.incoming.id}`} review={review} cards={updates.cards} renderPreview={renderPreview} onClose={() => { setReview(null); updates.refresh(); }} /> : null}
  </>;
}
