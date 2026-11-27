'use client';

import { useState, type ReactNode } from 'react';
import { Keyboard, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { QuickActionsContribution } from './quickActionsContext';

export function EnvironmentQuickActions({ contribution, fallback, title }: { contribution: QuickActionsContribution | null; fallback?: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" className="h-11 min-h-11 shrink-0 gap-1.5 px-2 text-xs" aria-label="Quick actions" data-tool-safe-action><Zap className="h-3.5 w-3.5" aria-hidden="true" />Actions</Button></PopoverTrigger>
    <PopoverContent side="top" align="start" className="z-[100] max-h-[min(70vh,36rem)] w-[min(38rem,calc(100vw-1rem))] overflow-y-auto p-0" aria-label="Quick actions menu">
      <header className="flex items-center gap-2 border-b border-[var(--cf-border-subtle)] px-3 py-2"><Keyboard className="h-4 w-4 text-[var(--cf-accent-strong)]" aria-hidden="true" /><strong className="text-sm">{contribution?.title ?? title}</strong></header>
      {contribution ? <div className="space-y-3 p-3">
        {contribution.actions.length ? <div className="flex flex-wrap gap-2">{contribution.actions.map((action) => <Button key={action.id} type="button" size="sm" variant="outline" disabled={action.disabled} aria-pressed={action.active} title={action.description} onClick={() => { setOpen(false); action.onSelect(); }}>{action.label}</Button>)}</div> : <p className="text-sm text-[var(--cf-text-muted)]">No actions are available here yet.</p>}
        {contribution.shortcuts?.length ? <section aria-label="Keyboard shortcuts"><h4 className="text-xs font-semibold">Keyboard</h4><ul className="mt-1 space-y-1 text-xs text-[var(--cf-text-muted)]">{contribution.shortcuts.map((shortcut) => <li key={shortcut}>{shortcut}</li>)}</ul></section> : null}
      </div> : fallback ?? <p className="p-3 text-sm text-[var(--cf-text-muted)]">No quick actions are available for this tool.</p>}
    </PopoverContent>
  </Popover>;
}
