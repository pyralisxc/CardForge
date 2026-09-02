"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { readProjectPreference, writeProjectPreference } from '@/features/project/client';

export type DeskPosition = { x: number; y: number };

const DESK_TOOLBAR_CLEARANCE = 72;

function keepBelowDeskToolbar(position: DeskPosition): DeskPosition {
  return { x: Math.max(0, position.x), y: Math.max(DESK_TOOLBAR_CLEARANCE, position.y) };
}

type DeskDragState = {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  origin: DeskPosition;
  latest: DeskPosition;
  moved: boolean;
};

export function useDeskSpatialLayout({ positionKey, snapToGrid }: { positionKey: string; snapToGrid: boolean }) {
  const workGridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DeskDragState | null>(null);
  const suppressedFocusRef = useRef<string | null>(null);
  const [positions, setPositions] = useState<Record<string, DeskPosition>>({});

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(positionKey).then((value) => {
      if (cancelled || !value || typeof value !== 'object' || Array.isArray(value)) return;
      const restored = Object.fromEntries(Object.entries(value).flatMap(([id, entry]) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const { x, y } = entry as Partial<DeskPosition>;
        return Number.isFinite(x) && Number.isFinite(y) ? [[id, keepBelowDeskToolbar({ x: Number(x), y: Number(y) })]] : [];
      }));
      setPositions(restored);
    });
    return () => { cancelled = true; };
  }, [positionKey]);

  const beginDrag = useCallback((itemId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || window.matchMedia('(max-width: 767px)').matches) return;
    const grid = workGridRef.current;
    const tile = event.currentTarget.closest<HTMLElement>('[data-home-work-object]');
    if (!grid || !tile) return;
    const gridBounds = grid.getBoundingClientRect();
    const tileBounds = tile.getBoundingClientRect();
    const origin = keepBelowDeskToolbar(positions[itemId] ?? {
      x: tileBounds.left - gridBounds.left,
      y: tileBounds.top - gridBounds.top,
    });
    dragRef.current = {
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      latest: origin,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [positions]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const grid = workGridRef.current;
    const tile = event.currentTarget.closest<HTMLElement>('[data-home-work-object]');
    if (!drag || drag.pointerId !== event.pointerId || !grid || !tile) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    const place = (value: number) => snapToGrid ? Math.round(value / 24) * 24 : Math.round(value);
    drag.latest = {
      x: Math.max(0, Math.min(grid.clientWidth - tile.offsetWidth, place(drag.origin.x + dx))),
      y: Math.max(DESK_TOOLBAR_CLEARANCE, Math.min(grid.clientHeight - tile.offsetHeight, place(drag.origin.y + dy))),
    };
    setPositions((current) => ({ ...current, [drag.itemId]: drag.latest }));
  }, [snapToGrid]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressedFocusRef.current = drag.itemId;
    setPositions((current) => {
      const next = { ...current, [drag.itemId]: drag.latest };
      void writeProjectPreference(positionKey, next);
      return next;
    });
  }, [positionKey]);

  const shouldSuppressFocus = useCallback((itemId: string) => {
    if (suppressedFocusRef.current !== itemId) return false;
    suppressedFocusRef.current = null;
    return true;
  }, []);

  return {
    beginDrag,
    endDrag,
    moveDrag,
    positions,
    shouldSuppressFocus,
    workGridRef,
  };
}
