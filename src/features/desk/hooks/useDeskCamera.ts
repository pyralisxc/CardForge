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

import { getDeskCameraGeometry } from '../model/deskSpatialGeometry';

export type DeskCamera = ReturnType<typeof getDeskCameraGeometry> & ReturnType<typeof useSpatialGestures> & {
  changeZoom: (nextZoom: number, focalPoint?: { clientX: number; clientY: number }) => void;
  fit: () => void;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
};

type CameraMode = 'fit' | 'custom';

const clampScroll = (value: number, surface: number, viewport: number) => (
  Math.max(0, Math.min(Math.max(0, surface - viewport), value))
);

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
  const viewportStateRef = useRef({ width: 1200, height: 720 });
  const zoomRef = useRef(1);
  const cameraModeRef = useRef<CameraMode>('fit');
  const suppressScrollRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const scrollProgrammatically = useCallback((grid: HTMLDivElement, target: { left: number; top: number }) => {
    suppressScrollRef.current = true;
    scrollRef.current = target;
    grid.scrollTo(target);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    }));
  }, []);

  useEffect(() => {
    const grid = viewportRef.current;
    if (!grid || focused) return;
    const update = () => {
      const next = { width: Math.max(1, grid.clientWidth), height: Math.max(1, grid.clientHeight) };
      const previous = viewportStateRef.current;
      const previousGeometry = getDeskCameraGeometry(previous, zoomRef.current);
      const nextFit = getDeskCameraGeometry(next, 0);
      let nextGeometry = nextFit;
      let target = { left: 0, top: 0 };

      if (cameraModeRef.current === 'custom') {
        nextGeometry = getDeskCameraGeometry(next, nextFit.fitZoom * previousGeometry.relativeZoom);
        const worldCenter = {
          x: (grid.scrollLeft + previous.width / 2 - previousGeometry.offsetX) / previousGeometry.zoom,
          y: (grid.scrollTop + previous.height / 2 - previousGeometry.offsetY) / previousGeometry.zoom,
        };
        target = {
          left: clampScroll(worldCenter.x * nextGeometry.zoom + nextGeometry.offsetX - next.width / 2, nextGeometry.surfaceWidth, next.width),
          top: clampScroll(worldCenter.y * nextGeometry.zoom + nextGeometry.offsetY - next.height / 2, nextGeometry.surfaceHeight, next.height),
        };
      }

      viewportStateRef.current = next;
      zoomRef.current = nextGeometry.zoom;
      setViewport(next);
      setZoom(nextGeometry.zoom);
      requestAnimationFrame(() => scrollProgrammatically(grid, target));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [viewportRef, hasItems, focused, scrollProgrammatically]);

  useLayoutEffect(() => {
    const grid = viewportRef.current;
    if (!grid) return;
    if (focused) scrollProgrammatically(grid, { left: 0, top: 0 });
    else scrollProgrammatically(grid, scrollRef.current);
  }, [focused, viewportRef, scrollProgrammatically]);

  const geometry = useMemo(() => getDeskCameraGeometry(viewport, zoom), [viewport, zoom]);

  const changeZoom = useCallback((nextZoom: number, focalPoint?: SpatialPoint, previousPoint = focalPoint) => {
    const grid = viewportRef.current;
    if (!grid) return;
    const currentViewport = viewportStateRef.current;
    const currentGeometry = getDeskCameraGeometry(currentViewport, zoomRef.current);
    const nextGeometry = getDeskCameraGeometry(currentViewport, nextZoom);
    const bounds = grid.getBoundingClientRect();
    const localPoint = focalPoint
      ? { x: focalPoint.clientX - bounds.left, y: focalPoint.clientY - bounds.top }
      : { x: grid.clientWidth / 2, y: grid.clientHeight / 2 };
    const previousLocalPoint = previousPoint
      ? { x: previousPoint.clientX - bounds.left, y: previousPoint.clientY - bounds.top }
      : localPoint;
    const worldPoint = {
      x: (grid.scrollLeft + previousLocalPoint.x - currentGeometry.offsetX) / currentGeometry.zoom,
      y: (grid.scrollTop + previousLocalPoint.y - currentGeometry.offsetY) / currentGeometry.zoom,
    };
    const target = {
      left: clampScroll(worldPoint.x * nextGeometry.zoom + nextGeometry.offsetX - localPoint.x, nextGeometry.surfaceWidth, currentViewport.width),
      top: clampScroll(worldPoint.y * nextGeometry.zoom + nextGeometry.offsetY - localPoint.y, nextGeometry.surfaceHeight, currentViewport.height),
    };

    cameraModeRef.current = nextGeometry.relativeZoom <= 1.0001 ? 'fit' : 'custom';
    zoomRef.current = nextGeometry.zoom;
    setZoom(nextGeometry.zoom);
    requestAnimationFrame(() => scrollProgrammatically(grid, target));
  }, [viewportRef, scrollProgrammatically]);

  const gestures = useSpatialGestures({ viewportRef, zoom, changeZoom, cancelDrag: onPinchStart, disabled: focused });

  const fit = useCallback(() => {
    const grid = viewportRef.current;
    if (!grid) return;
    const fitted = getDeskCameraGeometry(viewportStateRef.current, 0);
    cameraModeRef.current = 'fit';
    zoomRef.current = fitted.zoom;
    setZoom(fitted.zoom);
    requestAnimationFrame(() => scrollProgrammatically(grid, { left: 0, top: 0 }));
  }, [viewportRef, scrollProgrammatically]);

  const onScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    if (focused || event.currentTarget.dataset.focused === 'true' || suppressScrollRef.current) return;
    cameraModeRef.current = geometry.relativeZoom <= 1.0001 ? 'fit' : 'custom';
    scrollRef.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
  }, [focused, geometry.relativeZoom]);

  return {
    ...geometry,
    changeZoom,
    fit,
    onScroll,
    ...gestures,
  };
}
