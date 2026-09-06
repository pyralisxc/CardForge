"use client";

import { useEffect, useMemo, useState } from 'react';

import { readProjectPreferenceSafely, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { AccountLibraryItem, AccountLibrarySource } from '@/features/storage-management/client';

import {
  DESK_ORDER_KEY,
  DESK_PINS_KEY,
  getDeskSourceFacets,
  getDeskTagFacets,
  getDeskTypeFacets,
  matchesDeskSourceFilters,
  matchesDeskTagFilters,
  matchesDeskTypeFilters,
  matchesDeskViews,
  normalizeDeskOrder,
  preserveDeskOrder,
  workSourceLabel,
} from '../model/desk';
import { useDeskSpatialLayout } from './useDeskSpatialLayout';

interface DeskLayoutOptions {
  persistenceScope: ProjectPersistenceScope;
  workItems: AccountLibraryItem[];
  query: string;
  sourceFilters: readonly AccountLibrarySource[];
  typeFilters: readonly string[];
  tagFilters: readonly string[];
  tagMatch: 'any' | 'all';
  viewIds: readonly string[];
  focused: boolean;
  snapToGrid: boolean;
  selectedIds: readonly string[];
  onSelectionChange: (ids: string[], anchorId: string | null) => void;
}

export function useDeskLayout({
  persistenceScope,
  workItems,
  query,
  sourceFilters,
  typeFilters,
  tagFilters,
  tagMatch,
  viewIds,
  focused,
  snapToGrid,
  selectedIds,
  onSelectionChange,
}: DeskLayoutOptions) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [deskOrderIds, setDeskOrderIds] = useState<string[]>([]);
  const [pinPreferencesWritable, setPinPreferencesWritable] = useState(false);
  const [orderPreferencesWritable, setOrderPreferencesWritable] = useState(false);
  const pinKey = `${DESK_PINS_KEY}:${persistenceScope}`;
  const orderKey = `${DESK_ORDER_KEY}:${persistenceScope}`;
  useEffect(() => {
    let cancelled = false;
    setPinPreferencesWritable(false);
    void readProjectPreferenceSafely<unknown>(pinKey).then((result) => {
      if (cancelled || result.kind === 'unavailable') return;
      const value = result.kind === 'available' ? result.value : null;
      if (Array.isArray(value)) {
        setPinnedIds(value.filter((entry): entry is string => typeof entry === 'string'));
      } else setPinnedIds([]);
      setPinPreferencesWritable(true);
    });
    return () => { cancelled = true; };
  }, [pinKey]);

  useEffect(() => {
    let cancelled = false;
    setOrderPreferencesWritable(false);
    void readProjectPreferenceSafely<unknown>(orderKey).then((result) => {
      if (cancelled || result.kind === 'unavailable') return;
      const value = result.kind === 'available' ? result.value : null;
      if (Array.isArray(value)) {
        setDeskOrderIds(value.filter((entry): entry is string => typeof entry === 'string'));
      } else setDeskOrderIds([]);
      setOrderPreferencesWritable(true);
    });
    return () => { cancelled = true; };
  }, [orderKey]);

  const persistedDeskOrder = useMemo(
    () => preserveDeskOrder(workItems.map((item) => item.id), deskOrderIds),
    [deskOrderIds, workItems],
  );
  useEffect(() => {
    if (persistedDeskOrder.join('\u0000') === deskOrderIds.join('\u0000')) return;
    setDeskOrderIds(persistedDeskOrder);
    if (orderPreferencesWritable) void writeProjectPreference(orderKey, persistedDeskOrder);
  }, [deskOrderIds, orderKey, orderPreferencesWritable, persistedDeskOrder]);

  const normalizedDeskOrder = useMemo(
    () => normalizeDeskOrder(workItems.map((item) => item.id), persistedDeskOrder),
    [persistedDeskOrder, workItems],
  );

  const sourceFacets = useMemo(() => getDeskSourceFacets(workItems), [workItems]);
  const typeFacets = useMemo(() => getDeskTypeFacets(workItems), [workItems]);
  const tagFacets = useMemo(() => getDeskTagFacets(workItems), [workItems]);

  const visibleWork = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return workItems.filter((item) => (
      matchesDeskViews(item, viewIds)
      && matchesDeskSourceFilters(item, sourceFilters)
      && matchesDeskTypeFilters(item, typeFilters)
      && matchesDeskTagFilters(item, tagFilters, tagMatch)
      && (!normalizedQuery || [item.name, ...item.details, workSourceLabel(item)].join(' ').toLocaleLowerCase().includes(normalizedQuery))
    )).toSorted((left, right) => normalizedDeskOrder.indexOf(left.id) - normalizedDeskOrder.indexOf(right.id));
  }, [normalizedDeskOrder, query, sourceFilters, tagFilters, tagMatch, typeFilters, viewIds, workItems]);

  const {
    beginDrag,
    beginMarquee,
    camera,
    endDrag,
    endMarquee,
    marquee,
    moveDrag,
    moveMarquee,
    nudgeSelection,
    positions,
    shouldSuppressActivation,
    workGridRef,
    workWorldRef,
  } = useDeskSpatialLayout({
    positionKey: `${DESK_ORDER_KEY}:positions:${persistenceScope}`,
    // The stored world contains every authorized item, not only the filtered
    // projection. Filtering or a later-arriving provider therefore cannot
    // drop positions, pins, or relative order.
    itemIds: persistedDeskOrder,
    focused,
    snapToGrid,
    selectedIds,
    onSelectionChange,
  });

  const togglePin = (itemId: string) => {
    setPinnedIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current];
      if (pinPreferencesWritable) void writeProjectPreference(pinKey, next);
      return next;
    });
  };

  return {
    beginDrag,
    beginMarquee,
    camera,
    endDrag,
    endMarquee,
    marquee,
    moveDrag,
    moveMarquee,
    nudgeSelection,
    pinnedIds,
    positions,
    shouldSuppressActivation,
    sourceFacets,
    tagFacets,
    typeFacets,
    togglePin,
    visibleWork,
    workGridRef,
    workWorldRef,
  };
}
