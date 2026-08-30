"use client";

import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  Copy,
  FileJson2,
  FolderPlus,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Search,
  Tag,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import type { CardSetOrganization } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  AuthoredObjectPreview,
  CardPreview,
  CardWatermarkOverlay,
} from '@/features/card-rendering/client';
import {
  selectAllGeneratedDisplayCards,
  selectAllTemplates,
  useCardTransferActions,
  useProjectStore,
  type ProjectState,
} from '@/features/project/client';

import styles from './StudioSetDesk.module.css';

interface StudioSetDeskProps {
  onEditCardRequest: (card: DisplayCard) => void;
  onEditTemplate: () => void;
  onGenerate: () => void;
  onOpenOutput: () => void;
  onOpenSave: () => void;
  onOpenPipeline?: () => void;
  showCardWatermark: boolean;
}

const DEFAULT_ORGANIZATION: CardSetOrganization = {
  arrangement: 'grid',
  groupBy: 'none',
  sort: 'manual',
  tags: [],
  positions: {},
};

const getCardTitle = (card: DisplayCard, index: number) => String(
  card.data.cardName ?? card.data.name ?? card.data.title ?? `Card ${index + 1}`,
);

export function StudioSetDesk({
  onEditCardRequest,
  onEditTemplate,
  onGenerate,
  onOpenOutput,
  onOpenSave,
  onOpenPipeline,
  showCardWatermark,
}: StudioSetDeskProps) {
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [setQuery, setSetQuery] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [moveTargetId, setMoveTargetId] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [pendingRemove, setPendingRemove] = useState<DisplayCard[]>([]);
  const [pendingDeleteSetId, setPendingDeleteSetId] = useState<string | null>(null);

  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const storedCards = useProjectStore((state) => state.storedCards);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const setActiveCardSetName = useProjectStore((state) => state.setActiveCardSetName);
  const duplicateCardSet = useProjectStore((state) => state.duplicateCardSet);
  const deleteCardSet = useProjectStore((state) => state.deleteCardSet);
  const updateCardSetOrganization = useProjectStore((state) => state.updateCardSetOrganization);
  const addCardSetTag = useProjectStore((state) => state.addCardSetTag);
  const setCardsTag = useProjectStore((state) => state.setCardsTag);
  const setCardPositions = useProjectStore((state) => state.setCardPositions);
  const addGeneratedCards = useProjectStore((state) => state.addGeneratedCards);
  const removeGeneratedCards = useProjectStore((state) => state.removeGeneratedCards);
  const moveGeneratedCardsToSet = useProjectStore((state) => state.moveGeneratedCardsToSet);
  const reorderGeneratedCard = useProjectStore((state) => state.reorderGeneratedCard);
  const { exportSet, handleImportTransfer } = useCardTransferActions({ toast });

  const templates = useMemo(
    () => selectAllTemplates({ defaultTemplates, userTemplates } as ProjectState),
    [defaultTemplates, userTemplates],
  );
  const templateById = useMemo(
    () => new Map(templates.flatMap((template) => template.id ? [[template.id, template] as const] : [])),
    [templates],
  );
  const displayCards = useMemo(() => selectAllGeneratedDisplayCards({
    defaultTemplates,
    userTemplates,
    storedCards,
  } as ProjectState), [defaultTemplates, storedCards, userTemplates]);
  const cardsBySetId = useMemo(() => {
    const result = new Map<string, DisplayCard[]>();
    cardSets.forEach((set) => result.set(set.id, []));
    displayCards.forEach((card) => {
      const setId = card.setId ?? cardSets[0]?.id;
      if (!setId) return;
      result.set(setId, [...(result.get(setId) ?? []), card]);
    });
    return result;
  }, [cardSets, displayCards]);

  const filteredSets = cardSets.filter((set) => set.name.toLocaleLowerCase().includes(setQuery.trim().toLocaleLowerCase()));
  const activeCards = cardsBySetId.get(activeCardSet.id) ?? [];
  const organization = activeCardSet.organization ?? DEFAULT_ORGANIZATION;
  const availableFields = [...new Set(activeCards.flatMap((card) => Object.keys(card.data)
    .filter((key) => card.data[key] !== undefined && String(card.data[key]).trim())))].toSorted();
  const normalizedCardQuery = cardQuery.trim().toLocaleLowerCase();
  const visibleCards = activeCards.filter((card, index) => (
    (!normalizedCardQuery || [
      getCardTitle(card, index),
      card.template.name,
      ...Object.values(card.data),
      ...organization.tags.filter((tag) => card.tagIds?.includes(tag.id)).map((tag) => tag.label),
    ].join(' ').toLocaleLowerCase().includes(normalizedCardQuery))
    && (tagFilter === 'all' || card.tagIds?.includes(tagFilter))
  ));
  const sortedCards = [...visibleCards].sort((left, right) => {
    if (organization.sort === 'name') return getCardTitle(left, activeCards.indexOf(left)).localeCompare(getCardTitle(right, activeCards.indexOf(right)));
    if (organization.sort === 'field-value' && organization.sortField) {
      return String(left.data[organization.sortField] ?? '').localeCompare(String(right.data[organization.sortField] ?? ''), undefined, { numeric: true });
    }
    if (organization.sort === 'recently-changed') return (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0);
    return activeCards.indexOf(left) - activeCards.indexOf(right);
  });
  const organizedGroups = (() => {
    const groups = new Map<string, DisplayCard[]>();
    const labelFor = (card: DisplayCard) => {
      if (organization.groupBy === 'tag') return organization.tags.find((tag) => card.tagIds?.includes(tag.id))?.label ?? 'Untagged';
      if (organization.groupBy === 'field' && organization.groupField) return String(card.data[organization.groupField] ?? 'No value');
      if (organization.groupBy === 'template') return card.template.name;
      if (organization.groupBy === 'content-type') return String(card.data.contentType ?? card.data.type ?? card.data.kind ?? card.template.name);
      if (organization.groupBy === 'batch') return String(card.data.batch ?? card.data.batchName ?? 'No batch');
      return 'All cards';
    };
    sortedCards.forEach((card) => {
      const label = labelFor(card);
      groups.set(label, [...(groups.get(label) ?? []), card]);
    });
    return [...groups.entries()];
  })();
  const selectedCards = activeCards.filter((card) => selectedCardIds.includes(card.uniqueId));
  const selectedCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const selectedCardIndex = selectedCard ? activeCards.findIndex((card) => card.uniqueId === selectedCard.uniqueId) : -1;
  const otherSets = cardSets.filter((set) => set.id !== activeCardSet.id);
  const effectiveMoveTargetId = otherSets.some((set) => set.id === moveTargetId) ? moveTargetId : otherSets[0]?.id ?? '';
  const allVisibleSelected = visibleCards.length > 0 && visibleCards.every((card) => selectedCardIds.includes(card.uniqueId));
  const activeTemplate = activeCardSet.frontTemplateId ? templateById.get(activeCardSet.frontTemplateId) ?? null : null;
  const activeBack = activeCardSet.backingTemplateId ? templateById.get(activeCardSet.backingTemplateId) ?? null : null;

  const chooseSet = (setId: string) => {
    setActiveCardSetId(setId);
    setSelectedCardIds([]);
    setCardQuery('');
    setTagFilter('all');
  };
  const updateOrganization = (patch: Partial<Omit<CardSetOrganization, 'tags' | 'positions'>>) => {
    updateCardSetOrganization(activeCardSet.id, patch);
  };
  const moveSelectedCards = () => {
    if (!selectedCards.length || !effectiveMoveTargetId) return;
    const moved = moveGeneratedCardsToSet(selectedCards.map((card) => card.uniqueId), effectiveMoveTargetId);
    if (!moved) return;
    toast({ title: `${moved} card${moved === 1 ? '' : 's'} moved`, description: `The selection now belongs to ${otherSets.find((set) => set.id === effectiveMoveTargetId)?.name ?? 'the selected Set'}.` });
    setSelectedCardIds([]);
  };
  const duplicateSelectedCards = () => {
    if (!selectedCards.length) return;
    addGeneratedCards(selectedCards.map((card) => ({
      ...card,
      uniqueId: `card-${globalThis.crypto.randomUUID()}`,
      setId: activeCardSet.id,
      setName: activeCardSet.name,
    })));
    toast({ title: `${selectedCards.length} card${selectedCards.length === 1 ? '' : 's'} duplicated`, description: 'Each copy is independently editable.' });
  };
  const applyNewTag = () => {
    if (!selectedCards.length) return;
    const tagId = addCardSetTag(activeCardSet.id, tagDraft);
    if (!tagId) return;
    setCardsTag(selectedCards.map((card) => card.uniqueId), tagId, true);
    setTagDraft('');
  };
  const placeCard = (card: DisplayCard, clientX: number, clientY: number) => {
    if (organization.arrangement !== 'manual' || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    setCardPositions(activeCardSet.id, {
      [card.uniqueId]: {
        x: Math.max(0, Math.min(bounds.width - 150, clientX - bounds.left - 66)),
        y: Math.max(0, Math.min(Math.max(bounds.height, 480) - 210, clientY - bounds.top - 90)),
      },
    });
  };

  return (
    <section className={styles.desk} data-studio-set-desk aria-labelledby="studio-set-desk-title">
      <aside className={styles.shelf} aria-label="Sets on this device">
        <div className={styles.shelfHeader}>
          <div><span>Set Desk</span><strong>{cardSets.length} open</strong></div>
          <div className={styles.shelfActions}>
            <Button type="button" size="icon" variant="ghost" onClick={() => importInputRef.current?.click()} aria-label="Import editable Set"><Upload aria-hidden="true" /></Button>
            <Button type="button" size="icon" onClick={() => createCardSet()} aria-label="Create Set"><FolderPlus aria-hidden="true" /></Button>
          </div>
          <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import CardForge editable Set" onChange={handleImportTransfer} />
        </div>
        <label className={styles.search}><Search aria-hidden="true" /><Input value={setQuery} onChange={(event) => setSetQuery(event.target.value)} placeholder="Find a Set" aria-label="Search Sets" /></label>
        <div className={styles.setList}>
          {filteredSets.map((set) => {
            const cards = cardsBySetId.get(set.id) ?? [];
            const template = set.frontTemplateId ? templateById.get(set.frontTemplateId) ?? null : null;
            const active = set.id === activeCardSet.id;
            return <article key={set.id} className={styles.setObject} data-active={active}>
              <button type="button" className={styles.setObjectMain} onClick={() => chooseSet(set.id)} aria-pressed={active}>
                <AuthoredObjectPreview cards={cards} template={template} label={set.name} size="compact" emptyLabel={cards.length ? undefined : 'Empty'} />
                <span><strong>{set.name}</strong><small>{cards.length} card{cards.length === 1 ? '' : 's'}</small></span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button type="button" size="icon" variant="ghost" aria-label={`Actions for ${set.name}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { chooseSet(set.id); onGenerate(); }}><WandSparkles aria-hidden="true" />Generate cards</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void exportSet(set.id)}><FileJson2 aria-hidden="true" />Download editable Set</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { const copyId = duplicateCardSet(set.id); if (copyId) chooseSet(copyId); }}><Copy aria-hidden="true" />Duplicate Set</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={cardSets.length <= 1} onSelect={() => setPendingDeleteSetId(set.id)}><Trash2 aria-hidden="true" />Delete device copy</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </article>;
          })}
          {!filteredSets.length ? <p className={styles.emptyShelf}>No Sets match that search.</p> : null}
        </div>
      </aside>

      <div className={styles.workbench}>
        <header className={styles.workbenchHeader}>
          <div className={styles.activeIdentity}>
            <AuthoredObjectPreview cards={activeCards} template={activeTemplate} label={activeCardSet.name} size="standard" emptyLabel={activeCards.length ? undefined : 'Empty Set'} />
            <div>
              <span id="studio-set-desk-title">Active Set</span>
              <Input value={activeCardSet.name} onChange={(event) => setActiveCardSetName(event.target.value)} aria-label="Active Set name" />
              <small>{activeCards.length} card{activeCards.length === 1 ? '' : 's'} · {activeTemplate?.name ?? 'Choose a Template'}{activeBack ? ` · ${activeBack.name} back` : ''}</small>
            </div>
          </div>
          <div className={styles.primaryActions}>
            <Button type="button" variant="outline" onClick={onEditTemplate}><Pencil aria-hidden="true" />Template</Button>
            <Button type="button" onClick={onGenerate}><WandSparkles aria-hidden="true" />Generate</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button type="button" variant="outline"><MoreHorizontal aria-hidden="true" />Set actions</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onOpenSave}>Save / move</DropdownMenuItem>
                <DropdownMenuItem onSelect={onOpenOutput}>Export / print</DropdownMenuItem>
                {onOpenPipeline ? <DropdownMenuItem onSelect={onOpenPipeline}>Send to Pipeline</DropdownMenuItem> : null}
                <DropdownMenuItem onSelect={() => void exportSet(activeCardSet.id)}>Download editable Set</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className={styles.objectBar}>
          <label className={styles.search}><Search aria-hidden="true" /><Input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Find cards, tags, or field values" aria-label="Search active Set" /></label>
          <Select value={organization.arrangement} onValueChange={(value) => updateOrganization({ arrangement: value as CardSetOrganization['arrangement'] })}>
            <SelectTrigger aria-label="Arrange cards" className={styles.compactSelect}><LayoutGrid aria-hidden="true" /><span>{organization.arrangement === 'manual' ? 'Freeform' : organization.arrangement === 'stack' ? 'Stacks' : 'Grid'}</span></SelectTrigger>
            <SelectContent><SelectItem value="manual">Freeform</SelectItem><SelectItem value="grid">Grid</SelectItem><SelectItem value="stack">Stacks</SelectItem></SelectContent>
          </Select>
          <Select value={organization.groupBy} onValueChange={(value) => updateOrganization({ groupBy: value as CardSetOrganization['groupBy'], groupField: value === 'field' ? organization.groupField ?? availableFields[0] : undefined })}>
            <SelectTrigger aria-label="Group cards" className={styles.compactSelect}><span>{organization.groupBy === 'none' ? 'No groups' : `By ${organization.groupBy}`}</span></SelectTrigger>
            <SelectContent><SelectItem value="none">No groups</SelectItem><SelectItem value="tag">By tag</SelectItem>{availableFields.length ? <SelectItem value="field">By field</SelectItem> : null}<SelectItem value="template">By Template</SelectItem><SelectItem value="content-type">By content type</SelectItem><SelectItem value="batch">By batch</SelectItem></SelectContent>
          </Select>
          {organization.groupBy === 'field' && availableFields.length ? <Select value={organization.groupField ?? availableFields[0]} onValueChange={(groupField) => updateOrganization({ groupField })}><SelectTrigger aria-label="Field used for groups" className={styles.compactSelect}><span>{organization.groupField ?? availableFields[0]}</span></SelectTrigger><SelectContent>{availableFields.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select> : null}
          <Select value={organization.sort} onValueChange={(value) => updateOrganization({ sort: value as CardSetOrganization['sort'], sortField: value === 'field-value' ? organization.sortField ?? availableFields[0] : undefined })}>
            <SelectTrigger aria-label="Sort cards" className={styles.compactSelect}><span>{organization.sort === 'manual' ? 'Manual order' : organization.sort === 'field-value' ? 'Field value' : organization.sort === 'recently-changed' ? 'Recent' : 'Name'}</span></SelectTrigger>
            <SelectContent><SelectItem value="manual">Manual order</SelectItem><SelectItem value="name">Name</SelectItem>{availableFields.length ? <SelectItem value="field-value">Field value</SelectItem> : null}<SelectItem value="recently-changed">Recently changed</SelectItem></SelectContent>
          </Select>
          {organization.sort === 'field-value' && availableFields.length ? <Select value={organization.sortField ?? availableFields[0]} onValueChange={(sortField) => updateOrganization({ sortField })}><SelectTrigger aria-label="Field used for sorting" className={styles.compactSelect}><span>{organization.sortField ?? availableFields[0]}</span></SelectTrigger><SelectContent>{availableFields.map((field) => <SelectItem key={field} value={field}>{field}</SelectItem>)}</SelectContent></Select> : null}
          {organization.tags.length ? <Select value={tagFilter} onValueChange={setTagFilter}><SelectTrigger aria-label="Filter cards by tag" className={styles.compactSelect}><Tag aria-hidden="true" /><span>{tagFilter === 'all' ? 'All tags' : organization.tags.find((tag) => tag.id === tagFilter)?.label}</span></SelectTrigger><SelectContent><SelectItem value="all">All tags</SelectItem>{organization.tags.map((tag) => <SelectItem key={tag.id} value={tag.id}>{tag.label}</SelectItem>)}</SelectContent></Select> : null}
          {visibleCards.length ? <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedCardIds((current) => allVisibleSelected ? current.filter((id) => !visibleCards.some((card) => card.uniqueId === id)) : [...new Set([...current, ...visibleCards.map((card) => card.uniqueId)])])}>{allVisibleSelected ? 'Clear shown' : 'Select shown'}</Button> : null}
        </div>

        {selectedCards.length ? <div className={styles.selectionBar} role="region" aria-label="Selected card actions">
          <strong>{selectedCards.length === 1 ? `${getCardTitle(selectedCards[0]!, 0)} selected` : `${selectedCards.length} cards selected`}</strong>
          {selectedCard ? <><Button type="button" size="icon" variant="outline" disabled={selectedCardIndex <= 0} onClick={() => reorderGeneratedCard(selectedCard.uniqueId, 'earlier')} aria-label="Move selected card earlier"><ArrowUp aria-hidden="true" /></Button><Button type="button" size="icon" variant="outline" disabled={selectedCardIndex >= activeCards.length - 1} onClick={() => reorderGeneratedCard(selectedCard.uniqueId, 'later')} aria-label="Move selected card later"><ArrowDown aria-hidden="true" /></Button><Button type="button" size="sm" variant="outline" onClick={() => onEditCardRequest(selectedCard)}>Edit</Button></> : null}
          {otherSets.length ? <><Select value={effectiveMoveTargetId} onValueChange={setMoveTargetId}><SelectTrigger aria-label="Move selected cards to Set" className={styles.moveSelect}><span>Move to {otherSets.find((set) => set.id === effectiveMoveTargetId)?.name}</span></SelectTrigger><SelectContent>{otherSets.map((set) => <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>)}</SelectContent></Select><Button type="button" size="sm" variant="outline" onClick={moveSelectedCards}>Move</Button></> : null}
          <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline"><Tag aria-hidden="true" />Tags</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{organization.tags.map((tag) => { const applied = selectedCards.every((card) => card.tagIds?.includes(tag.id)); return <DropdownMenuItem key={tag.id} onSelect={() => setCardsTag(selectedCards.map((card) => card.uniqueId), tag.id, !applied)}>{applied ? 'Remove' : 'Add'} {tag.label}</DropdownMenuItem>; })}<DropdownMenuSeparator /><div className={styles.tagCreator}><Input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="New tag" aria-label="New tag name" /><Button type="button" size="sm" disabled={!tagDraft.trim()} onClick={applyNewTag}>Add</Button></div></DropdownMenuContent></DropdownMenu>
          <Button type="button" size="sm" variant="outline" onClick={duplicateSelectedCards}><Copy aria-hidden="true" />Duplicate</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPendingRemove(selectedCards)}><Trash2 aria-hidden="true" />Remove</Button>
        </div> : null}

        <div ref={stageRef} className={styles.stage} data-arrangement={organization.arrangement} aria-label={`${activeCardSet.name} contents`}>
          {sortedCards.length ? <div className={styles.groupPlane} data-arrangement={organization.arrangement}>{organizedGroups.map(([groupLabel, cards]) => <section key={groupLabel} className={styles.cardGroup}>
            {organization.groupBy !== 'none' ? <header><strong>{groupLabel}</strong><span>{cards.length}</span></header> : null}
            <div className={styles.cardGrid} data-arrangement={organization.arrangement}>{cards.map((card) => {
              const index = activeCards.indexOf(card);
              const position = organization.positions[card.uniqueId] ?? { x: (index % 5) * 148, y: Math.floor(index / 5) * 205 };
              return <button key={card.uniqueId} type="button" draggable={organization.arrangement === 'manual'} className={styles.cardObject} style={organization.arrangement === 'manual' ? { left: position.x, top: position.y } : undefined} aria-pressed={selectedCardIds.includes(card.uniqueId)} onDoubleClick={() => onEditCardRequest(card)} onDragEnd={(event) => placeCard(card, event.clientX, event.clientY)} onClick={() => setSelectedCardIds((current) => current.includes(card.uniqueId) ? current.filter((id) => id !== card.uniqueId) : [...current, card.uniqueId])}>
                <span className={styles.cardVisual}><CardPreview card={card} targetWidthPx={136} />{showCardWatermark ? <CardWatermarkOverlay testId={`studio-set-desk-watermark-${card.uniqueId}`} /> : null}</span>
                <strong>{getCardTitle(card, index)}</strong>
                <span>{card.template.name}</span>
                {card.tagIds?.length ? <small>{card.tagIds.map((id) => organization.tags.find((tag) => tag.id === id)?.label).filter(Boolean).join(' · ')}</small> : null}
              </button>;
            })}</div>
          </section>)}</div> : <div className={styles.emptyStage}><Boxes aria-hidden="true" /><strong>{activeCards.length ? 'No cards match this view' : 'This Set is ready for its first card'}</strong><p>{activeCards.length ? 'Clear the search or tag filter.' : 'Choose a Template or generate a batch. Your work returns here when the tool closes.'}</p><div><Button type="button" variant="outline" onClick={onEditTemplate}>Choose Template</Button><Button type="button" onClick={onGenerate}>Generate cards</Button></div></div>}
        </div>
      </div>

      <AlertDialog open={pendingRemove.length > 0} onOpenChange={(open) => { if (!open) setPendingRemove([]); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove {pendingRemove.length} card{pendingRemove.length === 1 ? '' : 's'}?</AlertDialogTitle><AlertDialogDescription>This removes the selected cards from this browser Set. The Set and its Templates remain available.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep cards</AlertDialogCancel><AlertDialogAction onClick={() => { const removed = removeGeneratedCards(pendingRemove.map((card) => card.uniqueId)); setPendingRemove([]); setSelectedCardIds([]); toast({ title: `${removed} card${removed === 1 ? '' : 's'} removed` }); }}>Remove cards</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={pendingDeleteSetId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteSetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this device Set?</AlertDialogTitle><AlertDialogDescription>This removes the Set and its cards from this browser. Copies in Google Drive, attached folders, and Pipeline remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep Set</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingDeleteSetId) deleteCardSet(pendingDeleteSetId); setPendingDeleteSetId(null); }}>Delete device copy</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
