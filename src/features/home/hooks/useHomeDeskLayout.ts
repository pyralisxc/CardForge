"use client";

import { useEffect, useMemo, useState } from 'react';

import { readProjectPreference, writeProjectPreference, type ProjectPersistenceScope } from '@/features/project/client';
import type { AccountLibraryItem } from '@/features/storage-management/client';

import {
  HOME_ORDER_KEY,
  HOME_PINS_KEY,
  matchesSourceFilter,
  normalizeDeskOrder,
  reorderDeskItem,
  workSourceLabel,
  type HomeSort,
  type HomeSourceFilter,
} from '../model/homeDesk';
import { useDeskSpatialLayout } from './useDeskSpatialLayout';

interface HomeDeskLayoutOptions {
  persistenceScope: ProjectPersistenceScope;
  workItems: AccountLibraryItem[];
  query: string;
  sourceFilter: HomeSourceFilter;
  sort: HomeSort;
  snapToGrid: boolean;
}

export function useHomeDeskLayout({
  persistenceScope,
  workItems,
  query,
  sourceFilter,
  sort,
  snapToGrid,
}: HomeDeskLayoutOptions) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [deskOrderIds, setDeskOrderIds] = useState<string[]>([]);
  const pinKey = `${HOME_PINS_KEY}:${persistenceScope}`;
  const orderKey = `${HOME_ORDER_KEY}:${persistenceScope}`;
  const {
    beginDrag,
    endDrag,
    moveDrag,
    positions,
    shouldSuppressFocus,
    workGridRef,
  } = useDeskSpatialLayout({ positionKey: `${HOME_ORDER_KEY}:positions:${persistenceScope}`, snapToGrid });

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

  const visibleWork = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return workItems.filter((item) => (
      matchesSourceFilter(item, sourceFilter)
      && (!normalizedQuery || [item.name, ...item.details, workSourceLabel(item)].join(' ').toLocaleLowerCase().includes(normalizedQuery))
    )).toSorted((left, right) => {
      if (sort === 'name') return left.name.localeCompare(right.name);
      if (sort === 'size') return (right.sizeBytes ?? -1) - (left.sizeBytes ?? -1) || left.name.localeCompare(right.name);
      return normalizedDeskOrder.indexOf(left.id) - normalizedDeskOrder.indexOf(right.id);
    });
  }, [normalizedDeskOrder, query, sort, sourceFilter, workItems]);

  const togglePin = (itemId: string) => {
    const wasPinned = pinnedIds.includes(itemId);
    setPinnedIds((current) => {
      const next = current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current];
      void writeProjectPreference(pinKey, next);
      return next;
    });
    if (!wasPinned) {
      setDeskOrderIds((current) => {
        const normalized = normalizeDeskOrder(workItems.map((item) => item.id), current);
        const next = normalized.includes(itemId) ? reorderDeskItem(normalized, itemId, normalized[0]!) : normalized;
        void writeProjectPreference(orderKey, next);
        return next;
      });
    }
  };

  const moveWork = (itemId: string, direction: 'earlier' | 'later') => {
    setDeskOrderIds((current) => {
      const next = reorderDeskItem(normalizeDeskOrder(workItems.map((item) => item.id), current), itemId, direction);
      void writeProjectPreference(orderKey, next);
      return next;
    });
  };

  return { beginDrag, endDrag, moveDrag, moveWork, pinnedIds, positions, shouldSuppressFocus, togglePin, visibleWork, workGridRef };
}
