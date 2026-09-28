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

import { readProjectPreferenceSafely, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import {
  collectDeskWorldItems,
  DEFAULT_DESK_GRID_SIZE_MM,
  DESK_SPATIAL_VERSION,
  getDefaultDeskWorldPosition,
  getDeskMarqueeSelection,
  getDeskWorldBounds,
  getDeskWorldSize,
  moveDeskWorldSelectionWithRebase,
  isLegacyDeskWorldGeometry,
  normalizeDeskWorldGeometry,
  type DeskRect,
  type DeskWorldItemRect,
  type DeskWorldPosition,
} from '../model/deskSpatialGeometry';
import { useDeskCamera, type DeskCameraSnapshot } from './useDeskCamera';

export type DeskPosition = { x: number; y: number; z: number };

type SelectionChange = (ids: string[], anchorId: string | null) => void;
type ClientPoint = { clientX: number; clientY: number };

type DeskDragState = {
  itemId: string;
  pointerId: number;
  startClient: ClientPoint;
  latestClient: ClientPoint;
  startWorld: { x: number; y: number };
  startCamera: DeskCameraSnapshot;
  items: Array<Pick<DeskWorldItemRect, 'id' | 'x' | 'y' | 'z'>>;
  selectedIds: string[];
  moved: boolean;
  latestPositions: Record<string, DeskWorldPosition>;
  originalPositions: Record<string, DeskWorldPosition>;
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
  const edgePanFrameRef = useRef<number | null>(null);
  const edgePanLastTimeRef = useRef<number | null>(null);
  const cameraApiRef = useRef<ReturnType<typeof useDeskCamera> | null>(null);
  const [storedPositions, setStoredPositions] = useState<Record<string, DeskWorldPosition>>({});
  const [positionsWritable, setPositionsWritable] = useState(false);
  const [marquee, setMarquee] = useState<DeskRect | null>(null);
  const [framingItems, setFramingItems] = useState<DeskWorldItemRect[]>([]);

  const stopEdgePan = useCallback(() => {
    if (edgePanFrameRef.current !== null) cancelAnimationFrame(edgePanFrameRef.current);
    edgePanFrameRef.current = null;
    edgePanLastTimeRef.current = null;
  }, []);

  const cancelPointerGesture = useCallback(() => {
    stopEdgePan();
    const drag = dragRef.current;
    if (drag) {
      setStoredPositions((current) => ({ ...current, ...drag.originalPositions }));
      cameraApiRef.current?.restore(drag.startCamera);
    }
    dragRef.current = null;
    marqueeRef.current = null;
    setMarquee(null);
  }, [stopEdgePan]);

  useEffect(() => stopEdgePan, [stopEdgePan]);

  useEffect(() => {
    let cancelled = false;
    setPositionsWritable(false);
    setFramingItems([]);
    void readProjectPreferenceSafely<unknown>(positionKey).then((result) => {
      if (cancelled || result.kind === 'unavailable') return;
      const raw = result.kind === 'available' ? result.value : null;
      const geometry = normalizeDeskWorldGeometry(raw);
      setStoredPositions(geometry.positions);
      setPositionsWritable(true);
      if (result.kind === 'available' && isLegacyDeskWorldGeometry(raw)) {
        void writeProjectPreference(positionKey, geometry);
      }
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
  cameraApiRef.current = camera;

  const itemKey = itemIds.join('\u0000');
  const visibleItemKey = visibleItemIds.join('\u0000');
  useLayoutEffect(() => {
    const world = workWorldRef.current;
    if (focused || !positionsWritable || !world) return;
    let settleFrame: number | null = null;
    let settleTimeout: ReturnType<typeof setTimeout> | null = null;
    const measureVisibleWork = () => {
      const bounds = world.getBoundingClientRect();
      const next = collectDeskWorldItems({
        tiles: world.querySelectorAll<HTMLElement>('[data-desk-set-object-id]:not([aria-hidden="true"])'),
        bounds,
        projection: { scale: camera.zoom },
        positions,
      });
      setFramingItems((current) => {
        const signature = (items: DeskWorldItemRect[]) => items.map((item) => `${item.id}:${item.x}:${item.y}:${item.width}:${item.height}`).join('|');
        return signature(current) === signature(next) ? current : next;
      });
    };
    const frame = requestAnimationFrame(() => {
      measureVisibleWork();
      settleTimeout = setTimeout(() => {
        settleFrame = requestAnimationFrame(measureVisibleWork);
      }, 180);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (settleFrame !== null) cancelAnimationFrame(settleFrame);
      if (settleTimeout !== null) clearTimeout(settleTimeout);
    };
  }, [camera.zoom, focused, itemKey, positions, positionsWritable, visibleItemKey]);

  const collectWorldItems = useCallback((): DeskWorldItemRect[] => {
    const world = workWorldRef.current;
    if (!world) return [];
    return collectDeskWorldItems({
      tiles: world.querySelectorAll<HTMLElement>('[data-desk-set-object-id]:not([aria-hidden="true"])'),
      bounds: world.getBoundingClientRect(),
      projection: { scale: camera.zoom },
      positions,
    });
  }, [camera.zoom, positions]);

  const persistPositions = useCallback((next: Record<string, DeskWorldPosition>) => {
    if (positionsWritable) void writeProjectPreference(positionKey, { version: DESK_SPATIAL_VERSION, positions: next });
  }, [positionKey, positionsWritable]);

  const processDragPointer = useCallback((drag: DeskDragState, pointer: ClientPoint) => {
    const cameraApi = cameraApiRef.current;
    if (!cameraApi) return false;
    const currentWorld = cameraApi.projectClientPoint(pointer);
    const delta = {
      x: currentWorld.x - drag.startWorld.x,
      y: currentWorld.y - drag.startWorld.y,
    };
    const screenDistance = Math.hypot(
      pointer.clientX - drag.startClient.clientX,
      pointer.clientY - drag.startClient.clientY,
    );
    if (!drag.moved && screenDistance < 5) return false;
    drag.moved = true;
    const moved = moveDeskWorldSelectionWithRebase({
      items: drag.items,
      selectedIds: drag.selectedIds,
      delta,
      snap: snapToGrid ? DEFAULT_DESK_GRID_SIZE_MM : 0,
    });
    drag.latestPositions = moved.positions;
    setStoredPositions((current) => ({ ...current, ...moved.positions }));
    return true;
  }, [snapToGrid]);

  const ensureEdgePanLoop = useCallback(() => {
    if (edgePanFrameRef.current !== null) return;
    edgePanLastTimeRef.current = performance.now();
    const tick = (time: number) => {
      edgePanFrameRef.current = null;
      const drag = dragRef.current;
      const cameraApi = cameraApiRef.current;
      if (!drag || !drag.moved || !cameraApi) {
        edgePanLastTimeRef.current = null;
        return;
      }
      const previous = edgePanLastTimeRef.current ?? time;
      edgePanLastTimeRef.current = time;
      const panned = cameraApi.edgePan(drag.latestClient, Math.max(0, time - previous));
      if (!panned) {
        edgePanLastTimeRef.current = null;
        return;
      }
      processDragPointer(drag, drag.latestClient);
      edgePanFrameRef.current = requestAnimationFrame(tick);
    };
    edgePanFrameRef.current = requestAnimationFrame(tick);
  }, [processDragPointer]);

  const beginDrag = useCallback((itemId: string, event: ReactPointerEvent<HTMLButtonElement>, options: { additive?: boolean } = {}) => {
    if (event.button !== 0) return;
    const startCamera = camera.capture();
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
    const point = { clientX: event.clientX, clientY: event.clientY };
    dragRef.current = {
      itemId,
      pointerId: event.pointerId,
      startClient: point,
      latestClient: point,
      startWorld: camera.projectClientPoint(point),
      startCamera,
      items: liftedItems,
      selectedIds: selected,
      moved: false,
      latestPositions: {},
      originalPositions: Object.fromEntries(authoredItems.map((item) => [item.id, { x: item.x, y: item.y, z: item.z }])),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [camera, onSelectionChange, positions, selectedIds]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.latestClient = { clientX: event.clientX, clientY: event.clientY };
    if (!processDragPointer(drag, drag.latestClient)) return;
    event.preventDefault();
    ensureEdgePanLoop();
  }, [ensureEdgePanLoop, processDragPointer]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.type === 'pointercancel') { cancelPointerGesture(); return; }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    stopEdgePan();
    dragRef.current = null;
    if (!drag.moved) return;
    suppressedActivationRef.current = drag.itemId;
    const next = { ...storedPositions, ...drag.latestPositions };
    setStoredPositions(next);
    persistPositions(next);
  }, [cancelPointerGesture, persistPositions, stopEdgePan, storedPositions]);

  const nudgeSelection = useCallback((delta: { x: number; y: number }) => {
    camera.enterCustom();
    const authoredItems = Object.entries(positions).map(([id, position]) => ({ id, ...position }));
    const moved = moveDeskWorldSelectionWithRebase({
      items: authoredItems,
      selectedIds,
      delta,
      snap: snapToGrid ? DEFAULT_DESK_GRID_SIZE_MM : 0,
    });
    const next = { ...storedPositions, ...moved.positions };
    setStoredPositions(next);
    persistPositions(next);
  }, [camera, persistPositions, positions, selectedIds, snapToGrid, storedPositions]);

  const beginMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>, allowTouch = false) => {
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    if (event.button !== 0 || (event.pointerType === 'touch' && !allowTouch) || (event.target as HTMLElement).closest('button, input, [data-set-object]')) return;
    camera.enterCustom();
    const point = camera.projectClientPoint(event);
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
    const point = camera.projectClientPoint(event);
    setMarquee(rectFromPoints(state.startX, state.startY, point.x, point.y));
  }, [camera]);

  const endMarquee = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = marqueeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const point = camera.projectClientPoint(event);
    const selectedRect = rectFromPoints(state.startX, state.startY, point.x, point.y);
    const hits = getDeskMarqueeSelection(collectWorldItems(), selectedRect);
    const next = Array.from(new Set([...state.additiveIds, ...hits]));
    onSelectionChange(next, hits.at(-1) ?? state.additiveIds.at(-1) ?? null);
    marqueeRef.current = null;
    setMarquee(null);
  }, [camera, collectWorldItems, onSelectionChange]);

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
