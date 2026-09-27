"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { Minus, Plus, Redo2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';
import type { CardFace, CardSetOrganization } from '@/domain/cards';
import { getCardFaceCanvas, getCardPreviewLayout, type DisplayCard } from '@/domain/rendering';
import {
  focusCreatorArtifact,
  selectCreatorArtifacts,
  setCreatorCamera,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';
import { ArtifactSlot, ArtifactThumbnail, CardWatermarkOverlay, getTemplateAccent, useArtifactFaces } from '@/features/card-rendering/client';
import {
  getSpatialAnchoredZoomTarget,
  getSpatialCenteredScroll,
  getSpatialViewportGeometry,
  projectClientPointToSpatialWorld,
  projectSpatialScrollToWorldOrigin,
  scrollSpatialViewportProgrammatically,
  useSpatialGestures,
  type SpatialPoint,
} from '@/components/ui/spatial-viewport';
import { getSpatialOriginCompensatedScroll } from '@/components/ui/spatial-world';

import {
  buildFocusedArtifactLayout,
  getDirectionalArtifactNeighbor,
  getFocusedArtifactFrame,
  getFocusedArtifactFitZoom,
  moveFocusedArtifactSelectionWithRebase,
  projectVisibleArtifacts,
  type ArtifactBrowseDirection,
  type FocusedArtifactLayoutEntry,
} from '../model/focusedArtifactLayout';
import { getCardTitle } from '../model/desk';
import { FocusedArtifactNavigator } from './FocusedArtifactNavigator';
import { FocusedArtifactWorkspace } from './FocusedArtifactWorkspace';
import styles from './Desk.module.css';

interface FocusedSetArtifactSurfaceProps {
  setId: string;
  setName: string;
  allCards: DisplayCard[];
  canExportClean: boolean;
  canUseProjectFiles: boolean;
  groups: Array<[string, DisplayCard[]]>;
  organization: CardSetOrganization;
  session: CreatorInteractionSession;
  setSession: Dispatch<SetStateAction<CreatorInteractionSession>>;
  snapToGrid: boolean;
  showGrid: boolean;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  onFocusArtifact: (nextSession: CreatorInteractionSession) => void;
  onReturnToSet: () => void;
  onEditArtifact: (artifactId: string) => void;
  editingArtifactId: string | null;
  onCancelArtifactEdit: () => void;
  onArtifactEditDirtyChange: (dirty: boolean) => void;
  onSaveArtifact: (card: DisplayCard) => void;
  onDesignArtifact: (card: DisplayCard, face: CardFace) => void;
  onMoveArtifacts: (positions: Record<string, ArtifactPosition>) => void;
}

type DragState = {
  pointerId: number;
  artifactId: string;
  startX: number;
  startY: number;
  selectedIds: string[];
  moved: boolean;
  latestPositions: Record<string, ArtifactPosition>;
  latestAffectedIds: string[];
  latestOriginShift: ArtifactPosition;
  startScroll: { left: number; top: number };
  startCamera: { x: number; y: number; zoom: number };
};

type SpatialHistoryEntry = {
  before: Record<string, ArtifactPosition>;
  after: Record<string, ArtifactPosition>;
  originShift: ArtifactPosition;
};

type SetCameraMode = 'fit-work' | 'fit-selection' | 'whole' | 'custom';

const MAX_SPATIAL_HISTORY = 50;
const ARTIFACT_THUMBNAIL_IMAGE_SCREEN_WIDTH = 32;

const identityFor = (setId: string, card: DisplayCard): ArtifactIdentity => ({
  artifactId: card.uniqueId,
  artifactType: 'card',
  setId,
});

const nearlyEqual = (left: number, right: number) => Math.abs(left - right) < 0.001;

export function FocusedSetArtifactSurface({
  setId,
  setName,
  allCards,
  canExportClean,
  canUseProjectFiles,
  groups,
  organization,
  session,
  setSession,
  snapToGrid,
  showGrid,
  stageRef,
  onFocusArtifact,
  onReturnToSet,
  onEditArtifact,
  editingArtifactId,
  onCancelArtifactEdit,
  onArtifactEditDirtyChange,
  onSaveArtifact,
  onDesignArtifact,
  onMoveArtifacts,
}: FocusedSetArtifactSurfaceProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const suppressedClickRef = useRef<string | null>(null);
  const navigatorReturnArtifactIdRef = useRef<string | null>(null);
  const pendingSpatialFocusIdRef = useRef<string | null>(null);
  const previousArtifactFocusIdRef = useRef<string | null>(session.focusPath.artifactId);
  const fittedSetIdRef = useRef<string | null>(null);
  const cameraModeRef = useRef<SetCameraMode>('fit-work');
  const [cameraMode, setCameraMode] = useState<SetCameraMode>('fit-work');
  const relativeZoomRef = useRef(1);
  const suppressCameraScrollRef = useRef(false);
  const programmaticCameraScrollCancelRef = useRef<(() => void) | null>(null);
  const undoStackRef = useRef<SpatialHistoryEntry[]>([]);
  const redoStackRef = useRef<SpatialHistoryEntry[]>([]);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 520 });
  const [dragPreview, setDragPreview] = useState<Record<string, ArtifactPosition>>({});
  const [navigatorFocusId, setNavigatorFocusId] = useState<string | null>(null);
  const [faces] = useArtifactFaces();
  const [historyRevision, setHistoryRevision] = useState(0);
  const marqueeRef = useRef<{ start: ArtifactPosition; additive: string[] } | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const cardById = useMemo(() => new Map(allCards.map((card) => [card.uniqueId, card])), [allCards]);
  const cardIndexById = useMemo(() => new Map(allCards.map((card, index) => [card.uniqueId, index])), [allCards]);

  const layoutGroups = useMemo(() => groups.map(([label, cards]) => ({
    label,
    artifacts: cards.map((card, index) => ({
      identity: identityFor(setId, card),
      title: getCardTitle(card, cardIndexById.get(card.uniqueId) ?? index),
      subtitle: card.template.name,
      groupLabel: label,
      position: organization.positions[card.uniqueId],
    })),
  })), [cardIndexById, groups, organization.positions, setId]);

  const layout = useMemo(() => buildFocusedArtifactLayout({
    arrangement: organization.arrangement,
    groups: layoutGroups,
    minimumWidth: 960,
    minimumHeight: 640,
  }), [layoutGroups, organization.arrangement]);
  const fitZoom = useMemo(() => getFocusedArtifactFitZoom({
    layout,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  }), [layout, viewportSize.height, viewportSize.width]);
  const relativeZoom = session.camera.zoom / fitZoom;
  const dragWorldSize = useMemo(() => {
    if (Object.keys(dragPreview).length === 0) return { width: layout.width, height: layout.height };
    return layout.entries.reduce((size, entry) => {
      const position = dragPreview[entry.identity.artifactId] ?? entry.position;
      return {
        width: Math.max(size.width, position.x + entry.width + 24),
        height: Math.max(size.height, position.y + entry.height + 30),
      };
    }, { width: layout.width, height: layout.height });
  }, [dragPreview, layout]);
  const scaledWorldWidth = dragWorldSize.width * session.camera.zoom;
  const scaledWorldHeight = dragWorldSize.height * session.camera.zoom;
  const cameraGeometry = useMemo(() => getSpatialViewportGeometry({
    viewport: viewportSize,
    world: { width: layout.width, height: layout.height },
    zoom: session.camera.zoom,
  }), [layout.height, layout.width, session.camera.zoom, viewportSize]);
  const worldOffsetX = cameraGeometry.offsetX;
  const worldOffsetY = cameraGeometry.offsetY;
  const entryById = useMemo(() => new Map(layout.entries.map((entry) => [entry.identity.artifactId, entry])), [layout.entries]);
  const workFrame = useMemo(() => getFocusedArtifactFrame({
    layout,
    entries: layout.entries,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  }), [layout, viewportSize.height, viewportSize.width]);
  const visibleSelectionEntries = useMemo(() => (
    layout.entries.filter((entry) => session.selection.includes(entry.identity.artifactId))
  ), [layout.entries, session.selection]);
  const selectionFrame = useMemo(() => getFocusedArtifactFrame({
    layout,
    entries: visibleSelectionEntries,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  }), [layout, viewportSize.height, viewportSize.width, visibleSelectionEntries]);
  const visibleEntries = useMemo(() => projectVisibleArtifacts(layout, {
    x: session.camera.x,
    y: session.camera.y,
    width: viewportSize.width / session.camera.zoom,
    height: viewportSize.height / session.camera.zoom,
  }), [layout, session.camera, viewportSize]);
  const artifactFocusId = session.focusPath.artifactId;
  const focusedEntry = artifactFocusId ? entryById.get(artifactFocusId) ?? null : null;
  const projectedEntries = focusedEntry && !visibleEntries.includes(focusedEntry) ? [...visibleEntries, focusedEntry] : visibleEntries;
  // Keep the canonical scene renderer for normal Set-sized projections. Large
  // fitted collections use an image-led thumbnail tier instead of erasing the
  // creator's work into generic numbered boxes.
  const useFullPreview = projectedEntries.length <= 160;
  const orderedGroups = useMemo(() => {
    const entriesByGroup = new Map<string, FocusedArtifactLayoutEntry[]>();
    for (const entry of layout.entries) {
      const entries = entriesByGroup.get(entry.groupLabel) ?? [];
      entries.push(entry);
      entriesByGroup.set(entry.groupLabel, entries);
    }
    return layout.groups.map((group) => ({ ...group, entries: entriesByGroup.get(group.label) ?? [] }));
  }, [layout.entries, layout.groups]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    setViewportSize({ width: Math.max(1, viewport.clientWidth), height: Math.max(1, viewport.clientHeight) });
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewportSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (navigatorFocusId && entryById.has(navigatorFocusId)) return;
    setNavigatorFocusId(layout.entries[0]?.identity.artifactId ?? null);
  }, [entryById, layout.entries, navigatorFocusId]);

  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryRevision((current) => current + 1);
  }, [setId]);

  const scrollCameraProgrammatically = useCallback((
    viewport: HTMLDivElement,
    target: { left: number; top: number },
    behavior: ScrollBehavior = 'auto',
  ) => {
    programmaticCameraScrollCancelRef.current?.();
    suppressCameraScrollRef.current = true;
    let cancel = () => {};
    cancel = scrollSpatialViewportProgrammatically({
      viewport,
      target,
      behavior,
      onRelease: () => {
        if (programmaticCameraScrollCancelRef.current !== cancel) return;
        programmaticCameraScrollCancelRef.current = null;
        suppressCameraScrollRef.current = false;
      },
    });
    programmaticCameraScrollCancelRef.current = cancel;
  }, []);

  useEffect(() => () => {
    programmaticCameraScrollCancelRef.current?.();
    programmaticCameraScrollCancelRef.current = null;
  }, []);

  const setSemanticCamera = useCallback((requestedMode: Exclude<SetCameraMode, 'custom'>, behavior: ScrollBehavior = 'auto') => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const effectiveMode = requestedMode === 'fit-selection' && visibleSelectionEntries.length === 0 ? 'fit-work' : requestedMode;
    const frame = effectiveMode === 'whole'
      ? { x: 0, y: 0, zoom: fitZoom }
      : effectiveMode === 'fit-selection'
        ? selectionFrame
        : workFrame;
    const geometry = getSpatialViewportGeometry({
      viewport: viewportSize,
      world: { width: layout.width, height: layout.height },
      zoom: frame.zoom,
    });
    cameraModeRef.current = effectiveMode;
    setCameraMode(effectiveMode);
    relativeZoomRef.current = frame.zoom / fitZoom;
    setSession((current) => (
      nearlyEqual(current.camera.zoom, frame.zoom)
      && nearlyEqual(current.camera.x, frame.x)
      && nearlyEqual(current.camera.y, frame.y)
        ? current
        : setCreatorCamera(current, frame)
    ));
    programmaticCameraScrollCancelRef.current?.();
    programmaticCameraScrollCancelRef.current = null;
    suppressCameraScrollRef.current = true;
    requestAnimationFrame(() => scrollCameraProgrammatically(viewport, {
      left: frame.x * frame.zoom + geometry.offsetX,
      top: frame.y * frame.zoom + geometry.offsetY,
    }, behavior));
  }, [fitZoom, layout.width, layout.height, scrollCameraProgrammatically, selectionFrame, setSession, viewportSize, visibleSelectionEntries.length, workFrame]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || artifactFocusId) return;
    if (fittedSetIdRef.current !== setId) {
      fittedSetIdRef.current = setId;
      cameraModeRef.current = 'fit-work';
      setCameraMode('fit-work');
      relativeZoomRef.current = 1;
    }

    if (cameraModeRef.current !== 'custom') {
      setSemanticCamera(cameraModeRef.current);
      return;
    }

    const customZoom = Math.max(fitZoom, Math.min(Math.max(2, fitZoom * 3), fitZoom * relativeZoomRef.current));
    if (!nearlyEqual(customZoom, session.camera.zoom)) {
      setSession((current) => setCreatorCamera(current, { ...current.camera, zoom: customZoom }));
      return;
    }
    const geometry = getSpatialViewportGeometry({
      viewport: viewportSize,
      world: { width: layout.width, height: layout.height },
      zoom: customZoom,
    });
    scrollCameraProgrammatically(viewport, {
      left: session.camera.x * customZoom + geometry.offsetX,
      top: session.camera.y * customZoom + geometry.offsetY,
    });
    // Physical scroll owns continuous Custom camera motion. React only reprojects
    // the stored camera into the viewport when a structural dependency changes.
  }, [artifactFocusId, fitZoom, layout.height, layout.width, scrollCameraProgrammatically, session.camera.zoom, setId, setSemanticCamera, setSession, viewportSize]);

  useEffect(() => {
    const previousArtifactFocusId = previousArtifactFocusIdRef.current;
    previousArtifactFocusIdRef.current = artifactFocusId;
    if (focusedEntry && pendingSpatialFocusIdRef.current === focusedEntry.identity.artifactId) {
      const artifactId = focusedEntry.identity.artifactId;
      pendingSpatialFocusIdRef.current = null;
      requestAnimationFrame(() => document.getElementById(`spatial-artifact-${artifactId}`)?.focus({ preventScroll: true }));
      return;
    }
    if (!artifactFocusId && previousArtifactFocusId && navigatorReturnArtifactIdRef.current === previousArtifactFocusId) {
      navigatorReturnArtifactIdRef.current = null;
      requestAnimationFrame(() => document.getElementById(`ordered-artifact-${previousArtifactFocusId}`)?.focus());
    }
  }, [artifactFocusId, focusedEntry]);

  const updateSelection = (ids: readonly string[]) => {
    setSession((current) => selectCreatorArtifacts(current, ids));
  };

  const toggleArtifact = (artifactId: string, range: boolean, additive: boolean) => {
    const orderedIds = layout.entries.map((entry) => entry.identity.artifactId);
    if (range && selectionAnchorRef.current) {
      const anchorIndex = orderedIds.indexOf(selectionAnchorRef.current);
      const targetIndex = orderedIds.indexOf(artifactId);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const ids = orderedIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
        updateSelection(additive ? [...session.selection, ...ids] : ids);
        return;
      }
    }
    selectionAnchorRef.current = artifactId;
    updateSelection(!additive ? [artifactId] : session.selection.includes(artifactId)
      ? session.selection.filter((id) => id !== artifactId)
      : [...session.selection, artifactId]);
  };

  const focusArtifact = (artifactId: string, source: 'spatial' | 'navigator' | 'browse' = 'spatial') => {
    const entry = entryById.get(artifactId);
    if (!entry) return;
    const selectedSession = session.selection.includes(artifactId)
      ? session
      : selectCreatorArtifacts(session, [artifactId]);
    if (source === 'navigator') navigatorReturnArtifactIdRef.current = artifactId;
    if (source === 'navigator' || source === 'browse') {
      pendingSpatialFocusIdRef.current = artifactId;
    }
    const viewport = viewportRef.current;
    const sessionAtCurrentCamera = viewport
      ? setCreatorCamera(selectedSession, {
        ...selectedSession.camera,
        x: viewport.scrollLeft / selectedSession.camera.zoom,
        y: viewport.scrollTop / selectedSession.camera.zoom,
      })
      : selectedSession;
    onFocusArtifact(focusCreatorArtifact(sessionAtCurrentCamera, artifactId));
    setNavigatorFocusId(artifactId);
  };

  const browseFocusedArtifact = (direction: ArtifactBrowseDirection) => {
    if (!artifactFocusId) return;
    const neighbor = getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: artifactFocusId, direction });
    if (neighbor) focusArtifact(neighbor.identity.artifactId, 'browse');
  };
  const focusedArtifactDirections = useMemo(() => ({
    up: Boolean(artifactFocusId && getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: artifactFocusId, direction: 'up' })),
    down: Boolean(artifactFocusId && getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: artifactFocusId, direction: 'down' })),
    left: Boolean(artifactFocusId && getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: artifactFocusId, direction: 'left' })),
    right: Boolean(artifactFocusId && getDirectionalArtifactNeighbor({ entries: layout.entries, artifactId: artifactFocusId, direction: 'right' })),
  }), [artifactFocusId, layout.entries]);

  const commitSpatialMove = (
    after: Record<string, ArtifactPosition>,
    artifactIds: readonly string[],
    originShift: ArtifactPosition = { x: 0, y: 0 },
  ) => {
    const before = Object.fromEntries(artifactIds.flatMap((artifactId) => {
      const entry = entryById.get(artifactId);
      return entry ? [[artifactId, entry.position] as const] : [];
    }));
    const historyAfter = Object.fromEntries(artifactIds.flatMap((artifactId) => (
      after[artifactId] ? [[artifactId, after[artifactId]] as const] : []
    )));
    if (Object.keys(before).length === 0 || Object.keys(historyAfter).length === 0) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_SPATIAL_HISTORY - 1)), {
      before,
      after: historyAfter,
      originShift,
    }];
    redoStackRef.current = [];
    setHistoryRevision((current) => current + 1);
    onMoveArtifacts(organization.arrangement === 'manual' ? after : {
      ...Object.fromEntries(layout.entries.map((entry) => [entry.identity.artifactId, entry.position])),
      ...after,
    });
  };

  const compensateCameraForOriginShift = (originShift: ArtifactPosition, direction: 1 | -1 = 1) => {
    if (originShift.x === 0 && originShift.y === 0) return;
    const node = viewportRef.current;
    const delta = { x: originShift.x * direction, y: originShift.y * direction };
    if (node) {
      node.scrollTo(getSpatialOriginCompensatedScroll({
        scroll: { left: node.scrollLeft, top: node.scrollTop },
        originShift: delta,
        zoom: session.camera.zoom,
      }));
    }
    setSession((current) => setCreatorCamera(current, {
      ...current.camera,
      x: Math.max(0, current.camera.x + delta.x),
      y: Math.max(0, current.camera.y + delta.y),
    }));
  };

  const undoSpatialMove = () => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(entry);
    onMoveArtifacts(entry.before);
    compensateCameraForOriginShift(entry.originShift, -1);
    setHistoryRevision((current) => current + 1);
  };

  const redoSpatialMove = () => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(entry);
    onMoveArtifacts(entry.after);
    compensateCameraForOriginShift(entry.originShift, 1);
    setHistoryRevision((current) => current + 1);
  };

  const nudgeSelection = (artifactId: string, delta: ArtifactPosition) => {
    const selectedIds = session.selection.includes(artifactId) ? session.selection : [artifactId];
    updateSelection(selectedIds);
    const moved = moveFocusedArtifactSelectionWithRebase({
      entries: layout.entries,
      selectedIds,
      delta,
      snapToGrid,
    });
    commitSpatialMove(moved.positions, moved.affectedIds, moved.originShift);
    compensateCameraForOriginShift(moved.originShift);
  };

  const beginArtifactMove = (entry: FocusedArtifactLayoutEntry, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    cameraModeRef.current = 'custom';
    setCameraMode('custom');
    suppressedClickRef.current = null;
    const artifactId = entry.identity.artifactId;
    const selectedIds = session.selection.includes(artifactId) ? session.selection : [artifactId];
    dragRef.current = {
      pointerId: event.pointerId,
      artifactId,
      startX: event.clientX,
      startY: event.clientY,
      selectedIds,
      moved: false,
      latestPositions: {},
      latestAffectedIds: selectedIds,
      latestOriginShift: { x: 0, y: 0 },
      startScroll: { left: viewportRef.current?.scrollLeft ?? 0, top: viewportRef.current?.scrollTop ?? 0 },
      startCamera: { ...session.camera },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveArtifact = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = {
      x: (event.clientX - drag.startX) / session.camera.zoom,
      y: (event.clientY - drag.startY) / session.camera.zoom,
    };
    if (!drag.moved && Math.hypot(delta.x, delta.y) < 5) return;
    if (!drag.moved && !session.selection.includes(drag.artifactId)) updateSelection(drag.selectedIds);
    drag.moved = true;
    const moved = moveFocusedArtifactSelectionWithRebase({
      entries: layout.entries,
      selectedIds: drag.selectedIds,
      delta,
      snapToGrid,
    });
    drag.latestPositions = moved.positions;
    drag.latestAffectedIds = moved.affectedIds;
    drag.latestOriginShift = moved.originShift;
    setDragPreview(moved.positions);
    const node = viewportRef.current;
    if (node) {
      const target = getSpatialOriginCompensatedScroll({
        scroll: drag.startScroll,
        originShift: moved.originShift,
        zoom: drag.startCamera.zoom,
      });
      requestAnimationFrame(() => node.scrollTo(target));
    }
    setSession((current) => setCreatorCamera(current, {
      ...current.camera,
      x: drag.startCamera.x + moved.originShift.x,
      y: drag.startCamera.y + moved.originShift.y,
    }));
  };

  const endArtifactMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      suppressedClickRef.current = drag.artifactId;
      commitSpatialMove(drag.latestPositions, drag.latestAffectedIds, drag.latestOriginShift);
    }
    setDragPreview({});
  };

  const cancelArtifactMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const node = viewportRef.current;
    if (node) node.scrollTo(drag.startScroll);
    setSession((current) => setCreatorCamera(current, drag.startCamera));
    setDragPreview({});
  };

  const handleArtifactKey = (artifactId: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const amount = event.shiftKey ? 24 : 4;
    const delta = event.key === 'ArrowLeft' ? { x: -amount, y: 0 }
      : event.key === 'ArrowRight' ? { x: amount, y: 0 }
        : event.key === 'ArrowUp' ? { x: 0, y: -amount }
          : event.key === 'ArrowDown' ? { x: 0, y: amount }
            : null;
    if (delta) {
      event.preventDefault();
      nudgeSelection(artifactId, delta);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      focusArtifact(artifactId);
    }
  };

  const moveNavigatorFocus = (artifactId: string, direction: -1 | 1 | 'first' | 'last') => {
    const currentIndex = layout.entries.findIndex((entry) => entry.identity.artifactId === artifactId);
    const nextIndex = direction === 'first' ? 0
      : direction === 'last' ? layout.entries.length - 1
        : Math.max(0, Math.min(layout.entries.length - 1, currentIndex + direction));
    const nextId = layout.entries[nextIndex]?.identity.artifactId;
    if (!nextId) return;
    setNavigatorFocusId(nextId);
    requestAnimationFrame(() => document.getElementById(`ordered-artifact-${nextId}`)?.focus());
  };

  const moveNavigatorGroup = (artifactId: string, direction: -1 | 1) => {
    const currentGroupIndex = orderedGroups.findIndex((group) => group.entries.some((entry) => entry.identity.artifactId === artifactId));
    const nextGroup = orderedGroups[Math.max(0, Math.min(orderedGroups.length - 1, currentGroupIndex + direction))];
    const nextId = nextGroup?.entries[0]?.identity.artifactId;
    if (!nextId) return;
    setNavigatorFocusId(nextId);
    requestAnimationFrame(() => document.getElementById(`ordered-artifact-${nextId}`)?.focus());
  };

  const semanticScrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' as const : 'smooth' as const;
  const applyFit = () => setSemanticCamera('fit-work', semanticScrollBehavior());
  const applySelectionFit = () => setSemanticCamera('fit-selection', semanticScrollBehavior());
  const applyWhole = () => setSemanticCamera('whole', semanticScrollBehavior());

  const setZoom = (zoom: number, point?: SpatialPoint, previousPoint = point) => {
    const normalized = Math.max(fitZoom, Math.min(Math.max(2, fitZoom * 3), zoom));
    const node = viewportRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const local = point ? { x: point.clientX - rect.left, y: point.clientY - rect.top } : { x: node.clientWidth / 2, y: node.clientHeight / 2 };
    const previous = previousPoint ? { x: previousPoint.clientX - rect.left, y: previousPoint.clientY - rect.top } : local;
    const nextGeometry = getSpatialViewportGeometry({
      viewport: viewportSize,
      world: { width: layout.width, height: layout.height },
      zoom: normalized,
    });
    const target = getSpatialAnchoredZoomTarget({
      scroll: { left: node.scrollLeft, top: node.scrollTop },
      viewport: viewportSize,
      currentGeometry: cameraGeometry,
      nextGeometry,
      focalPoint: local,
      previousFocalPoint: previous,
    });
    cameraModeRef.current = nearlyEqual(normalized, fitZoom) ? 'whole' : 'custom';
    setCameraMode(cameraModeRef.current);
    relativeZoomRef.current = normalized / fitZoom;
    if (normalized === session.camera.zoom) node.scrollTo(target.scroll);
    setSession((current) => setCreatorCamera(current, { ...target.worldOrigin, zoom: normalized }));
  };
  const gestures = useSpatialGestures({ viewportRef, zoom: session.camera.zoom, changeZoom: setZoom, disabled: Boolean(artifactFocusId), cancelDrag: () => {
    dragRef.current = null;
    marqueeRef.current = null;
    setDragPreview({});
    setMarquee(null);
  } });
  const worldPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    return projectClientPointToSpatialWorld(event, node.getBoundingClientRect(), {
      zoom: session.camera.zoom,
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
      offsetX: worldOffsetX,
      offsetY: worldOffsetY,
    });
  };
  const centerSetCamera = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const node = viewportRef.current;
    if (!node) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(layout.width, (event.clientX - bounds.left) / Math.max(1, bounds.width) * layout.width));
    const y = Math.max(0, Math.min(layout.height, (event.clientY - bounds.top) / Math.max(1, bounds.height) * layout.height));
    const scroll = getSpatialCenteredScroll({
      point: { x, y },
      viewport: viewportSize,
      geometry: cameraGeometry,
    });
    const camera = {
      ...projectSpatialScrollToWorldOrigin(scroll, cameraGeometry),
      zoom: session.camera.zoom,
    };
    setSession((current) => setCreatorCamera(current, camera));
    node.scrollTo(scroll);
  };
  const selectionRect = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = marqueeRef.current?.start;
    if (!start) return null;
    const end = worldPoint(event);
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  };

  const focusedCard = focusedEntry ? cardById.get(focusedEntry.identity.artifactId) ?? null : null;
  return (
    <div className={styles.setArtifactWorkspace} data-artifact-focused={Boolean(focusedEntry)} data-artifact-density={layout.density}>
      <div
        className={styles.artifactContextField}
        data-artifact-context-field
        data-surface-authority={focusedEntry ? 'context' : 'primary'}
        aria-hidden={Boolean(focusedEntry)}
        inert={focusedEntry ? true : undefined}
      >
      <p id={`artifact-field-instructions-${setId}`} className="sr-only">Swipe to pan and pinch to zoom. Tap or click a card to select it; double tap, double click, or press Enter to focus it. Hold a card then drag to move it; hold empty space then drag to draw a selection. With a mouse, drag cards to move or empty space to select. Moving a card switches to Freeform. Use Tab to reach visible Artifacts and Arrow keys to move selected Artifacts; hold Shift for a larger step. Open the ordered Artifact navigator to reach every Artifact, including those outside the camera.</p>
      <div
        ref={(node) => { viewportRef.current = node; stageRef.current = node; }}
        tabIndex={-1}
        className={styles.contentStage}
        data-desk-artifact-stage
        data-scene-viewport
        data-arrangement={organization.arrangement}
        data-density={layout.density}
        data-zoom={session.camera.zoom.toFixed(2)}
        data-relative-zoom={relativeZoom.toFixed(2)}
        data-camera-mode={cameraMode}
        data-at-fit={cameraMode !== 'custom'}
        data-grid={showGrid && organization.arrangement === 'manual'}
        data-artifact-focus-exclusive="false"
        aria-label={`${setName} spatial Artifact field`}
        aria-describedby={`artifact-field-instructions-${setId}`}
        data-spatial-history-revision={historyRevision}
        {...gestures}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
          cameraModeRef.current = 'custom';
          setCameraMode('custom');
          marqueeRef.current = { start: worldPoint(event), additive: event.ctrlKey || event.metaKey || event.shiftKey ? session.selection : [] };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => { const rect = selectionRect(event); if (rect) setMarquee(rect); }}
        onPointerUp={(event) => {
          const rect = selectionRect(event), state = marqueeRef.current;
          if (!rect || !state) return;
          const hits = layout.entries.filter((entry) => entry.position.x < rect.x + rect.width && entry.position.x + entry.width > rect.x && entry.position.y < rect.y + rect.height && entry.position.y + entry.height > rect.y).map((entry) => entry.identity.artifactId);
          updateSelection([...new Set([...state.additive, ...hits])]);
          marqueeRef.current = null;
          setMarquee(null);
        }}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== 'z') return;
          event.preventDefault();
          if (event.shiftKey) redoSpatialMove(); else undoSpatialMove();
        }}
        onScroll={(event) => {
          if (suppressCameraScrollRef.current) return;
          cameraModeRef.current = 'custom';
          setCameraMode('custom');
          relativeZoomRef.current = session.camera.zoom / fitZoom;
          const viewport = event.currentTarget;
          const origin = projectSpatialScrollToWorldOrigin({
            left: viewport.scrollLeft,
            top: viewport.scrollTop,
          }, cameraGeometry);
          setSession((current) => setCreatorCamera(current, {
            ...current.camera,
            ...origin,
          }));
        }}
      >
        <div className={styles.artifactWorldSizer} style={{ width: Math.max(viewportSize.width, scaledWorldWidth), height: Math.max(viewportSize.height, scaledWorldHeight) }}>
          <div data-artifact-world className={styles.artifactWorld} style={{ left: worldOffsetX, top: worldOffsetY, width: dragWorldSize.width, height: dragWorldSize.height, transform: `scale(${session.camera.zoom})` }}>
            {marquee ? <span className={styles.deskMarquee} style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} aria-hidden="true" /> : null}
            {organization.arrangement !== 'manual' && organization.groupBy !== 'none' ? layout.groups.map((group) => (
              <div key={group.label} className={styles.artifactGroupLabel} style={{ left: group.x, top: group.y, width: group.width }}><strong>{group.label}</strong><span>{group.count}</span></div>
            )) : null}
            {projectedEntries.map((entry) => {
              const artifactId = entry.identity.artifactId;
              const card = cardById.get(artifactId);
              const position = dragPreview[artifactId] ?? entry.position;
              const selected = session.selection.includes(artifactId);
              if (!card) return null;
              const face = faces[artifactId] ?? 'front';
              const visibleTemplate = face === 'back' && card.backingTemplate ? card.backingTemplate : card.template;
              const previewLayout = getCardPreviewLayout({ targetWidthPx: entry.width - 20, aspectRatio: visibleTemplate.aspectRatio, canvas: getCardFaceCanvas(card, face), isPrintMode: false });
              const previewWidth = (entry.width - 20) * Math.min(1, (entry.height - 64) / previewLayout.visualHeightPx);
              const previewHeight = previewLayout.visualHeightPx * previewWidth / Math.max(1, entry.width - 20);
              const showThumbnailImage = previewWidth * session.camera.zoom >= ARTIFACT_THUMBNAIL_IMAGE_SCREEN_WIDTH;
              return (
                <div
                  key={artifactId}
                  className={styles.artifactTile}
                  style={{ left: position.x, top: position.y, width: entry.width, minHeight: entry.height }}
                  data-card-face={face}
                >
                <button
                  id={`artifact-field-${artifactId}`}
                  type="button"
                  className={styles.cardButton}
                  data-artifact-id={artifactId}
                  data-artifact-type={entry.identity.artifactType}
                  data-focused={session.focusPath.artifactId === artifactId}
                  aria-label={`${entry.title}. ${entry.subtitle}`}
                  aria-pressed={selected}
                  onPointerDown={(event) => beginArtifactMove(entry, event)}
                  onPointerMove={moveArtifact}
                  onPointerUp={endArtifactMove}
                  onPointerCancel={cancelArtifactMove}
                  onLostPointerCapture={cancelArtifactMove}
                  onKeyDown={(event) => handleArtifactKey(artifactId, event)}
                  onDoubleClick={() => focusArtifact(artifactId)}
                  onClick={(event) => {
                    if (suppressedClickRef.current === artifactId) { suppressedClickRef.current = null; return; }
                    if (event.detail >= 2) { focusArtifact(artifactId); return; }
                    toggleArtifact(artifactId, event.shiftKey, event.metaKey || event.ctrlKey);
                  }}
                >
                  {useFullPreview || artifactId === artifactFocusId ? <ArtifactSlot card={card} face={face} width={previewWidth} depth="board" flipLabel={entry.title} setId={setId} watermark={!canExportClean} /> : (
                    <span className={styles.artifactLodPreview} data-artifact-thumbnail={artifactId} aria-hidden="true">
                      <ArtifactThumbnail
                        card={card}
                        face={face}
                        width={previewWidth}
                        height={previewHeight}
                        showImage={showThumbnailImage}
                      />
                      {!canExportClean && showThumbnailImage ? <CardWatermarkOverlay testId={`artifact-thumbnail-watermark-${artifactId}`} /> : null}
                      <span className={styles.artifactLodBorder} data-artifact-template-border style={{ borderColor: getTemplateAccent(visibleTemplate.id ?? visibleTemplate.name) }}>
                        <span className={styles.artifactLodOrdinal}>{entry.index + 1}</span>
                      </span>
                    </span>
                  )}
                  <strong className={styles.artifactTileTitle} title={entry.title}>{entry.title}</strong>
                  <span className={styles.cardTemplateLabel} title={`Card from ${visibleTemplate.name}`}>Card · {visibleTemplate.name}</span>
                  {organization.groupBy !== 'none' ? <small className={styles.cardGroupLabel} title={entry.groupLabel}>{entry.groupLabel}</small> : null}
                </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {cameraMode === 'custom' && (scaledWorldWidth > viewportSize.width + 1 || scaledWorldHeight > viewportSize.height + 1) ? <button
        type="button"
        className={styles.setMinimap}
        aria-label="Set minimap. Choose a point to center the camera."
        onClick={centerSetCamera}
      ><span style={{
        left: `${session.camera.x / Math.max(1, layout.width) * 100}%`,
        top: `${session.camera.y / Math.max(1, layout.height) * 100}%`,
        width: `${Math.min(1, viewportSize.width / session.camera.zoom / Math.max(1, layout.width)) * 100}%`,
        height: `${Math.min(1, viewportSize.height / session.camera.zoom / Math.max(1, layout.height)) * 100}%`,
      }} /></button> : null}
      <div className={styles.cameraControls} data-set-view-controls data-camera-mode={cameraMode} aria-label="Artifact view controls">
        <Button type="button" size="icon" variant="ghost" disabled={relativeZoom <= 1.0001} onClick={() => setZoom(session.camera.zoom - fitZoom * 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
        <span aria-live="polite">{Math.round(relativeZoom * 100)}%</span>
        <Button type="button" size="icon" variant="ghost" onClick={() => setZoom(session.camera.zoom + fitZoom * 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="ghost" aria-pressed={cameraMode === 'fit-work'} onClick={applyFit}>Fit Work</Button>
        <Button type="button" size="sm" variant="ghost" disabled={visibleSelectionEntries.length === 0} aria-pressed={cameraMode === 'fit-selection'} onClick={applySelectionFit}>Selection</Button>
        <Button type="button" size="sm" variant="ghost" aria-pressed={cameraMode === 'whole'} onClick={applyWhole}>Whole Set</Button>
        <Button type="button" size="icon" variant="ghost" disabled={undoStackRef.current.length === 0} onClick={undoSpatialMove} aria-label="Undo Artifact move"><Undo2 aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" disabled={redoStackRef.current.length === 0} onClick={redoSpatialMove} aria-label="Redo Artifact move"><Redo2 aria-hidden="true" /></Button>
        <FocusedArtifactNavigator
          setName={setName}
          entries={layout.entries}
          groups={orderedGroups}
          arrangement={organization.arrangement}
          selection={session.selection}
          navigatorFocusId={navigatorFocusId}
          hidden={Boolean(focusedEntry)}
          onFocusArtifact={(artifactId) => focusArtifact(artifactId, 'navigator')}
          onMoveFocus={moveNavigatorFocus}
          onMoveGroup={moveNavigatorGroup}
          onNudge={nudgeSelection}
          onSetNavigatorFocus={setNavigatorFocusId}
          onToggleArtifact={toggleArtifact}
        />
      </div>
      </div>
      {focusedEntry && focusedCard ? <FocusedArtifactWorkspace
        canExportClean={canExportClean} canUseProjectFiles={canUseProjectFiles}
        key={focusedEntry.identity.artifactId}
        artifactId={focusedEntry.identity.artifactId}
        card={focusedCard}
        setName={setName}
        title={focusedEntry.title}
        subtitle={focusedEntry.subtitle}
        availableDirections={focusedArtifactDirections}
        onBrowse={browseFocusedArtifact}
        onExitFocus={onReturnToSet}
        onEdit={() => onEditArtifact(focusedEntry.identity.artifactId)}
        editing={editingArtifactId === focusedEntry.identity.artifactId}
        onCancelEdit={onCancelArtifactEdit}
        onDirtyChange={onArtifactEditDirtyChange}
        onSave={onSaveArtifact}
        onDesign={onDesignArtifact}
      /> : null}

    </div>
  );
}
