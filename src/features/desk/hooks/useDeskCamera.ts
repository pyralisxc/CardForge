"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type UIEvent as ReactUIEvent,
} from 'react';
import { useSpatialGestures, type SpatialPoint } from '@/features/card-rendering/client';

import {
  DESK_MAX_ZOOM,
  DESK_MIN_ZOOM,
  DESK_MOBILE_EXPLORATION_ZOOM,
  getDeskCameraGeometry,
} from '../model/deskSpatialGeometry';

export type DeskCamera = ReturnType<typeof getDeskCameraGeometry> & ReturnType<typeof useSpatialGestures> & {
  changeZoom: (nextZoom: number, focalPoint?: { clientX: number; clientY: number }) => void;
  fit: () => void;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
};

const preferredDeskZoom = (viewport: { width: number; height: number }) => {
  const fit = getDeskCameraGeometry(viewport, 1).fitZoom;
  return Math.max(fit, viewport.width < 768 ? DESK_MOBILE_EXPLORATION_ZOOM : 0.85);
};

export function useDeskCamera({
  focused,
  hasItems,
  viewportRef,
  onPinchStart,
}: {
  focused: boolean;
  hasItems: boolean;
  viewportRef: RefObject<HTMLDivElement>;
  onPinchStart?: () => void;
}): DeskCamera {
  const scrollRef = useRef({ left: 0, top: 0 });
  const userZoomedRef = useRef(false);
  const zoomRef = useRef(1);
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  useEffect(() => {
    const grid = viewportRef.current;
    if (!grid || focused) return;
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
  }, [viewportRef, hasItems, focused]);

  useLayoutEffect(() => {
    // The focused Set owns its own camera. Retained off-camera Desk objects
    // can keep this outer scroll range alive, so explicitly leave that camera.
    viewportRef.current?.scrollTo(focused
      ? { left: 0, top: 0 }
      : { left: scrollRef.current.left, top: scrollRef.current.top });
  }, [focused, viewportRef]);

  const geometry = useMemo(() => getDeskCameraGeometry(viewport, zoom), [viewport, zoom]);

  const changeZoom = useCallback((nextZoom: number, focalPoint?: SpatialPoint, previousPoint = focalPoint) => {
    const grid = viewportRef.current;
    const currentZoom = zoomRef.current;
    const next = Math.max(DESK_MIN_ZOOM, Math.min(DESK_MAX_ZOOM, nextZoom));
    userZoomedRef.current = true;
    if (!grid) return;
    const currentGeometry = getDeskCameraGeometry(viewport, currentZoom);
    const nextGeometry = getDeskCameraGeometry(viewport, next);
    const bounds = grid.getBoundingClientRect();
    const localPoint = focalPoint
      ? { x: focalPoint.clientX - bounds.left, y: focalPoint.clientY - bounds.top }
      : { x: grid.clientWidth / 2, y: grid.clientHeight / 2 };
    const worldPoint = {
      x: (grid.scrollLeft + (previousPoint ? previousPoint.clientX - bounds.left : localPoint.x) - currentGeometry.offsetX) / currentZoom,
      y: (grid.scrollTop + (previousPoint ? previousPoint.clientY - bounds.top : localPoint.y) - currentGeometry.offsetY) / currentZoom,
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

  const gestures = useSpatialGestures({ viewportRef, zoom, changeZoom, cancelDrag: onPinchStart, disabled: focused });

  const fit = useCallback(() => {
    const grid = viewportRef.current;
    userZoomedRef.current = true;
    zoomRef.current = geometry.fitZoom;
    scrollRef.current = { left: 0, top: 0 };
    setZoom(geometry.fitZoom);
    requestAnimationFrame(() => grid?.scrollTo({ left: 0, top: 0 }));
  }, [geometry.fitZoom, viewportRef]);

  const onScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    if (focused || event.currentTarget.dataset.focused === 'true') return;
    userZoomedRef.current = true;
    scrollRef.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
  }, [focused]);

  return {
    ...geometry,
    changeZoom,
    fit,
    onScroll,
    ...gestures,
  };
}
