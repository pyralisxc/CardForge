"use client";

import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { FolderPlus, LayoutGrid, Loader2, Maximize2, Minus, Plus, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelectionFilterMenu } from '@/components/ui/multi-selection-filter-menu';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { EnvironmentBoundaryNotice } from '@/features/app-shell/client/environment';
import { CARD_SET_BUILT_IN_TYPES, type CardFace } from '@/domain/cards';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { AccountLibraryItem, AccountLibraryOrganizationOperation, AccountLibrarySource } from '@/features/storage-management/client';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';

import type { DeskCamera } from '../hooks/useDeskCamera';
import type { DeskPosition } from '../hooks/useDeskSpatialLayout';
import type { DeskOrganizationFacet, DeskSourceFacet } from '../model/desk';
import type { DeskSavedView, DeskTagMatch, DeskViewId } from '../hooks/useDeskViewPreferences';
import { DeskWorkObject } from './DeskWorkObject';
import styles from './Desk.module.css';

const sourcePhaseLabel: Record<string, string> = {
  loading: 'Loading',
  empty: 'No work found',
  unavailable: 'Unavailable',
  'permission-required': 'Permission required',
  expired: 'Sign-in expired',
  incomplete: 'Partially loaded',
};

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
  failure: { message: string; kind: BoundaryFailureKind; nextAction?: string; retryable: boolean } | null;
  sourceStatuses: readonly { id: string; label: string; phase: string; failure: { message: string } | null }[];
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
  workGridRef: RefObject<HTMLDivElement>;
  workWorldRef: RefObject<HTMLDivElement>;
  camera: DeskCamera;
  canUseProjectFiles: boolean;
  canSubmit: boolean;
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
  onUpdateSelectedOrganization: (operation: AccountLibraryOrganizationOperation) => void;
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
  const [viewName, setViewName] = useState('');
  const [organizationType, setOrganizationType] = useState('');
  const [organizationTag, setOrganizationTag] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const saveView = () => { if (props.onSaveView(viewName)) setViewName(''); };
  const selectedTags = Array.from(new Set(props.selectedWorkItems.flatMap((item) => item.organization.tags))).toSorted((left, right) => left.localeCompare(right));
  const typeVocabulary = Array.from(new Set([
    ...CARD_SET_BUILT_IN_TYPES,
    ...props.typeFacets.map((facet) => facet.label),
  ])).toSorted((left, right) => left.localeCompare(right));
  const sourceStatusDetails = props.sourceStatuses.filter((source) => source.phase !== 'ready' && source.phase !== 'empty');
  const sourceStatusSummary = sourceStatusDetails.every((source) => source.phase === 'loading')
    ? 'Loading work sources'
    : sourceStatusDetails.length === 1
      ? 'One work source needs attention'
      : `${sourceStatusDetails.length} work sources need attention`;
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
      <Select value={organizationType || '__choose_type'} onValueChange={(type) => {
        if (type === '__choose_type') return;
        props.onUpdateSelectedOrganization({ kind: 'set-type', type });
        setOrganizationType(type);
      }}>
        <SelectTrigger className={styles.deskTypeSelect} aria-label="Choose a supported or reusable Set type"><span>{organizationType || 'Set type'}</span></SelectTrigger>
        <SelectContent><SelectItem value="__choose_type">Set type</SelectItem>{typeVocabulary.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
      </Select>
      <Input value={organizationType} onChange={(event) => setOrganizationType(event.target.value)} className={styles.deskSaveViewInput} aria-label="Set custom descriptive type" placeholder="Custom type, e.g. Postcards" />
      <Button type="button" size="sm" variant="ghost" onClick={() => { props.onUpdateSelectedOrganization({ kind: 'set-type', type: organizationType }); setOrganizationType(''); }} disabled={!organizationType.trim()}>Set type</Button>
      {props.tagFacets.length ? <Select value="__choose_reusable_tag" onValueChange={(tag) => {
        if (tag === '__choose_reusable_tag') return;
        props.onUpdateSelectedOrganization({ kind: 'add-tag', tag });
      }}><SelectTrigger className={styles.deskTypeSelect} aria-label="Choose a reusable personal tag"><span>Reuse tag</span></SelectTrigger><SelectContent><SelectItem value="__choose_reusable_tag">Reuse tag</SelectItem>{props.tagFacets.map((facet) => <SelectItem key={facet.id} value={facet.id}>{facet.label}</SelectItem>)}</SelectContent></Select> : null}
      <Input value={organizationTag} onChange={(event) => setOrganizationTag(event.target.value)} className={styles.deskSaveViewInput} aria-label="Add personal tag" placeholder="Add tag" />
      <Button type="button" size="sm" variant="ghost" onClick={() => { props.onUpdateSelectedOrganization({ kind: 'add-tag', tag: organizationTag }); setOrganizationTag(''); }} disabled={!organizationTag.trim()}>Add tag</Button>
      {selectedTags.length ? <span className={styles.deskOrganizationTags} aria-label="Selected work tags">{selectedTags.map((tag) => <Button key={tag} type="button" size="sm" variant="outline" aria-label={`Remove tag ${tag} from selected work`} onClick={() => props.onUpdateSelectedOrganization({ kind: 'remove-tag', tag })}>{tag} ×</Button>)}</span> : null}
      {selectedTags.length ? <Select value={renameFrom || '__choose_tag'} onValueChange={(tag) => setRenameFrom(tag === '__choose_tag' ? '' : tag)}><SelectTrigger className={styles.deskTypeSelect} aria-label="Choose tag to rename"><span>{renameFrom || 'Rename tag'}</span></SelectTrigger><SelectContent><SelectItem value="__choose_tag">Rename tag</SelectItem>{selectedTags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent></Select> : null}
      {renameFrom ? <Input value={renameTo} onChange={(event) => setRenameTo(event.target.value)} className={styles.deskSaveViewInput} aria-label={`New name for ${renameFrom}`} placeholder="New tag name" /> : null}
      {renameFrom ? <Button type="button" size="sm" variant="ghost" disabled={!renameTo.trim()} onClick={() => { props.onUpdateSelectedOrganization({ kind: 'rename-tag', from: renameFrom, to: renameTo }); setRenameFrom(''); setRenameTo(''); }}>Rename tag</Button> : null}
      <Button type="button" size="sm" variant="ghost" onClick={() => props.onUpdateSelectedOrganization({ kind: 'clear' })}>Clear labels</Button>
    </div> : null}
  </>;
  return <div className={styles.desk} data-desk={props.focusedItemId ? 'focused' : 'overview'} data-focused={Boolean(props.focusedItemId)}>
    {props.failure ? <EnvironmentBoundaryNotice
      title={props.failure.kind === 'authentication' ? 'A source needs sign-in' : props.failure.kind === 'authorization' ? 'Permission is required for a source' : props.failure.kind === 'not_found' ? 'A source is no longer available' : 'Some sources are unavailable'}
      message={`${props.failure.message}${props.failure.nextAction ? ` ${props.failure.nextAction}` : ''}${props.failure.kind === 'unavailable' ? ' Previously loaded same-account work remains visible.' : ' Protected results from that source were removed.'}`}
      settingsHref="/account?section=library&tool=locations"
      actionLabel={props.failure.retryable ? 'Retry' : undefined}
      onAction={props.failure.retryable ? props.onRetry : undefined}
    /> : null}
    <section className={styles.workSurface} data-grid={props.showGrid} aria-label="Open Sets on Desk">
      <div className={styles.deskToolbar} data-desk-toolbar>
        <div className={styles.deskFilterRow} aria-label="Desk views and filters">{renderDeskFilters()}</div>
        <details className={styles.mobileDeskFilters} data-mobile-desk-filters>
          <summary aria-label="Open Desk filters"><SlidersHorizontal aria-hidden="true" /><span>Filters</span><span className={styles.mobileDeskFilterSummary}>{props.activeRestrictionsLabel}</span></summary>
          <div className={styles.mobileDeskFilterPanel} aria-label="Desk views and filters">{renderDeskFilters()}</div>
        </details>
        <div className={styles.spatialControls} aria-label="Desk view controls">
          <Button type="button" size="icon" variant="ghost" title="Zoom Desk out" onClick={() => props.camera.changeZoom(props.camera.zoom - 0.1)} aria-label="Zoom Desk out"><Minus aria-hidden="true" /></Button>
          <span className={styles.contextZoom} aria-live="polite">{Math.round(props.camera.zoom * 100)}%</span>
          <Button type="button" size="icon" variant="ghost" title="Zoom Desk in" onClick={() => props.camera.changeZoom(props.camera.zoom + 0.1)} aria-label="Zoom Desk in"><Plus aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Fit the whole Desk in view" title="Fit the whole Desk in view" onClick={props.camera.fit}><Maximize2 aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="ghost" title={props.showGrid ? 'Hide Desk grid' : 'Show Desk grid'} aria-label={props.showGrid ? 'Hide Desk grid' : 'Show Desk grid'} aria-pressed={props.showGrid} onClick={props.onShowGridChange}><LayoutGrid aria-hidden="true" /></Button>
          <Button type="button" size="sm" variant="ghost" title="Snap moved Sets to the Desk grid" aria-pressed={props.snapToGrid} onClick={props.onSnapToGridChange}>Snap</Button>
        </div>
      </div>
      {sourceStatusDetails.length ? <details className={styles.sourceStatusNotice}>
        <summary>{sourceStatusSummary}</summary>
        <ul>{sourceStatusDetails.map((source) => <li key={source.id}><strong>{source.label}</strong><span>{source.failure?.message ?? sourcePhaseLabel[source.phase] ?? 'Status unavailable'}</span></li>)}</ul>
      </details> : null}
      {props.isLoading && !props.workItemsCount ? <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing your desk</strong></div></div> : props.visibleWork.length ? <div
        id="desk-world-viewport"
        ref={props.workGridRef}
        className={styles.workGrid}
        data-desk-viewport
        data-scene-viewport
        data-focused={Boolean(props.focusedItemId)}
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
          <div ref={props.workWorldRef} className={styles.deskWorld} data-focused={Boolean(props.focusedItemId)} data-grid={props.showGrid} style={{ transform: `translate(${props.camera.offsetX}px, ${props.camera.offsetY}px) scale(${props.camera.zoom})` }}>
            {props.marquee ? <span className={styles.deskMarquee} aria-hidden="true" style={{ left: props.marquee.left, top: props.marquee.top, width: props.marquee.right - props.marquee.left, height: props.marquee.bottom - props.marquee.top } as CSSProperties} /> : null}
            {props.visibleWork.map((item) => {
              const featured = item.id === props.activeWorkId;
              const focused = item.id === props.focusedItemId;
              return <DeskWorkObject key={item.id} item={item} active={featured} featured={featured} focused={focused} selected={props.selectedIds.includes(item.id)} arrangeMode={false} obscured={Boolean(props.focusedItemId) && !focused} pinned={props.pinnedIds.includes(item.id)} position={props.positions[item.id]} canUseProjectFiles={props.canUseProjectFiles} canSubmit={props.canSubmit} preview={(face) => props.renderWorkPreview(item, featured, focused, face)} canFlip={props.canFlipWork(item)} artifactIds={props.previewArtifactIds(item)} focusedSurface={focused ? props.renderFocusedSurface(item) : null} beginDrag={props.beginDrag} moveDrag={props.moveDrag} endDrag={props.endDrag} shouldSuppressActivation={props.shouldSuppressActivation} onSelect={props.onSelectWork} onFocus={props.onFocusWork} onTogglePin={props.onTogglePin} onOpenLane={props.onOpenLane} onOpenLocation={props.onOpenLocation} onOpenPipeline={props.onOpenPipeline} onDuplicate={props.onDuplicate} onInspect={props.onInspect} onDelete={props.onDelete} />;
            })}
          </div>
        </div>
      </div> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}>
        <FolderPlus aria-hidden="true" />
        <strong>{props.workItemsCount ? 'No work matches this view' : 'Your desk is ready'}</strong>
        <p className={styles.emptyCopy}>{props.workItemsCount ? 'Clear the search or change the active view and filters.' : 'A Set keeps related cards together. Create one from scratch or a published starter, or open saved work from Library.'}</p>
        {props.workItemsCount ? <Button type="button" variant="outline" onClick={() => { props.onQueryChange(''); props.onResetViews(); }}>Show My work</Button> : <div className="flex flex-wrap justify-center gap-2"><Button type="button" onClick={props.onCreate}>Create your first Set</Button><Button type="button" variant="outline" onClick={() => props.onNavigate('/account?section=library')}>Open Library</Button></div>}
      </div></div>}
    </section>
  </div>;
}