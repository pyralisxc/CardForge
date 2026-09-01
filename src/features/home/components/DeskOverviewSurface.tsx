"use client";

import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { CreditCard, FolderPlus, HardDrive, LayoutGrid, Link2, Loader2, Search, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import { sourceFilterOptions, type HomeAccountStatus, type HomeSort, type HomeSourceFilter } from '../model/homeDesk';
import { DeskWorkObject } from './DeskWorkObject';
import styles from './HomeDesk.module.css';

const statusIcons = { Access: CreditCard, Storage: HardDrive, Connections: Link2, Security: ShieldCheck };

export interface DeskOverviewSurfaceProps {
  workItemsCount: number;
  visibleWork: AccountLibraryItem[];
  focusedItemId: string | null;
  activeWorkId: string | null;
  pinnedIds: string[];
  positions: Record<string, DeskPosition>;
  isLoading: boolean;
  failureMessage: string | null;
  showGrid: boolean;
  snapToGrid: boolean;
  query: string;
  sourceFilter: HomeSourceFilter;
  sort: HomeSort;
  searchRef: RefObject<HTMLInputElement>;
  workGridRef: RefObject<HTMLDivElement>;
  canUseProjectFiles: boolean;
  canSubmit: boolean;
  statuses: HomeAccountStatus[];
  campaignShelf: ReactNode;
  renderWorkPreview: (item: AccountLibraryItem, featured: boolean, focused: boolean) => ReactNode;
  renderFocusedSurface: (item: AccountLibraryItem) => ReactNode;
  beginDrag: (itemId: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  moveDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  endDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  shouldSuppressFocus: (itemId: string) => boolean;
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
  return <div className={styles.desk} data-home-desk={props.focusedItemId ? 'focused' : 'overview'} data-focused={Boolean(props.focusedItemId)}>
    <header className={styles.deskIntro}>
      <div><p>Desk</p><h1>Your creative workspace</h1><span>Your open Sets stay arranged here. Choose one to move closer.</span></div>
      <strong>{props.visibleWork.length} open</strong>
    </header>
    {props.failureMessage ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${props.failureMessage} Available work remains unchanged.`} actionLabel="Retry" onAction={props.onRetry} /> : null}
    <section className={styles.workSurface} data-grid={props.showGrid} aria-labelledby="home-open-work-heading">
      <div className={styles.workSurfaceHeader}><h2 id="home-open-work-heading">Open work</h2><span>Each pile is one Set</span></div>
      <div className={styles.deskToolbar}>
        <label className={styles.searchField}><span className="sr-only">Search open work</span><Search aria-hidden="true" /><Input ref={props.searchRef} value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Find work" /></label>
        <SelectionFilterMenu allLabel="All work" ariaLabel="Filter open work by source" compactLabel="Source" className={styles.sourceSelect} value={props.sourceFilter} onChange={(value) => props.onSourceFilterChange(value as HomeSourceFilter)} options={sourceFilterOptions.filter((option) => option.id !== 'all').map((option) => ({ value: option.id, label: option.label }))} />
        <Select value={props.sort} onValueChange={(value) => props.onSortChange(value as HomeSort)}><SelectTrigger aria-label="Arrange open work" className={styles.arrangeSelect}><span>{props.sort === 'desk' ? 'Desk order' : props.sort === 'name' ? 'Name' : 'Largest first'}</span></SelectTrigger><SelectContent><SelectItem value="desk">Desk order</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="size">Largest first</SelectItem></SelectContent></Select>
        <div className={styles.spatialControls} aria-label="Desk positioning">
          <Button type="button" size="icon" variant="ghost" aria-label={props.showGrid ? 'Hide Desk grid' : 'Show Desk grid'} aria-pressed={props.showGrid} onClick={props.onShowGridChange}><LayoutGrid aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" aria-pressed={props.snapToGrid} onClick={props.onSnapToGridChange}>Snap</Button>
        </div>
      </div>
      {props.isLoading && !props.workItemsCount ? <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing your desk</strong></div></div> : props.visibleWork.length ? <div ref={props.workGridRef} className={styles.workGrid}>
        {props.visibleWork.map((item, index) => {
          const featured = index === 0;
          const focused = item.id === props.focusedItemId;
          return <DeskWorkObject key={item.id} item={item} index={index} itemCount={props.visibleWork.length} active={item.id === props.activeWorkId} featured={featured} focused={focused} obscured={Boolean(props.focusedItemId) && !focused} pinned={props.pinnedIds.includes(item.id)} position={props.positions[item.id]} canUseProjectFiles={props.canUseProjectFiles} canSubmit={props.canSubmit} preview={props.renderWorkPreview(item, featured, focused)} focusedSurface={focused ? props.renderFocusedSurface(item) : null} beginDrag={props.beginDrag} moveDrag={props.moveDrag} endDrag={props.endDrag} shouldSuppressFocus={props.shouldSuppressFocus} onFocus={props.onFocusWork} onTogglePin={props.onTogglePin} onOpenLane={props.onOpenLane} onOpenLocation={props.onOpenLocation} onOpenPipeline={props.onOpenPipeline} onDuplicate={props.onDuplicate} onMove={props.onMoveWork} onInspect={props.onInspect} onDelete={props.onDelete} />;
        })}
      </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><FolderPlus aria-hidden="true" /><strong>{props.workItemsCount ? 'No work matches this view' : 'Your desk is ready'}</strong><p className={styles.emptyCopy}>{props.workItemsCount ? 'Clear the search or change the source filter.' : 'Create a Set here, or connect durable work from Library.'}</p>{props.workItemsCount ? <Button type="button" variant="outline" onClick={() => { props.onQueryChange(''); props.onSourceFilterChange('all'); }}>Show all work</Button> : <Button type="button" onClick={props.onCreate}>Create your first Set</Button>}</div></div>}
    </section>
    {props.campaignShelf}
    <div className={styles.utilityStrip} aria-label="Account essentials">{props.statuses.map((status) => { const Icon = statusIcons[status.label as keyof typeof statusIcons] ?? Sparkles; return <button key={status.label} type="button" className={styles.utilityButton} onClick={() => props.onNavigate(status.href)} aria-label={`${status.label}: ${status.value}. ${status.action}`}><Icon className="h-4 w-4" aria-hidden="true" /><span className={styles.utilityText}><strong>{status.label}</strong><span>{status.value}</span></span></button>; })}</div>
  </div>;
}
