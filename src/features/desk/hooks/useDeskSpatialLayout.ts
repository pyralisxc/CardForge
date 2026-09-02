"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { readProjectPreference, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import {
  collectDeskWorldItems,
  getDefaultDeskWorldPosition,
  getDeskMarqueeSelection,
  moveDeskWorldSelection,
  normalizeDeskWorldGeometry,
  type DeskRect,
  type DeskWorldItemRect,
  type DeskWorldPosition,
} from '../model/deskSpatialGeometry';
import { useDeskCamera } from './useDeskCamera';

export type DeskPosition = { x: number; y: number; z: number };

type SelectionChange = (ids: string[], anchorId: string | null) => void;

type DeskDragState = {
  itemId: string;
  pointerId: number;
  startX: number;
  startY: number;
  items: DeskWorldItemRect[];
  selectedIds: string[];
  moved: boolean;
  latestPositions: Record<string, DeskWorldPosition>;
};

type DeskMarqueeState = {
  pointerId: number;
  startX: number;
  startY: number;
  additiveIds: string[];
};

const rectFromPoints = (left: number, top: number, right: number, bottom: number): DeskRect => ({
  left: Math.min(left, right),
  top: Math.min(top, bottom),
  right: Math.max(left, right),
  bottom: Math.max(top, bottom),
});

export function useDeskSpatialLayout({
  positionKey,
  itemIds,
  focused,
  snapToGrid,
  selectedIds,
  onSelectionChange,
}: {
  positionKey: string;
  itemIds: readonly string[];
  focused: boolean;
  snapToGrid: boolean;
  selectedIds: readonly string[];
  onSelectionChange: SelectionChange;
}) {
  const workGridRef = useRef<HTMLDivElement | null>(null);
  const workWorldRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DeskDragState | null>(null);
  const marqueeRef = useRef<DeskMarqueeState | null>(null);
  const suppressedActivationRef = useRef<string | null>(null);
  const [storedPositions, setStoredPositions] = useState<Record<string, DeskWorldPosition>>({});
  const [marquee, setMarquee] = useState<DeskRect | null>(null);
  const camera = useDeskCamera({ focused, viewportRef: workGridRef });

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(positionKey).then((value) => {
      if (!cancelled) setStoredPositions(normalizeDeskWorldGeometry(value).positions);
    });
    return () => { cancelled = true; };
  }, [positionKey]);

  const positions = useMemo(() => Object.fromEntries(itemIds.map((id, index) => [
    id,
    storedPositions[id] ?? getDefaultDeskWorldPosition(index),
  ])), [itemIds, storedPositions]);
  const collectWorldItems = useCallback((): DeskWorldItemRect[] => {
    const world = workWorldRef.current;
    if (!world) return [];
    const bounds = world.getBoundingClientRect();
    return collectDeskWorldItems({
      tiles: world.querySelectorAll<HTMLElement>('[data-desk-set-object-id]:not([aria-hidden="true"])'),
      bounds,
      projection: { scale: camera.zoom, offsetX: 0, offsetY: 0 },
      positions,
    });
  }, [camera.zoom, positions]);

  const persistPositions = useCallback((next: Record<string, DeskWorldPosition>) => {
    void writeProjectPreference(positionKey, { version: 2, positions: next });
  }, [positionKey]);

  const beginDrag = useCallback((itemId: string, event: ReactPointerEvent<HTMLButtonElement>, options: { additive?: boolean } = {}) => {
    if (event.button !== 0) return;
    const items = collectWorldItems();
    const selected = selectedIds.includes(itemId)
      ? [...selectedIds]
      : options.additive
        ? [...selectedIds, itemId]
        : [itemId];
    if (!selectedIds.includes(itemId)) onSelectionChange(selected, itemId);
    const selectedItems = items.filter((item) => selected.includes(item.id));
    if (selectedItems.length === 0) return;
    const topZ = Math.max(0, ...Object.values(positions).map((position) => position.z)) + 1;
    const lifted = Object.fromEntries(selectedItems.map((item, index) => [item.id, {
      x: item.x,
      y: item.y,
      z: topZ + index,
    }]));
    dragRef.current = {
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      items: selectedItems.map((item) => ({ ...item, z: lifted[item.id]?.z ?? item.z })),
      selectedIds: selected,
      moved: false,
      latestPositions: {},
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [collectWorldItems, onSelectionChange, positions, selectedIds]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / camera.zoom;
    const dy = (event.clientY - drag.startY) / camera.zoom;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    event.preventDefault();
    const moved = moveDeskWorldSelection({
      items: drag.items,
      selectedIds: drag.selectedIds,
      delta: { x: dx, y: dy },
      snap: snapToGrid ? 24 : 1,
    });
    drag.latestPositions = moved;
    setStoredPositions((current) => ({ ...current, ...moved }));
  }, [camera.zoom, snapToGrid]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressedActivationRef.current = drag.itemId;
    const next = { ...storedPositions, ...drag.latestPositions };
    setStoredPositions(next);
    persistPositions(next);
  }, [persistPositions, storedPositions]);

  const nudgeSelection = useCallback((delta: { x: number; y: number }) => {
    const moved = moveDeskWorldSelection({
      items: collectWorldItems(),
      selectedIds,
      delta,
      snap: snapToGrid ? 24 : 1,
    });
    const next = { ...storedPositions, ...moved };
    setStoredPositions(next);
    persistPositions(next);
  }, [collectWorldItems, persistPositions, selectedIds, snapToGrid, storedPositions]);

  const beginMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>, allowTouch = false) => {
    if (event.button !== 0 || (event.pointerType === 'touch' && !allowTouch) || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: (event.clientX - bounds.left) / camera.zoom,
      y: (event.clientY - bounds.top) / camera.zoom,
    };
    marqueeRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      additiveIds: event.metaKey || event.ctrlKey || event.shiftKey ? [...selectedIds] : [],
    };
    setMarquee(rectFromPoints(point.x, point.y, point.x, point.y));
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera.zoom, selectedIds]);

  const moveMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setMarquee(rectFromPoints(
      state.startX,
      state.startY,
      (event.clientX - bounds.left) / camera.zoom,
      (event.clientY - bounds.top) / camera.zoom,
    ));
  }, [camera.zoom]);

  const endMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const selectedRect = rectFromPoints(
      state.startX,
      state.startY,
      (event.clientX - bounds.left) / camera.zoom,
      (event.clientY - bounds.top) / camera.zoom,
    );
    const hits = getDeskMarqueeSelection(collectWorldItems(), selectedRect);
    const next = Array.from(new Set([...state.additiveIds, ...hits]));
    onSelectionChange(next, hits.at(-1) ?? state.additiveIds.at(-1) ?? null);
    marqueeRef.current = null;
    setMarquee(null);
  }, [camera.zoom, collectWorldItems, onSelectionChange]);

  const shouldSuppressActivation = useCallback((itemId: string) => {
    if (suppressedActivationRef.current !== itemId) return false;
    suppressedActivationRef.current = null;
    return true;
  }, []);

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
    positions,
    shouldSuppressActivation,
    workGridRef,
    workWorldRef,
  };
}
