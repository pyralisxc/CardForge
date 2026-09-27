"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { projectClientPointToSpatialWorld } from '@/components/ui/spatial-viewport';
import { getSpatialOriginCompensatedScroll } from '@/components/ui/spatial-world';
import { readProjectPreferenceSafely, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import {
  collectDeskWorldItems,
  getDefaultDeskWorldPosition,
  getDeskMarqueeSelection,
  getDeskWorldBounds,
  getDeskWorldSize,
  moveDeskWorldSelection,
  moveDeskWorldSelectionWithRebase,
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
  items: Array<Pick<DeskWorldItemRect, 'id' | 'x' | 'y' | 'z'>>;
  selectedIds: string[];
  moved: boolean;
  latestPositions: Record<string, DeskWorldPosition>;
  originalPositions: Record<string, DeskWorldPosition>;
  startScroll: { left: number; top: number };
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
  visibleItemIds,
  focused,
  snapToGrid,
  selectedIds,
  onSelectionChange,
}: {
  positionKey: string;
  itemIds: readonly string[];
  visibleItemIds: readonly string[];
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
  const [positionsWritable, setPositionsWritable] = useState(false);
  const [marquee, setMarquee] = useState<DeskRect | null>(null);
  const [framingItems, setFramingItems] = useState<DeskWorldItemRect[]>([]);
  const cancelPointerGesture = useCallback(() => {
    const drag = dragRef.current;
    if (drag) {
      setStoredPositions((current) => ({ ...current, ...drag.originalPositions }));
      const grid = workGridRef.current;
      if (grid) requestAnimationFrame(() => grid.scrollTo(drag.startScroll));
    }
    dragRef.current = null;
    marqueeRef.current = null;
    setMarquee(null);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setPositionsWritable(false);
    setFramingItems([]);
    void readProjectPreferenceSafely<unknown>(positionKey).then((result) => {
      if (cancelled || result.kind === 'unavailable') return;
      setStoredPositions(normalizeDeskWorldGeometry(result.kind === 'available' ? result.value : null).positions);
      setPositionsWritable(true);
    });
    return () => { cancelled = true; };
  }, [positionKey]);

  const positions = useMemo(() => Object.fromEntries(itemIds.map((id, index) => [
    id,
    storedPositions[id] ?? getDefaultDeskWorldPosition(index),
  ])), [itemIds, storedPositions]);
  const worldItems = useMemo(() => framingItems.map((item) => ({
    ...item,
    ...(positions[item.id] ?? {}),
  })), [framingItems, positions]);
  const worldSize = useMemo(() => getDeskWorldSize(worldItems), [worldItems]);
  const workBounds = useMemo(() => getDeskWorldBounds(worldItems), [worldItems]);
  const selectionBounds = useMemo(() => getDeskWorldBounds(
    worldItems.filter((item) => selectedIds.includes(item.id)),
  ), [selectedIds, worldItems]);
  const camera = useDeskCamera({
    focused,
    hasItems: visibleItemIds.length > 0,
    worldSize,
    workBounds,
    selectionBounds,
    viewportRef: workGridRef,
    onPinchStart: cancelPointerGesture,
  });

  const itemKey = itemIds.join('\u0000');
  const visibleItemKey = visibleItemIds.join('\u0000');
  useLayoutEffect(() => {
    const world = workWorldRef.current;
    if (focused || !positionsWritable || !world) return;
    let settleFrame: number | null = null;
    let settleTimeout: ReturnType<typeof setTimeout> | null = null;
    const measureVisibleWork = () => {
      const bounds = world.getBoundingClientRect();
      const scale = Math.max(Number.EPSILON, bounds.width / Math.max(1, worldSize.width));
      const next = collectDeskWorldItems({
        tiles: world.querySelectorAll<HTMLElement>('[data-desk-set-object-id]:not([aria-hidden="true"])'),
        bounds,
        projection: { scale, offsetX: 0, offsetY: 0 },
        positions,
      });
      setFramingItems((current) => {
        const signature = (items: DeskWorldItemRect[]) => items.map((item) => `${item.id}:${item.x}:${item.y}:${item.width}:${item.height}`).join('|');
        return signature(current) === signature(next) ? current : next;
      });
    };
    const frame = requestAnimationFrame(() => {
      measureVisibleWork();
      // Intrinsic previews may settle after the first layout. One bounded
      // remeasure keeps Fit Work honest without creating a live camera loop.
      settleTimeout = setTimeout(() => {
        settleFrame = requestAnimationFrame(measureVisibleWork);
      }, 180);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      if (settleTimeout !== null) clearTimeout(settleTimeout);
    };
  }, [focused, itemKey, positions, positionsWritable, visibleItemKey, worldSize.height, worldSize.width]);
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
    if (positionsWritable) void writeProjectPreference(positionKey, { version: 2, positions: next });
  }, [positionKey, positionsWritable]);

  const beginDrag = useCallback((itemId: string, event: ReactPointerEvent<HTMLButtonElement>, options: { additive?: boolean } = {}) => {
    if (event.button !== 0) return;
    camera.enterCustom();
    suppressedActivationRef.current = null;
    const selected = selectedIds.includes(itemId)
      ? [...selectedIds]
      : options.additive
        ? [...selectedIds, itemId]
        : [itemId];
    if (!selectedIds.includes(itemId)) onSelectionChange(selected, itemId);
    const authoredItems = Object.entries(positions).map(([id, position]) => ({ id, ...position }));
    if (!authoredItems.some((item) => selected.includes(item.id))) return;
    const topZ = Math.max(0, ...authoredItems.map((position) => position.z)) + 1;
    let liftIndex = 0;
    const liftedItems = authoredItems.map((item) => selected.includes(item.id)
      ? { ...item, z: topZ + liftIndex++ }
      : item);
    const grid = workGridRef.current;
    dragRef.current = {
      itemId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      items: liftedItems,
      selectedIds: selected,
      moved: false,
      latestPositions: {},
      originalPositions: Object.fromEntries(authoredItems.map((item) => [item.id, { x: item.x, y: item.y, z: item.z }])),
      startScroll: { left: grid?.scrollLeft ?? 0, top: grid?.scrollTop ?? 0 },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera, collectWorldItems, onSelectionChange, positions, selectedIds]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / camera.zoom;
    const dy = (event.clientY - drag.startY) / camera.zoom;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    event.preventDefault();
    const moved = moveDeskWorldSelectionWithRebase({
      items: drag.items,
      selectedIds: drag.selectedIds,
      delta: { x: dx, y: dy },
      snap: snapToGrid ? 24 : 1,
    });
    drag.latestPositions = moved.positions;
    setStoredPositions((current) => ({ ...current, ...moved.positions }));
    const grid = workGridRef.current;
    if (grid && (moved.originShift.x > 0 || moved.originShift.y > 0)) {
      const target = getSpatialOriginCompensatedScroll({
        scroll: drag.startScroll,
        originShift: moved.originShift,
        zoom: camera.zoom,
      });
      requestAnimationFrame(() => grid.scrollTo(target));
    }
  }, [camera.zoom, snapToGrid]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.type === 'pointercancel') { cancelPointerGesture(); return; }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved) return;
    suppressedActivationRef.current = drag.itemId;
    const next = { ...storedPositions, ...drag.latestPositions };
    setStoredPositions(next);
    persistPositions(next);
  }, [cancelPointerGesture, persistPositions, storedPositions]);

  const nudgeSelection = useCallback((delta: { x: number; y: number }) => {
    camera.enterCustom();
    const authoredItems = Object.entries(positions).map(([id, position]) => ({ id, ...position }));
    const moved = moveDeskWorldSelectionWithRebase({
      items: authoredItems,
      selectedIds,
      delta,
      snap: snapToGrid ? 24 : 1,
    });
    const next = { ...storedPositions, ...moved.positions };
    setStoredPositions(next);
    persistPositions(next);
    const grid = workGridRef.current;
    if (grid && (moved.originShift.x > 0 || moved.originShift.y > 0)) {
      const target = getSpatialOriginCompensatedScroll({
        scroll: { left: grid.scrollLeft, top: grid.scrollTop },
        originShift: moved.originShift,
        zoom: camera.zoom,
      });
      requestAnimationFrame(() => grid.scrollTo(target));
    }
  }, [camera, persistPositions, positions, selectedIds, snapToGrid, storedPositions]);

  const beginMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>, allowTouch = false) => {
    // React portal events bubble through this component tree even when their DOM
    // target is a menu/dialog rendered elsewhere. Only the physical Desk canvas
    // may claim pointer capture for marquee selection.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (event.button !== 0 || (event.pointerType === 'touch' && !allowTouch) || (event.target as HTMLElement).closest('button, input, [data-set-object]')) return;
    camera.enterCustom();
    const bounds = workWorldRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const point = projectClientPointToSpatialWorld(event, bounds, {
      zoom: camera.zoom,
      scrollLeft: 0,
      scrollTop: 0,
    });
    marqueeRef.current = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      additiveIds: event.metaKey || event.ctrlKey || event.shiftKey ? [...selectedIds] : [],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera, selectedIds]);

  const moveMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = workWorldRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const point = projectClientPointToSpatialWorld(event, bounds, {
      zoom: camera.zoom,
      scrollLeft: 0,
      scrollTop: 0,
    });
    setMarquee(rectFromPoints(state.startX, state.startY, point.x, point.y));
  }, [camera.zoom]);

  const endMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const bounds = workWorldRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const point = projectClientPointToSpatialWorld(event, bounds, {
      zoom: camera.zoom,
      scrollLeft: 0,
      scrollTop: 0,
    });
    const selectedRect = rectFromPoints(state.startX, state.startY, point.x, point.y);
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
    worldSize,
  };
}
