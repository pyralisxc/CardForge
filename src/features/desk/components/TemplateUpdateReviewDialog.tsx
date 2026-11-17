"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import type { SetUpdateDecision } from '@/domain/cards/setUpdateReview';
import { commitSetTemplateUpdateReview, type OpenTemplateUpdateReview } from '@/features/project/client/workspace';

const displayValue = (value: unknown): string => {
  if (value === undefined) return 'Not present';
  if (typeof value === 'string') return value || '(empty)';
  return JSON.stringify(value, null, 2);
};

export function TemplateUpdateReviewDialog({ review, onClose }: { review: OpenTemplateUpdateReview; onClose: () => void }) {
  const [choices, setChoices] = useState<Record<string, SetUpdateDecision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const { toast } = useToast();
  useEffect(() => () => request.current?.abort(), []);
  const groups = new Map<string, typeof review.changes>();
  for (const change of review.changes) groups.set(change.group, [...(groups.get(change.group) ?? []), change]);
  const deferred = review.changes.filter((change) => !choices[change.key] || choices[change.key] === 'defer').length;
  const used = review.changes.filter((change) => choices[change.key] === 'use').length;
  const applyReview = async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null);
    try {
      const result = await commitSetTemplateUpdateReview(review, choices, controller.signal);
      toast({ title: result.outcome === 'reviewed' ? 'Update reviewed' : 'Update still deferred',
        description: `${result.changesTemplate ? 'Selected changes applied. ' : 'Your design was kept. '}Review recorded in this browser. Save or download the Set separately to keep it elsewhere.` });
      onClose();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The review could not be recorded. Your existing work was kept.');
    } finally { request.current = null; setBusy(false); }
  };
  const close = () => { request.current?.abort(); onClose(); };
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col gap-4 overflow-hidden">
      <DialogHeader>
        <DialogTitle>Review Update · {review.current.name}</DialogTitle>
        <DialogDescription>Compare your design with “{review.incoming.name}”. Choose each change; nothing is accepted automatically.</DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">These are two available snapshots, not a reconstruction of missing history. A related revision may contain earlier or parallel work. Keep mine completes a decision; Defer leaves it unresolved.</p>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {groups.size ? [...groups].map(([group, changes]) => <details key={group} open className="rounded-md border p-3">
          <summary className="cursor-pointer font-medium">{group} · {changes.length} {changes.length === 1 ? 'change' : 'changes'}</summary>
          <div className="mt-3 space-y-4">
            {changes.map((change) => <fieldset key={change.key} disabled={busy} className="min-w-0 border-t pt-3">
              <legend className="break-all text-sm font-medium">{change.label}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><span className="text-xs text-muted-foreground">Mine</span><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{displayValue(change.before)}</pre></div>
                <div><span className="text-xs text-muted-foreground">Update</span><pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">{displayValue(change.after)}</pre></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                {([['keep', 'Keep mine'], ['use', 'Use update'], ['defer', 'Defer']] as const).map(([decision, label]) => <label key={decision} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name={`decision-${change.key}`} value={decision} checked={(choices[change.key] ?? 'defer') === decision}
                    onChange={() => setChoices((current) => ({ ...current, [change.key]: decision }))} />{label}
                </label>)}
              </div>
            </fieldset>)}
          </div>
        </details>) : <p>No content differences remain. You can explicitly mark this revision reviewed.</p>}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p role="status" className="text-sm text-muted-foreground">{used} selected to apply · {deferred} deferred. This records the review in this browser, not a confirmed provider Save.</p>
      <DialogFooter>
        <Button variant="outline" onClick={close}>{busy ? 'Cancel' : 'Close without applying'}</Button>
        <Button disabled={busy} onClick={() => void applyReview()}>{busy ? 'Recording…' : used ? 'Apply choices and record review' : deferred ? 'Record deferred review' : 'Mark reviewed'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
