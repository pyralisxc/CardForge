"use client";

import { Hand, Keyboard, MousePointer2, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DeskQuickActionsDepth = 'desk' | 'set' | 'artifact' | 'tool';

interface DeskQuickActionsProps {
  depth: DeskQuickActionsDepth;
  selectedCount: number;
  onFitWork?: () => void;
  onFitSelection?: () => void;
  onSelectShown?: () => void;
  onClearSelection?: () => void;
}

const TouchGuide = ({ depth }: { depth: DeskQuickActionsDepth }) => (
  <section className="space-y-2 p-3" aria-label="Touch quick actions">
    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-muted)]"><Hand className="h-4 w-4" aria-hidden="true" />Touch</h4>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      <dt className="font-medium">Pan</dt><dd className="text-[var(--cf-text-muted)]">Drag empty space</dd>
      <dt className="font-medium">Zoom</dt><dd className="text-[var(--cf-text-muted)]">Pinch around the area you want</dd>
      <dt className="font-medium">Select</dt><dd className="text-[var(--cf-text-muted)]">Tap an object</dd>
      {depth === 'set' ? <><dt className="font-medium">Move</dt><dd className="text-[var(--cf-text-muted)]">Hold an Artifact, then drag</dd></> : null}
      {depth === 'artifact' ? <><dt className="font-medium">Direction</dt><dd className="text-[var(--cf-text-muted)]">Quick swipe to browse nearby Artifacts</dd><dt className="font-medium">Edit</dt><dd className="text-[var(--cf-text-muted)]">Double tap</dd></> : null}
    </dl>
  </section>
);

const DesktopGuide = ({ depth }: { depth: DeskQuickActionsDepth }) => (
  <section className="space-y-2 border-t border-[var(--cf-border-subtle)] p-3 sm:border-l sm:border-t-0" aria-label="Desktop quick actions">
    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-muted)]"><MousePointer2 className="h-4 w-4" aria-hidden="true" />Desktop</h4>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      <dt className="font-medium">Pan</dt><dd className="text-[var(--cf-text-muted)]">Drag empty space</dd>
      <dt className="font-medium">Zoom</dt><dd className="text-[var(--cf-text-muted)]">Mouse wheel around cursor</dd>
      <dt className="font-medium">Select</dt><dd className="text-[var(--cf-text-muted)]">Click · Ctrl/Cmd-click adds</dd>
      <dt className="font-medium">Area select</dt><dd className="text-[var(--cf-text-muted)]">Shift-drag empty space</dd>
      {depth === 'set' || depth === 'artifact' ? <><dt className="font-medium">Direction</dt><dd className="text-[var(--cf-text-muted)]">WASD or Arrow keys</dd></> : null}
      {depth === 'set' ? <><dt className="font-medium">Move</dt><dd className="text-[var(--cf-text-muted)]">Drag selected Artifact · Shift+WASD/Arrows for a larger nudge</dd></> : null}
    </dl>
  </section>
);

export function DeskQuickActions({ depth, selectedCount, onFitWork, onFitSelection, onSelectShown, onClearSelection }: DeskQuickActionsProps) {
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" size="sm" variant="ghost" className="h-8 min-h-8 shrink-0 gap-1.5 px-2 text-xs" aria-label="Quick actions">
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />Quick actions
        {selectedCount > 0 ? <span className="rounded border border-[var(--cf-border-subtle)] px-1.5 py-0.5 text-[10px]">{selectedCount} selected</span> : null}
      </Button>
    </PopoverTrigger>
    <PopoverContent side="top" align="start" className="w-[min(38rem,calc(100vw-1rem))] p-0" aria-label="Desk quick actions">
      <header className="flex items-center gap-2 border-b border-[var(--cf-border-subtle)] px-3 py-2">
        <Keyboard className="h-4 w-4 text-[var(--cf-accent-strong)]" aria-hidden="true" />
        <div><strong className="block text-sm">Spatial quick actions</strong><span className="text-xs text-[var(--cf-text-muted)]">Touch and desktop stay visible together.</span></div>
      </header>
      <div className="grid sm:grid-cols-2"><TouchGuide depth={depth} /><DesktopGuide depth={depth} /></div>
      {onFitWork || onFitSelection || onSelectShown || onClearSelection ? <div className="flex flex-wrap gap-2 border-t border-[var(--cf-border-subtle)] p-3">
        {onFitWork ? <Button type="button" size="sm" variant="outline" onClick={onFitWork}>Fit Work</Button> : null}
        {onFitSelection ? <Button type="button" size="sm" variant="outline" onClick={onFitSelection} disabled={selectedCount === 0}>Fit Selection</Button> : null}
        {onSelectShown ? <Button type="button" size="sm" variant="outline" onClick={onSelectShown}>Select shown</Button> : null}
        {onClearSelection ? <Button type="button" size="sm" variant="ghost" onClick={onClearSelection} disabled={selectedCount === 0}>Clear selection</Button> : null}
      </div> : null}
    </PopoverContent>
  </Popover>;
}
