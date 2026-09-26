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
import { useSpatialGestures, type SpatialPoint } from '@/components/ui/spatial-viewport';

import {
  DESK_SURFACE_HEIGHT,
  DESK_SURFACE_WIDTH,
  getDeskCameraGeometry,
  getDeskFramingTarget,
  type DeskCameraMode,
  type DeskRect,
} from '../model/deskSpatialGeometry';

export type DeskCamera = ReturnType<typeof getDeskCameraGeometry> & ReturnType<typeof useSpatialGestures> & {
  mode: DeskCameraMode;
  changeZoom: (nextZoom: number, focalPoint?: { clientX: number; clientY: number }) => void;
  fit: () => void;
  fitSelection: () => void;
  whole: () => void;
  enterCustom: () => void;
  canZoomOut: boolean;
  hasSelectionTarget: boolean;
  showMinimap: boolean;
  minimapViewport: { left: number; top: number; width: number; height: number };
  centerOnWorldPoint: (point: { x: number; y: number }) => void;
  onScroll: (event: ReactUIEvent<HTMLDivElement>) => void;
};

const clampScroll = (value: number, surface: number, viewport: number) => (
  Math.max(0, Math.min(Math.max(0, surface - viewport), value))
);

export function useDeskCamera({
  focused,
  hasItems,
  workBounds,
  selectionBounds,
  viewportRef,
  onPinchStart,
}: {
  focused: boolean;
  hasItems: boolean;
  workBounds: DeskRect | null;
  selectionBounds: DeskRect | null;
  viewportRef: RefObject<HTMLDivElement>;
  onPinchStart?: () => void;
}): DeskCamera {
  const scrollRef = useRef({ left: 0, top: 0 });
  const viewportStateRef = useRef({ width: 1200, height: 720 });
  const zoomRef = useRef(1);
  const cameraModeRef = useRef<DeskCameraMode>('fit-work');
  const suppressScrollRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<DeskCameraMode>('fit-work');
  const [scrollPosition, setScrollPosition] = useState({ left: 0, top: 0 });

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const scrollProgrammatically = useCallback((grid: HTMLDivElement, target: { left: number; top: number }, behavior: ScrollBehavior = 'auto') => {
    suppressScrollRef.current = true;
    scrollRef.current = target;
    setScrollPosition(target);
    grid.scrollTo({ ...target, behavior });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      suppressScrollRef.current = false;
    }));
  }, []);

  const getSemanticTarget = useCallback((requestedMode: Exclude<DeskCameraMode, 'custom'>, nextViewport = viewportStateRef.current) => {
    if (requestedMode === 'whole' || !hasItems) {
      return { mode: 'whole' as const, ...getDeskFramingTarget({ viewport: nextViewport, bounds: null }) };
    }
    if (requestedMode === 'fit-selection' && selectionBounds) {
      return { mode: 'fit-selection' as const, ...getDeskFramingTarget({ viewport: nextViewport, bounds: selectionBounds }) };
    }
    return {
      mode: 'fit-work' as const,
      ...getDeskFramingTarget({ viewport: nextViewport, bounds: workBounds }),
    };
  }, [hasItems, selectionBounds, workBounds]);

  const applySemanticMode = useCallback((requestedMode: Exclude<DeskCameraMode, 'custom'>, behavior: ScrollBehavior = 'auto') => {
    const grid = viewportRef.current;
    if (!grid) return;
    const target = getSemanticTarget(requestedMode);
    cameraModeRef.current = target.mode;
    setMode(target.mode);
    zoomRef.current = target.geometry.zoom;
    setZoom(target.geometry.zoom);
    // Suppress layout-driven scroll events immediately. Waiting until the next
    // frame lets a responsive reflow incorrectly turn this semantic camera
    // action back into Custom before the programmatic scroll begins.
    suppressScrollRef.current = true;
    requestAnimationFrame(() => scrollProgrammatically(grid, target.scroll, behavior));
  }, [getSemanticTarget, scrollProgrammatically, viewportRef]);

  useEffect(() => {
    const grid = viewportRef.current;
    if (!grid || focused) return;
    const update = () => {
      const measuredWidth = grid.clientWidth;
      const measuredHeight = grid.clientHeight;
      // Filtering can briefly collapse or detach the viewport during React
      // layout. That is not a real camera resize: accepting it would replace
      // a useful viewport with a 1px fit and leave the Desk reading as 0%.
      if (measuredWidth < 2 || measuredHeight < 2) return;
      const next = { width: measuredWidth, height: measuredHeight };
      const previous = viewportStateRef.current;
      const previousGeometry = getDeskCameraGeometry(previous, zoomRef.current);
      let nextGeometry = getDeskCameraGeometry(next, 0);
      let target = { left: 0, top: 0 };

      if (cameraModeRef.current === 'custom') {
        nextGeometry = getDeskCameraGeometry(next, nextGeometry.fitZoom * previousGeometry.relativeZoom);
        const worldCenter = {
          x: (grid.scrollLeft + previous.width / 2 - previousGeometry.offsetX) / previousGeometry.zoom,
          y: (grid.scrollTop + previous.height / 2 - previousGeometry.offsetY) / previousGeometry.zoom,
        };
        target = {
          left: clampScroll(worldCenter.x * nextGeometry.zoom + nextGeometry.offsetX - next.width / 2, nextGeometry.surfaceWidth, next.width),
          top: clampScroll(worldCenter.y * nextGeometry.zoom + nextGeometry.offsetY - next.height / 2, nextGeometry.surfaceHeight, next.height),
        };
      } else {
        const semantic = getSemanticTarget(cameraModeRef.current, next);
        nextGeometry = semantic.geometry;
        target = semantic.scroll;
        cameraModeRef.current = semantic.mode;
        setMode(semantic.mode);
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
  }, [focused, getSemanticTarget, scrollProgrammatically, viewportRef]);

  useLayoutEffect(() => {
    const grid = viewportRef.current;
    if (!grid) return;
    if (focused) scrollProgrammatically(grid, { left: 0, top: 0 });
    else scrollProgrammatically(grid, scrollRef.current);
  }, [focused, scrollProgrammatically, viewportRef]);

  useLayoutEffect(() => {
    if (focused || cameraModeRef.current === 'custom') return;
    applySemanticMode(cameraModeRef.current);
  }, [applySemanticMode, focused, selectionBounds, workBounds]);

  const geometry = useMemo(() => getDeskCameraGeometry(viewport, zoom), [viewport, zoom]);

  const enterCustom = useCallback(() => {
    if (cameraModeRef.current === 'custom') return;
    cameraModeRef.current = 'custom';
    setMode('custom');
  }, []);

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
    const target = nextGeometry.relativeZoom <= 1.0001 ? { left: 0, top: 0 } : {
      left: clampScroll(worldPoint.x * nextGeometry.zoom + nextGeometry.offsetX - localPoint.x, nextGeometry.surfaceWidth, currentViewport.width),
      top: clampScroll(worldPoint.y * nextGeometry.zoom + nextGeometry.offsetY - localPoint.y, nextGeometry.surfaceHeight, currentViewport.height),
    };

    const nextMode = nextGeometry.relativeZoom <= 1.0001 ? 'whole' : 'custom';
    cameraModeRef.current = nextMode;
    setMode(nextMode);
    zoomRef.current = nextGeometry.zoom;
    setZoom(nextGeometry.zoom);
    requestAnimationFrame(() => scrollProgrammatically(grid, target));
  }, [scrollProgrammatically, viewportRef]);

  const gestures = useSpatialGestures({ viewportRef, zoom, changeZoom, cancelDrag: onPinchStart, disabled: focused });

  const onScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    if (focused || event.currentTarget.dataset.focused === 'true' || suppressScrollRef.current) return;
    const next = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
    cameraModeRef.current = 'custom';
    setMode('custom');
    scrollRef.current = next;
    setScrollPosition(next);
  }, [focused]);

  const centerOnWorldPoint = useCallback((point: { x: number; y: number }) => {
    const grid = viewportRef.current;
    if (!grid) return;
    const current = getDeskCameraGeometry(viewportStateRef.current, zoomRef.current);
    const target = {
      left: clampScroll(point.x * current.zoom + current.offsetX - viewportStateRef.current.width / 2, current.surfaceWidth, viewportStateRef.current.width),
      top: clampScroll(point.y * current.zoom + current.offsetY - viewportStateRef.current.height / 2, current.surfaceHeight, viewportStateRef.current.height),
    };
    enterCustom();
    scrollProgrammatically(grid, target);
  }, [enterCustom, scrollProgrammatically, viewportRef]);

  return {
    ...geometry,
    mode,
    changeZoom,
    fit: () => applySemanticMode('fit-work', 'smooth'),
    fitSelection: () => applySemanticMode('fit-selection', 'smooth'),
    whole: () => applySemanticMode('whole', 'smooth'),
    enterCustom,
    canZoomOut: geometry.relativeZoom > 1.0001,
    hasSelectionTarget: Boolean(selectionBounds),
    showMinimap: mode === 'custom' && (geometry.surfaceWidth > viewport.width + 1 || geometry.surfaceHeight > viewport.height + 1),
    minimapViewport: {
      left: scrollPosition.left / Math.max(1, geometry.surfaceWidth),
      top: scrollPosition.top / Math.max(1, geometry.surfaceHeight),
      width: Math.min(1, viewport.width / Math.max(1, geometry.surfaceWidth)),
      height: Math.min(1, viewport.height / Math.max(1, geometry.surfaceHeight)),
    },
    centerOnWorldPoint,
    onScroll,
    ...gestures,
  };
}

export const deskMinimapPointToWorld = (point: { x: number; y: number }) => ({
  x: Math.max(0, Math.min(1, point.x)) * DESK_SURFACE_WIDTH,
  y: Math.max(0, Math.min(1, point.y)) * DESK_SURFACE_HEIGHT,
});
