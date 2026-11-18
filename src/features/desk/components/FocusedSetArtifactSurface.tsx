"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { Minus, Plus, Redo2, RefreshCcw, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getSpatialDirectionForKey, type SpatialResolvedPointerStart } from '@/components/ui/spatial-viewport';
import type { ArtifactIdentity, ArtifactPosition } from '@/domain/artifacts';
import type { CardFace, CardSetOrganization } from '@/domain/cards';
import { snapSpatialValue } from '@/domain/spatial';
import { getCardFaceCanvas, getCardPhysicalSizeMm, getCardPreviewLayout, hasCardBacking, type DisplayCard } from '@/domain/rendering';
import {
  focusCreatorArtifact,
  selectCreatorArtifacts,
  setCreatorCamera,
  type CreatorInteractionSession,
} from '@/features/app-shell/client/environment';
import { ArtifactSlot, ArtifactThumbnail, CardPreview, CardWatermarkOverlay, getTemplateAccent, useArtifactFaces } from '@/features/card-rendering/client';
import { SetTemplateObject, type SetTemplateEntry } from '@/features/project/client/ui';
import {
  buildFocusedArtifactLayout,
  DEFAULT_SET_GRID_SIZE_MM,
  getDirectionalArtifactNeighbor,
  getFocusedArtifactFrame,
  getStackCaptionArtifactIds,
  moveFocusedArtifactSelectionResult,
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
  templateEntries: SetTemplateEntry[];
  onDesignTemplate: (templateId: string) => void;
  canExportClean: boolean;
  canUseProjectFiles: boolean;
  groups: Array<[string, DisplayCard[]]>;
  organization: CardSetOrganization;
  session: CreatorInteractionSession;
  setSession: Dispatch<SetStateAction<CreatorInteractionSession>>;
  snapToGrid: boolean;
  touchMultiSelect: boolean;
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
  onMoveTemplates: (positions: Record<string, ArtifactPosition>) => void;
}

type ClientPoint = { clientX: number; clientY: number };

const renderTemplatePreview = (card: DisplayCard, face: CardFace, targetWidthPx: number) => <CardPreview card={card} face={face} targetWidthPx={targetWidthPx} />;

const ArtifactTileVisual = memo(function ArtifactTileVisual({ card, face, setId, width, height, fullPreview, showImage, canExportClean, title, groupLabel, showGroupLabel, ordinal }: {
  card: DisplayCard;
  face: CardFace;
  setId: string;
  width: number;
  height: number;
  fullPreview: boolean;
  showImage: boolean;
  canExportClean: boolean;
  title: string;
  groupLabel: string;
  showGroupLabel: boolean;
  ordinal: number;
}) {
  const template = face === 'back' && card.backingTemplate ? card.backingTemplate : card.template;
  return <>
    {fullPreview ? <ArtifactSlot card={card} face={face} width={width} depth="board" setId={setId} watermark={!canExportClean} /> : (
      <span className={styles.artifactLodPreview} data-artifact-thumbnail={card.uniqueId} aria-hidden="true">
        <ArtifactThumbnail card={card} face={face} width={width} height={height} showImage={showImage} />
        {!canExportClean && showImage ? <CardWatermarkOverlay testId={`artifact-thumbnail-watermark-${card.uniqueId}`} /> : null}
        <span className={styles.artifactLodBorder} data-artifact-template-border style={{ borderColor: getTemplateAccent(template.id ?? template.name) }}>
          <span className={styles.artifactLodOrdinal}>{ordinal}</span>
        </span>
      </span>
    )}
    <strong className={styles.artifactTileTitle} title={title}>{title}</strong>
    <span className={styles.cardTemplateLabel} title={`Card from ${template.name}`}>Card · {template.name}</span>
    {showGroupLabel ? <small className={styles.cardGroupLabel} title={groupLabel}>{groupLabel}</small> : null}
  </>;
});

type DragState = {
  kind: 'artifact' | 'template';
  pointerId: number;
  objectId: string;
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
  kind: DragState['kind'];
  before: Record<string, ArtifactPosition>;
  after: Record<string, ArtifactPosition>;
};

const MAX_SPATIAL_HISTORY = 50;
const ARTIFACT_THUMBNAIL_IMAGE_SCREEN_WIDTH = 32;
const TOUCH_ACQUISITION_RADIUS = 24;
const TOUCH_DIRECT_TARGET_MIN = 32;
const TOUCH_AMBIGUITY_DISTANCE = 7;
const TOUCH_CLARITY_SEPARATION = 44;

const identityFor = (setId: string, card: DisplayCard): ArtifactIdentity => ({
  artifactId: card.uniqueId,
  artifactType: 'card',
  setId,
});

export function FocusedSetArtifactSurface({
  setId,
  setName,
  allCards,
  templateEntries,
  onDesignTemplate,
  canExportClean,
  canUseProjectFiles,
  groups,
  organization,
  session,
  setSession,
  snapToGrid,
  touchMultiSelect,
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
  onMoveTemplates,
}: FocusedSetArtifactSurfaceProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const suppressedClickRef = useRef<string | null>(null);
  const suppressedTemplateClickRef = useRef<string | null>(null);
  const lastArtifactPointerTypeRef = useRef<string | null>(null);
  const touchTapRef = useRef<{ artifactId: string; x: number; y: number; at: number } | null>(null);
  const navigatorReturnArtifactIdRef = useRef<string | null>(null);
  const pendingSpatialFocusIdRef = useRef<string | null>(null);
  const previousArtifactFocusIdRef = useRef<string | null>(session.focusPath.artifactId);
  const undoStackRef = useRef<SpatialHistoryEntry[]>([]);
  const redoStackRef = useRef<SpatialHistoryEntry[]>([]);
  const edgePanFrameRef = useRef<number | null>(null);
  const edgePanLastTimeRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 520 });
  const [dragPreview, setDragPreview] = useState<Record<string, ArtifactPosition>>({});
  const [templateDragPreview, setTemplateDragPreview] = useState<Record<string, ArtifactPosition>>({});
  const [navigatorFocusId, setNavigatorFocusId] = useState<string | null>(null);
  const [faces, setFace] = useArtifactFaces();
  const [historyRevision, setHistoryRevision] = useState(0);
  const marqueeRef = useRef<{ start: ArtifactPosition; pointerId: number; additive: string[] } | null>(null);
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
      showGroupLabel: organization.arrangement === 'manual' && organization.groupBy !== 'none',
      position: organization.positions[card.uniqueId],
      physicalSizeMm: getCardPhysicalSizeMm(card),
    })),
  })), [cardIndexById, groups, organization.arrangement, organization.groupBy, organization.positions, setId]);

  const layout = useMemo(() => buildFocusedArtifactLayout({
    arrangement: organization.arrangement,
    groups: layoutGroups,
    minimumWidth: 160,
    minimumHeight: 120,
  }), [layoutGroups, organization.arrangement]);
  const templateLayout = useMemo(() => {
    const sized = templateEntries.map((entry) => {
      const physical = getCardPhysicalSizeMm({ ...entry.sample, template: entry.template });
      const width = (physical.widthMm + 18) * Math.SQRT2;
      const previewWidth = width - 16;
      const preview = getCardPreviewLayout({ targetWidthPx: previewWidth, aspectRatio: entry.template.aspectRatio, canvas: getCardFaceCanvas(entry.sample, entry.face), isPrintMode: false });
      return { entry, width, height: preview.visualHeightPx + 68, previewWidth };
    });
    const columns = Math.min(3, Math.ceil(Math.sqrt(sized.length)));
    const columnWidth = Math.max(0, ...sized.map((item) => item.width)) + 14;
    const rowHeight = Math.max(0, ...sized.map((item) => item.height)) + 14;
    return sized.map((item, index) => ({
      ...item,
      ...(organization.templatePositions?.[item.entry.template.id!] ?? {
        x: layout.bounds.x - columns * columnWidth - 24 + index % columns * columnWidth,
        y: layout.bounds.y + Math.floor(index / columns) * rowHeight,
      }),
    }));
  }, [templateEntries, layout.bounds.x, layout.bounds.y, organization.templatePositions]);
  const sceneLayout = useMemo(() => {
    if (!templateLayout.length) return layout;
    const rects = [...templateLayout, ...(layout.entries.length ? [layout.bounds] : [])];
    const x = Math.min(...rects.map((rect) => rect.x));
    const y = Math.min(...rects.map((rect) => rect.y));
    return { ...layout, bounds: { x, y, width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x, height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y } };
  }, [layout, templateLayout]);
  const entryById = useMemo(() => new Map(layout.entries.map((entry) => [entry.identity.artifactId, entry])), [layout.entries]);
  const workFrame = useMemo(() => getFocusedArtifactFrame({
    layout: sceneLayout,
    entries: layout.entries,
    additionalBounds: templateLayout,
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    includeGroupLabels: organization.arrangement !== 'manual' && organization.groupBy !== 'none',
  }), [layout, sceneLayout, templateLayout, organization.arrangement, organization.groupBy, viewportSize.height, viewportSize.width]);
  const wholeFrame = useMemo(() => getFocusedArtifactFrame({
    layout: sceneLayout,
    entries: [],
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    padding: 24,
  }), [sceneLayout, viewportSize.height, viewportSize.width]);
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
      if (drag.kind === 'template') suppressedTemplateClickRef.current = drag.objectId;
      setSession((current) => setCreatorCamera(current, drag.startCamera.camera));
    }
    dragRef.current = null;
    marqueeRef.current = null;
    setDragPreview({});
    setTemplateDragPreview({});
    setMarquee(null);
  }, [setSession, stopEdgePan]);

  const setCamera = useCallback((next: { x: number; y: number; zoom: number }) => {
    setSession((current) => setCreatorCamera(current, next));
  }, [setSession]);

  const cameraApiRef = useRef<ReturnType<typeof useSetSpatialCamera> | null>(null);
  const resolvePointerTarget = (point: ClientPoint, event: ReactPointerEvent<HTMLDivElement>) => {
    lastArtifactPointerTypeRef.current = event.pointerType;
    if (event.pointerType === 'mouse') return null;
    const templateTarget = (event.target as HTMLElement).closest<HTMLElement>('button[data-set-template]');
    if (templateTarget) return { target: templateTarget, allowHold: true, onTap: () => {
      templateTarget.focus({ preventScroll: true });
      onDesignTemplate(templateTarget.dataset.setTemplate!);
    } };
    if (event.pointerType !== 'touch') return null;
    const stage = viewportRef.current;
    if (!stage) return null;
    const directTarget = (event.target as HTMLElement).closest<HTMLElement>('button[data-artifact-id]');
    if (directTarget) {
      const directRect = directTarget.getBoundingClientRect();
      if (Math.min(directRect.width, directRect.height) >= TOUCH_DIRECT_TARGET_MIN) return null;
    }
    const candidates = Array.from(stage.querySelectorAll<HTMLElement>('button[data-artifact-id][data-viewport-visible="true"]')).flatMap((target) => {
      const rect = target.getBoundingClientRect();
      const dx = point.clientX < rect.left ? rect.left - point.clientX : point.clientX > rect.right ? point.clientX - rect.right : 0;
      const dy = point.clientY < rect.top ? rect.top - point.clientY : point.clientY > rect.bottom ? point.clientY - rect.bottom : 0;
      const distance = Math.hypot(dx, dy);
      if (distance > TOUCH_ACQUISITION_RADIUS) return [];
      return [{ target, rect, distance }];
    }).sort((left, right) => left.distance - right.distance);
    const nearest = candidates[0];
    if (!nearest) return null;

    const ambiguous = candidates.filter((candidate) => candidate.distance <= nearest.distance + TOUCH_AMBIGUITY_DISTANCE);
    if (ambiguous.length > 1) {
      let minimumSeparation = Number.POSITIVE_INFINITY;
      for (let left = 0; left < ambiguous.length; left += 1) {
        for (let right = left + 1; right < ambiguous.length; right += 1) {
          const a = ambiguous[left]!.rect;
          const b = ambiguous[right]!.rect;
          minimumSeparation = Math.min(minimumSeparation, Math.hypot(
            (a.left + a.width / 2) - (b.left + b.width / 2),
            (a.top + a.height / 2) - (b.top + b.height / 2),
          ));
        }
      }
      if (minimumSeparation < TOUCH_CLARITY_SEPARATION) {
        const multiplier = Math.min(1.8, Math.max(1.2, TOUCH_CLARITY_SEPARATION / Math.max(8, minimumSeparation)));
        return {
          allowHold: false,
          onTap: () => {
            touchTapRef.current = null;
            const cameraApi = cameraApiRef.current;
            if (cameraApi) cameraApi.changeZoom(cameraApi.camera.zoom * multiplier, point);
          },
        };
      }
    }

    const artifactId = nearest.target.dataset.artifactId;
    const range = event.shiftKey;
    const additive = event.metaKey || event.ctrlKey || touchMultiSelect;
    return {
      target: nearest.target,
      allowHold: true,
      onTap: (at: number) => {
        if (artifactId) handleTouchTap(artifactId, point, range, additive, at);
      },
    };
  };
  const onResolvedPointerDown = (target: HTMLElement, event: SpatialResolvedPointerStart) => {
    const templateId = target.dataset.setTemplate;
    if (templateId) {
      beginSpatialMoveFromPointer('template', templateId, event, target);
      return;
    }
    const artifactId = target.dataset.artifactId;
    const entry = artifactId ? entryById.get(artifactId) : null;
    if (entry) beginSpatialMoveFromPointer('artifact', entry.identity.artifactId, event, target);
  };

  const beginMarquee = (point: ClientPoint, pointerId: number, viewport: HTMLDivElement, additive: string[] = []) => {
    const camera = cameraApiRef.current;
    if (!camera) return;
    camera.enterCustom();
    marqueeRef.current = { start: camera.projectClientPoint(point), pointerId, additive };
    viewport.setPointerCapture(pointerId);
  };

  const camera = useSetSpatialCamera({
    resetKey: setId,
    disabled: Boolean(artifactFocusId),
    viewportRef,
    viewport: viewportSize,
    camera: session.camera,
    wholeBounds: sceneLayout.bounds,
    wholeFrame,
    workFrame,
    selectionFrame,
    hasSelection: visibleSelectionEntries.length > 0,
    onCameraChange: setCamera,
    onCancelDrag: cancelActiveSpatialGesture,
    resolvePointerTarget,
    onResolvedPointerDown,
    onEmptySpaceHold: beginMarquee,
  });
  cameraApiRef.current = camera;

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
  const selectionAnchorId = selectionAnchorRef.current ?? session.selection[0];
  const selectedArtifactIds = new Set(session.selection);
  const stackCaptionIds = organization.arrangement === 'stack'
    ? getStackCaptionArtifactIds(layout.entries, (id) => (
      dragPreview[id] ? 3 : selectedArtifactIds.has(id) ? (id === selectionAnchorId ? 2 : 1) : 0
    ))
    : null;
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
    touchTapRef.current = null;
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

  function handleTouchTap(
    artifactId: string,
    point: { clientX: number; clientY: number },
    range: boolean,
    additive: boolean,
    at: number,
  ) {
    if (touchMultiSelect) {
      touchTapRef.current = null;
      toggleArtifact(artifactId, false, true);
      return;
    }
    const previous = touchTapRef.current;
    if (
      previous
      && previous.artifactId === artifactId
      && at - previous.at <= 360
      && Math.hypot(point.clientX - previous.x, point.clientY - previous.y) <= 28
    ) {
      touchTapRef.current = null;
      focusArtifact(artifactId);
      return;
    }
    toggleArtifact(artifactId, range, additive);
    touchTapRef.current = { artifactId, x: point.clientX, y: point.clientY, at };
  }

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
    objectIds: readonly string[],
    kind: DragState['kind'] = 'artifact',
  ) => {
    const before = Object.fromEntries(objectIds.flatMap((id) => {
      const template = kind === 'template' ? templateLayout.find((item) => item.entry.template.id === id) : null;
      const position = template ? { x: template.x, y: template.y } : kind === 'artifact' ? entryById.get(id)?.position : null;
      return position ? [[id, position] as const] : [];
    }));
    const historyAfter = Object.fromEntries(objectIds.flatMap((id) => (
      after[id] ? [[id, after[id]] as const] : []
    )));
    if (Object.keys(before).length === 0 || Object.keys(historyAfter).length === 0) return;
    undoStackRef.current = [...undoStackRef.current.slice(-(MAX_SPATIAL_HISTORY - 1)), {
      kind,
      before,
      after: historyAfter,
    }];
    redoStackRef.current = [];
    setHistoryRevision((current) => current + 1);
    if (kind === 'template') onMoveTemplates(after);
    else onMoveArtifacts(organization.arrangement === 'manual' ? after : {
      ...Object.fromEntries(layout.entries.map((entry) => [entry.identity.artifactId, entry.position])),
      ...after,
    });
  };

  const undoSpatialMove = () => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(entry);
    (entry.kind === 'template' ? onMoveTemplates : onMoveArtifacts)(entry.before);
    setHistoryRevision((current) => current + 1);
  };

  const redoSpatialMove = () => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(entry);
    (entry.kind === 'template' ? onMoveTemplates : onMoveArtifacts)(entry.after);
    setHistoryRevision((current) => current + 1);
  };

  const nudgeSelection = (artifactId: string, delta: ArtifactPosition) => {
    const selectedIds = session.selection.includes(artifactId) ? session.selection : [artifactId];
    updateSelection(selectedIds);
    const moved = moveFocusedArtifactSelectionResult({
      entries: layout.entries,
      selectedIds,
      delta,
      snapToGrid,
      gridStep: organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM,
    });
    commitSpatialMove(moved.positions, moved.affectedIds);
  };

  const processSpatialDrag = useCallback((drag: DragState, point: ClientPoint) => {
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
    if (!drag.moved) {
      camera.enterCustom();
      if (drag.kind === 'artifact' && !session.selection.includes(drag.objectId)) updateSelection(drag.selectedIds);
    }
    drag.moved = true;
    if (drag.kind === 'template') {
      const origin = templateLayout.find((item) => item.entry.template.id === drag.objectId);
      if (!origin) return false;
      const step = organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM;
      const snap = (value: number) => snapToGrid ? snapSpatialValue(value, 0, step) : Math.round(value * 1000) / 1000;
      drag.latestPositions = { [drag.objectId]: { x: snap(origin.x + delta.x), y: snap(origin.y + delta.y) } };
      setTemplateDragPreview(drag.latestPositions);
      return true;
    }
    const moved = moveFocusedArtifactSelectionResult({
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
  }, [camera, layout.entries, organization.gridSizeMm, session.selection, snapToGrid, templateLayout, updateSelection]);

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
      processSpatialDrag(drag, drag.latestClient);
      edgePanFrameRef.current = requestAnimationFrame(tick);
    };
    edgePanFrameRef.current = requestAnimationFrame(tick);
  }, [camera, processSpatialDrag]);

  function beginSpatialMoveFromPointer(
    kind: DragState['kind'],
    objectId: string,
    event: Pick<ReactPointerEvent<HTMLElement>, 'button' | 'pointerId' | 'clientX' | 'clientY' | 'shiftKey' | 'metaKey' | 'ctrlKey'>,
    target: HTMLElement,
  ) {
    if (event.button !== 0) return;
    const startCamera = camera.capture();
    suppressedClickRef.current = null;
    suppressedTemplateClickRef.current = null;
    if (kind === 'artifact') selectionAnchorRef.current = objectId;
    const selectedIds = kind === 'artifact' && session.selection.includes(objectId) ? session.selection : [objectId];
    const point = { clientX: event.clientX, clientY: event.clientY };
    dragRef.current = {
      kind,
      pointerId: event.pointerId,
      objectId,
      startClient: point,
      latestClient: point,
      startWorld: camera.projectClientPoint(point),
      selectedIds,
      moved: false,
      latestPositions: {},
      latestAffectedIds: selectedIds,
      startCamera,
    };
    target.setPointerCapture(event.pointerId);
  }

  const beginArtifactMove = (entry: FocusedArtifactLayoutEntry, event: ReactPointerEvent<HTMLButtonElement>) => {
    lastArtifactPointerTypeRef.current = event.pointerType;
    beginSpatialMoveFromPointer('artifact', entry.identity.artifactId, event, event.currentTarget);
  };

  const moveSpatialObject = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.latestClient = { clientX: event.clientX, clientY: event.clientY };
    if (!processSpatialDrag(drag, drag.latestClient)) return;
    event.preventDefault();
    ensureEdgePanLoop();
  };

  const endSpatialMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    stopEdgePan();
    dragRef.current = null;
    if (drag.kind === 'template') {
      if (drag.moved || event.pointerType === 'touch') suppressedTemplateClickRef.current = drag.objectId;
      if (drag.moved) commitSpatialMove(drag.latestPositions, drag.latestAffectedIds, 'template');
      setTemplateDragPreview({});
      return;
    }
    if (drag.moved) {
      touchTapRef.current = null;
      suppressedClickRef.current = drag.objectId;
      commitSpatialMove(drag.latestPositions, drag.latestAffectedIds);
    } else if (event.pointerType === 'touch') {
      // Touch UAs synthesize click after pointerup, and that click can arrive
      // after the Set rerenders. Commit the tap selection here and suppress the
      // synthetic click so it cannot toggle the same Artifact back off.
      handleTouchTap(
        drag.objectId,
        { clientX: event.clientX, clientY: event.clientY },
        event.shiftKey,
        event.metaKey || event.ctrlKey || touchMultiSelect,
        event.timeStamp,
      );
      suppressedClickRef.current = drag.objectId;
    }
    setDragPreview({});
  };

  const cancelSpatialMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    stopEdgePan();
    touchTapRef.current = null;
    dragRef.current = null;
    camera.restore(drag.startCamera);
    if (drag.kind === 'template') suppressedTemplateClickRef.current = drag.objectId;
    setDragPreview({});
    setTemplateDragPreview({});
  };

  const handleTemplateKey = (templateId: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const direction = getSpatialDirectionForKey(event.key);
    const origin = templateLayout.find((item) => item.entry.template.id === templateId);
    if (!direction || !origin) return;
    event.preventDefault();
    camera.enterCustom();
    const step = organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM;
    const amount = (event.shiftKey ? 5 : 1) * (snapToGrid ? step : 1);
    const snap = (value: number) => snapToGrid ? snapSpatialValue(value, 0, step) : value;
    commitSpatialMove({ [templateId]: {
      x: snap(origin.x + (direction === 'left' ? -amount : direction === 'right' ? amount : 0)),
      y: snap(origin.y + (direction === 'up' ? -amount : direction === 'down' ? amount : 0)),
    } }, [templateId], 'template');
  };

  const handleArtifactKey = (artifactId: string, event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const amount = event.shiftKey ? (organization.gridSizeMm ?? DEFAULT_SET_GRID_SIZE_MM) : 1;
    const key = event.key.length === 1 ? event.key.toLocaleLowerCase() : event.key;
    const delta = key === 'ArrowLeft' || key === 'a' ? { x: -amount, y: 0 }
      : key === 'ArrowRight' || key === 'd' ? { x: amount, y: 0 }
        : key === 'ArrowUp' || key === 'w' ? { x: 0, y: -amount }
          : key === 'ArrowDown' || key === 's' ? { x: 0, y: amount }
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
    if (marqueeRef.current?.pointerId !== event.pointerId) return null;
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
      <p id={`artifact-field-instructions-${setId}`} className="sr-only">Drag empty space immediately to pan and pinch to zoom. Hold empty space, then drag to select multiple cards. Tap or click a card to select it; use Quick Actions Select Multiple on touch to add or remove cards without replacing the selection. Double tap, double click, or press Enter to focus it when Select Multiple is off. Hold a card then drag to move it. With a mouse, Shift-drag empty space to draw a selection. Moving a card switches to Freeform. Use Tab to reach visible Artifacts and Arrow or WASD keys to move selected Artifacts; hold Shift for a larger step. Open the ordered Artifact navigator to reach every Artifact, including those outside the camera.</p>
      <p id={`template-movement-${setId}`} className="sr-only">Click, tap, or press Enter to design a Template. Drag to move it; on touch, hold before dragging. Arrow or WASD keys move the focused Template; Shift takes a larger step. Escape cancels a move. Templates move independently of Artifacts.</p>
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
          if (event.button !== 0 || event.pointerType === 'touch' || !event.shiftKey || (event.target as HTMLElement).closest('button')) return;
          beginMarquee(event, event.pointerId, event.currentTarget, session.selection);
        }}
        onPointerMove={(event) => { const rect = selectionRect(event); if (rect) setMarquee(rect); }}
        onPointerUp={(event) => {
          const rect = selectionRect(event), state = marqueeRef.current;
          if (!rect || !state) return;
          marqueeRef.current = null;
          setMarquee(null);
          if (Math.hypot(rect.width, rect.height) * camera.camera.zoom < 6) return;
          const hits = layout.entries.filter((entry) => entry.position.x < rect.x + rect.width && entry.position.x + entry.width > rect.x && entry.position.y < rect.y + rect.height && entry.position.y + entry.height > rect.y).map((entry) => entry.identity.artifactId);
          updateSelection([...new Set([...state.additive, ...hits])]);
        }}
        onPointerCancel={cancelActiveSpatialGesture}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && dragRef.current) {
            event.preventDefault();
            cancelActiveSpatialGesture();
            return;
          }
          if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase() !== 'z') return;
          event.preventDefault();
          if (event.shiftKey) redoSpatialMove(); else undoSpatialMove();
        }}
      >
        <div className={styles.artifactWorldSizer} style={{ width: viewportSize.width, height: viewportSize.height }}>
          <div data-artifact-world className={styles.artifactWorld} style={{ left: 0, top: 0, width: 1, height: 1, transform: `translate(${camera.offsetX}px, ${camera.offsetY}px) scale(${camera.camera.zoom})` }}>
            {templateLayout.map(({ entry, x, y, width, height, previewWidth }) => {
              const templateId = entry.template.id!;
              const position = templateDragPreview[templateId] ?? { x, y };
              const visible = position.x + width >= camera.camera.x - viewportSize.width / camera.camera.zoom / 2
                && position.x <= camera.camera.x + viewportSize.width / camera.camera.zoom / 2
                && position.y + height >= camera.camera.y - viewportSize.height / camera.camera.zoom / 2
                && position.y <= camera.camera.y + viewportSize.height / camera.camera.zoom / 2;
              return <SetTemplateObject key={entry.template.id} id={`set-template-field-${setId}-${entry.template.id}`} entry={entry}
                className={styles.setTemplateObject} style={{ left: position.x, top: position.y, width, height }} tabIndex={visible ? 0 : -1}
                interaction={{
                  'aria-describedby': `template-movement-${setId}`,
                  onPointerDown: (event) => beginSpatialMoveFromPointer('template', templateId, event, event.currentTarget),
                  onPointerMove: moveSpatialObject, onPointerUp: endSpatialMove,
                  onPointerCancel: cancelSpatialMove, onLostPointerCapture: cancelSpatialMove,
                  onKeyDown: (event) => handleTemplateKey(templateId, event),
                }}
                onDesign={(id) => {
                  if (suppressedTemplateClickRef.current === id) { suppressedTemplateClickRef.current = null; return; }
                  onDesignTemplate(id);
                }} accent={getTemplateAccent(templateId)} previewWidth={previewWidth}
                showPreview={visible} renderPreview={renderTemplatePreview} />;
            })}
            {marquee ? <span data-artifact-marquee className={styles.deskMarquee} style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} aria-hidden="true" /> : null}
            {organization.arrangement !== 'manual' && organization.groupBy !== 'none' ? layout.groups.map((group) => (
              <div key={group.label} data-artifact-group-label className={styles.artifactGroupLabel} style={{ left: group.x, top: group.y, width: group.width, height: group.height }}><strong title={group.label}>{group.label}</strong><span>{group.count}</span></div>
            )) : null}
            {projectedEntries.map((entry) => {
              const artifactId = entry.identity.artifactId;
              const card = cardById.get(artifactId);
              const position = dragPreview[artifactId] ?? entry.position;
              const selected = selectedArtifactIds.has(artifactId);
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
                  data-selection-anchor={selected && selectionAnchorId === artifactId ? 'true' : 'false'}
                  data-caption-visible={!stackCaptionIds || stackCaptionIds.has(artifactId) ? 'true' : 'false'}
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
                  onPointerMove={moveSpatialObject}
                  onPointerUp={endSpatialMove}
                  onPointerCancel={cancelSpatialMove}
                  onLostPointerCapture={cancelSpatialMove}
                  onKeyDown={(event) => handleArtifactKey(artifactId, event)}
                  onDoubleClick={() => {
                    if (lastArtifactPointerTypeRef.current !== 'touch') focusArtifact(artifactId);
                  }}
                  onClick={(event) => {
                    if (suppressedClickRef.current === artifactId) { suppressedClickRef.current = null; return; }
                    const touch = lastArtifactPointerTypeRef.current === 'touch';
                    toggleArtifact(artifactId, event.shiftKey, event.metaKey || event.ctrlKey || (touch && touchMultiSelect));
                  }}
                >
                  <ArtifactTileVisual card={card} face={face} setId={setId} width={previewWidth} height={previewHeight}
                    fullPreview={useFullPreview || artifactId === artifactFocusId} showImage={showThumbnailImage}
                    canExportClean={canExportClean} title={entry.title} groupLabel={entry.groupLabel}
                    showGroupLabel={organization.groupBy !== 'none'} ordinal={entry.index + 1} />
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
        <Button type="button" size="icon" variant="ghost" disabled={undoStackRef.current.length === 0} onClick={undoSpatialMove} aria-label="Undo spatial move"><Undo2 aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" disabled={redoStackRef.current.length === 0} onClick={redoSpatialMove} aria-label="Redo spatial move"><Redo2 aria-hidden="true" /></Button>
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
