"use client";

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { CreditCard, FolderPlus, Hand, HardDrive, LayoutGrid, Link2, Loader2, Search, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { CardFace } from '@/domain/cards';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { DeskCamera } from '../hooks/useDeskCamera';
import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import type { DeskAccountStatus, DeskSourceFacet, DeskSourceFilter } from '../model/desk';
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
  sourceFilter: DeskSourceFilter;
  sourceFacets: DeskSourceFacet[];
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
  onQueryChange: (value: string) => void;
  onSourceFilterChange: (value: DeskSourceFilter) => void;
  onShowGridChange: () => void;
  onSnapToGridChange: () => void;
  onFocusWork: (item: AccountLibraryItem) => void;
  onTogglePin: (itemId: string) => void;
  onOpenLane: (item: AccountLibraryItem, lane: 'open' | 'generate' | 'export') => void;
  onOpenLocation: (item: AccountLibraryItem) => void;
  onOpenPipeline: (setId: string) => void;
  onDuplicate: (item: AccountLibraryItem) => void;
  onInspect: (item: AccountLibraryItem) => void;
  onDelete: (item: AccountLibraryItem) => void;
  onCreate: () => void;
  onRetry: () => void;
  onNavigate: (href: string) => void;
}

export function DeskOverviewSurface(props: DeskOverviewSurfaceProps) {
  const [arrangeMode, setArrangeMode] = useState(false);
  return <div className={styles.desk} data-desk={props.focusedItemId ? 'focused' : 'overview'} data-focused={Boolean(props.focusedItemId)}>
    {props.failureMessage ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${props.failureMessage} Available work remains unchanged.`} settingsHref="/account?section=library&tool=locations" actionLabel="Retry" onAction={props.onRetry} /> : null}
    <section className={styles.workSurface} data-grid={props.showGrid} aria-label="Open Sets on Desk">
      <div className={styles.deskToolbar}>
        <label className={styles.searchField}><span className="sr-only">Search open work</span><Search aria-hidden="true" /><Input ref={props.searchRef} value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Find work" /></label>
        {props.sourceFacets.length > 1 ? <SelectionFilterMenu allLabel="All sources" ariaLabel="Filter open work by source" compactLabel="Source" className={styles.sourceSelect} value={props.sourceFilter} onChange={(value) => props.onSourceFilterChange(value as DeskSourceFilter)} options={props.sourceFacets.map((facet) => ({ value: facet.id, label: `${facet.label} · ${facet.count}` }))} /> : null}
        <div className={styles.spatialControls} aria-label="Desk positioning">
          <span className={styles.desktopSpatialControls}>
            <Button type="button" size="icon" variant="ghost" aria-label={props.showGrid ? 'Hide Desk grid' : 'Show Desk grid'} aria-pressed={props.showGrid} onClick={props.onShowGridChange}><LayoutGrid aria-hidden="true" /></Button>
            <Button type="button" size="sm" variant="ghost" aria-pressed={props.snapToGrid} onClick={props.onSnapToGridChange}>Snap</Button>
          </span>
          <Button type="button" size="sm" variant={arrangeMode ? 'secondary' : 'ghost'} aria-pressed={arrangeMode} onClick={() => setArrangeMode((current) => !current)}><Hand className="mr-1 h-4 w-4" aria-hidden="true" />{arrangeMode ? 'Done' : 'Move'}</Button>
        </div>
      </div>
      {props.isLoading && !props.workItemsCount ? <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing your desk</strong></div></div> : props.visibleWork.length ? <div
        id="desk-world-viewport"
        ref={props.workGridRef}
        className={styles.workGrid}
        data-desk-viewport
        data-focused={Boolean(props.focusedItemId)}
        data-arrange-mode={arrangeMode}
        data-zoom={props.camera.zoom.toFixed(2)}
        onScroll={props.camera.onScroll}
        onPointerDownCapture={props.camera.onPointerDownCapture}
        onPointerMoveCapture={props.camera.onPointerMoveCapture}
        onPointerUpCapture={props.camera.onPointerUpCapture}
        onPointerCancelCapture={props.camera.onPointerCancelCapture}
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
            onPointerDown={props.focusedItemId ? undefined : (event) => props.beginMarquee(event, arrangeMode)}
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
            {props.visibleWork.map((item) => {
              const featured = item.id === props.activeWorkId;
              const focused = item.id === props.focusedItemId;
              return <DeskWorkObject key={item.id} item={item} active={item.id === props.activeWorkId} featured={featured} focused={focused} selected={props.selectedIds.includes(item.id)} arrangeMode={arrangeMode} obscured={Boolean(props.focusedItemId) && !focused} pinned={props.pinnedIds.includes(item.id)} position={props.positions[item.id]} canUseProjectFiles={props.canUseProjectFiles} canSubmit={props.canSubmit} preview={(face) => props.renderWorkPreview(item, featured, focused, face)} canFlip={props.canFlipWork(item)} focusedSurface={focused ? props.renderFocusedSurface(item) : null} beginDrag={props.beginDrag} moveDrag={props.moveDrag} endDrag={props.endDrag} shouldSuppressActivation={props.shouldSuppressActivation} onSelect={props.onSelectWork} onFocus={props.onFocusWork} onTogglePin={props.onTogglePin} onOpenLane={props.onOpenLane} onOpenLocation={props.onOpenLocation} onOpenPipeline={props.onOpenPipeline} onDuplicate={props.onDuplicate} onInspect={props.onInspect} onDelete={props.onDelete} />;
            })}
          </div>
        </div>
      </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><FolderPlus aria-hidden="true" /><strong>{props.workItemsCount ? 'No work matches this view' : 'Your desk is ready'}</strong><p className={styles.emptyCopy}>{props.workItemsCount ? 'Clear the search or change the source filter.' : 'Create a Set here, or connect durable work from Library.'}</p>{props.workItemsCount ? <Button type="button" variant="outline" onClick={() => { props.onQueryChange(''); props.onSourceFilterChange('all'); }}>Show all work</Button> : <Button type="button" onClick={props.onCreate}>Create your first Set</Button>}</div></div>}
    </section>
    {props.campaignShelf}
    <div className={styles.utilityStrip} aria-label="Account essentials">{props.statuses.map((status) => { const Icon = statusIcons[status.label as keyof typeof statusIcons] ?? Sparkles; return <button key={status.label} type="button" className={styles.utilityButton} onClick={() => props.onNavigate(status.href)} aria-label={`${status.label}: ${status.value}. ${status.action}`}><Icon className="h-4 w-4" aria-hidden="true" /><span className={styles.utilityText}><strong>{status.label}</strong><span>{status.value}</span></span></button>; })}</div>
  </div>;
}
