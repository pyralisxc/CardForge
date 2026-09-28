"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { Minus, Plus, Redo2, RefreshCcw, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';
import type { CardFace, CardSetOrganization } from '@/domain/cards';
import { getCardFaceCanvas, getCardPhysicalSizeMm, getCardPreviewLayout, hasCardBacking, type DisplayCard } from '@/domain/rendering';
import {
  focusCreatorArtifact,
  selectCreatorArtifacts,
  setCreatorCamera,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';
import { ArtifactSlot, ArtifactThumbnail, CardWatermarkOverlay, getTemplateAccent, useArtifactFaces } from '@/features/card-rendering/client';
import {
  buildFocusedArtifactLayout,
  DEFAULT_SET_GRID_SIZE_MM,
  getDirectionalArtifactNeighbor,
  getFocusedArtifactFrame,
  moveFocusedArtifactSelectionWithRebase,
  projectVisibleArtifacts,
  type ArtifactBrowseDirection,
  type FocusedArtifactLayoutEntry,
} from '../model/focusedArtifactLayout';
import { getCardTitle } from '../model/desk';
import { useSetSpatialCamera, type SetCameraSnapshot } from '../hooks/useSetSpatialCamera';
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

type ClientPoint = { clientX: number; clientY: number };

type DragState = {
  pointerId: number;
  artifactId: string;
  startClient: ClientPoint;
  latestClient: ClientPoint;
  startWorld: ArtifactPosition;
  selectedIds: string[];
  moved: boolean;
  latestPositions: Record<string, ArtifactPosition>;
  latestAffectedIds: string[];
  startCamera: SetCameraSnapshot;
};

type SpatialHistoryEntry = {
  before: Record<string, ArtifactPosition>;
  after: Record<string, ArtifactPosition>;
};

const MAX_SPATIAL_HISTORY = 50;
const ARTIFACT_THUMBNAIL_IMAGE_SCREEN_WIDTH = 32;

const identityFor = (setId: string, card: DisplayCard): ArtifactIdentity => ({
  artifactId: card.uniqueId,
  artifactType: 'card',
  setId,
});

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
  const undoStackRef = useRef<SpatialHistoryEntry[]>([]);
  const redoStackRef = useRef<SpatialHistoryEntry[]>([]);
  const edgePanFrameRef = useRef<number | null>(null);
  const edgePanLastTimeRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 520 });
  const [dragPreview, setDragPreview] = useState<Record<string, ArtifactPosition>>({});
  const [navigatorFocusId, setNavigatorFocusId] = useState<string | null>(null);
  const [faces, setFace] = useArtifactFaces();
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
      physicalSizeMm: getCardPhysicalSizeMm(card),
    })),
  })), [cardIndexById, groups, organization.positions, setId]);

  const layout = useMemo(() => buildFocusedArtifactLayout({
    arrangement: organization.arrangement,
    groups: layoutGroups,
    minimumWidth: 160,
    minimumHeight: 120,
  }), [layoutGroups, organization.arrangement]);
  const entryById = useMemo(() => new Map(layout.entries.map((entry) => [entry.identity.artifactId, entry])), [layout.entries]);
  const workFrame = useMemo(() => getFocusedArtifactFrame({
    layout,
    entries: layout.entries,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
  }), [layout, viewportSize.height, viewportSize.width]);
  const wholeFrame = useMemo(() => getFocusedArtifactFrame({
    layout,
    entries: [],
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    padding: 24,
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
  const artifactFocusId = session.focusPath.artifactId;
  const focusedEntry = artifactFocusId ? entryById.get(artifactFocusId) ?? null : null;

  const stopEdgePan = useCallback(() => {
    if (edgePanFrameRef.current !== null) cancelAnimationFrame(edgePanFrameRef.current);
    edgePanFrameRef.current = null;
    edgePanLastTimeRef.current = null;
  }, []);

  const cancelActiveSpatialGesture = useCallback(() => {
    stopEdgePan();
    const drag = dragRef.current;
    if (drag) {
      setSession((current) => setCreatorCamera(current, drag.startCamera.camera));
    }
    dragRef.current = null;
    marqueeRef.current = null;
    setDragPreview({});
    setMarquee(null);
  }, [setSession, stopEdgePan]);

  const setCamera = useCallback((next: { x: number; y: number; zoom: number }) => {
    setSession((current) => setCreatorCamera(current, next));
  }, [setSession]);

  const camera = useSetSpatialCamera({
    resetKey: setId,
    disabled: Boolean(artifactFocusId),
    viewportRef,
    viewport: viewportSize,
    camera: session.camera,
    wholeBounds: layout.bounds,
    wholeFrame,
    workFrame,
    selectionFrame,
    hasSelection: visibleSelectionEntries.length > 0,
    onCameraChange: setCamera,
    onCancelDrag: cancelActiveSpatialGesture,
  });

  const visibleEntries = useMemo(() => projectVisibleArtifacts(layout, {
    x: camera.camera.x - viewportSize.width / camera.camera.zoom / 2,
    y: camera.camera.y - viewportSize.height / camera.camera.zoom / 2,
    width: viewportSize.width / camera.camera.zoom,
    height: viewportSize.height / camera.camera.zoom,
  }), [camera.camera, layout, viewportSize]);
  const visibleArtifactIds = useMemo(
    () => new Set(visibleEntries.map((entry) => entry.identity.artifactId)),
    [visibleEntries],
  );
  // World membership is stable once the Set is opened. Viewport projection may
  // choose a lighter preview tier, but it must never mount/unmount Artifacts or
  // replay their Set-to-Desk entrance as the camera pans.
  const projectedEntries = layout.entries;
  const useFullPreview = layout.entries.length <= 160;
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

  const updateSelection = useCallback((ids: readonly string[]) => {
    setSession((current) => selectCreatorArtifacts(current, ids));
  }, [setSession]);

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
    onFocusArtifact(focusCreatorArtifact(selectedSession, artifactId));
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
    }];
    redoStackRef.current = [];
    setHistoryRevision((current) => current + 1);
    onMoveArtifacts(organization.arrangement === 'manual' ? after : {
      ...Object.fromEntries(layout.entries.map((entry) => [entry.identity.artifactId, entry.position])),
      ...after,
    });
  };

  const undoSpatialMove = () => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(entry);
    onMoveArtifacts(entry.before);
    setHistoryRevision((current) => current + 1);
  };

  const redoSpatialMove = () => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(entry);
    onMoveArtifacts(entry.after);
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
      gridStep: organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM,
    });
    commitSpatialMove(moved.positions, moved.affectedIds);
  };

  const processArtifactDrag = useCallback((drag: DragState, point: ClientPoint) => {
    const world = camera.projectClientPoint(point);
    const delta = {
      x: world.x - drag.startWorld.x,
      y: world.y - drag.startWorld.y,
    };
    const screenDistance = Math.hypot(
      point.clientX - drag.startClient.clientX,
      point.clientY - drag.startClient.clientY,
    );
    if (!drag.moved && screenDistance < 5) return false;
    if (!drag.moved && !session.selection.includes(drag.artifactId)) updateSelection(drag.selectedIds);
    drag.moved = true;
    const moved = moveFocusedArtifactSelectionWithRebase({
      entries: layout.entries,
      selectedIds: drag.selectedIds,
      delta,
      snapToGrid,
      gridStep: organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM,
    });
    drag.latestPositions = moved.positions;
    drag.latestAffectedIds = moved.affectedIds;
    setDragPreview(moved.positions);
    return true;
  }, [camera, layout.entries, organization.gridSizeMm, session.selection, snapToGrid, updateSelection]);

  const ensureEdgePanLoop = useCallback(() => {
    if (edgePanFrameRef.current !== null) return;
    edgePanLastTimeRef.current = performance.now();
    const tick = (time: number) => {
      edgePanFrameRef.current = null;
      const drag = dragRef.current;
      if (!drag || !drag.moved) {
        edgePanLastTimeRef.current = null;
        return;
      }
      const previous = edgePanLastTimeRef.current ?? time;
      edgePanLastTimeRef.current = time;
      if (!camera.edgePan(drag.latestClient, Math.max(0, time - previous))) {
        edgePanLastTimeRef.current = null;
        return;
      }
      processArtifactDrag(drag, drag.latestClient);
      edgePanFrameRef.current = requestAnimationFrame(tick);
    };
    edgePanFrameRef.current = requestAnimationFrame(tick);
  }, [camera, processArtifactDrag]);

  const beginArtifactMove = (entry: FocusedArtifactLayoutEntry, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const startCamera = camera.capture();
    camera.enterCustom();
    suppressedClickRef.current = null;
    const artifactId = entry.identity.artifactId;
    selectionAnchorRef.current = artifactId;
    const selectedIds = session.selection.includes(artifactId) ? session.selection : [artifactId];
    const point = { clientX: event.clientX, clientY: event.clientY };
    dragRef.current = {
      pointerId: event.pointerId,
      artifactId,
      startClient: point,
      latestClient: point,
      startWorld: camera.projectClientPoint(point),
      selectedIds,
      moved: false,
      latestPositions: {},
      latestAffectedIds: selectedIds,
      startCamera,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveArtifact = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.latestClient = { clientX: event.clientX, clientY: event.clientY };
    if (!processArtifactDrag(drag, drag.latestClient)) return;
    event.preventDefault();
    ensureEdgePanLoop();
  };

  const endArtifactMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    stopEdgePan();
    dragRef.current = null;
    if (drag.moved) {
      suppressedClickRef.current = drag.artifactId;
      commitSpatialMove(drag.latestPositions, drag.latestAffectedIds);
    }
    setDragPreview({});
  };

  const cancelArtifactMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    stopEdgePan();
    dragRef.current = null;
    camera.restore(drag.startCamera);
    setDragPreview({});
  };

  const handleArtifactKey = (artifactId: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const amount = event.shiftKey ? (organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM) : 1;
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

  const selectionRect = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = marqueeRef.current?.start;
    if (!start) return null;
    const end = camera.projectClientPoint(event);
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
        data-set-spatial-stage
        data-scene-viewport
        data-arrangement={organization.arrangement}
        data-density={layout.density}
        data-zoom={camera.camera.zoom.toFixed(2)}
        data-relative-zoom={camera.relativeZoom.toFixed(2)}
        data-camera-mode={camera.mode}
        data-camera-x={camera.camera.x.toFixed(3)}
        data-camera-y={camera.camera.y.toFixed(3)}
        data-at-fit={camera.mode !== 'custom'}
        data-grid={showGrid && organization.arrangement === 'manual'}
        style={{
          '--artifact-grid-step': `${(organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM) * camera.camera.zoom}px`,
          '--artifact-grid-origin-x': `${camera.offsetX}px`,
          '--artifact-grid-origin-y': `${camera.offsetY}px`,
        } as CSSProperties}
        data-artifact-focus-exclusive="false"
        aria-label={`${setName} spatial Artifact field`}
        aria-describedby={`artifact-field-instructions-${setId}`}
        data-spatial-history-revision={historyRevision}
        {...camera.gestures}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
          camera.enterCustom();
          marqueeRef.current = { start: camera.projectClientPoint(event), additive: event.ctrlKey || event.metaKey || event.shiftKey ? session.selection : [] };
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
      >
        <div className={styles.artifactWorldSizer} style={{ width: viewportSize.width, height: viewportSize.height }}>
          <div data-artifact-world className={styles.artifactWorld} style={{ left: 0, top: 0, width: 1, height: 1, transform: `translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.camera.zoom})` }}>
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
              const previewLayout = getCardPreviewLayout({ targetWidthPx: entry.contentWidth, aspectRatio: visibleTemplate.aspectRatio, canvas: getCardFaceCanvas(card, face), isPrintMode: false });
              const previewWidth = entry.contentWidth * Math.min(1, entry.contentHeight / previewLayout.visualHeightPx);
              const previewHeight = previewLayout.visualHeightPx * previewWidth / Math.max(1, entry.contentWidth);
              const showThumbnailImage = visibleArtifactIds.has(artifactId)
                && previewWidth * camera.camera.zoom >= ARTIFACT_THUMBNAIL_IMAGE_SCREEN_WIDTH;
              return (
                <div
                  key={artifactId}
                  className={styles.artifactTile}
                  style={{ left: position.x, top: position.y, width: entry.width, minHeight: entry.height }}
                  data-card-face={face}
                  data-selected={selected ? 'true' : 'false'}
                  data-selection-anchor={selected && (selectionAnchorRef.current ?? session.selection[0]) === artifactId ? 'true' : 'false'}
                  data-dragging={dragPreview[artifactId] ? 'true' : 'false'}
                >
                <button
                  id={`artifact-field-${artifactId}`}
                  type="button"
                  className={styles.cardButton}
                  data-artifact-id={artifactId}
                  data-artifact-type={entry.identity.artifactType}
                  data-viewport-visible={visibleArtifactIds.has(artifactId) ? 'true' : 'false'}
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
                  {useFullPreview || artifactId === artifactFocusId ? <ArtifactSlot card={card} face={face} width={previewWidth} depth="board" setId={setId} watermark={!canExportClean} /> : (
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
                {hasCardBacking(card) ? <button
                  type="button"
                  className={styles.deskTileFlip}
                  onClick={() => setFace(artifactId, face === 'front' ? 'back' : 'front')}
                  aria-label={`Show ${face === 'front' ? 'back' : 'front'} of ${entry.title}`}
                  title={`Show ${face === 'front' ? 'back' : 'front'}`}
                ><RefreshCcw size={15} aria-hidden="true" /></button> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {camera.showMinimap ? <button
        type="button"
        className={styles.setMinimap}
        aria-label="Set minimap. Choose a point to center the camera."
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          camera.centerOnMinimapPoint({
            x: (event.clientX - bounds.left) / Math.max(1, bounds.width),
            y: (event.clientY - bounds.top) / Math.max(1, bounds.height),
          });
        }}
      ><span style={{
        left: `${camera.minimapViewport.left * 100}%`,
        top: `${camera.minimapViewport.top * 100}%`,
        width: `${camera.minimapViewport.width * 100}%`,
        height: `${camera.minimapViewport.height * 100}%`,
      }} /></button> : null}
      <div className={styles.cameraControls} data-set-view-controls data-camera-mode={camera.mode} aria-label="Artifact view controls">
        <Button type="button" size="icon" variant="ghost" disabled={camera.relativeZoom <= 1.0001} onClick={() => camera.changeZoom(camera.camera.zoom - camera.fitZoom * 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
        <span aria-live="polite">{Math.round(camera.relativeZoom * 100)}%</span>
        <Button type="button" size="icon" variant="ghost" onClick={() => camera.changeZoom(camera.camera.zoom + camera.fitZoom * 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="ghost" aria-pressed={camera.mode === 'fit-work'} onClick={camera.fit}>Fit Work</Button>
        <Button type="button" size="sm" variant="ghost" disabled={visibleSelectionEntries.length === 0} aria-pressed={camera.mode === 'fit-selection'} onClick={camera.fitSelection}>Selection</Button>
        <Button type="button" size="sm" variant="ghost" aria-pressed={camera.mode === 'whole'} onClick={camera.whole}>Whole Set</Button>
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
