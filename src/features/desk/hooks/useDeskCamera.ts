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
  getSpatialAnchoredZoomTarget,
  getSpatialCenteredScroll,
  projectSpatialScrollToWorldOrigin,
  useSpatialGestures,
  type SpatialPoint,
} from '@/components/ui/spatial-viewport';

import {
  getDeskCameraGeometry,
  getDeskFramingTarget,
  type DeskCameraMode,
  type DeskRect,
  type DeskWorldSize,
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


export function useDeskCamera({
  focused,
  hasItems,
  worldSize,
  workBounds,
  selectionBounds,
  viewportRef,
  onPinchStart,
}: {
  focused: boolean;
  hasItems: boolean;
  worldSize: DeskWorldSize;
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
      return { mode: 'whole' as const, ...getDeskFramingTarget({ viewport: nextViewport, world: worldSize, bounds: null }) };
    }
    if (requestedMode === 'fit-selection' && selectionBounds) {
      return { mode: 'fit-selection' as const, ...getDeskFramingTarget({ viewport: nextViewport, world: worldSize, bounds: selectionBounds }) };
    }
    return {
      mode: 'fit-work' as const,
      ...getDeskFramingTarget({ viewport: nextViewport, world: worldSize, bounds: workBounds }),
    };
  }, [hasItems, selectionBounds, workBounds, worldSize]);

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
      const previousGeometry = getDeskCameraGeometry(previous, worldSize, zoomRef.current);
      let nextGeometry = getDeskCameraGeometry(next, worldSize, 0);
      let target = { left: 0, top: 0 };

      if (cameraModeRef.current === 'custom') {
        nextGeometry = getDeskCameraGeometry(next, worldSize, nextGeometry.fitZoom * previousGeometry.relativeZoom);
        target = getSpatialAnchoredZoomTarget({
          scroll: { left: grid.scrollLeft, top: grid.scrollTop },
          viewport: next,
          currentGeometry: previousGeometry,
          nextGeometry,
          focalPoint: { x: next.width / 2, y: next.height / 2 },
          previousFocalPoint: { x: previous.width / 2, y: previous.height / 2 },
        }).scroll;
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
  }, [focused, getSemanticTarget, scrollProgrammatically, viewportRef, worldSize]);

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

  const geometry = useMemo(() => getDeskCameraGeometry(viewport, worldSize, zoom), [viewport, worldSize, zoom]);

  const enterCustom = useCallback(() => {
    if (cameraModeRef.current === 'custom') return;
    cameraModeRef.current = 'custom';
    setMode('custom');
  }, []);

  const changeZoom = useCallback((nextZoom: number, focalPoint?: SpatialPoint, previousPoint = focalPoint) => {
    const grid = viewportRef.current;
    if (!grid) return;
    const currentViewport = viewportStateRef.current;
    const currentGeometry = getDeskCameraGeometry(currentViewport, worldSize, zoomRef.current);
    const nextGeometry = getDeskCameraGeometry(currentViewport, worldSize, nextZoom);
    const bounds = grid.getBoundingClientRect();
    const localPoint = focalPoint
      ? { x: focalPoint.clientX - bounds.left, y: focalPoint.clientY - bounds.top }
      : { x: grid.clientWidth / 2, y: grid.clientHeight / 2 };
    const previousLocalPoint = previousPoint
      ? { x: previousPoint.clientX - bounds.left, y: previousPoint.clientY - bounds.top }
      : localPoint;
    const target = nextGeometry.relativeZoom <= 1.0001
      ? { left: 0, top: 0 }
      : getSpatialAnchoredZoomTarget({
          scroll: { left: grid.scrollLeft, top: grid.scrollTop },
          viewport: currentViewport,
          currentGeometry,
          nextGeometry,
          focalPoint: localPoint,
          previousFocalPoint: previousLocalPoint,
        }).scroll;

    const nextMode = nextGeometry.relativeZoom <= 1.0001 ? 'whole' : 'custom';
    cameraModeRef.current = nextMode;
    setMode(nextMode);
    zoomRef.current = nextGeometry.zoom;
    setZoom(nextGeometry.zoom);
    requestAnimationFrame(() => scrollProgrammatically(grid, target));
  }, [scrollProgrammatically, viewportRef, worldSize]);

  const gestures = useSpatialGestures({ viewportRef, zoom: geometry.zoom, changeZoom, cancelDrag: onPinchStart, disabled: focused });

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
    const current = getDeskCameraGeometry(viewportStateRef.current, worldSize, zoomRef.current);
    const target = getSpatialCenteredScroll({
      point,
      viewport: viewportStateRef.current,
      geometry: current,
    });
    enterCustom();
    scrollProgrammatically(grid, target);
  }, [enterCustom, scrollProgrammatically, viewportRef, worldSize]);

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
    minimapViewport: (() => {
      const origin = projectSpatialScrollToWorldOrigin(scrollPosition, geometry);
      return {
        left: origin.x / Math.max(1, worldSize.width),
        top: origin.y / Math.max(1, worldSize.height),
        width: Math.min(1, viewport.width / geometry.zoom / Math.max(1, worldSize.width)),
        height: Math.min(1, viewport.height / geometry.zoom / Math.max(1, worldSize.height)),
      };
    })(),
    centerOnWorldPoint,
    onScroll,
    ...gestures,
  };
}

export const deskMinimapPointToWorld = (point: { x: number; y: number }, world: DeskWorldSize) => ({
  x: Math.max(0, Math.min(1, point.x)) * Math.max(1, world.width),
  y: Math.max(0, Math.min(1, point.y)) * Math.max(1, world.height),
});
