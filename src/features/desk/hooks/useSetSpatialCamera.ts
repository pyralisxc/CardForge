"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import { useSpatialGestures, type SpatialPoint as ClientSpatialPoint } from '@/components/ui/spatial-viewport';
import {
  getSpatialEdgePanScreenVelocity,
  projectSpatialScreenToWorld,
  type SpatialCamera2D,
  type SpatialPoint,
  type SpatialRect,
  type SpatialViewportSize,
} from '@/domain/spatial';
import type { CreatorCamera } from '@/features/app-shell/client/environment';

export type SetCameraMode = 'fit-work' | 'fit-selection' | 'whole' | 'custom';

export interface SetCameraSnapshot {
  camera: SpatialCamera2D;
  mode: SetCameraMode;
}

const MIN_ZOOM = 0.04;
const MAX_ZOOM = 4;
const TRAVEL_MS = 220;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function useSetSpatialCamera({
  resetKey,
  disabled,
  viewportRef,
  viewport,
  camera,
  wholeBounds,
  workFrame,
  selectionFrame,
  hasSelection,
  onCameraChange,
  onCancelDrag,
}: {
  resetKey: string;
  disabled: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  viewport: SpatialViewportSize;
  camera: CreatorCamera;
  wholeBounds: SpatialRect;
  workFrame: SpatialCamera2D;
  selectionFrame: SpatialCamera2D;
  hasSelection: boolean;
  onCameraChange: (camera: SpatialCamera2D) => void;
  onCancelDrag?: () => void;
}) {
  const cameraRef = useRef<SpatialCamera2D>(camera);
  cameraRef.current = camera;
  const modeRef = useRef<SetCameraMode>('fit-work');
  const animationRef = useRef<number | null>(null);
  const resetRef = useRef<string | null>(null);
  const [mode, setModeState] = useState<SetCameraMode>('fit-work');

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }, []);

  useEffect(() => stopAnimation, [stopAnimation]);

  const commitCamera = useCallback((next: SpatialCamera2D) => {
    const normalized = {
      x: finite(next.x),
      y: finite(next.y),
      zoom: clamp(finite(next.zoom, 1), MIN_ZOOM, MAX_ZOOM),
    };
    cameraRef.current = normalized;
    onCameraChange(normalized);
  }, [onCameraChange]);

  const setMode = useCallback((next: SetCameraMode) => {
    modeRef.current = next;
    setModeState((current) => current === next ? current : next);
  }, []);

  const animateTo = useCallback((target: SpatialCamera2D, nextMode: SetCameraMode, smooth: boolean) => {
    stopAnimation();
    setMode(nextMode);
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!smooth || reducedMotion) {
      commitCamera(target);
      return;
    }
    const start = { ...cameraRef.current };
    const startedAt = performance.now();
    const frame = (now: number) => {
      const progress = clamp((now - startedAt) / TRAVEL_MS, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      commitCamera({
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
      });
      if (progress < 1) animationRef.current = requestAnimationFrame(frame);
      else animationRef.current = null;
    };
    animationRef.current = requestAnimationFrame(frame);
  }, [commitCamera, setMode, stopAnimation]);

  const semanticTarget = useCallback((requested: Exclude<SetCameraMode, 'custom'>) => {
    if (requested === 'fit-selection' && hasSelection) return { mode: 'fit-selection' as const, camera: selectionFrame };
    if (requested === 'fit-work') return { mode: 'fit-work' as const, camera: workFrame };
    const center = {
      x: wholeBounds.x + wholeBounds.width / 2,
      y: wholeBounds.y + wholeBounds.height / 2,
    };
    return {
      mode: 'whole' as const,
      camera: {
        ...center,
        zoom: Math.min(workFrame.zoom, selectionFrame.zoom || workFrame.zoom),
      },
    };
  }, [hasSelection, selectionFrame, wholeBounds, workFrame]);

  const applyMode = useCallback((requested: Exclude<SetCameraMode, 'custom'>, smooth = true) => {
    const target = semanticTarget(requested);
    animateTo(target.camera, target.mode, smooth);
  }, [animateTo, semanticTarget]);

  useLayoutEffect(() => {
    if (disabled) return;
    if (resetRef.current !== resetKey) {
      resetRef.current = resetKey;
      const target = semanticTarget('fit-work');
      setMode(target.mode);
      commitCamera(target.camera);
      return;
    }
    if (modeRef.current === 'custom') return;
    const target = semanticTarget(modeRef.current);
    setMode(target.mode);
    commitCamera(target.camera);
  }, [commitCamera, disabled, resetKey, semanticTarget, setMode, viewport.width, viewport.height]);

  const enterCustom = useCallback(() => {
    stopAnimation();
    setMode('custom');
  }, [setMode, stopAnimation]);

  const projectClientPoint = useCallback((point: ClientSpatialPoint): SpatialPoint => {
    const node = viewportRef.current;
    if (!node) return { x: cameraRef.current.x, y: cameraRef.current.y };
    const rect = node.getBoundingClientRect();
    return projectSpatialScreenToWorld(
      { x: point.clientX - rect.left, y: point.clientY - rect.top },
      cameraRef.current,
      viewport,
    );
  }, [viewport, viewportRef]);

  const changeZoom = useCallback((nextZoom: number, focalPoint?: ClientSpatialPoint, previousPoint = focalPoint) => {
    const node = viewportRef.current;
    if (!node) return;
    stopAnimation();
    const current = cameraRef.current;
    const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const rect = node.getBoundingClientRect();
    const center = { x: viewport.width / 2, y: viewport.height / 2 };
    const local = focalPoint
      ? { x: focalPoint.clientX - rect.left, y: focalPoint.clientY - rect.top }
      : center;
    const previousLocal = previousPoint
      ? { x: previousPoint.clientX - rect.left, y: previousPoint.clientY - rect.top }
      : local;
    const anchoredWorld = projectSpatialScreenToWorld(previousLocal, current, viewport);
    commitCamera({
      x: anchoredWorld.x - (local.x - center.x) / next,
      y: anchoredWorld.y - (local.y - center.y) / next,
      zoom: next,
    });
    setMode('custom');
  }, [commitCamera, setMode, stopAnimation, viewport, viewportRef]);

  const panByScreen = useCallback((delta: SpatialPoint) => {
    if (delta.x === 0 && delta.y === 0) return;
    stopAnimation();
    const current = cameraRef.current;
    commitCamera({
      x: current.x + finite(delta.x) / current.zoom,
      y: current.y + finite(delta.y) / current.zoom,
      zoom: current.zoom,
    });
    setMode('custom');
  }, [commitCamera, setMode, stopAnimation]);

  const edgePan = useCallback((point: ClientSpatialPoint, elapsedMs: number) => {
    const node = viewportRef.current;
    if (!node) return false;
    const rect = node.getBoundingClientRect();
    const velocity = getSpatialEdgePanScreenVelocity({
      pointer: { x: point.clientX - rect.left, y: point.clientY - rect.top },
      viewport,
      edgeZone: 72,
      maxScreenSpeed: 760,
    });
    if (velocity.x === 0 && velocity.y === 0) return false;
    const seconds = clamp(elapsedMs, 0, 40) / 1000;
    panByScreen({ x: velocity.x * seconds, y: velocity.y * seconds });
    return true;
  }, [panByScreen, viewport, viewportRef]);

  const capture = useCallback((): SetCameraSnapshot => ({
    camera: { ...cameraRef.current },
    mode: modeRef.current,
  }), []);

  const restore = useCallback((snapshot: SetCameraSnapshot) => {
    stopAnimation();
    setMode(snapshot.mode);
    commitCamera(snapshot.camera);
  }, [commitCamera, setMode, stopAnimation]);

  const gestures = useSpatialGestures({
    viewportRef,
    zoom: camera.zoom,
    changeZoom,
    panByScreen,
    cancelDrag: onCancelDrag,
    disabled,
  });

  const fitZoom = workFrame.zoom;
  const relativeZoom = camera.zoom / Math.max(Number.EPSILON, fitZoom);
  const offsetX = viewport.width / 2 - camera.x * camera.zoom;
  const offsetY = viewport.height / 2 - camera.y * camera.zoom;
  const visibleWidth = viewport.width / Math.max(Number.EPSILON, camera.zoom);
  const visibleHeight = viewport.height / Math.max(Number.EPSILON, camera.zoom);
  const minimapViewport = {
    left: clamp((camera.x - visibleWidth / 2 - wholeBounds.x) / Math.max(1, wholeBounds.width), 0, 1),
    top: clamp((camera.y - visibleHeight / 2 - wholeBounds.y) / Math.max(1, wholeBounds.height), 0, 1),
    width: Math.min(1, visibleWidth / Math.max(1, wholeBounds.width)),
    height: Math.min(1, visibleHeight / Math.max(1, wholeBounds.height)),
  };

  const centerOnMinimapPoint = useCallback((point: SpatialPoint) => {
    enterCustom();
    commitCamera({
      ...cameraRef.current,
      x: wholeBounds.x + clamp(point.x, 0, 1) * wholeBounds.width,
      y: wholeBounds.y + clamp(point.y, 0, 1) * wholeBounds.height,
    });
  }, [commitCamera, enterCustom, wholeBounds]);

  return {
    mode,
    camera,
    fitZoom,
    relativeZoom,
    offsetX,
    offsetY,
    minimapViewport,
    showMinimap: mode === 'custom',
    gestures,
    enterCustom,
    changeZoom,
    edgePan,
    projectClientPoint,
    capture,
    restore,
    centerOnMinimapPoint,
    fit: () => applyMode('fit-work'),
    fitSelection: () => applyMode('fit-selection'),
    whole: () => applyMode('whole'),
    canZoomOut: camera.zoom > MIN_ZOOM * 1.001,
  };
}
