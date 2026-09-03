"use client";

import { useEffect, useMemo, useState } from 'react';

import { readProjectPreference, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import { type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import {
  DESK_ORDER_KEY,
  DESK_PINS_KEY,
  getDeskSourceFacets,
  matchesSourceFilter,
  normalizeDeskOrder,
  workSourceLabel,
  type HomeSourceFilter,
} from '../model/desk';
import { useDeskSpatialLayout } from './useDeskSpatialLayout';

interface DeskLayoutOptions {
  persistenceScope: ProjectPersistenceScope;
  workItems: AccountLibraryItem[];
  query: string;
  sourceFilter: HomeSourceFilter;
  focused: boolean;
  snapToGrid: boolean;
  selectedIds: readonly string[];
  onSelectionChange: (ids: string[], anchorId: string | null) => void;
}

export function useDeskLayout({
  persistenceScope,
  workItems,
  query,
  sourceFilter,
  focused,
  snapToGrid,
  selectedIds,
  onSelectionChange,
}: DeskLayoutOptions) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [deskOrderIds, setDeskOrderIds] = useState<string[]>([]);
  const pinKey = `${DESK_PINS_KEY}:${persistenceScope}`;
  const orderKey = `${DESK_ORDER_KEY}:${persistenceScope}`;
  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(pinKey).then((value) => {
      if (!cancelled && Array.isArray(value)) setPinnedIds(value.filter((entry): entry is string => typeof entry === 'string'));
    });
    return () => { cancelled = true; };
  }, [pinKey]);

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(orderKey).then((value) => {
      if (!cancelled && Array.isArray(value)) setDeskOrderIds(value.filter((entry): entry is string => typeof entry === 'string'));
    });
    return () => { cancelled = true; };
  }, [orderKey]);

  const normalizedDeskOrder = useMemo(
    () => normalizeDeskOrder(workItems.map((item) => item.id), deskOrderIds),
    [deskOrderIds, workItems],
  );
  useEffect(() => {
    if (normalizedDeskOrder.join('\u0000') === deskOrderIds.join('\u0000')) return;
    setDeskOrderIds(normalizedDeskOrder);
    void writeProjectPreference(orderKey, normalizedDeskOrder);
  }, [deskOrderIds, normalizedDeskOrder, orderKey]);

  const sourceFacets = useMemo(() => getDeskSourceFacets(workItems), [workItems]);

  const visibleWork = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return workItems.filter((item) => (
      matchesSourceFilter(item, sourceFilter)
      && (!normalizedQuery || [item.name, ...item.details, workSourceLabel(item)].join(' ').toLocaleLowerCase().includes(normalizedQuery))
    )).toSorted((left, right) => normalizedDeskOrder.indexOf(left.id) - normalizedDeskOrder.indexOf(right.id));
  }, [normalizedDeskOrder, query, sourceFilter, workItems]);

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
    itemIds: visibleWork.map((item) => item.id),
    focused,
    snapToGrid,
    selectedIds,
    onSelectionChange,
  });

  const togglePin = (itemId: string) => {
    setPinnedIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current];
      void writeProjectPreference(pinKey, next);
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
    togglePin,
    visibleWork,
    workGridRef,
    workWorldRef,
  };
}
