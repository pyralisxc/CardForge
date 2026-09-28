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

import { useSpatialGestures, type SpatialPoint as ClientSpatialPoint } from '@/components/ui/spatial-viewport';
import {
  fitSpatialCameraToRect,
  getSpatialEdgePanScreenVelocity,
  projectSpatialScreenToWorld,
  type SpatialCamera2D,
  type SpatialPoint,
  type SpatialRect,
} from '@/domain/spatial';

import {
  type DeskCameraMode,
  type DeskRect,
  type DeskWorldSize,
} from '../model/deskSpatialGeometry';

const MIN_DESK_ZOOM = 0.04;
const MAX_DESK_ZOOM = 4;
const DESK_FIT_PADDING = 44;
const DESK_WHOLE_PADDING = 24;
const CAMERA_TRAVEL_MS = 240;

const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const close = (a: number, b: number) => Math.abs(a - b) < 0.0001;

const toSpatialRect = (bounds: DeskRect): SpatialRect => ({
  x: bounds.left,
  y: bounds.top,
  width: Math.max(1, bounds.right - bounds.left),
  height: Math.max(1, bounds.bottom - bounds.top),
});

const getWholeRect = (bounds: DeskRect | null, worldSize: DeskWorldSize): SpatialRect => {
  const content = bounds ? toSpatialRect(bounds) : { x: 0, y: 0, width: 1, height: 1 };
  const width = Math.max(Math.max(1, worldSize.width), content.width);
  const height = Math.max(Math.max(1, worldSize.height), content.height);
  const centerX = bounds ? (bounds.left + bounds.right) / 2 : 0;
  const centerY = bounds ? (bounds.top + bounds.bottom) / 2 : 0;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
};

export interface DeskCameraSnapshot {
  camera: SpatialCamera2D;
  mode: DeskCameraMode;
}

export type DeskCamera = ReturnType<typeof useSpatialGestures> & {
  mode: DeskCameraMode;
  x: number;
  y: number;
  zoom: number;
  fitZoom: number;
  relativeZoom: number;
  offsetX: number;
  offsetY: number;
  surfaceWidth: number;
  surfaceHeight: number;
  changeZoom: (nextZoom: number, focalPoint?: ClientSpatialPoint, previousPoint?: ClientSpatialPoint) => void;
  fit: () => void;
  fitSelection: () => void;
  whole: () => void;
  enterCustom: () => void;
  canZoomOut: boolean;
  hasSelectionTarget: boolean;
  showMinimap: boolean;
  minimapViewport: { left: number; top: number; width: number; height: number };
  centerOnMinimapPoint: (point: SpatialPoint) => void;
  projectClientPoint: (point: ClientSpatialPoint) => SpatialPoint;
  edgePan: (point: ClientSpatialPoint, elapsedMs: number) => boolean;
  capture: () => DeskCameraSnapshot;
  restore: (snapshot: DeskCameraSnapshot) => void;
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
  viewportRef: RefObject<HTMLDivElement | null>;
  onPinchStart?: () => void;
}): DeskCamera {
  const viewportStateRef = useRef({ width: 1200, height: 720 });
  const cameraRef = useRef<SpatialCamera2D>({ x: 0, y: 0, zoom: 1 });
  const cameraModeRef = useRef<DeskCameraMode>('fit-work');
  const animationFrameRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });
  const [cameraState, setCameraState] = useState<SpatialCamera2D>(cameraRef.current);
  const [mode, setMode] = useState<DeskCameraMode>('fit-work');

  const cancelCameraAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  useEffect(() => cancelCameraAnimation, [cancelCameraAnimation]);

  const commitCamera = useCallback((next: SpatialCamera2D) => {
    const normalized = {
      x: finite(next.x),
      y: finite(next.y),
      zoom: clamp(finite(next.zoom, 1), MIN_DESK_ZOOM, MAX_DESK_ZOOM),
    };
    cameraRef.current = normalized;
    setCameraState((current) => (
      close(current.x, normalized.x) && close(current.y, normalized.y) && close(current.zoom, normalized.zoom)
        ? current
        : normalized
    ));
  }, []);

  const setCameraMode = useCallback((next: DeskCameraMode) => {
    cameraModeRef.current = next;
    setMode((current) => current === next ? current : next);
  }, []);

  const getSemanticTarget = useCallback((
    requestedMode: Exclude<DeskCameraMode, 'custom'>,
    nextViewport = viewportStateRef.current,
  ) => {
    const wholeRect = getWholeRect(workBounds, worldSize);
    if (requestedMode === 'fit-selection' && selectionBounds) {
      return {
        mode: 'fit-selection' as const,
        camera: fitSpatialCameraToRect({
          bounds: toSpatialRect(selectionBounds),
          viewport: nextViewport,
          padding: DESK_FIT_PADDING,
          minZoom: MIN_DESK_ZOOM,
          maxZoom: MAX_DESK_ZOOM,
        }),
      };
    }
    if (requestedMode === 'fit-work' && hasItems && workBounds) {
      return {
        mode: 'fit-work' as const,
        camera: fitSpatialCameraToRect({
          bounds: toSpatialRect(workBounds),
          viewport: nextViewport,
          padding: DESK_FIT_PADDING,
          minZoom: MIN_DESK_ZOOM,
          maxZoom: MAX_DESK_ZOOM,
        }),
      };
    }
    return {
      mode: 'whole' as const,
      camera: fitSpatialCameraToRect({
        bounds: wholeRect,
        viewport: nextViewport,
        padding: DESK_WHOLE_PADDING,
        minZoom: MIN_DESK_ZOOM,
        maxZoom: MAX_DESK_ZOOM,
      }),
    };
  }, [hasItems, selectionBounds, workBounds, worldSize]);

  const animateCameraTo = useCallback((target: SpatialCamera2D, nextMode: DeskCameraMode, smooth: boolean) => {
    cancelCameraAnimation();
    setCameraMode(nextMode);
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!smooth || reducedMotion) {
      commitCamera(target);
      return;
    }

    const start = { ...cameraRef.current };
    const startedAt = performance.now();
    const frame = (now: number) => {
      const progress = clamp((now - startedAt) / CAMERA_TRAVEL_MS, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      commitCamera({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
      });
      if (progress < 1) animationFrameRef.current = requestAnimationFrame(frame);
      else animationFrameRef.current = null;
    };
    animationFrameRef.current = requestAnimationFrame(frame);
  }, [cancelCameraAnimation, commitCamera, setCameraMode]);

  const applySemanticMode = useCallback((
    requestedMode: Exclude<DeskCameraMode, 'custom'>,
    smooth = false,
  ) => {
    const target = getSemanticTarget(requestedMode);
    animateCameraTo(target.camera, target.mode, smooth);
  }, [animateCameraTo, getSemanticTarget]);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    const update = () => {
      const width = viewportNode.clientWidth;
      const height = viewportNode.clientHeight;
      if (width < 2 || height < 2) return;
      const next = { width, height };
      viewportStateRef.current = next;
      setViewport(next);
      if (!focused && cameraModeRef.current !== 'custom') {
        const semantic = getSemanticTarget(cameraModeRef.current, next);
        setCameraMode(semantic.mode);
        commitCamera(semantic.camera);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewportNode);
    return () => observer.disconnect();
  }, [commitCamera, focused, getSemanticTarget, setCameraMode, viewportRef]);

  useLayoutEffect(() => {
    if (focused || cameraModeRef.current === 'custom') return;
    const semantic = getSemanticTarget(cameraModeRef.current);
    setCameraMode(semantic.mode);
    commitCamera(semantic.camera);
  }, [commitCamera, focused, getSemanticTarget, selectionBounds, setCameraMode, workBounds]);

  const enterCustom = useCallback(() => {
    cancelCameraAnimation();
    setCameraMode('custom');
  }, [cancelCameraAnimation, setCameraMode]);

  const projectClientPoint = useCallback((point: ClientSpatialPoint): SpatialPoint => {
    const node = viewportRef.current;
    const currentViewport = viewportStateRef.current;
    if (!node) return { x: cameraRef.current.x, y: cameraRef.current.y };
    const bounds = node.getBoundingClientRect();
    return projectSpatialScreenToWorld({
      x: point.clientX - bounds.left,
      y: point.clientY - bounds.top,
    }, cameraRef.current, currentViewport);
  }, [viewportRef]);

  const changeZoom = useCallback((
    nextZoom: number,
    focalPoint?: ClientSpatialPoint,
    previousPoint = focalPoint,
  ) => {
    const node = viewportRef.current;
    if (!node) return;
    cancelCameraAnimation();
    const current = cameraRef.current;
    const next = clamp(nextZoom, MIN_DESK_ZOOM, MAX_DESK_ZOOM);
    const currentViewport = viewportStateRef.current;
    const bounds = node.getBoundingClientRect();
    const center = { x: currentViewport.width / 2, y: currentViewport.height / 2 };
    const local = focalPoint
      ? { x: focalPoint.clientX - bounds.left, y: focalPoint.clientY - bounds.top }
      : center;
    const previousLocal = previousPoint
      ? { x: previousPoint.clientX - bounds.left, y: previousPoint.clientY - bounds.top }
      : local;
    const anchoredWorld = projectSpatialScreenToWorld(previousLocal, current, currentViewport);
    commitCamera({
      x: anchoredWorld.x - (local.x - center.x) / next,
      y: anchoredWorld.y - (local.y - center.y) / next,
      zoom: next,
    });
    setCameraMode('custom');
  }, [cancelCameraAnimation, commitCamera, setCameraMode, viewportRef]);

  const panByScreen = useCallback((delta: SpatialPoint) => {
    if (delta.x === 0 && delta.y === 0) return;
    cancelCameraAnimation();
    const current = cameraRef.current;
    commitCamera({
      x: current.x + finite(delta.x) / current.zoom,
      y: current.y + finite(delta.y) / current.zoom,
      zoom: current.zoom,
    });
    setCameraMode('custom');
  }, [cancelCameraAnimation, commitCamera, setCameraMode]);

  const edgePan = useCallback((point: ClientSpatialPoint, elapsedMs: number) => {
    const node = viewportRef.current;
    if (!node) return false;
    const bounds = node.getBoundingClientRect();
    const velocity = getSpatialEdgePanScreenVelocity({
      pointer: { x: point.clientX - bounds.left, y: point.clientY - bounds.top },
      viewport: viewportStateRef.current,
      edgeZone: 72,
      maxScreenSpeed: 760,
    });
    if (velocity.x === 0 && velocity.y === 0) return false;
    const seconds = clamp(elapsedMs, 0, 40) / 1000;
    panByScreen({ x: velocity.x * seconds, y: velocity.y * seconds });
    return true;
  }, [panByScreen, viewportRef]);

  const capture = useCallback((): DeskCameraSnapshot => ({
    camera: { ...cameraRef.current },
    mode: cameraModeRef.current,
  }), []);

  const restore = useCallback((snapshot: DeskCameraSnapshot) => {
    cancelCameraAnimation();
    setCameraMode(snapshot.mode);
    commitCamera(snapshot.camera);
  }, [cancelCameraAnimation, commitCamera, setCameraMode]);

  const gestures = useSpatialGestures({
    viewportRef,
    zoom: cameraState.zoom,
    changeZoom,
    panByScreen,
    cancelDrag: onPinchStart,
    disabled: focused,
  });

  const wholeRect = useMemo(() => getWholeRect(workBounds, worldSize), [workBounds, worldSize]);
  const wholeCamera = useMemo(() => fitSpatialCameraToRect({
    bounds: wholeRect,
    viewport,
    padding: DESK_WHOLE_PADDING,
    minZoom: MIN_DESK_ZOOM,
    maxZoom: MAX_DESK_ZOOM,
  }), [viewport, wholeRect]);
  const fitZoom = wholeCamera.zoom;
  const relativeZoom = cameraState.zoom / Math.max(Number.EPSILON, fitZoom);
  const offsetX = viewport.width / 2 - cameraState.x * cameraState.zoom;
  const offsetY = viewport.height / 2 - cameraState.y * cameraState.zoom;

  const visibleWidth = viewport.width / cameraState.zoom;
  const visibleHeight = viewport.height / cameraState.zoom;
  const minimapViewport = {
    left: clamp((cameraState.x - visibleWidth / 2 - wholeRect.x) / wholeRect.width, 0, 1),
    top: clamp((cameraState.y - visibleHeight / 2 - wholeRect.y) / wholeRect.height, 0, 1),
    width: Math.min(1, visibleWidth / wholeRect.width),
    height: Math.min(1, visibleHeight / wholeRect.height),
  };

  const centerOnMinimapPoint = useCallback((point: SpatialPoint) => {
    enterCustom();
    commitCamera({
      ...cameraRef.current,
      x: wholeRect.x + clamp(point.x, 0, 1) * wholeRect.width,
      y: wholeRect.y + clamp(point.y, 0, 1) * wholeRect.height,
    });
  }, [commitCamera, enterCustom, wholeRect]);

  return {
    ...gestures,
    mode,
    x: cameraState.x,
    y: cameraState.y,
    zoom: cameraState.zoom,
    fitZoom,
    relativeZoom,
    offsetX,
    offsetY,
    surfaceWidth: viewport.width,
    surfaceHeight: viewport.height,
    changeZoom,
    fit: () => applySemanticMode('fit-work', true),
    fitSelection: () => applySemanticMode('fit-selection', true),
    whole: () => applySemanticMode('whole', true),
    enterCustom,
    canZoomOut: cameraState.zoom > MIN_DESK_ZOOM * 1.001,
    hasSelectionTarget: Boolean(selectionBounds),
    showMinimap: mode === 'custom' && hasItems,
    minimapViewport,
    centerOnMinimapPoint,
    projectClientPoint,
    edgePan,
    capture,
    restore,
    onScroll: () => undefined,
  };
}
