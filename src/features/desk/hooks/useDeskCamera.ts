"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type UIEvent as ReactUIEvent,
} from 'react';

import {
  DESK_MAX_ZOOM,
  DESK_MIN_ZOOM,
  DESK_MOBILE_EXPLORATION_ZOOM,
  getDeskCameraGeometry,
} from '../model/deskSpatialGeometry';

export type DeskCamera = ReturnType<typeof getDeskCameraGeometry> & {
  changeZoom: (nextZoom: number, focalPoint?: { clientX: number; clientY: number }) => void;
  fit: () => void;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
  onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMoveCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUpCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancelCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

type DeskPinchState = { distance: number; zoom: number };

const pinchGeometry = (points: Array<{ x: number; y: number }>) => {
  const [first, second] = points;
  if (!first || !second) return null;
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    focalPoint: { clientX: (first.x + second.x) / 2, clientY: (first.y + second.y) / 2 },
  };
};

const preferredDeskZoom = (viewport: { width: number; height: number }) => {
  const fit = getDeskCameraGeometry(viewport, 1).fitZoom;
  return viewport.width < 768 ? Math.max(fit, DESK_MOBILE_EXPLORATION_ZOOM) : fit;
};

export function useDeskCamera({
  focused,
  viewportRef,
  onPinchStart,
}: {
  focused: boolean;
  viewportRef: RefObject<HTMLDivElement>;
  onPinchStart?: () => void;
}): DeskCamera {
  const scrollRef = useRef({ left: 0, top: 0 });
  const userZoomedRef = useRef(false);
  const zoomRef = useRef(1);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<DeskPinchState | null>(null);
  const suppressedPinchPointersRef = useRef(new Set<number>());
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const grid = viewportRef.current;
    if (!grid) return;
    const update = () => {
      const next = { width: Math.max(1, grid.clientWidth), height: Math.max(1, grid.clientHeight) };
      setViewport(next);
      if (!userZoomedRef.current) {
        const preferredZoom = preferredDeskZoom(next);
        setZoom(preferredZoom);
        const geometry = getDeskCameraGeometry(next, preferredZoom);
        requestAnimationFrame(() => {
          const centered = {
            left: Math.max(0, (geometry.surfaceWidth - grid.clientWidth) / 2),
            top: Math.max(0, (geometry.surfaceHeight - grid.clientHeight) / 2),
          };
          scrollRef.current = centered;
          grid.scrollTo(centered);
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [viewportRef]);

  useLayoutEffect(() => {
    if (focused) return;
    viewportRef.current?.scrollTo({ left: scrollRef.current.left, top: scrollRef.current.top });
  }, [focused, viewportRef]);

  const geometry = useMemo(() => getDeskCameraGeometry(viewport, zoom), [viewport, zoom]);

  const changeZoom = useCallback((nextZoom: number, focalPoint?: { clientX: number; clientY: number }) => {
    const grid = viewportRef.current;
    const currentZoom = zoomRef.current;
    const next = Math.max(DESK_MIN_ZOOM, Math.min(DESK_MAX_ZOOM, nextZoom));
    userZoomedRef.current = true;
    if (!grid || Math.abs(next - currentZoom) < 0.001) return;
    const currentGeometry = getDeskCameraGeometry(viewport, currentZoom);
    const nextGeometry = getDeskCameraGeometry(viewport, next);
    const bounds = grid.getBoundingClientRect();
    const localPoint = focalPoint
      ? { x: focalPoint.clientX - bounds.left, y: focalPoint.clientY - bounds.top }
      : { x: grid.clientWidth / 2, y: grid.clientHeight / 2 };
    const worldPoint = {
      x: (grid.scrollLeft + localPoint.x - currentGeometry.offsetX) / currentZoom,
      y: (grid.scrollTop + localPoint.y - currentGeometry.offsetY) / currentZoom,
    };
    zoomRef.current = next;
    setZoom(next);
    requestAnimationFrame(() => {
      const target = {
        left: Math.max(0, worldPoint.x * next + nextGeometry.offsetX - localPoint.x),
        top: Math.max(0, worldPoint.y * next + nextGeometry.offsetY - localPoint.y),
      };
      scrollRef.current = target;
      grid.scrollTo(target);
    });
  }, [viewport, viewportRef]);

  const onPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pinchGeometry([...touchPointsRef.current.values()]);
    if (!pinch) return;
    pinchRef.current = { distance: pinch.distance, zoom: zoomRef.current };
    suppressedPinchPointersRef.current = new Set(touchPointsRef.current.keys());
    onPinchStart?.();
    event.preventDefault();
    event.stopPropagation();
  }, [onPinchStart]);

  const onPointerMoveCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !touchPointsRef.current.has(event.pointerId)) return;
    touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const initial = pinchRef.current;
    const current = pinchGeometry([...touchPointsRef.current.values()]);
    if (!initial || !current) return;
    suppressedPinchPointersRef.current.add(event.pointerId);
    changeZoom(initial.zoom * current.distance / initial.distance, current.focalPoint);
    event.preventDefault();
    event.stopPropagation();
  }, [changeZoom]);

  const endPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    const suppress = suppressedPinchPointersRef.current.has(event.pointerId);
    touchPointsRef.current.delete(event.pointerId);
    if (touchPointsRef.current.size < 2) pinchRef.current = null;
    if (suppress) {
      event.preventDefault();
      event.stopPropagation();
      suppressedPinchPointersRef.current.delete(event.pointerId);
    }
    if (touchPointsRef.current.size === 0) suppressedPinchPointersRef.current.clear();
  }, []);

  const fit = useCallback(() => {
    const grid = viewportRef.current;
    userZoomedRef.current = true;
    setZoom(geometry.fitZoom);
    requestAnimationFrame(() => grid?.scrollTo({ left: 0, top: 0 }));
  }, [geometry.fitZoom, viewportRef]);

  const onScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    if (focused || event.currentTarget.dataset.focused === 'true') return;
    scrollRef.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
  }, [focused]);

  return {
    ...geometry,
    changeZoom,
    fit,
    onScroll,
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture: endPointerCapture,
    onPointerCancelCapture: endPointerCapture,
  };
}
