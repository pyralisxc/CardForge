"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSpatialGestures, type SpatialPoint } from './useSpatialGestures';

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

export function useArtifactViewport({
  aspectRatio,
  maxWidth = 560,
  horizontalPadding = 96,
  verticalPadding = 96,
}: ArtifactViewportOptions) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
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
    const measureNow = () => {
      const bounds = viewportNode.getBoundingClientRect();
      setViewport({ width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) });
    };
    const measure = () => {
      cancelAnimationFrame(measurementFrame);
      measurementFrame = requestAnimationFrame(measureNow);
    };
    measureNow();
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
    const target = pendingScroll.current;
    pendingScroll.current = null;
    viewportNode.scrollTo(target ?? {
      left: Math.max(0, (worldWidth - viewport.width) / 2),
      top: Math.max(0, (worldHeight - viewport.height) / 2),
      behavior: 'auto',
    });
  }, [aspectRatio, isAutoFit, viewport.height, viewport.width, worldHeight, worldWidth, zoom]);

  const changeZoom = useCallback((nextZoom: number, point?: SpatialPoint, previousPoint = point) => {
    const node = viewportRef.current;
    const next = Math.max(0.2, Math.min(3, nextZoom));
    if (node) {
      const rect = node.getBoundingClientRect();
      const local = point ? { x: point.clientX - rect.left, y: point.clientY - rect.top } : { x: node.clientWidth / 2, y: node.clientHeight / 2 };
      const previous = previousPoint ? { x: previousPoint.clientX - rect.left, y: previousPoint.clientY - rect.top } : local;
      const width = fitWidth * next, height = width * aspect.height / aspect.width;
      const nextWorldWidth = Math.max(viewport.width, width + horizontalPadding);
      const nextWorldHeight = Math.max(viewport.height, height + verticalPadding);
      pendingScroll.current = {
        left: Math.max(0, (node.scrollLeft + previous.x - (worldWidth - visualWidth) / 2) / zoom * next + (nextWorldWidth - width) / 2 - local.x),
        top: Math.max(0, (node.scrollTop + previous.y - (worldHeight - visualHeight) / 2) / zoom * next + (nextWorldHeight - height) / 2 - local.y),
      };
      if (next === zoom) { node.scrollTo(pendingScroll.current); pendingScroll.current = null; }
    }
    setIsAutoFit(false);
    setZoom(next);
  }, [aspect, fitWidth, horizontalPadding, verticalPadding, viewport, worldWidth, worldHeight, visualWidth, visualHeight, zoom]);

  const fit = useCallback(() => {
    setZoom(1);
    setIsAutoFit(true);
  }, []);

  const gestures = useSpatialGestures({ viewportRef, zoom, changeZoom, allowHold: false });

  return {
    changeZoom,
    fit,
    fitWidth,
    isAutoFit,
    gestures,
    viewportRef,
    visualHeight,
    visualWidth,
    worldHeight,
    worldWidth,
    zoom,
  };
}
