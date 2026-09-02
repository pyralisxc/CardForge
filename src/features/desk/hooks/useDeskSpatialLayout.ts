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
  DESK_WORLD_HEIGHT,
  DESK_WORLD_WIDTH,
  collectDeskWorldItems,
  getDeskMarqueeSelection,
  getDeskWorldProjection,
  moveDeskWorldSelection,
  normalizeDeskWorldGeometry,
  projectDeskWorldPosition,
  type DeskRect,
  type DeskWorldItemRect,
  type DeskWorldPosition,
} from '../model/deskSpatialGeometry';

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

const screenRect = (left: number, top: number, right: number, bottom: number): DeskRect => ({
  left: Math.min(left, right),
  top: Math.min(top, bottom),
  right: Math.max(left, right),
  bottom: Math.max(top, bottom),
});

export function useDeskSpatialLayout({
  positionKey,
  snapToGrid,
  selectedIds,
  onSelectionChange,
}: {
  positionKey: string;
  snapToGrid: boolean;
  selectedIds: readonly string[];
  onSelectionChange: SelectionChange;
}) {
  const workGridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DeskDragState | null>(null);
  const marqueeRef = useRef<DeskMarqueeState | null>(null);
  const suppressedActivationRef = useRef<string | null>(null);
  const [worldPositions, setWorldPositions] = useState<Record<string, DeskWorldPosition>>({});
  const [viewport, setViewport] = useState({ width: DESK_WORLD_WIDTH, height: DESK_WORLD_HEIGHT });
  const [marquee, setMarquee] = useState<DeskRect | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readProjectPreference<unknown>(positionKey).then((value) => {
      if (!cancelled) setWorldPositions(normalizeDeskWorldGeometry(value).positions);
    });
    return () => { cancelled = true; };
  }, [positionKey]);

  useEffect(() => {
    const grid = workGridRef.current;
    if (!grid) return;
    const update = () => setViewport({ width: Math.max(1, grid.clientWidth), height: Math.max(1, grid.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const projection = useMemo(() => getDeskWorldProjection(viewport), [viewport]);
  const positions = useMemo(() => Object.fromEntries(Object.entries(worldPositions).map(([id, position]) => (
    [id, projectDeskWorldPosition(position, viewport)]
  ))), [viewport, worldPositions]);

  const collectWorldItems = useCallback((): DeskWorldItemRect[] => {
    const grid = workGridRef.current;
    if (!grid) return [];
    const bounds = grid.getBoundingClientRect();
    return collectDeskWorldItems({
      tiles: grid.querySelectorAll<HTMLElement>('[data-desk-set-object-id]:not([aria-hidden="true"])'),
      bounds,
      projection,
      positions: worldPositions,
    });
  }, [projection, worldPositions]);

  const persistPositions = useCallback((next: Record<string, DeskWorldPosition>) => {
    void writeProjectPreference(positionKey, { version: 2, positions: next });
  }, [positionKey]);

  const beginDrag = useCallback((itemId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const items = collectWorldItems();
    const selected = selectedIds.includes(itemId) ? [...selectedIds] : [itemId];
    if (!selectedIds.includes(itemId)) onSelectionChange(selected, itemId);
    const selectedItems = items.filter((item) => selected.includes(item.id));
    if (selectedItems.length === 0) return;
    const topZ = Math.max(0, ...Object.values(worldPositions).map((position) => position.z)) + 1;
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
  }, [collectWorldItems, onSelectionChange, selectedIds, worldPositions]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / projection.scale;
    const dy = (event.clientY - drag.startY) / projection.scale;
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
    setWorldPositions((current) => ({ ...current, ...moved }));
  }, [projection.scale, snapToGrid]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressedActivationRef.current = drag.itemId;
    const next = { ...worldPositions, ...drag.latestPositions };
    setWorldPositions(next);
    persistPositions(next);
  }, [persistPositions, worldPositions]);

  const nudgeSelection = useCallback((delta: { x: number; y: number }) => {
    const moved = moveDeskWorldSelection({
      items: collectWorldItems(),
      selectedIds,
      delta,
      snap: snapToGrid ? 24 : 1,
    });
    const next = { ...worldPositions, ...moved };
    setWorldPositions(next);
    persistPositions(next);
  }, [collectWorldItems, persistPositions, selectedIds, snapToGrid, worldPositions]);

  const beginMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>, allowTouch = false) => {
    if (event.button !== 0 || (event.pointerType === 'touch' && !allowTouch) || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    marqueeRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      additiveIds: event.metaKey || event.ctrlKey || event.shiftKey ? [...selectedIds] : [],
    };
    setMarquee(screenRect(point.x, point.y, point.x, point.y));
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [selectedIds]);

  const moveMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setMarquee(screenRect(state.startX, state.startY, event.clientX - bounds.left, event.clientY - bounds.top));
  }, []);

  const endMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const selectedRect = screenRect(state.startX, state.startY, event.clientX - bounds.left, event.clientY - bounds.top);
    const worldRect = {
      left: (selectedRect.left - projection.offsetX) / projection.scale,
      top: (selectedRect.top - projection.offsetY) / projection.scale,
      right: (selectedRect.right - projection.offsetX) / projection.scale,
      bottom: (selectedRect.bottom - projection.offsetY) / projection.scale,
    };
    const hits = getDeskMarqueeSelection(collectWorldItems(), worldRect);
    const next = Array.from(new Set([...state.additiveIds, ...hits]));
    onSelectionChange(next, hits.at(-1) ?? state.additiveIds.at(-1) ?? null);
    marqueeRef.current = null;
    setMarquee(null);
  }, [collectWorldItems, onSelectionChange, projection]);

  const shouldSuppressActivation = useCallback((itemId: string) => {
    if (suppressedActivationRef.current !== itemId) return false;
    suppressedActivationRef.current = null;
    return true;
  }, []);

  return {
    beginDrag,
    beginMarquee,
    endDrag,
    endMarquee,
    marquee,
    moveDrag,
    moveMarquee,
    nudgeSelection,
    positions,
    shouldSuppressActivation,
    workGridRef,
  };
}
