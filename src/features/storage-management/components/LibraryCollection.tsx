"use client";

import dynamic from 'next/dynamic';
import { Fragment, useState, type RefObject } from 'react';
import {
  Boxes, Copy, ExternalLink, Grid2X2, Heart, LayoutList, Loader2, MoreHorizontal,
  PanelRightOpen, RefreshCcw, Search, ThumbsDown, ThumbsUp, Trash2, UploadCloud,
} from 'lucide-react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { CardFace } from '@/domain/cards';
import { hasCardBacking, type DisplayCard } from '@/domain/rendering';
import type { TCGCardTemplate } from '@/domain/templates';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';
import { EnvironmentBoundaryNotice, type ActionDescriptor, type SelectionSession } from '@/features/app-shell/client/environment';

import type { useAccountLibraryProjection } from '../hooks/useAccountLibraryProjection';
import { ACCOUNT_LIBRARY_KINDS, getAccountLibrarySourceLabel, type AccountLibraryItem, type AccountLibrarySource } from '../model/accountLibrary';
import type { LibraryDensity, LibraryScope } from '../model/libraryScopes';
import { accountLibraryKindLabels } from './AccountLibraryItemRow';
import { LibraryVisual, getSharedLibraryActions, pipelineLineageFor, type LibraryViewItem } from './LibraryObjectPresentation';
import styles from './UnifiedAccountLibrary.module.css';

const CampaignLibraryWorkspace = dynamic(() => import(
  '@/features/marketing-content/client'
).then((module) => module.CampaignLibraryWorkspace));
const OwnerMarketingPanel = dynamic(() => import(
  '@/features/marketing/client'
).then((module) => module.OwnerMarketingPanel));

const LIBRARY_SOURCES: AccountLibrarySource[] = ['device', 'google-drive', 'local-folder', 'assistant-draft'];

export interface LibraryBoundaryFailure {
  id?: string;
  message: string;
  nextAction?: string | null;
  retryable: boolean;
  kind?: BoundaryFailureKind;
  code?: string;
  correlationId?: string | null;
}

export const describeLibraryBoundaryFailure = (failure: LibraryBoundaryFailure): string => (
  `${failure.message}${failure.nextAction ? ` ${failure.nextAction}` : ''}${failure.id === 'google-drive' ? ' Previously loaded Google Drive items remain visible.' : ' Other Library scopes remain unchanged.'}${failure.code ? ` Error code: ${failure.code}.` : ''}${failure.correlationId ? ` Reference: ${failure.correlationId}.` : ''}`
);

interface LibraryCollectionProps {
  activeFailure: LibraryBoundaryFailure | null;
  activeLoading: boolean;
  activeScope: LibraryScope;
  campaignTargetId: string | null;
  campaignNotice?: { kind: 'success' | 'error'; message: string };
  canReview: boolean;
  canSubmit: boolean;
  cardsFor: (item: LibraryViewItem) => DisplayCard[];
  density: LibraryDensity;
  heartMetrics: Record<string, { count: number; hearted: boolean }>;
  heartingId: string | null;
  isSignedIn: boolean;
  isOwner: boolean;
  onDensityChange: (density: LibraryDensity) => void;
  onOpenContribution: () => void;
  onOpenDetail: (item: LibraryViewItem) => void;
  onPersonalAction: (actionId: string, item: AccountLibraryItem) => void;
  onPublishedAction: (actionId: string, item: Extract<LibraryViewItem, { scope: 'published' }>) => void;
  onRefresh: () => void;
  onToggleHeart: (item: LibraryViewItem) => void;
  onVote: (submissionId: string, name: string, value: 'positive' | 'negative') => void;
  personalActions: (item: AccountLibraryItem) => ActionDescriptor[];
  projection: ReturnType<typeof useAccountLibraryProjection>;
  scopeDefinition: { label: string; description: string };
  searchRef: RefObject<HTMLInputElement>;
  selection: SelectionSession;
  sharedType: string;
  sharedTypes: string[];
  templateFor: (item: LibraryViewItem) => TCGCardTemplate | null;
  unfilteredScopeItemCount: number;
  viewItems: LibraryViewItem[];
  votingId: string | null;
  onSharedTypeChange: (type: string) => void;
}

export function LibraryCollection({
  activeFailure, activeLoading, activeScope, campaignNotice, campaignTargetId, canReview, canSubmit, cardsFor, density,
  heartMetrics, heartingId, isSignedIn, onDensityChange, onOpenContribution, onOpenDetail, onPersonalAction,
  onPublishedAction, onRefresh, onSharedTypeChange, onToggleHeart, onVote, personalActions, projection,
  scopeDefinition, searchRef, selection, sharedType, sharedTypes, templateFor, unfilteredScopeItemCount, viewItems, votingId, isOwner,
}: LibraryCollectionProps) {
  const [faces, setFaces] = useState<Record<string, CardFace>>({});
  return <section className={styles.collection} aria-labelledby="library-collection-heading">
    <div className={styles.collectionHeading}><div><h2 id="library-collection-heading">{scopeDefinition.label}</h2><p>{scopeDefinition.description}</p></div>{activeScope === 'campaigns' ? null : <span>{viewItems.length} shown</span>}</div>
    {activeScope === 'campaigns' ? isOwner
      ? <OwnerMarketingPanel initialNotice={campaignNotice} />
      : <CampaignLibraryWorkspace initialCampaignId={campaignTargetId} /> : <>
      <div className={styles.toolbar} aria-label="Library toolbar">
        <label className={styles.searchField}><span className="sr-only">Search Library</span><Search aria-hidden="true" /><Input ref={searchRef} id="library-search" value={projection.query} onChange={(event) => projection.setQuery(event.target.value)} placeholder={`Search ${activeScope}`} /></label>
        {activeScope === 'personal' ? <>
          <SelectionFilterMenu allLabel="All sources" ariaLabel="Filter by source" compactLabel="Source" className={styles.filterSelect} value={projection.source} onChange={projection.setSource} options={LIBRARY_SOURCES.map((source) => ({ value: source, label: `${getAccountLibrarySourceLabel(source)} · ${projection.sourceCounts.get(source) ?? 0}` }))} />
          <SelectionFilterMenu allLabel="All types" ariaLabel="Filter by type" compactLabel="Type" className={styles.filterSelect} value={projection.kind} onChange={projection.setKind} options={ACCOUNT_LIBRARY_KINDS.map((kind) => ({ value: kind, label: accountLibraryKindLabels[kind] }))} />
        </> : <SelectionFilterMenu allLabel={activeScope === 'pipeline' ? 'All work' : 'All types'} ariaLabel={activeScope === 'pipeline' ? 'Filter Pipeline' : 'Filter by type'} className={styles.filterSelect} value={sharedType} onChange={onSharedTypeChange} options={sharedTypes.map((value) => ({ value, label: value }))} />}
        <Select value={projection.sort} onValueChange={(value) => projection.setSort(value as 'recent' | 'name' | 'kind')}><SelectTrigger aria-label="Sort library" className={styles.sortSelect}><span>{projection.sort === 'name' ? 'Name' : projection.sort === 'kind' ? 'Type' : 'Recent'}</span></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="kind">Type</SelectItem></SelectContent></Select>
        <div className={styles.densityControls} aria-label="Collection view"><button type="button" aria-label="Gallery view" aria-pressed={density === 'gallery'} onClick={() => onDensityChange('gallery')}><Grid2X2 aria-hidden="true" /></button><button type="button" aria-label="Compact list view" aria-pressed={density === 'list'} onClick={() => onDensityChange('list')}><LayoutList aria-hidden="true" /></button><button type="button" aria-label="Expanded view" aria-pressed={density === 'expanded'} onClick={() => onDensityChange('expanded')}><PanelRightOpen aria-hidden="true" /></button></div>
        {canSubmit && activeScope === 'published' ? <button id="library-contribute-trigger" type="button" className={styles.contributeButton} onClick={onOpenContribution}><UploadCloud size={16} aria-hidden="true" />Submit new</button> : null}
      </div>
      {activeFailure ? <EnvironmentBoundaryNotice
        title={unfilteredScopeItemCount ? 'Some sources are unavailable' : `${scopeDefinition.label} is unavailable`}
        message={describeLibraryBoundaryFailure(activeFailure)}
        settingsHref={activeFailure.id === 'google-drive' || activeFailure.id === 'local-folder' ? '/account?section=library&tool=locations' : undefined}
        actionLabel={activeFailure.retryable ? 'Retry' : undefined}
        onAction={activeFailure.retryable ? onRefresh : undefined}
      /> : null}
      {activeFailure && !unfilteredScopeItemCount ? null : activeLoading && !unfilteredScopeItemCount ? <div className={styles.emptyState}><Loader2 className="animate-spin" aria-hidden="true" /><strong>Preparing {activeScope}</strong></div> : viewItems.length ? <div className={styles.objectGrid} aria-label={`${activeScope} Library objects`}>
        {viewItems.map((item) => {
          const pipelineItem = item.scope === 'pipeline' ? item : null;
          const lineageId = pipelineLineageFor(item);
          const heart = lineageId ? heartMetrics[lineageId] ?? { count: 0, hearted: false } : null;
          const cards = cardsFor(item);
          const face = faces[item.id] ?? 'front';
          const canFlip = cards.some(hasCardBacking);
          return <article key={item.id} className={styles.objectTile} data-selected={selection.objectId === item.id}>
            <button id={`library-object-${item.id}`} type="button" className={styles.objectButton} onClick={() => onOpenDetail(item)}><span className={styles.visualSlot} data-card-face={face}><LibraryVisual item={item} cards={cards} template={templateFor(item)} face={face} /></span><span className={styles.objectCopy}><span className={styles.objectTopline}><small>{item.kindLabel}</small><small>{item.statusLabel}</small></span><strong>{item.name}</strong><span>{item.sourceLabel}</span><p>{item.summary}</p></span></button>
            {canFlip ? <button type="button" className={styles.objectFlip} onClick={() => setFaces((current) => ({ ...current, [item.id]: face === 'front' ? 'back' : 'front' }))} aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${item.name}`} title={`Show ${face === 'front' ? 'back' : 'front'}`}><RefreshCcw aria-hidden="true" /></button> : null}
            {item.scope === 'personal' ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={styles.objectMenu} aria-label={`Actions for ${item.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent align="end">
              {personalActions(item.personal).map((action) => <Fragment key={action.id}>{action.commitment === 'destructive' ? <DropdownMenuSeparator /> : null}<DropdownMenuItem disabled={action.availability.kind === 'disabled'} title={action.availability.kind === 'disabled' ? action.availability.reason : undefined} className={action.commitment === 'destructive' ? 'text-destructive focus:text-destructive' : undefined} onSelect={() => onPersonalAction(action.id, item.personal)}>{action.id === 'library.send-pipeline' ? <UploadCloud aria-hidden="true" /> : action.id === 'library.duplicate' ? <Copy aria-hidden="true" /> : action.id === 'library.delete-copy' ? <Trash2 aria-hidden="true" /> : action.id === 'library.view-source' ? <ExternalLink aria-hidden="true" /> : null}{action.label}</DropdownMenuItem></Fragment>)}
            </DropdownMenuContent></DropdownMenu> : item.scope === 'published' ? <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={styles.objectMenu} aria-label={`Actions for ${item.name}`}><MoreHorizontal aria-hidden="true" /></button></DropdownMenuTrigger><DropdownMenuContent align="end">
              {getSharedLibraryActions(item).map((action) => <DropdownMenuItem key={action.id} disabled={action.availability.kind === 'disabled'} title={action.availability.kind === 'disabled' ? action.availability.reason : undefined} onSelect={() => onPublishedAction(action.id, item)}>{action.id === 'library.copy-published-template' ? <Copy aria-hidden="true" /> : null}{action.label}</DropdownMenuItem>)}
            </DropdownMenuContent></DropdownMenu> : null}
            {heart ? <div className={styles.reactionActions}><button type="button" disabled={heartingId === lineageId} data-active={heart.hearted} onClick={() => onToggleHeart(item)} aria-label={`${heart.hearted ? 'Remove heart from' : 'Heart'} ${item.name}`} title={isSignedIn ? 'Heart this Pipeline object' : 'Sign in to heart this Pipeline object'}><Heart aria-hidden="true" />{heart.count}</button>{pipelineItem && canReview ? <><button type="button" disabled={votingId === pipelineItem.pipeline.submission.id || pipelineItem.pipeline.reviewState === 'self'} data-active={pipelineItem.pipeline.submission.currentUserVote === 'positive'} onClick={() => onVote(pipelineItem.pipeline.submission.id, item.name, 'positive')} aria-label={`Vote up for ${item.name}`} title={pipelineItem.pipeline.reviewState === 'self' ? 'Contributor self-voting is disabled by the owner.' : 'Vote up on this exact revision'}><ThumbsUp aria-hidden="true" />{pipelineItem.pipeline.submission.positiveVotes}</button><button type="button" disabled={votingId === pipelineItem.pipeline.submission.id || pipelineItem.pipeline.reviewState === 'self'} data-active={pipelineItem.pipeline.submission.currentUserVote === 'negative'} onClick={() => onVote(pipelineItem.pipeline.submission.id, item.name, 'negative')} aria-label={`Vote down for ${item.name}`} title={pipelineItem.pipeline.reviewState === 'self' ? 'Contributor self-voting is disabled by the owner.' : 'Vote down on this exact revision'}><ThumbsDown aria-hidden="true" />{pipelineItem.pipeline.submission.negativeVotes}</button></> : null}</div> : null}
          </article>;
        })}
      </div> : <div className={styles.emptyState}><Boxes aria-hidden="true" /><strong>{unfilteredScopeItemCount ? 'No objects match this view' : `${scopeDefinition.label} is ready`}</strong><p>{unfilteredScopeItemCount ? 'Clear the search or change the filter.' : activeScope === 'personal' ? 'Create a Set or connect a location to begin.' : activeScope === 'published' ? 'Your published Pipeline work will appear here.' : 'Shared work available to your account will appear here.'}</p></div>}
    </>}
  </section>;
}
