"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

export type SpatialPoint = { clientX: number; clientY: number };
type Gesture = { start: SpatialPoint; last: SpatialPoint; mode: 'pending' | 'drag' | 'pan' | 'pinch'; target: HTMLElement };
const pinch = (points: SpatialPoint[]) => ({
  distance: Math.max(1, Math.hypot(points[1].clientX - points[0].clientX, points[1].clientY - points[0].clientY)),
  center: { clientX: (points[0].clientX + points[1].clientX) / 2, clientY: (points[0].clientY + points[1].clientY) / 2 },
});

const originatesInsideViewport = (event: { currentTarget: HTMLElement; target: EventTarget | null }) => (
  event.target instanceof Node && event.currentTarget.contains(event.target)
);

/** Viewports own pan/pinch intent; their existing object handlers own authored moves.
 * Keep touch-action:none on this viewport so the browser cannot cancel a hold or pinch.
 *
 * React portal events still propagate through their component ancestors even though the
 * popup/dialog is not a DOM descendant of the viewport. Spatial ownership is physical:
 * only events whose DOM target is actually inside this viewport may start or suppress a
 * gesture. This keeps menus, dialogs, and tool overlays from being captured as canvas input.
 */
export function useSpatialGestures({ viewportRef, zoom, changeZoom, cancelDrag, disabled = false, allowHold = true }: {
  viewportRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  changeZoom: (zoom: number, point?: SpatialPoint, previousPoint?: SpatialPoint) => void;
  cancelDrag?: () => void;
  disabled?: boolean;
  allowHold?: boolean;
}) {
  const current = useRef({ zoom, changeZoom, cancelDrag, disabled });
  current.current = { zoom, changeZoom, cancelDrag, disabled };
  const points = useRef(new Map<number, SpatialPoint>());
  const gesture = useRef<Gesture | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const initialPinch = useRef<{ distance: number; zoom: number; previousCenter: SpatialPoint } | null>(null);
  const pinchFrame = useRef<number | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    gesture.current?.target.removeAttribute('data-spatial-held');
  };
  const projectPinch = () => {
    if (pinchFrame.current !== null) cancelAnimationFrame(pinchFrame.current);
    pinchFrame.current = null;
    const initial = initialPinch.current;
    if (!initial || points.current.size < 2) return;
    const next = pinch([...points.current.values()]);
    current.current.changeZoom(initial.zoom * next.distance / initial.distance, next.center, initial.previousCenter);
    initial.previousCenter = next.center;
  };

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (current.current.disabled || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      current.current.changeZoom(current.current.zoom * Math.exp(-event.deltaY * 0.006), event);
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  });
  useEffect(() => () => { clearHold(); if (pinchFrame.current !== null) cancelAnimationFrame(pinchFrame.current); }, []);

  const stop = (event: ReactPointerEvent<HTMLDivElement>) => { event.preventDefault(); event.stopPropagation(); };
  return {
    onPointerDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || !originatesInsideViewport(event)) return;
      if (event.pointerType !== 'touch') { suppressClick.current = false; return; }
      const point = { clientX: event.clientX, clientY: event.clientY };
      points.current.set(event.pointerId, point);
      if (points.current.size > 1) {
        clearHold();
        if (gesture.current) gesture.current.mode = 'pinch';
        current.current.cancelDrag?.();
        const initial = pinch([...points.current.values()]);
        initialPinch.current = { distance: initial.distance, zoom: current.current.zoom, previousCenter: initial.center };
        suppressClick.current = true;
        stop(event);
        return;
      }
      suppressClick.current = false;
      const target = (event.target as HTMLElement).closest<HTMLElement>('button[data-artifact-id], button[id^="set-"]') ?? event.currentTarget;
      const immediate = event.currentTarget.dataset.arrangeMode === 'true';
      gesture.current = { start: point, last: point, mode: immediate ? 'drag' : 'pending', target };
      // Descendant object handlers may replace capture to retain their own target.
      target.setPointerCapture(event.pointerId);
      if (allowHold && !immediate) holdTimer.current = setTimeout(() => {
        if (gesture.current?.mode !== 'pending') return;
        gesture.current.mode = 'drag';
        target.setAttribute('data-spatial-held', 'true');
      }, 350);
    },
    onPointerMoveCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || !points.current.has(event.pointerId)) return;
      const point = { clientX: event.clientX, clientY: event.clientY };
      points.current.set(event.pointerId, point);
      const state = gesture.current;
      if (!state) return;
      if (points.current.size > 1) {
        // Both fingers can update before React commits. Project their shared
        // center once per frame instead of applying two half-updated cameras.
        if (pinchFrame.current === null) pinchFrame.current = requestAnimationFrame(projectPinch);
        stop(event);
        return;
      }
      if (state.mode === 'pinch') { stop(event); return; }
      if (state.mode === 'pending' && Math.hypot(point.clientX - state.start.clientX, point.clientY - state.start.clientY) > 8) {
        clearHold();
        state.mode = 'pan';
        current.current.cancelDrag?.();
      }
      if (state.mode === 'pan') {
        event.currentTarget.scrollBy(state.last.clientX - point.clientX, state.last.clientY - point.clientY);
        suppressClick.current = true;
      }
      state.last = point;
      if (state.mode !== 'drag') stop(event);
    },
    onPointerUpCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || !points.current.has(event.pointerId)) return;
      const mode = gesture.current?.mode;
      if (pinchFrame.current !== null) projectPinch();
      clearHold();
      points.current.delete(event.pointerId);
      if (!points.current.size) { gesture.current = null; initialPinch.current = null; }
      if (mode === 'pinch' || mode === 'pan') stop(event);
    },
    onPointerCancelCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!points.current.has(event.pointerId)) return;
      clearHold();
      if (pinchFrame.current !== null) cancelAnimationFrame(pinchFrame.current);
      pinchFrame.current = null;
      initialPinch.current = null;
      points.current.clear();
      gesture.current = null;
      suppressClick.current = true;
      current.current.cancelDrag?.();
      stop(event);
    },
    onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!originatesInsideViewport(event) || !suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (originatesInsideViewport(event) && gesture.current) event.preventDefault();
    },
  };
}
