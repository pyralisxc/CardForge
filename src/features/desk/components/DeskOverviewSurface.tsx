"use client";

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CreditCard, FolderPlus, Hand, HardDrive, LayoutGrid, Link2, Loader2, Maximize2, Minus, Plus, Search, ShieldCheck, Sparkles, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { CardFace } from '@/domain/cards';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { DeskCamera } from '../hooks/useDeskCamera';
import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import { sourceFilterOptions, type DeskAccountStatus, type HomeSort, type HomeSourceFilter } from '../model/desk';
import { DeskWorkObject } from './DeskWorkObject';
import styles from './Desk.module.css';

const statusIcons = { Access: CreditCard, Storage: HardDrive, Connections: Link2, Security: ShieldCheck };

export interface DeskOverviewSurfaceProps {
  workItemsCount: number;
  visibleWork: AccountLibraryItem[];
  focusedItemId: string | null;
  activeWorkId: string | null;
  pinnedIds: string[];
  selectedIds: string[];
  positions: Record<string, DeskPosition>;
  marquee: { left: number; top: number; right: number; bottom: number } | null;
  isLoading: boolean;
  failureMessage: string | null;
  showGrid: boolean;
  snapToGrid: boolean;
  query: string;
  sourceFilter: HomeSourceFilter;
  sort: HomeSort;
  searchRef: RefObject<HTMLInputElement>;
  workGridRef: RefObject<HTMLDivElement>;
  workWorldRef: RefObject<HTMLDivElement>;
  camera: DeskCamera;
  canUseProjectFiles: boolean;
  canSubmit: boolean;
  statuses: DeskAccountStatus[];
  campaignShelf: ReactNode;
  renderWorkPreview: (item: AccountLibraryItem, featured: boolean, focused: boolean, face: CardFace) => ReactNode;
  canFlipWork: (item: AccountLibraryItem) => boolean;
  renderFocusedSurface: (item: AccountLibraryItem) => ReactNode;
  beginDrag: (itemId: string, event: ReactPointerEvent<HTMLButtonElement>, options?: { additive?: boolean }) => void;
  moveDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  endDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  shouldSuppressActivation: (itemId: string) => boolean;
  beginMarquee: (event: ReactPointerEvent<HTMLDivElement>, allowTouch?: boolean) => void;
  moveMarquee: (event: ReactPointerEvent<HTMLDivElement>) => void;
  endMarquee: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectWork: (item: AccountLibraryItem, options?: { additive?: boolean; range?: boolean }) => void;
  onNudgeSelection: (delta: { x: number; y: number }) => void;
  onClearSelection: () => void;
  onQueryChange: (value: string) => void;
  onSourceFilterChange: (value: HomeSourceFilter) => void;
  onSortChange: (value: HomeSort) => void;
  onShowGridChange: () => void;
  onSnapToGridChange: () => void;
  onFocusWork: (item: AccountLibraryItem) => void;
  onTogglePin: (itemId: string) => void;
  onOpenLane: (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => void;
  onOpenLocation: (item: AccountLibraryItem) => void;
  onOpenPipeline: (setId: string) => void;
  onDuplicate: (item: AccountLibraryItem) => void;
  onMoveWork: (itemId: string, direction: 'earlier' | 'later') => void;
  onInspect: (item: AccountLibraryItem) => void;
  onDelete: (item: AccountLibraryItem) => void;
  onCreate: () => void;
  onRetry: () => void;
  onNavigate: (href: string) => void;
}

export function DeskOverviewSurface(props: DeskOverviewSurfaceProps) {
  const [arrangeMode, setArrangeMode] = useState(false);
  const primarySelected = props.visibleWork.find((item) => props.selectedIds.includes(item.id)) ?? null;
  return <div className={styles.desk} data-desk={props.focusedItemId ? 'focused' : 'overview'} data-focused={Boolean(props.focusedItemId)}>
    <header className={styles.deskIntro}>
      <div><p>Desk</p><h1>Your creative workspace</h1><span>Your open Sets stay arranged here. Choose one to move closer.</span></div>
      <strong>{props.visibleWork.length} open</strong>
    </header>
    {props.failureMessage ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${props.failureMessage} Available work remains unchanged.`} actionLabel="Retry" onAction={props.onRetry} /> : null}
    <section className={styles.workSurface} data-grid={props.showGrid} aria-labelledby="desk-open-work-heading">
      <div className={styles.workSurfaceHeader}><h2 id="desk-open-work-heading">Open work</h2><span>Each pile is one Set</span></div>
      <div className={styles.deskToolbar}>
        <label className={styles.searchField}><span className="sr-only">Search open work</span><Search aria-hidden="true" /><Input ref={props.searchRef} value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Find work" /></label>
        <SelectionFilterMenu allLabel="All work" ariaLabel="Filter open work by source" compactLabel="Source" className={styles.sourceSelect} value={props.sourceFilter} onChange={(value) => props.onSourceFilterChange(value as HomeSourceFilter)} options={sourceFilterOptions.filter((option) => option.id !== 'all').map((option) => ({ value: option.id, label: option.label }))} />
        <Select value={props.sort} onValueChange={(value) => props.onSortChange(value as HomeSort)}><SelectTrigger aria-label="Arrange open work" className={styles.arrangeSelect}><span>{props.sort === 'desk' ? 'Desk order' : props.sort === 'name' ? 'Name' : 'Largest first'}</span></SelectTrigger><SelectContent><SelectItem value="desk">Desk order</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="size">Largest first</SelectItem></SelectContent></Select>
        <div className={styles.spatialControls} aria-label="Desk positioning">
          <span className={styles.desktopSpatialControls}>
            <Button type="button" size="icon" variant="ghost" aria-label={props.showGrid ? 'Hide Desk grid' : 'Show Desk grid'} aria-pressed={props.showGrid} onClick={props.onShowGridChange}><LayoutGrid aria-hidden="true" /></Button>
            <Button type="button" size="sm" variant="ghost" aria-pressed={props.snapToGrid} onClick={props.onSnapToGridChange}>Snap</Button>
          </span>
          <Button type="button" size="sm" variant={arrangeMode ? 'secondary' : 'ghost'} aria-pressed={arrangeMode} onClick={() => setArrangeMode((current) => !current)}><Hand className="mr-1 h-4 w-4" aria-hidden="true" />{arrangeMode ? 'Done' : 'Move'}</Button>
        </div>
      </div>
      {props.selectedIds.length && !props.focusedItemId ? <div className={styles.deskSelectionBar}>
        <strong role="status" aria-live="polite">{props.selectedIds.length} Set{props.selectedIds.length === 1 ? '' : 's'} selected</strong>
        {primarySelected ? <Button type="button" size="sm" onClick={() => props.onFocusWork(primarySelected)}>Open</Button> : null}
        <span className={styles.deskNudgeControls} role="group" aria-label="Move selected Sets">
          <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets left" onClick={() => props.onNudgeSelection({ x: -24, y: 0 })}><ArrowLeft aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets up" onClick={() => props.onNudgeSelection({ x: 0, y: -24 })}><ArrowUp aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets down" onClick={() => props.onNudgeSelection({ x: 0, y: 24 })}><ArrowDown aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Move selected Sets right" onClick={() => props.onNudgeSelection({ x: 24, y: 0 })}><ArrowRight aria-hidden="true" /></Button>
        </span>
        <Button type="button" size="icon" variant="ghost" aria-label="Clear Desk selection" onClick={props.onClearSelection}><X aria-hidden="true" /></Button>
      </div> : null}
      {props.isLoading && !props.workItemsCount ? <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing your desk</strong></div></div> : props.visibleWork.length ? <div
        id="desk-world-viewport"
        ref={props.workGridRef}
        className={styles.workGrid}
        data-desk-viewport
        data-focused={Boolean(props.focusedItemId)}
        data-arrange-mode={arrangeMode}
        data-zoom={props.camera.zoom.toFixed(2)}
        onScroll={props.camera.onScroll}
        tabIndex={props.focusedItemId ? -1 : 0}
        aria-label={props.focusedItemId ? undefined : 'Desk viewport. Swipe or scroll to explore the bounded Desk.'}
      >
        <div className={styles.deskWorldSizer} data-focused={Boolean(props.focusedItemId)} style={{ width: props.camera.surfaceWidth, height: props.camera.surfaceHeight }}>
          <div
            ref={props.workWorldRef}
            className={styles.deskWorld}
            data-focused={Boolean(props.focusedItemId)}
            data-grid={props.showGrid}
            style={{ transform: `translate(${props.camera.offsetX}px, ${props.camera.offsetY}px) scale(${props.camera.zoom})` }}
            onPointerDown={props.focusedItemId ? undefined : (event) => props.beginMarquee(event, false)}
            onPointerMove={props.focusedItemId ? undefined : props.moveMarquee}
            onPointerUp={props.focusedItemId ? undefined : props.endMarquee}
            onPointerCancel={props.focusedItemId ? undefined : props.endMarquee}
          >
            {props.marquee ? <span className={styles.deskMarquee} aria-hidden="true" style={{
              left: props.marquee.left,
              top: props.marquee.top,
              width: props.marquee.right - props.marquee.left,
              height: props.marquee.bottom - props.marquee.top,
            } as CSSProperties} /> : null}
            {props.visibleWork.map((item, index) => {
              const featured = item.id === props.activeWorkId;
              const focused = item.id === props.focusedItemId;
              return <DeskWorkObject key={item.id} item={item} index={index} itemCount={props.visibleWork.length} active={item.id === props.activeWorkId} featured={featured} focused={focused} selected={props.selectedIds.includes(item.id)} arrangeMode={arrangeMode} obscured={Boolean(props.focusedItemId) && !focused} pinned={props.pinnedIds.includes(item.id)} position={props.positions[item.id]} canUseProjectFiles={props.canUseProjectFiles} canSubmit={props.canSubmit} preview={(face) => props.renderWorkPreview(item, featured, focused, face)} canFlip={props.canFlipWork(item)} focusedSurface={focused ? props.renderFocusedSurface(item) : null} beginDrag={props.beginDrag} moveDrag={props.moveDrag} endDrag={props.endDrag} shouldSuppressActivation={props.shouldSuppressActivation} onSelect={props.onSelectWork} onFocus={props.onFocusWork} onTogglePin={props.onTogglePin} onOpenLane={props.onOpenLane} onOpenLocation={props.onOpenLocation} onOpenPipeline={props.onOpenPipeline} onDuplicate={props.onDuplicate} onMove={props.onMoveWork} onInspect={props.onInspect} onDelete={props.onDelete} />;
            })}
          </div>
        </div>
      </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><FolderPlus aria-hidden="true" /><strong>{props.workItemsCount ? 'No work matches this view' : 'Your desk is ready'}</strong><p className={styles.emptyCopy}>{props.workItemsCount ? 'Clear the search or change the source filter.' : 'Create a Set here, or connect durable work from Library.'}</p>{props.workItemsCount ? <Button type="button" variant="outline" onClick={() => { props.onQueryChange(''); props.onSourceFilterChange('all'); }}>Show all work</Button> : <Button type="button" onClick={props.onCreate}>Create your first Set</Button>}</div></div>}
      {props.visibleWork.length && !props.focusedItemId ? <>
        {!props.selectedIds.length ? <p className={styles.deskViewportHint}>{arrangeMode ? 'Move is on · drag selected Sets, then tap Done' : 'Swipe the Desk to look around · tap a Set to select it'}</p> : null}
        <div className={styles.deskCameraControls} role="group" aria-label="Desk view controls">
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom Desk out" aria-controls="desk-world-viewport" disabled={props.camera.zoom <= 0.25} onClick={() => props.camera.changeZoom(props.camera.zoom - 0.1)}><Minus aria-hidden="true" /></Button>
          <span role="status" aria-live="polite">{Math.round(props.camera.zoom * 100)}%</span>
          <Button type="button" size="icon" variant="ghost" aria-label="Zoom Desk in" aria-controls="desk-world-viewport" disabled={props.camera.zoom >= 1.25} onClick={() => props.camera.changeZoom(props.camera.zoom + 0.1)}><Plus aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" aria-label="Fit the whole Desk in view" aria-controls="desk-world-viewport" onClick={props.camera.fit}><Maximize2 className="mr-1 h-4 w-4" aria-hidden="true" />Fit</Button>
        </div>
      </> : null}
    </section>
    {props.campaignShelf}
    <div className={styles.utilityStrip} aria-label="Account essentials">{props.statuses.map((status) => { const Icon = statusIcons[status.label as keyof typeof statusIcons] ?? Sparkles; return <button key={status.label} type="button" className={styles.utilityButton} onClick={() => props.onNavigate(status.href)} aria-label={`${status.label}: ${status.value}. ${status.action}`}><Icon className="h-4 w-4" aria-hidden="true" /><span className={styles.utilityText}><strong>{status.label}</strong><span>{status.value}</span></span></button>; })}</div>
  </div>;
}
