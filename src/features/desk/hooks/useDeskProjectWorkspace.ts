"use client";

import { useMemo } from 'react';

import type { CardSetOrganization } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import { selectAllGeneratedDisplayCards, selectAllTemplates, useProjectStore, type ProjectState } from '@/features/project/client/workspace';

import { getArtifactSelectionScope } from '../model/focusedArtifactLayout';
import { getCardTitle } from '../model/desk';
import { deriveReflectiveOrganization, getSemanticOrganizationField } from '../model/reflectiveOrganization';

const DEFAULT_FOCUSED_ORGANIZATION: CardSetOrganization = {
  arrangement: 'manual', groupBy: 'none', sort: 'manual', tags: [], positions: {},
};

interface DeskProjectWorkspaceOptions {
  focusedSetId: string | null;
  generationSetId: string | null;
  selectedCardIds: string[];
  latestGeneratedIds: string[];
  cardQuery: string;
  tagFilter: string;
  moveTargetId: string;
}

export function useDeskProjectWorkspace(options: DeskProjectWorkspaceOptions) {
  const cardSets = useProjectStore((state) => state.cardSets);
  const activeCardSetId = useProjectStore((state) => state.activeCardSet?.id ?? null);
  const activeCardSet = useProjectStore((state) => state.activeCardSet);
  const storedCards = useProjectStore((state) => state.storedCards);
  const defaultTemplates = useProjectStore((state) => state.defaultTemplates);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const createCardSet = useProjectStore((state) => state.createCardSet);
  const setActiveCardSetId = useProjectStore((state) => state.setActiveCardSetId);
  const renameCardSet = useProjectStore((state) => state.renameCardSet);
  const duplicateCardSet = useProjectStore((state) => state.duplicateCardSet);
  const deleteCardSet = useProjectStore((state) => state.deleteCardSet);
  const moveGeneratedCardsToSet = useProjectStore((state) => state.moveGeneratedCardsToSet);
  const reorderGeneratedCard = useProjectStore((state) => state.reorderGeneratedCard);
  const addGeneratedCards = useProjectStore((state) => state.addGeneratedCards);
  const removeGeneratedCards = useProjectStore((state) => state.removeGeneratedCards);
  const reviseGeneratedCards = useProjectStore((state) => state.reviseGeneratedCards);
  const undoLastBulkRevision = useProjectStore((state) => state.undoLastBulkRevision);
  const openEditDialog = useProjectStore((state) => state.openEditDialog);
  const setStudioView = useProjectStore((state) => state.setStudioView);
  const generatorSelectedTemplateId = useProjectStore((state) => state.generatorSelectedTemplateId);
  const generatorSelectedBackingTemplateId = useProjectStore((state) => state.generatorSelectedBackingTemplateId);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const setGeneratorSelectedTemplateId = useProjectStore((state) => state.setGeneratorSelectedTemplateId);
  const setGeneratorSelectedBackingTemplateId = useProjectStore((state) => state.setGeneratorSelectedBackingTemplateId);
  const setTemplateEditorSelectedTemplateId = useProjectStore((state) => state.setTemplateEditorSelectedTemplateId);
  const updateCardSetOrganization = useProjectStore((state) => state.updateCardSetOrganization);
  const addCardSetTag = useProjectStore((state) => state.addCardSetTag);
  const setCardsTag = useProjectStore((state) => state.setCardsTag);
  const setCardPositions = useProjectStore((state) => state.setCardPositions);
  const displayCards = useMemo(() => selectAllGeneratedDisplayCards({
    cardSets,
    activeCardSet: cardSets.find((set) => set.id === activeCardSetId) ?? null,
    storedCards,
    defaultTemplates,
    userTemplates,
  } as ProjectState), [activeCardSetId, cardSets, defaultTemplates, storedCards, userTemplates]);
  const templates = useMemo(() => selectAllTemplates({ defaultTemplates, userTemplates } as ProjectState), [defaultTemplates, userTemplates]);

  const focusedSet = options.focusedSetId ? cardSets.find((set) => set.id === options.focusedSetId) ?? null : null;
  const generationSet = options.generationSetId ? cardSets.find((set) => set.id === options.generationSetId) ?? null : null;
  const storedOrganization = focusedSet?.organization ?? DEFAULT_FOCUSED_ORGANIZATION;
  const focusedCards = options.focusedSetId
    ? displayCards.filter((card) => card.setId === options.focusedSetId || (!card.setId && cardSets[0]?.id === options.focusedSetId))
    : [];
  const generationCards = generationSet
    ? displayCards.filter((card) => card.setId === generationSet.id || (!card.setId && cardSets[0]?.id === generationSet.id))
    : [];
  const normalizedCardQuery = options.cardQuery.trim().toLocaleLowerCase();
  const reflectiveOrganization = deriveReflectiveOrganization(focusedCards);
  const availableFields = reflectiveOrganization.fields;
  const validGroupField = availableFields.some((field) => (
    field.id === storedOrganization.groupField && field.groupable && !field.semanticGrouping
  ));
  const groupBy = storedOrganization.groupBy === 'none'
    || (storedOrganization.groupBy === 'field' ? validGroupField : reflectiveOrganization.groupings.includes(storedOrganization.groupBy))
    ? storedOrganization.groupBy
    : 'none';
  const validSortField = availableFields.some((field) => field.id === storedOrganization.sortField && field.sortable);
  const organization: CardSetOrganization = {
    ...storedOrganization,
    groupBy,
    groupField: groupBy === 'field' ? storedOrganization.groupField : undefined,
    sort: storedOrganization.sort === 'field-value' && !validSortField ? 'manual' : storedOrganization.sort,
    sortField: storedOrganization.sort === 'field-value' && validSortField ? storedOrganization.sortField : undefined,
  };
  const visibleCards = focusedCards.filter((card, index) => (
    (options.latestGeneratedIds.length === 0 || options.latestGeneratedIds.includes(card.uniqueId))
    && (!normalizedCardQuery || [
      getCardTitle(card, index),
      card.template.name,
      ...Object.values(card.data),
      ...organization.tags.filter((tag) => card.tagIds?.includes(tag.id)).map((tag) => tag.label),
    ].join(' ').toLocaleLowerCase().includes(normalizedCardQuery))
    && (options.tagFilter === 'all' || card.tagIds?.includes(options.tagFilter))
  ));
  const sortedCards = [...visibleCards].sort((left, right) => {
    if (organization.sort === 'name') return getCardTitle(left, focusedCards.indexOf(left)).localeCompare(getCardTitle(right, focusedCards.indexOf(right)));
    if (organization.sort === 'field-value' && organization.sortField) return String(left.data[organization.sortField] ?? '').localeCompare(String(right.data[organization.sortField] ?? ''), undefined, { numeric: true });
    if (organization.sort === 'recently-changed') return (Date.parse(right.updatedAt ?? '') || 0) - (Date.parse(left.updatedAt ?? '') || 0);
    return focusedCards.indexOf(left) - focusedCards.indexOf(right);
  });
  const groups = new Map<string, DisplayCard[]>();
  const groupLabel = (card: DisplayCard): string => {
    if (organization.groupBy === 'tag') return organization.tags.find((tag) => card.tagIds?.includes(tag.id))?.label ?? 'Untagged';
    if (organization.groupBy === 'field' && organization.groupField) return String(card.data[organization.groupField] ?? 'No value');
    if (organization.groupBy === 'template') return card.template.name;
    if (organization.groupBy === 'content-type') {
      const field = getSemanticOrganizationField(availableFields, 'contentType');
      return field ? String(card.data[field.id] ?? 'No value') : 'All cards';
    }
    if (organization.groupBy === 'batch') {
      const field = getSemanticOrganizationField(availableFields, 'batch');
      return field ? String(card.data[field.id] ?? 'No batch') : 'All cards';
    }
    return 'All cards';
  };
  sortedCards.forEach((card) => {
    const label = groupLabel(card);
    groups.set(label, [...(groups.get(label) ?? []), card]);
  });
  const selectedCards = focusedCards.filter((card) => options.selectedCardIds.includes(card.uniqueId));
  const selectedCard = selectedCards.length === 1 ? selectedCards[0] : null;
  const otherSets = options.focusedSetId ? cardSets.filter((set) => set.id !== options.focusedSetId) : [];

  return {
    actions: {
      addCardSetTag, addGeneratedCards, createCardSet, deleteCardSet, duplicateCardSet, moveGeneratedCardsToSet,
      openEditDialog, removeGeneratedCards, renameCardSet, reorderGeneratedCard, reviseGeneratedCards, setActiveCardSetId, setCardPositions,
      setCardsTag, setGeneratorSelectedBackingTemplateId, setGeneratorSelectedTemplateId, setStudioView,
      setTemplateEditorSelectedTemplateId, undoLastBulkRevision, updateCardSetOrganization,
    },
    state: {
      activeCardSet, activeCardSetId, allArtifactsSelected: focusedCards.length > 0 && focusedCards.every((card) => options.selectedCardIds.includes(card.uniqueId)),
      allVisibleCardsSelected: visibleCards.length > 0 && visibleCards.every((card) => options.selectedCardIds.includes(card.uniqueId)),
      availableFields, reflectiveGroupings: reflectiveOrganization.groupings, cardSets, displayCards, effectiveMoveTargetId: otherSets.some((set) => set.id === options.moveTargetId) ? options.moveTargetId : otherSets[0]?.id ?? '',
      focusedCards, generationCards, generationSet, generatorSelectedBackingTemplateId, generatorSelectedTemplateId,
      organization, organizedGroups: [...groups.entries()], otherSets, richTextHighlightColor,
      selectedCard, selectedCardIndex: selectedCard ? focusedCards.findIndex((card) => card.uniqueId === selectedCard.uniqueId) : -1,
      selectedCards, selectionScope: getArtifactSelectionScope(options.selectedCardIds, visibleCards.map((card) => card.uniqueId)),
      sortedCards, storedCards, templates, visibleCards,
    },
  };
}
