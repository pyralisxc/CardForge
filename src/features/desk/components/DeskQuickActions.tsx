"use client";

import { Hand, MousePointer2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

type DeskQuickActionsDepth = 'desk' | 'set' | 'artifact' | 'tool';

interface DeskQuickActionsProps {
  depth: DeskQuickActionsDepth;
  selectedCount: number;
  multiSelectActive?: boolean;
  onMultiSelectChange?: (active: boolean) => void;
  onFitWork?: () => void;
  onFitSelection?: () => void;
  onSelectShown?: () => void;
  onClearSelection?: () => void;
}

const TouchGuide = ({ depth }: { depth: DeskQuickActionsDepth }) => (
  <section className="space-y-2 p-3" aria-label="Touch quick actions">
    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-muted)]"><Hand className="h-4 w-4" aria-hidden="true" />Touch</h4>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      {depth !== 'artifact' ? <><dt className="font-medium">Pan</dt><dd className="text-[var(--cf-text-muted)]">Drag empty space</dd><dt className="font-medium">Zoom</dt><dd className="text-[var(--cf-text-muted)]">Pinch around the area you want</dd><dt className="font-medium">Select</dt><dd className="text-[var(--cf-text-muted)]">Tap an object</dd></> : null}
      {depth === 'set' ? <><dt className="font-medium">Multi-select</dt><dd className="text-[var(--cf-text-muted)]">Turn on Select Multiple, then tap to add or remove Artifacts</dd><dt className="font-medium">Move</dt><dd className="text-[var(--cf-text-muted)]">Hold an Artifact, then drag</dd></> : null}
      {depth === 'artifact' ? <><dt className="font-medium">Direction</dt><dd className="text-[var(--cf-text-muted)]">Quick swipe to browse nearby Artifacts</dd><dt className="font-medium">Edit</dt><dd className="text-[var(--cf-text-muted)]">Double tap</dd></> : null}
    </dl>
  </section>
);

const DesktopGuide = ({ depth }: { depth: DeskQuickActionsDepth }) => (
  <section className="space-y-2 border-t border-[var(--cf-border-subtle)] p-3 sm:border-l sm:border-t-0" aria-label="Desktop quick actions">
    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cf-text-muted)]"><MousePointer2 className="h-4 w-4" aria-hidden="true" />Desktop</h4>
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
      {depth !== 'artifact' ? <><dt className="font-medium">Pan</dt><dd className="text-[var(--cf-text-muted)]">Drag empty space</dd><dt className="font-medium">Zoom</dt><dd className="text-[var(--cf-text-muted)]">Mouse wheel around cursor</dd><dt className="font-medium">Select</dt><dd className="text-[var(--cf-text-muted)]">Click · Ctrl/Cmd-click adds</dd><dt className="font-medium">Area select</dt><dd className="text-[var(--cf-text-muted)]">Shift-drag empty space</dd></> : null}
      {depth === 'set' ? <><dt className="font-medium">Move</dt><dd className="text-[var(--cf-text-muted)]">Focus an Artifact, then use WASD or Arrow keys; hold Shift for a larger nudge</dd></> : null}
      {depth === 'set' ? <><dt className="font-medium">Open</dt><dd className="text-[var(--cf-text-muted)]">Enter opens the focused Artifact or Template</dd><dt className="font-medium">Undo move</dt><dd className="text-[var(--cf-text-muted)]">Ctrl/Cmd+Z; add Shift to redo while the Set canvas is focused</dd></> : null}
      {depth === 'artifact' ? <><dt className="font-medium">Return</dt><dd className="text-[var(--cf-text-muted)]">Escape returns to the Set</dd></> : null}
    </dl>
  </section>
);

export function DeskQuickActions({ depth, selectedCount, multiSelectActive = false, onMultiSelectChange, onFitWork, onFitSelection, onSelectShown, onClearSelection }: DeskQuickActionsProps) {
  return <>
      <div className="grid sm:grid-cols-2"><TouchGuide depth={depth} /><DesktopGuide depth={depth} /></div>
      {onMultiSelectChange || onFitWork || onFitSelection || onSelectShown || onClearSelection ? <div className="flex flex-wrap gap-2 border-t border-[var(--cf-border-subtle)] p-3">
        {onMultiSelectChange ? <Button type="button" size="sm" variant={multiSelectActive ? 'default' : 'outline'} aria-pressed={multiSelectActive} onClick={() => onMultiSelectChange(!multiSelectActive)}>{multiSelectActive ? 'Done selecting' : 'Select Multiple'}</Button> : null}
        {onFitWork ? <Button type="button" size="sm" variant="outline" onClick={onFitWork}>Fit Work</Button> : null}
        {onFitSelection ? <Button type="button" size="sm" variant="outline" onClick={onFitSelection} disabled={selectedCount === 0}>Fit Selection</Button> : null}
        {onSelectShown ? <Button type="button" size="sm" variant="outline" onClick={onSelectShown}>Select shown</Button> : null}
        {onClearSelection ? <Button type="button" size="sm" variant="ghost" onClick={onClearSelection} disabled={selectedCount === 0}>Clear selection</Button> : null}
      </div> : null}
  </>;
}
