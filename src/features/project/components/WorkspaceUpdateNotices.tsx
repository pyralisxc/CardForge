"use client";

import { useRef, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UPDATE_CHECK_INTERVALS, isUpdateCheckInterval } from '../client/editorPreferenceStorage';
import { useWorkspaceUpdates } from '../hooks/useWorkspaceUpdates';
import { UpdateSourceStatus } from './SetUpdates';

export interface PipelineNoticePresentation {
  items: Array<{ submissionId: string; lineageId: string; name: string; revisionNumber: number | null }>;
  unread: number;
  ready: boolean;
  receipts: Record<string, 'read' | 'dismissed'>;
  error: string | null;
  refresh: () => Promise<void>;
  dismiss: (submissionId: string) => Promise<boolean>;
  open: (item: { submissionId: string; lineageId: string }) => boolean;
}

export function WorkspaceUpdateNotices({ pipelineReview }: { pipelineReview?: PipelineNoticePresentation }) {
  const updates = useWorkspaceUpdates();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const openingReview = useRef(false);
  const preferences = updates.preferences;
  const groups = updates.sets.map((set) => {
    const keys = [...set.items.filter((item) => !item.reviewed).map((item) => item.key), ...set.unavailable.map((item) => item.key)]
      .filter((key) => updates.receipts?.[key] !== 'dismissed');
    return { set: set.set, keys, unread: updates.receipts ? keys.filter((key) => !updates.receipts![key]).length : 0 };
  }).filter((group) => group.keys.length);
  const enabled = preferences.ready && preferences.notificationsEnabled;
  const unread = (enabled ? groups.reduce((count, group) => count + group.unread, 0) : 0) + (pipelineReview?.unread ?? 0);
  return <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next && !updates.noticeBusy) updates.retryReceipts(); if (next && pipelineReview) void pipelineReview.refresh(); }}>
    <PopoverTrigger asChild><Button ref={trigger} type="button" variant="ghost" size="icon" className="relative shrink-0" aria-label={`Notifications${unread ? ` · ${unread} unread` : ''}`}>
      <Bell className="h-4 w-4" aria-hidden="true" />
      {unread ? <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? '99+' : unread}</span> : null}
    </Button></PopoverTrigger>
    <PopoverContent align="end" className="z-[120] flex max-h-[min(80dvh,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-1rem))] flex-col gap-3 overflow-y-auto p-4" onCloseAutoFocus={(event) => { if (openingReview.current) { event.preventDefault(); openingReview.current = false; } }}>
      <div><h2 className="font-semibold">Notifications</h2><p className="mt-1 text-xs text-muted-foreground">{unread ? `${unread} unread · ` : ''}Workspace updates and Pipeline review.</p></div>
      {pipelineReview ? <section aria-label="Pipeline review notices" className="space-y-2 border-b pb-3"><h3 className="text-sm font-medium">Pipeline review</h3>
        {pipelineReview.error ? <div role="alert" className="text-sm"><p>{pipelineReview.error}</p><Button size="sm" variant="outline" onClick={() => void pipelineReview.refresh()}>Retry Pipeline notices</Button></div> : null}
        {pipelineReview.items.map(item => <article key={item.submissionId} className="flex items-center gap-2 rounded-lg border p-2">
          <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={() => { if (pipelineReview.open(item)) setOpen(false); }}>
            {!pipelineReview.receipts[item.submissionId] ? <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
            <span>Compare {item.name} · revision {item.revisionNumber ?? 'unassigned'}</span>
          </Button>
          <Button type="button" size="sm" variant="ghost" aria-label={`Dismiss Pipeline notice for ${item.name} revision ${item.revisionNumber ?? 'unassigned'}`} onClick={() => void pipelineReview.dismiss(item.submissionId)}><X className="h-3 w-3" /></Button>
        </article>)}
        {!pipelineReview.ready && !pipelineReview.error ? <p role="status" className="text-xs text-muted-foreground">Loading Pipeline reviews…</p> : null}
        {pipelineReview.ready && !pipelineReview.items.length && !pipelineReview.error ? <p className="text-xs text-muted-foreground">No recent Pipeline reviews to show.</p> : null}
      </section> : null}
      {updates.noticeError ? <div role="alert" className="space-y-2 text-sm"><p className="text-destructive">{updates.noticeError}</p><Button size="sm" variant="outline" disabled={updates.noticeBusy} onClick={updates.retryReceipts}>Retry notification state</Button></div> : null}
      {updates.inspectionError ? <p role="alert" className="text-sm text-destructive">{updates.inspectionError}</p> : updates.checking || !preferences.ready ? <p role="status" className="py-3 text-sm text-muted-foreground">Reading workspace Updates…</p> : !enabled ? <div className="flex gap-2 py-3 text-sm text-muted-foreground"><BellOff className="h-4 w-4 shrink-0" aria-hidden="true" /><p>Update notices are off. Each Set’s Updates control still shows unfinished work.</p></div> : groups.length ? <div className="space-y-2">
        {groups.map((group) => <article key={group.set.id} className="rounded-lg border p-3">
          <Button type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal px-0 text-left hover:bg-transparent" aria-label={`Review updates in ${group.set.name}`} onClick={() => {
            openingReview.current = true;
            setOpen(false);
            updates.openSet(group.set.id, trigger.current);
          }}><span className="min-w-0"><span className="flex items-center gap-2 font-medium">{group.unread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}<span className="break-words">{group.set.name}</span></span><span className="mt-1 block text-xs font-normal text-muted-foreground">{group.keys.length} update{group.keys.length === 1 ? '' : 's'} to review{group.unread ? ` · ${group.unread} unread` : updates.receipts ? ' · read' : ''}</span></span></Button>
          <div className="mt-2 flex justify-end gap-1">
            {group.unread ? <Button size="sm" variant="ghost" disabled={updates.noticeBusy} onClick={() => void updates.acknowledge(group.keys, 'read')}>Mark read</Button> : null}
            <Button size="sm" variant="ghost" className="gap-1" disabled={!updates.receipts || updates.noticeBusy} aria-label={`Dismiss notices for ${group.set.name}`} onClick={() => void updates.acknowledge(group.keys, 'dismissed')}><X className="h-3 w-3" aria-hidden="true" />Dismiss</Button>
          </div>
        </article>)}
      </div> : <p className="py-4 text-sm text-muted-foreground">No Set update notices to show. Dismissed notices do not clear unfinished Set reviews.</p>}
      <div className="space-y-3 border-t pt-3"><UpdateSourceStatus /><Button type="button" size="sm" variant="outline" disabled={updates.sourceChecking} onClick={() => { updates.refreshLocal(); void updates.checkSources(); }}>Check for updates</Button></div>
      <details className="border-t pt-3 text-sm">
        <summary className="cursor-pointer font-medium">Update preferences</summary>
        <fieldset disabled={!preferences.ready} className="mt-3 space-y-3">
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={preferences.notificationsEnabled} onChange={(event) => preferences.setNotificationsEnabled(event.target.checked)} /><span>Show update notices</span></label>
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={preferences.automaticChecks} onChange={(event) => preferences.setAutomaticChecks(event.target.checked)} /><span>Check published sources while active</span></label>
          <label className="flex flex-wrap items-center justify-between gap-2"><span>Check every</span><select className="rounded-md border bg-background px-2 py-1" value={preferences.intervalSeconds} disabled={!preferences.automaticChecks} onChange={(event) => { const seconds = Number(event.target.value); if (isUpdateCheckInterval(seconds)) preferences.setIntervalSeconds(seconds); }}>{UPDATE_CHECK_INTERVALS.map((seconds) => <option key={seconds} value={seconds}>{seconds / 60} minutes</option>)}</select></label>
        </fieldset>
        {preferences.error ? <p role="alert" className="mt-3 text-xs text-destructive">{preferences.error}</p> : null}
        {!preferences.ready ? <Button size="sm" variant="outline" className="mt-2" onClick={preferences.retry}>Retry preferences</Button> : null}
        <p className="mt-3 text-xs text-muted-foreground">Preferences and read/dismiss state are kept for this account in this browser, separately from the review choices in your files. Dismissing a notice never resolves a review.</p>
      </details>
    </PopoverContent>
  </Popover>;
}
