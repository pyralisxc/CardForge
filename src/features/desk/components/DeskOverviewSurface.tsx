"use client";

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { CreditCard, FolderPlus, Hand, HardDrive, LayoutGrid, Link2, Loader2, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelectionFilterMenu } from '@/components/ui/multi-selection-filter-menu';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import type { CardFace } from '@/domain/cards';
import type { AccountLibraryItem, AccountLibrarySource } from '@/features/storage-management/client';

import type { DeskCamera } from '../hooks/useDeskCamera';
import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import type { DeskAccountStatus, DeskOrganizationFacet, DeskSourceFacet } from '../model/desk';
import type { DeskSavedView, DeskTagMatch, DeskViewId } from '../hooks/useDeskViewPreferences';
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
  sourceFilters: AccountLibrarySource[];
  sourceFacets: DeskSourceFacet[];
  typeFilters: string[];
  typeFacets: DeskOrganizationFacet[];
  tagFilters: string[];
  tagFacets: DeskOrganizationFacet[];
  tagMatch: DeskTagMatch;
  activeDeskViews: DeskViewId[];
  availableDeskViews: DeskViewId[];
  savedViews: DeskSavedView[];
  activeRestrictionsLabel: string;
  selectedWorkItems: AccountLibraryItem[];
  searchRef: RefObject<HTMLInputElement>;
  workGridRef: RefObject<HTMLDivElement>;
  workWorldRef: RefObject<HTMLDivElement>;
  camera: DeskCamera;
  canUseProjectFiles: boolean;
  canSubmit: boolean;
  statuses: DeskAccountStatus[];
  renderWorkPreview: (item: AccountLibraryItem, featured: boolean, focused: boolean, face: CardFace) => ReactNode;
  previewArtifactIds: (item: AccountLibraryItem) => string[];
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
  onSourceFiltersChange: (values: AccountLibrarySource[]) => void;
  onTypeFiltersChange: (values: string[]) => void;
  onTagFiltersChange: (values: string[]) => void;
  onTagMatchChange: (value: DeskTagMatch) => void;
  onDeskViewsChange: (values: DeskViewId[]) => void;
  onApplySavedView: (id: string) => void;
  onSaveView: (name: string) => boolean;
  onResetViews: () => void;
  onUpdateSelectedOrganization: (patch: { type?: string; tags?: string[] }) => void;
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
  const [viewName, setViewName] = useState('');
  const [organizationType, setOrganizationType] = useState('');
  const [organizationTag, setOrganizationTag] = useState('');
  const saveView = () => { if (props.onSaveView(viewName)) setViewName(''); };
  const renderDeskFilters = () => <>
    <MultiSelectionFilterMenu allLabel="My work" ariaLabel="Choose Desk views" compactLabel="Views" className={styles.sourceSelect} values={props.activeDeskViews} onChange={props.onDeskViewsChange} options={props.availableDeskViews.map((view) => ({
      value: view,
      label: view === 'my-work' ? 'My work' : view === 'campaigns' ? 'Campaigns' : 'My published',
    }))} />
    {props.sourceFacets.length ? <MultiSelectionFilterMenu allLabel="All sources" ariaLabel="Filter Desk by source" compactLabel="Source" className={styles.sourceSelect} values={props.sourceFilters} onChange={props.onSourceFiltersChange} options={props.sourceFacets.map((facet) => ({ value: facet.id, label: `${facet.label} · ${facet.count}` }))} /> : null}
    {props.typeFacets.length ? <MultiSelectionFilterMenu allLabel="All types" ariaLabel="Filter Desk by type" compactLabel="Type" className={styles.sourceSelect} values={props.typeFilters} onChange={props.onTypeFiltersChange} options={props.typeFacets.map((facet) => ({ value: facet.id, label: `${facet.label} · ${facet.count}` }))} /> : null}
    {props.tagFacets.length ? <MultiSelectionFilterMenu allLabel="All tags" ariaLabel="Filter Desk by tag" compactLabel="Tags" className={styles.sourceSelect} values={props.tagFilters} onChange={props.onTagFiltersChange} options={props.tagFacets.map((facet) => ({ value: facet.id, label: `${facet.label} · ${facet.count}` }))} /> : null}
    {props.tagFilters.length > 1 ? <SelectionFilterMenu allLabel="Any tag" ariaLabel="Choose tag matching" compactLabel="Tags" value={props.tagMatch} onChange={(value) => props.onTagMatchChange(value === 'all' ? 'all' : 'any')} options={[{ value: 'any', label: 'Any tag' }, { value: 'all', label: 'All tags' }]} /> : null}
    {props.savedViews.length ? <SelectionFilterMenu allLabel="Saved views" ariaLabel="Apply a saved Desk view" compactLabel="Saved" value="all" onChange={(value) => { if (value !== 'all') props.onApplySavedView(value); }} options={props.savedViews.map((view) => ({ value: view.id, label: view.name }))} /> : null}
    <span className={styles.deskRestrictionLabel} aria-live="polite">{props.activeRestrictionsLabel}</span>
    <Input value={viewName} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveView(); } }} className={styles.deskSaveViewInput} aria-label="Name this Desk view" placeholder="Save view" />
    <Button type="button" size="sm" variant="ghost" onClick={saveView} disabled={!viewName.trim()}>Save</Button>
    <Button type="button" size="sm" variant="ghost" onClick={props.onResetViews}>Reset</Button>
    {props.selectedWorkItems.length ? <div className={styles.deskOrganizer} aria-label="Organize selected work">
      <Input value={organizationType} onChange={(event) => setOrganizationType(event.target.value)} className={styles.deskSaveViewInput} aria-label="Set descriptive type" placeholder="Type, e.g. Postcards" />
      <Button type="button" size="sm" variant="ghost" onClick={() => { props.onUpdateSelectedOrganization({ type: organizationType }); setOrganizationType(''); }} disabled={!organizationType.trim()}>Set type</Button>
      <Input value={organizationTag} onChange={(event) => setOrganizationTag(event.target.value)} className={styles.deskSaveViewInput} aria-label="Add personal tag" placeholder="Add tag" />
      <Button type="button" size="sm" variant="ghost" onClick={() => {
        const tags = Array.from(new Set([...props.selectedWorkItems.flatMap((item) => item.organization.tags), organizationTag.trim()]));
        props.onUpdateSelectedOrganization({ tags }); setOrganizationTag('');
      }} disabled={!organizationTag.trim()}>Add tag</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => props.onUpdateSelectedOrganization({ type: '', tags: [] })}>Clear labels</Button>
    </div> : null}
  </>;
  return <div className={styles.desk} data-desk={props.focusedItemId ? 'focused' : 'overview'} data-focused={Boolean(props.focusedItemId)}>
    {props.failureMessage ? <EnvironmentBoundaryNotice title="Some sources are unavailable" message={`${props.failureMessage} Available work remains unchanged.`} settingsHref="/account?section=library&tool=locations" actionLabel="Retry" onAction={props.onRetry} /> : null}
    <section className={styles.workSurface} data-grid={props.showGrid} aria-label="Open Sets on Desk">
      <div className={styles.deskToolbar} data-desk-toolbar>
        <label className={styles.searchField}><span className="sr-only">Search open work</span><Search aria-hidden="true" /><Input ref={props.searchRef} value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Find work" /></label>
        <div className={styles.deskFilterRow} aria-label="Desk views and filters">
          {renderDeskFilters()}
        </div>
        <details className={styles.mobileDeskFilters} data-mobile-desk-filters>
          <summary aria-label="Open Desk filters"><SlidersHorizontal aria-hidden="true" /><span>Filters</span><span className={styles.mobileDeskFilterSummary}>{props.activeRestrictionsLabel}</span></summary>
          <div className={styles.mobileDeskFilterPanel} aria-label="Desk views and filters">{renderDeskFilters()}</div>
        </details>
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
        data-scene-viewport
        data-focused={Boolean(props.focusedItemId)}
        data-arrange-mode={arrangeMode}
        data-zoom={props.camera.zoom.toFixed(2)}
        onScroll={props.camera.onScroll}
        onPointerDownCapture={props.camera.onPointerDownCapture}
        onPointerMoveCapture={props.camera.onPointerMoveCapture}
        onPointerUpCapture={props.camera.onPointerUpCapture}
        onPointerCancelCapture={props.camera.onPointerCancelCapture}
        onClickCapture={props.camera.onClickCapture}
        onContextMenu={props.camera.onContextMenu}
        onPointerDown={props.focusedItemId ? undefined : (event) => props.beginMarquee(event, true)}
        onPointerMove={props.focusedItemId ? undefined : props.moveMarquee}
        onPointerUp={props.focusedItemId ? undefined : props.endMarquee}
        onPointerCancel={props.focusedItemId ? undefined : props.endMarquee}
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
              return <DeskWorkObject key={item.id} item={item} active={item.id === props.activeWorkId} featured={featured} focused={focused} selected={props.selectedIds.includes(item.id)} arrangeMode={arrangeMode} obscured={Boolean(props.focusedItemId) && !focused} pinned={props.pinnedIds.includes(item.id)} position={props.positions[item.id]} canUseProjectFiles={props.canUseProjectFiles} canSubmit={props.canSubmit} preview={(face) => props.renderWorkPreview(item, featured, focused, face)} canFlip={props.canFlipWork(item)} artifactIds={props.previewArtifactIds(item)} focusedSurface={focused ? props.renderFocusedSurface(item) : null} beginDrag={props.beginDrag} moveDrag={props.moveDrag} endDrag={props.endDrag} shouldSuppressActivation={props.shouldSuppressActivation} onSelect={props.onSelectWork} onFocus={props.onFocusWork} onTogglePin={props.onTogglePin} onOpenLane={props.onOpenLane} onOpenLocation={props.onOpenLocation} onOpenPipeline={props.onOpenPipeline} onDuplicate={props.onDuplicate} onInspect={props.onInspect} onDelete={props.onDelete} />;
            })}
          </div>
        </div>
      </div> : <div className={styles.emptyDesk}>
        <div className={styles.emptyDeskInner}>
          <FolderPlus aria-hidden="true" />
          <strong>{props.workItemsCount ? 'No work matches this view' : 'Your desk is ready'}</strong>
          <p className={styles.emptyCopy}>
            {props.workItemsCount
              ? 'Clear the search or change the active view and filters.'
              : 'A Set keeps related cards together. Create one from scratch or a published starter, or open saved work from Library.'}
          </p>
          {props.workItemsCount ? (
            <Button type="button" variant="outline" onClick={() => { props.onQueryChange(''); props.onResetViews(); }}>Show My work</Button>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={props.onCreate}>Create your first Set</Button>
              <Button type="button" variant="outline" onClick={() => props.onNavigate('/account?section=library')}>Open Library</Button>
            </div>
          )}
        </div>
      </div>}
    </section>
    <div className={styles.utilityStrip} aria-label="Account essentials">{props.statuses.map((status) => { const Icon = statusIcons[status.label as keyof typeof statusIcons] ?? Sparkles; return <button key={status.label} type="button" className={styles.utilityButton} onClick={() => props.onNavigate(status.href)} aria-label={`${status.label}: ${status.value}. ${status.action}`}><Icon className="h-4 w-4" aria-hidden="true" /><span className={styles.utilityText}><strong>{status.label}</strong><span>{status.value}</span></span></button>; })}</div>
  </div>;
}
