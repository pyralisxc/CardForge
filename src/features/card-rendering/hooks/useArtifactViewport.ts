"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

interface ArtifactViewportOptions {
  aspectRatio: string | undefined;
  maxWidth?: number;
  horizontalPadding?: number;
  verticalPadding?: number;
}

const readAspectRatio = (value: string | undefined) => {
  const [width, height] = (value ?? '63:88').split(':').map(Number);
  return width > 0 && height > 0 ? { width, height } : { width: 63, height: 88 };
};

const distanceBetween = (points: Array<{ clientX: number; clientY: number }>) => {
  const [first, second] = points;
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
};

export function useArtifactViewport({
  aspectRatio,
  maxWidth = 560,
  horizontalPadding = 96,
  verticalPadding = 96,
}: ArtifactViewportOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchPointersRef = useRef(new Map<number, { clientX: number; clientY: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 900, height: 620 });
  const [zoom, setZoom] = useState(1);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const aspect = useMemo(() => readAspectRatio(aspectRatio), [aspectRatio]);
  const fitWidth = useMemo(() => {
    const horizontalRoom = Math.max(140, viewport.width - horizontalPadding);
    const verticalRoom = Math.max(180, viewport.height - verticalPadding);
    return Math.max(120, Math.min(maxWidth, horizontalRoom, verticalRoom * aspect.width / aspect.height));
  }, [aspect.height, aspect.width, horizontalPadding, maxWidth, verticalPadding, viewport.height, viewport.width]);
  const visualWidth = fitWidth * zoom;
  const visualHeight = visualWidth * aspect.height / aspect.width;
  const worldWidth = Math.max(viewport.width, visualWidth + horizontalPadding);
  const worldHeight = Math.max(viewport.height, visualHeight + verticalPadding);

  useLayoutEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    let measurementFrame = 0;
    const measure = () => {
      cancelAnimationFrame(measurementFrame);
      measurementFrame = requestAnimationFrame(() => {
        const bounds = viewportNode.getBoundingClientRect();
        setViewport({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(measurementFrame);
    const observer = new ResizeObserver(measure);
    observer.observe(viewportNode);
    return () => {
      cancelAnimationFrame(measurementFrame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode) return;
    viewportNode.scrollTo({
      left: Math.max(0, (worldWidth - viewport.width) / 2),
      top: Math.max(0, (worldHeight - viewport.height) / 2),
      behavior: 'auto',
    });
  }, [aspectRatio, viewport.height, viewport.width, worldHeight, worldWidth, zoom]);

  const changeZoom = useCallback((nextZoom: number) => {
    setIsAutoFit(false);
    setZoom(Math.max(0.2, Math.min(3, nextZoom)));
  }, []);

  const fit = useCallback(() => {
    setZoom(1);
    setIsAutoFit(true);
  }, []);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setIsAutoFit(false);
    setZoom((current) => Math.max(0.2, Math.min(3, current * Math.exp(-event.deltaY * 0.006))));
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (touchPointersRef.current.size === 2) {
      pinchRef.current = {
        distance: distanceBetween([...touchPointersRef.current.values()]),
        zoom,
      };
    }
  }, [zoom]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || !touchPointersRef.current.has(event.pointerId)) return;
    touchPointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const pinch = pinchRef.current;
    if (!pinch || touchPointersRef.current.size < 2 || pinch.distance <= 0) return;
    event.preventDefault();
    setIsAutoFit(false);
    const distance = distanceBetween([...touchPointersRef.current.values()]);
    setZoom(Math.max(0.2, Math.min(3, pinch.zoom * distance / pinch.distance)));
  }, []);

  const endPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;
    touchPointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (touchPointersRef.current.size < 2) pinchRef.current = null;
  }, []);

  return {
    changeZoom,
    fit,
    fitWidth,
    isAutoFit,
    onPointerCancel: endPointer,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onWheel,
    viewportRef,
    visualHeight,
    visualWidth,
    worldHeight,
    worldWidth,
    zoom,
  };
}
