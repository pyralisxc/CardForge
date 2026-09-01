"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { Minus, Pencil, Plus, Redo2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';
import type { CardSetOrganization } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  focusCreatorArtifact,
  selectCreatorArtifacts,
  setCreatorCamera,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';
import { CardPreview } from '@/features/card-rendering/client';

import {
  buildFocusedArtifactLayout,
  moveFocusedArtifactSelection,
  projectVisibleArtifacts,
  type FocusedArtifactLayoutEntry,
} from '../model/focusedArtifactLayout';
import { getCardTitle } from '../model/homeDesk';
import { FocusedArtifactNavigator } from './FocusedArtifactNavigator';
import styles from './HomeDesk.module.css';

interface FocusedSetArtifactSurfaceProps {
  setId: string;
  setName: string;
  allCards: DisplayCard[];
  groups: Array<[string, DisplayCard[]]>;
  organization: CardSetOrganization;
  session: CreatorInteractionSession;
  setSession: Dispatch<SetStateAction<CreatorInteractionSession>>;
  snapToGrid: boolean;
  showGrid: boolean;
  stageRef: MutableRefObject<HTMLDivElement | null>;
  onFocusArtifact: (nextSession: CreatorInteractionSession) => void;
  onEditArtifact: (artifactId: string) => void;
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
};

type SpatialHistoryEntry = {
  before: Record<string, ArtifactPosition>;
  after: Record<string, ArtifactPosition>;
};

const MAX_SPATIAL_HISTORY = 50;

const identityFor = (setId: string, card: DisplayCard): ArtifactIdentity => ({
  artifactId: card.uniqueId,
  artifactType: 'card',
  setId,
});

export function FocusedSetArtifactSurface({
  setId,
  setName,
  allCards,
  groups,
  organization,
  session,
  setSession,
  snapToGrid,
  showGrid,
  stageRef,
  onFocusArtifact,
  onEditArtifact,
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
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 520 });
  const [dragPreview, setDragPreview] = useState<Record<string, ArtifactPosition>>({});
  const [navigatorFocusId, setNavigatorFocusId] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
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
    minimumWidth: Math.max(960, viewportSize.width / session.camera.zoom),
  }), [layoutGroups, organization.arrangement, session.camera.zoom, viewportSize.width]);
  const entryById = useMemo(() => new Map(layout.entries.map((entry) => [entry.identity.artifactId, entry])), [layout.entries]);
  const visibleEntries = useMemo(() => projectVisibleArtifacts(layout, {
    x: session.camera.x,
    y: session.camera.y,
    width: viewportSize.width / session.camera.zoom,
    height: viewportSize.height / session.camera.zoom,
  }), [layout, session.camera, viewportSize]);
  const artifactFocusId = session.focusPath.artifactId;
  const focusedEntry = artifactFocusId ? entryById.get(artifactFocusId) ?? null : null;
  const projectedEntries = focusedEntry ? [focusedEntry] : visibleEntries;
  const useDetailedPreview = session.camera.zoom >= 0.55 && projectedEntries.length <= 160;
  const orderedGroups = useMemo(() => {
    const entriesByGroup = new Map<string, FocusedArtifactLayoutEntry[]>();
    for (const entry of layout.entries) {
      const entries = entriesByGroup.get(entry.groupLabel) ?? [];
      entries.push(entry);
      entriesByGroup.set(entry.groupLabel, entries);
    }
    return layout.groups.map((group) => ({ ...group, entries: entriesByGroup.get(group.label) ?? [] }));
  }, [layout.entries, layout.groups]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
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
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      left: session.camera.x * session.camera.zoom,
      top: session.camera.y * session.camera.zoom,
      behavior: 'auto',
    });
  }, [artifactFocusId, session.camera.x, session.camera.y, session.camera.zoom]);

  useEffect(() => {
    if (!focusedEntry || session.camera.x !== 0 || session.camera.y !== 0 || session.camera.zoom !== 1) return;
    const zoom = Math.max(
      1,
      Math.min(
        2,
        viewportSize.width * 0.62 / focusedEntry.width,
        viewportSize.height * 0.72 / focusedEntry.height,
      ),
    );
    const x = Math.max(0, focusedEntry.position.x - viewportSize.width / zoom / 2 + focusedEntry.width / 2);
    const y = Math.max(0, focusedEntry.position.y - viewportSize.height / zoom / 2 + focusedEntry.height / 2);
    if (x === 0 && y === 0 && zoom === 1) return;
    setSession((current) => (
      current.focusPath.artifactId === focusedEntry.identity.artifactId
      && current.camera.x === 0
      && current.camera.y === 0
      && current.camera.zoom === 1
        ? setCreatorCamera(current, { x, y, zoom })
        : current
    ));
  }, [focusedEntry, session.camera.x, session.camera.y, session.camera.zoom, setSession, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    const previousArtifactFocusId = previousArtifactFocusIdRef.current;
    previousArtifactFocusIdRef.current = artifactFocusId;
    if (focusedEntry && pendingSpatialFocusIdRef.current === focusedEntry.identity.artifactId) {
      const artifactId = focusedEntry.identity.artifactId;
      pendingSpatialFocusIdRef.current = null;
      requestAnimationFrame(() => document.getElementById(`spatial-artifact-${artifactId}`)?.focus());
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
    updateSelection(session.selection.includes(artifactId)
      ? session.selection.filter((id) => id !== artifactId)
      : additive ? [...session.selection, artifactId] : [...session.selection, artifactId]);
  };

  const focusArtifact = (artifactId: string, source: 'spatial' | 'navigator' = 'spatial') => {
    const entry = entryById.get(artifactId);
    if (!entry) return;
    const fitZoom = Math.min(
      2,
      viewportSize.width * 0.62 / entry.width,
      viewportSize.height * 0.72 / entry.height,
    );
    const zoom = Math.min(2, Math.max(session.camera.zoom, fitZoom));
    const x = Math.max(0, entry.position.x - viewportSize.width / zoom / 2 + entry.width / 2);
    const y = Math.max(0, entry.position.y - viewportSize.height / zoom / 2 + entry.height / 2);
    const selectedSession = session.selection.includes(artifactId)
      ? session
      : selectCreatorArtifacts(session, [artifactId]);
    if (source === 'navigator') {
      navigatorReturnArtifactIdRef.current = artifactId;
      pendingSpatialFocusIdRef.current = artifactId;
    }
    onFocusArtifact(setCreatorCamera(focusCreatorArtifact(selectedSession, artifactId), { x, y, zoom }));
    setNavigatorFocusId(artifactId);
  };

  const commitSpatialMove = (after: Record<string, ArtifactPosition>, artifactIds: readonly string[]) => {
    const before = Object.fromEntries(artifactIds.flatMap((artifactId) => {
      const entry = entryById.get(artifactId);
      return entry ? [[artifactId, entry.position] as const] : [];
    }));
    if (Object.keys(before).length === 0 || Object.keys(after).length === 0) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_SPATIAL_HISTORY - 1)), { before, after }];
    redoStackRef.current = [];
    setHistoryRevision((current) => current + 1);
    onMoveArtifacts(after);
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
    if (organization.arrangement !== 'manual') return;
    const selectedIds = session.selection.includes(artifactId) ? session.selection : [artifactId];
    updateSelection(selectedIds);
    commitSpatialMove(moveFocusedArtifactSelection({
      entries: layout.entries,
      selectedIds,
      delta,
      snapToGrid,
    }), selectedIds);
  };

  const beginArtifactMove = (entry: FocusedArtifactLayoutEntry, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (organization.arrangement !== 'manual' || event.button !== 0) return;
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
    const nextPositions = moveFocusedArtifactSelection({
      entries: layout.entries,
      selectedIds: drag.selectedIds,
      delta,
      snapToGrid,
    });
    drag.latestPositions = nextPositions;
    setDragPreview(nextPositions);
  };

  const endArtifactMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      suppressedClickRef.current = drag.artifactId;
      commitSpatialMove(drag.latestPositions, drag.selectedIds);
    }
    setDragPreview({});
  };

  const cancelArtifactMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragPreview({});
  };

  const handleArtifactKey = (artifactId: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const amount = event.shiftKey ? 24 : 4;
    const delta = event.key === 'ArrowLeft' ? { x: -amount, y: 0 }
      : event.key === 'ArrowRight' ? { x: amount, y: 0 }
        : event.key === 'ArrowUp' ? { x: 0, y: -amount }
          : event.key === 'ArrowDown' ? { x: 0, y: amount }
            : null;
    if (delta && organization.arrangement === 'manual') {
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

  const setZoom = (zoom: number) => {
    const normalized = Math.max(0.2, Math.min(2, zoom));
    setSession((current) => setCreatorCamera(current, { ...current.camera, zoom: normalized }));
  };

  return (
    <>
      <p id={`artifact-field-instructions-${setId}`} className="sr-only">Use Tab to reach visible Artifacts. In Freeform view, use Arrow keys to move the selected Artifacts and hold Shift for a larger step. Open the ordered Artifact navigator to reach every Artifact, including those outside the camera.</p>
      <div className={styles.cameraControls} aria-label="Artifact view controls">
        <Button type="button" size="icon" variant="ghost" onClick={() => setZoom(session.camera.zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
        <span aria-live="polite">{Math.round(session.camera.zoom * 100)}%</span>
        <Button type="button" size="icon" variant="ghost" onClick={() => setZoom(session.camera.zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => {
          setSession((current) => setCreatorCamera(current, { x: 0, y: 0, zoom: 1 }));
          viewportRef.current?.scrollTo({
            left: 0,
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          });
        }}>Reset view</Button>
        <Button type="button" size="icon" variant="ghost" disabled={undoStackRef.current.length === 0} onClick={undoSpatialMove} aria-label="Undo Artifact move"><Undo2 aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" disabled={redoStackRef.current.length === 0} onClick={redoSpatialMove} aria-label="Redo Artifact move"><Redo2 aria-hidden="true" /></Button>
        <span>{projectedEntries.length} of {layout.entries.length} visuals mounted</span>
      </div>
      {focusedEntry ? <div className={styles.artifactFocusBar} role="status">
        <span><strong>{focusedEntry.title}</strong> · Exclusive Artifact focus</span>
        <Button type="button" size="sm" variant="outline" onClick={() => onEditArtifact(focusedEntry.identity.artifactId)}><Pencil className="mr-1.5 h-4 w-4" />Edit Artifact</Button>
      </div> : null}
      <div
        ref={(node) => { viewportRef.current = node; stageRef.current = node; }}
        tabIndex={-1}
        className={styles.contentStage}
        data-home-artifact-stage
        data-arrangement={organization.arrangement}
        data-grid={showGrid && organization.arrangement === 'manual'}
        data-artifact-focus-exclusive={Boolean(focusedEntry)}
        aria-label={`${setName} spatial Artifact field`}
        aria-describedby={`artifact-field-instructions-${setId}`}
        data-spatial-history-revision={historyRevision}
        onKeyDown={(event) => {
          if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== 'z') return;
          event.preventDefault();
          if (event.shiftKey) redoSpatialMove(); else undoSpatialMove();
        }}
        onScroll={(event) => {
          const viewport = event.currentTarget;
          setSession((current) => setCreatorCamera(current, {
            ...current.camera,
            x: viewport.scrollLeft / current.camera.zoom,
            y: viewport.scrollTop / current.camera.zoom,
          }));
        }}
      >
        <div className={styles.artifactWorldSizer} style={{ width: layout.width * session.camera.zoom, height: layout.height * session.camera.zoom }}>
          <div className={styles.artifactWorld} style={{ width: layout.width, height: layout.height, transform: `scale(${session.camera.zoom})` }}>
            {!focusedEntry && organization.arrangement !== 'manual' && organization.groupBy !== 'none' ? layout.groups.map((group) => (
              <div key={group.label} className={styles.artifactGroupLabel} style={{ top: group.y }}><strong>{group.label}</strong><span>{group.count}</span></div>
            )) : null}
            {projectedEntries.map((entry) => {
              const artifactId = entry.identity.artifactId;
              const card = cardById.get(artifactId);
              const position = dragPreview[artifactId] ?? entry.position;
              const selected = session.selection.includes(artifactId);
              if (!card) return null;
              return (
                <button
                  id={`spatial-artifact-${artifactId}`}
                  key={artifactId}
                  type="button"
                  className={styles.cardButton}
                  style={{ left: position.x, top: position.y, width: entry.width, minHeight: entry.height }}
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
                  onDoubleClick={() => focusedEntry ? onEditArtifact(artifactId) : focusArtifact(artifactId)}
                  onClick={(event) => {
                    if (suppressedClickRef.current === artifactId) { suppressedClickRef.current = null; return; }
                    if (event.shiftKey || event.metaKey || event.ctrlKey) {
                      toggleArtifact(artifactId, event.shiftKey, event.metaKey || event.ctrlKey);
                    } else if (!focusedEntry) focusArtifact(artifactId);
                  }}
                >
                  {useDetailedPreview ? <CardPreview card={card} targetWidthPx={focusedEntry ? 320 : 132} /> : <span className={styles.artifactLodPreview} aria-hidden="true">{entry.index + 1}</span>}
                  <strong>{entry.title}</strong>
                  <span>{entry.subtitle}</span>
                  {organization.groupBy !== 'none' ? <small>{entry.groupLabel}</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
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
    </>
  );
}
