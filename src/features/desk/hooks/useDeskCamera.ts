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

import {
  DESK_MAX_ZOOM,
  DESK_MIN_ZOOM,
  DESK_MOBILE_EXPLORATION_ZOOM,
  getDeskCameraGeometry,
} from '../model/deskSpatialGeometry';

export type DeskCamera = ReturnType<typeof getDeskCameraGeometry> & {
  changeZoom: (nextZoom: number) => void;
  fit: () => void;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
};

const preferredDeskZoom = (viewport: { width: number; height: number }) => {
  const fit = getDeskCameraGeometry(viewport, 1).fitZoom;
  return viewport.width < 768 ? Math.max(fit, DESK_MOBILE_EXPLORATION_ZOOM) : fit;
};

export function useDeskCamera({
  focused,
  viewportRef,
}: {
  focused: boolean;
  viewportRef: RefObject<HTMLDivElement>;
}): DeskCamera {
  const scrollRef = useRef({ left: 0, top: 0 });
  const cameraInitializedRef = useRef(false);
  const userZoomedRef = useRef(false);
  const zoomRef = useRef(1);
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
        if (!cameraInitializedRef.current) {
          cameraInitializedRef.current = true;
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

  const changeZoom = useCallback((nextZoom: number) => {
    const grid = viewportRef.current;
    const currentZoom = zoomRef.current;
    const next = Math.max(DESK_MIN_ZOOM, Math.min(DESK_MAX_ZOOM, nextZoom));
    userZoomedRef.current = true;
    if (!grid || Math.abs(next - currentZoom) < 0.001) return;
    const currentGeometry = getDeskCameraGeometry(viewport, currentZoom);
    const nextGeometry = getDeskCameraGeometry(viewport, next);
    const center = {
      x: (grid.scrollLeft + grid.clientWidth / 2 - currentGeometry.offsetX) / currentZoom,
      y: (grid.scrollTop + grid.clientHeight / 2 - currentGeometry.offsetY) / currentZoom,
    };
    setZoom(next);
    requestAnimationFrame(() => {
      grid.scrollTo({
        left: Math.max(0, center.x * next + nextGeometry.offsetX - grid.clientWidth / 2),
        top: Math.max(0, center.y * next + nextGeometry.offsetY - grid.clientHeight / 2),
      });
    });
  }, [viewport, viewportRef]);

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

  return { ...geometry, changeZoom, fit, onScroll };
}
