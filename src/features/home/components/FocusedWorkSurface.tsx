"use client";

import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Boxes, Copy, Info, Layers3, LayoutGrid, MoreHorizontal, Pencil, Pin, Printer, Save, Search, Sparkles, Tag, Trash2, WandSparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SelectionFilterMenu } from '@/components/ui/selection-filter-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { CardSet, CardSetOrganization } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import type { CreatorInteractionSession } from '@/features/app-shell/client/environment';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import type { ArtifactSelectionScope } from '../model/focusedArtifactLayout';
import { getCardTitle, workSourceLabel } from '../model/homeDesk';
import { FocusedSetArtifactSurface } from './FocusedSetArtifactSurface';
import styles from './HomeDesk.module.css';

export interface FocusedWorkSurfaceProps {
  item: AccountLibraryItem;
  localSetId: string | null;
  preview: ReactNode;
  remoteIcon: ReactNode;
  contentsLabel: string;
  renaming: boolean;
  renameDraft: string;
  pinned: boolean;
  focusedCards: DisplayCard[];
  visibleCards: DisplayCard[];
  sortedCards: DisplayCard[];
  groups: Array<[string, DisplayCard[]]>;
  organization: CardSetOrganization;
  availableFields: string[];
  selectedCards: DisplayCard[];
  selectedCard: DisplayCard | null;
  selectedCardIndex: number;
  allVisibleSelected: boolean;
  allArtifactsSelected: boolean;
  selectionScope: ArtifactSelectionScope;
  otherSets: CardSet[];
  moveTargetId: string;
  cardQuery: string;
  tagFilter: string;
  tagDraft: string;
  latestGeneratedIds: string[];
  showGrid: boolean;
  snapToGrid: boolean;
  session: CreatorInteractionSession;
  setSession: Dispatch<SetStateAction<CreatorInteractionSession>>;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  onBack: () => void;
  onRenameDraftChange: (value: string) => void;
  onCommitRename: () => void;
  onToggleRenaming: () => void;
  onOpenWork: () => void;
  onOpenDesign: () => void;
  onOpenGenerate: () => void;
  onOpenLocation: () => void;
  onDuplicateWork: () => void;
  onOpenOutput: () => void;
  onTogglePin: () => void;
  onInspect: () => void;
  onDeleteWork: () => void;
  onCardQueryChange: (value: string) => void;
  onOrganizationChange: (patch: Partial<Omit<CardSetOrganization, 'tags' | 'positions'>>) => void;
  onTagFilterChange: (value: string) => void;
  onShowGridChange: () => void;
  onSnapToGridChange: () => void;
  onSelectionChange: (next: SetStateAction<string[]>) => void;
  onReorderSelected: (direction: 'earlier' | 'later') => void;
  onMoveTargetChange: (setId: string) => void;
  onMoveSelected: () => void;
  onEditSelected: (artifactId?: string) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onSetCardsTag: (cardIds: string[], tagId: string, applied: boolean) => void;
  onTagDraftChange: (value: string) => void;
  onApplyNewTag: () => void;
  onClearGenerated: () => void;
  onMoveArtifacts: (positions: Record<string, { x: number; y: number }>) => void;
}

export function FocusedWorkSurface(props: FocusedWorkSurfaceProps) {
  return <div className={styles.focusSurface} data-home-desk="focused" data-focus-transition="set-to-artifacts">
    <button type="button" className={styles.backButton} onClick={props.onBack}><ArrowLeft size={16} aria-hidden="true" /> Back to Desk</button>
    <section className={styles.focusWorkspace} data-home-set-board aria-label={props.item.name}>
      <header className={styles.focusHeader}>
        {props.preview}
        <div className={styles.focusIdentity}>
          {props.renaming && props.localSetId ? <form className={styles.renameRow} onSubmit={(event) => { event.preventDefault(); props.onCommitRename(); }}><Input id="home-work-name" value={props.renameDraft} onChange={(event) => props.onRenameDraftChange(event.target.value)} aria-label="Work name" /><Button type="submit" size="sm">Save</Button></form> : <h1>{props.item.name}</h1>}
          <p>{props.contentsLabel} · {workSourceLabel(props.item)}</p>
        </div>
        <div className={styles.focusActions}>
          {!props.localSetId ? <button type="button" className={styles.quietAction} onClick={props.onOpenWork}><Pencil size={15} aria-hidden="true" />Open work</button> : null}
          {props.localSetId ? <button type="button" className={styles.quietAction} onClick={props.onOpenDesign}><Pencil size={15} aria-hidden="true" />Design</button> : null}
          {props.localSetId ? <button type="button" className={styles.quietAction} onClick={props.onOpenGenerate}><WandSparkles size={15} aria-hidden="true" />Generate</button> : null}
          <button type="button" className={styles.quietAction} onClick={props.onOpenLocation}><Save size={15} aria-hidden="true" />Save &amp; move</button>
          <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className={styles.quietAction} aria-label={`More actions for ${props.item.name}`}><MoreHorizontal size={15} aria-hidden="true" />More</button></DropdownMenuTrigger><DropdownMenuContent align="end">
            {props.localSetId ? <DropdownMenuItem onSelect={props.onToggleRenaming}><Pencil aria-hidden="true" />Rename</DropdownMenuItem> : null}
            {props.localSetId ? <DropdownMenuItem onSelect={props.onDuplicateWork}><Copy aria-hidden="true" />Duplicate</DropdownMenuItem> : null}
            {props.localSetId ? <DropdownMenuItem onSelect={props.onOpenOutput}><Printer aria-hidden="true" />Export / print</DropdownMenuItem> : null}
            <DropdownMenuItem onSelect={props.onTogglePin}><Pin aria-hidden="true" />{props.pinned ? 'Unpin from desk' : 'Pin to desk'}</DropdownMenuItem>
            <DropdownMenuItem id={`home-work-info-${props.item.id}`} onSelect={props.onInspect}><Info aria-hidden="true" />Details</DropdownMenuItem>
            {props.localSetId ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={props.onDeleteWork}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem></> : null}
          </DropdownMenuContent></DropdownMenu>
        </div>
      </header>
      {props.localSetId ? <>
        <div className={styles.contentHeading}><div><h2>Inside this Set</h2><p>Select one or more cards to arrange, move, duplicate, or remove them.</p></div><span className="text-xs text-[var(--cf-text-subtle)]">{props.visibleCards.length} shown</span></div>
        <div className={styles.contentToolbar}>
          <label className={styles.searchField}><span className="sr-only">Search cards in this work</span><Search aria-hidden="true" /><Input value={props.cardQuery} onChange={(event) => props.onCardQueryChange(event.target.value)} placeholder="Search cards" /></label>
          <div className={styles.organizationToolbar} aria-label="Set organization">
            <Select value={props.organization.arrangement} onValueChange={(value) => props.onOrganizationChange({ arrangement: value as CardSetOrganization['arrangement'] })}><SelectTrigger aria-label="Arrange cards" className={styles.compactSelect}><LayoutGrid aria-hidden="true" /><span>{props.organization.arrangement === 'manual' ? 'Freeform' : props.organization.arrangement === 'stack' ? 'Stacks' : 'Grid'}</span></SelectTrigger><SelectContent><SelectItem value="manual">Freeform</SelectItem><SelectItem value="grid">Grid</SelectItem><SelectItem value="stack">Stacks</SelectItem></SelectContent></Select>
            <Select value={props.organization.groupBy} onValueChange={(value) => props.onOrganizationChange({ groupBy: value as CardSetOrganization['groupBy'], groupField: value === 'field' ? props.organization.groupField ?? props.availableFields[0] : undefined })}><SelectTrigger aria-label="Group cards" className={styles.compactSelect}><Layers3 aria-hidden="true" /><span>{props.organization.groupBy === 'none' ? 'No groups' : `By ${props.organization.groupBy}`}</span></SelectTrigger><SelectContent><SelectItem value="none">No groups</SelectItem><SelectItem value="tag">By tag</SelectItem>{props.availableFields.length ? <SelectItem value="field">By field</SelectItem> : null}<SelectItem value="template">By Template</SelectItem><SelectItem value="content-type">By content type</SelectItem><SelectItem value="batch">By batch</SelectItem></SelectContent></Select>
            {props.organization.groupBy === 'field' && props.availableFields.length ? <Select value={props.organization.groupField ?? props.availableFields[0]} onValueChange={(groupField) => props.onOrganizationChange({ groupField })}><SelectTrigger aria-label="Field used for groups" className={styles.compactSelect}><span>{props.organization.groupField ?? props.availableFields[0]}</span></SelectTrigger><SelectContent>{props.availableFields.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select> : null}
            <Select value={props.organization.sort} onValueChange={(value) => props.onOrganizationChange({ sort: value as CardSetOrganization['sort'], sortField: value === 'field-value' ? props.organization.sortField ?? props.availableFields[0] : undefined })}><SelectTrigger aria-label="Sort cards" className={styles.compactSelect}><span>{props.organization.sort === 'manual' ? 'Manual order' : props.organization.sort === 'field-value' ? 'Field value' : props.organization.sort === 'recently-changed' ? 'Recent' : 'Name'}</span></SelectTrigger><SelectContent><SelectItem value="manual">Manual order</SelectItem><SelectItem value="name">Name</SelectItem>{props.availableFields.length ? <SelectItem value="field-value">Field value</SelectItem> : null}<SelectItem value="recently-changed">Recent</SelectItem></SelectContent></Select>
            {props.organization.sort === 'field-value' && props.availableFields.length ? <Select value={props.organization.sortField ?? props.availableFields[0]} onValueChange={(sortField) => props.onOrganizationChange({ sortField })}><SelectTrigger aria-label="Field used for sorting" className={styles.compactSelect}><span>{props.organization.sortField ?? props.availableFields[0]}</span></SelectTrigger><SelectContent>{props.availableFields.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select> : null}
            {props.organization.tags.length ? <SelectionFilterMenu allLabel="All tags" ariaLabel="Filter cards by tag" value={props.tagFilter} onChange={props.onTagFilterChange} options={props.organization.tags.map((tag) => ({ value: tag.id, label: tag.label }))} /> : null}
            <Button type="button" size="sm" variant="ghost" aria-pressed={props.showGrid} onClick={props.onShowGridChange}><LayoutGrid className="mr-1.5 h-4 w-4" />Grid</Button><Button type="button" size="sm" variant="ghost" aria-pressed={props.snapToGrid} onClick={props.onSnapToGridChange}>Snap</Button>
          </div>
          {props.visibleCards.length ? <Button type="button" size="sm" variant="ghost" onClick={() => props.onSelectionChange((current) => props.allVisibleSelected ? current.filter((id) => !props.visibleCards.some((card) => card.uniqueId === id)) : [...new Set([...current, ...props.visibleCards.map((card) => card.uniqueId)])])}>{props.allVisibleSelected ? 'Clear shown' : 'Select shown'}</Button> : null}
          {props.focusedCards.length ? <Button type="button" size="sm" variant="ghost" onClick={() => props.onSelectionChange(props.allArtifactsSelected ? [] : props.focusedCards.map((card) => card.uniqueId))}>{props.allArtifactsSelected ? 'Clear all Artifacts' : `Select all ${props.focusedCards.length} Artifacts`}</Button> : null}
          {props.selectedCards.length ? <div className={styles.selectionBar}>
            <span role="status">{props.selectedCards.length === 1 ? `${getCardTitle(props.selectedCards[0]!, 0)} selected` : `${props.selectedCards.length} Artifacts selected`}{props.selectionScope.hidden ? ` · ${props.selectionScope.hidden} hidden by the current filters; actions apply to the full selection` : ''}</span>
            {props.selectionScope.hidden ? <Button type="button" size="sm" variant="ghost" onClick={() => props.onSelectionChange((current) => current.filter((id) => props.visibleCards.some((card) => card.uniqueId === id)))}>Clear hidden selection</Button> : null}
            {props.selectedCard ? <><Button type="button" size="icon" variant="outline" disabled={props.selectedCardIndex <= 0} onClick={() => props.onReorderSelected('earlier')} aria-label="Move selected card earlier"><ArrowUp className="h-4 w-4" /></Button><Button type="button" size="icon" variant="outline" disabled={props.selectedCardIndex < 0 || props.selectedCardIndex >= props.focusedCards.length - 1} onClick={() => props.onReorderSelected('later')} aria-label="Move selected card later"><ArrowDown className="h-4 w-4" /></Button></> : null}
            {props.otherSets.length ? <Select value={props.moveTargetId} onValueChange={props.onMoveTargetChange}><SelectTrigger className={styles.moveSelect} aria-label="Move selected card to Set"><span className="truncate">Move to {props.otherSets.find((set) => set.id === props.moveTargetId)?.name ?? 'Set'}</span></SelectTrigger><SelectContent>{props.otherSets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>)}</SelectContent></Select> : null}
            {props.otherSets.length ? <Button type="button" size="sm" variant="outline" onClick={props.onMoveSelected}>Move</Button> : null}
            {props.selectedCard ? <Button type="button" size="sm" variant="outline" onClick={() => props.onEditSelected()}>Edit in Studio</Button> : null}
            <Button type="button" size="sm" variant="outline" onClick={props.onDuplicateSelected}><Copy className="mr-1.5 h-4 w-4" />Duplicate</Button><Button type="button" size="sm" variant="ghost" onClick={props.onDeleteSelected}><Trash2 className="mr-1.5 h-4 w-4" />Remove</Button>
            <div className={styles.tagTools}>{props.organization.tags.length ? <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline"><Tag className="mr-1.5 h-4 w-4" />Tags</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{props.organization.tags.map((tag) => { const applied = props.selectedCards.every((card) => card.tagIds?.includes(tag.id)); return <DropdownMenuItem key={tag.id} onSelect={() => props.onSetCardsTag(props.selectedCards.map((card) => card.uniqueId), tag.id, !applied)}>{applied ? 'Remove' : 'Add'} {tag.label}</DropdownMenuItem>; })}</DropdownMenuContent></DropdownMenu> : null}<Input value={props.tagDraft} onChange={(event) => props.onTagDraftChange(event.target.value)} placeholder="New tag" aria-label="New tag name" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); props.onApplyNewTag(); } }} /><Button type="button" size="sm" variant="outline" disabled={!props.tagDraft.trim()} onClick={props.onApplyNewTag}>Add tag</Button></div>
          </div> : null}
        </div>
        {props.latestGeneratedIds.length ? <div className={styles.resultFilter} role="status"><Sparkles size={15} aria-hidden="true" /><span>Showing {props.visibleCards.length} newly generated card{props.visibleCards.length === 1 ? '' : 's'}</span><Button type="button" size="sm" variant="ghost" onClick={props.onClearGenerated}>Clear all</Button></div> : null}
        {props.sortedCards.length ? <FocusedSetArtifactSurface setId={props.localSetId} setName={props.item.name} allCards={props.focusedCards} groups={props.groups} organization={props.organization} session={props.session} setSession={props.setSession} snapToGrid={props.snapToGrid} showGrid={props.showGrid} stageRef={props.stageRef} onEditArtifact={props.onEditSelected} onMoveArtifacts={props.onMoveArtifacts} /> : <div className={styles.emptyDesk}><div className={styles.emptyDeskInner}><Boxes aria-hidden="true" /><strong>{props.focusedCards.length ? 'No cards match this view' : 'This Set is ready for its first Artifact'}</strong><p className={styles.emptyCopy}>{props.focusedCards.length ? 'Clear the active filters to bring the Artifacts back.' : 'Create a design from scratch or generate cards into this Set.'}</p>{!props.focusedCards.length ? <div className="flex flex-wrap justify-center gap-2"><Button type="button" onClick={props.onOpenDesign}>Create design</Button><Button type="button" variant="outline" onClick={props.onOpenGenerate}>Generate cards</Button></div> : null}</div></div>}
      </> : <div className={styles.remoteFocus}><div className={styles.remoteFocusInner}>{props.remoteIcon}<h2 className="font-serif text-xl text-[var(--cf-text-strong)]">{props.item.name}</h2><p className={styles.emptyCopy}>This work stays owned by {workSourceLabel(props.item)}. Open it to load its exact contents into the CardForge workbench.</p><Button type="button" onClick={props.onOpenWork}>Open work</Button></div></div>}
    </section>
  </div>;
}
