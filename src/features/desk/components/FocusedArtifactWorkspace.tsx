"use client";

import dynamic from 'next/dynamic';
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Navigation, Pencil, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getCardFaceCanvas, type DisplayCard } from '@/domain/rendering';
import { ArtifactSlot, useArtifactFace, useArtifactViewport } from '@/features/card-rendering/client';
import type { ArtifactBrowseDirection } from '../model/focusedArtifactLayout';

import styles from './Desk.module.css';

const CardActions = dynamic(() => import('@/features/card-generator/client/card-actions').then((module) => module.CardActions), { ssr: false });

interface FocusedArtifactWorkspaceProps {
  artifactId: string;
  card: DisplayCard;
  canExportClean: boolean;
  canUseProjectFiles: boolean;
  setName: string;
  title: string;
  subtitle: string;
  availableDirections: Readonly<Record<ArtifactBrowseDirection, boolean>>;
  onBrowse: (direction: ArtifactBrowseDirection) => void;
  onEdit: () => void;
}

const directionForKey = (key: string): ArtifactBrowseDirection | null => (
  key === 'ArrowUp' ? 'up'
    : key === 'ArrowDown' ? 'down'
      : key === 'ArrowLeft' ? 'left'
        : key === 'ArrowRight' ? 'right'
          : null
);

const directionForSwipe = (deltaX: number, deltaY: number): ArtifactBrowseDirection | null => {
  if (Math.hypot(deltaX, deltaY) < 56) return null;
  return Math.abs(deltaX) >= Math.abs(deltaY)
    ? deltaX > 0 ? 'right' : 'left'
    : deltaY > 0 ? 'down' : 'up';
};

export function FocusedArtifactWorkspace({
  artifactId,
  card,
  canExportClean,
  canUseProjectFiles,
  setName,
  title,
  subtitle,
  availableDirections,
  onBrowse,
  onEdit,
}: FocusedArtifactWorkspaceProps) {
  const [face] = useArtifactFace(artifactId);
  const canvas = getCardFaceCanvas(card, face);
  const viewport = useArtifactViewport({
    aspectRatio: canvas ? `${canvas.width}:${canvas.height}` : (face === 'back' ? card.backingTemplate : card.template)?.aspectRatio,
    horizontalPadding: 96,
    maxWidth: 560,
    verticalPadding: 96,
  });
  const swipeRef = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const browse = (direction: ArtifactBrowseDirection) => {
    if (availableDirections[direction]) onBrowse(direction);
  };
  const canStartSwipe = (event: ReactPointerEvent<HTMLDivElement>) => (
    viewport.isAutoFit
    && event.pointerType === 'touch'
    && event.isPrimary
    && event.target instanceof Node
    && event.currentTarget.contains(event.target)
  );
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    viewport.gestures.onPointerDownCapture(event);
    if (event.pointerType === 'touch' && swipeRef.current?.pointerId !== event.pointerId) swipeRef.current = null;
    if (canStartSwipe(event)) swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
  };
  const handlePointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    viewport.gestures.onPointerUpCapture(event);
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    swipeRef.current = null;
    const direction = directionForSwipe(event.clientX - swipe.startX, event.clientY - swipe.startY);
    if (direction) browse(direction);
  };
  const handlePointerCancelCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    viewport.gestures.onPointerCancelCapture(event);
    if (swipeRef.current?.pointerId === event.pointerId) swipeRef.current = null;
  };
  const handleFocusedArtifactKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = directionForKey(event.key);
    if (!direction || !availableDirections[direction]) return;
    event.preventDefault();
    browse(direction);
  };

  return <div className={styles.artifactWorkspace} data-focused-artifact-workspace data-zoom={viewport.zoom.toFixed(2)}>
    <div className={styles.artifactWorkspaceControls} aria-label="Focused Artifact controls">
      <span className={styles.artifactWorkspaceIdentity}><strong>{title}</strong><small>Card · {face === 'back' && card.backingTemplate ? card.backingTemplate.name : subtitle}</small></span>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="ghost" data-artifact-browse aria-label="Browse this Set" title="Browse this Set"><Navigation className="h-4 w-4" aria-hidden="true" /><span className={styles.artifactBrowseLabel}>Browse</span></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className={styles.artifactBrowseMenu} aria-label="Browse this Set">
          <strong>Browse Set</strong>
          <p>Swipe the fitted card or use these directions.</p>
          <div className={styles.artifactBrowseGrid}>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseUp} disabled={!availableDirections.up} onClick={() => browse('up')} aria-label="Open Artifact above"><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseLeft} disabled={!availableDirections.left} onClick={() => browse('left')} aria-label="Open Artifact to the left"><ArrowLeft aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseRight} disabled={!availableDirections.right} onClick={() => browse('right')} aria-label="Open Artifact to the right"><ArrowRight aria-hidden="true" /></Button>
            <Button type="button" size="icon" variant="outline" className={styles.artifactBrowseDown} disabled={!availableDirections.down} onClick={() => browse('down')} aria-label="Open Artifact below"><ArrowDown aria-hidden="true" /></Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button type="button" size="sm" variant="outline" onClick={onEdit} aria-label="Edit Artifact" title="Edit Artifact"><Pencil className="mr-1.5 h-4 w-4" /><span className={styles.artifactEditLabel}>Edit</span></Button>
      <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom - 0.15)} aria-label="Zoom out"><Minus aria-hidden="true" /></Button>
      <span className={styles.artifactZoomValue} aria-live="polite">{Math.round(viewport.zoom * 100)}%</span>
      <Button type="button" size="icon" variant="ghost" onClick={() => viewport.changeZoom(viewport.zoom + 0.15)} aria-label="Zoom in"><Plus aria-hidden="true" /></Button>
      <Button type="button" size="sm" variant="ghost" onClick={viewport.fit}>Fit</Button>
      <CardActions card={card} canExportClean={canExportClean} canUseProjectFiles={canUseProjectFiles} compact />
    </div>
    <div
      ref={viewport.viewportRef}
      tabIndex={-1}
      className={styles.contentStage}
      data-desk-artifact-stage
      data-scene-viewport
      data-artifact-focus-exclusive="false"
      data-artifact-scroll-contained
      data-auto-fit={viewport.isAutoFit ? 'true' : 'false'}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={viewport.gestures.onPointerMoveCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerCancelCapture}
      onClickCapture={viewport.gestures.onClickCapture}
      onContextMenu={viewport.gestures.onContextMenu}
      style={{ overflow: viewport.isAutoFit ? 'hidden' : 'auto', touchAction: 'none' }}
      aria-label={`${setName} focused Artifact viewport`}
      aria-describedby={`focused-artifact-browse-${artifactId}`}
    >
      <p id={`focused-artifact-browse-${artifactId}`} className="sr-only">When this card is fitted, swipe up, down, left, or right to browse the nearby cards in this Set. Arrow keys offer the same navigation while this card is focused. Use the Browse button for visible direction controls.</p>
      <div className={styles.focusedArtifactWorld} style={{ width: viewport.worldWidth, height: viewport.worldHeight }}>
        <div className={styles.focusedArtifactFrame} style={{ width: viewport.visualWidth, minHeight: viewport.visualHeight }} data-card-face={face}>
          <button
            id={`spatial-artifact-${artifactId}`}
            type="button"
            className={styles.focusedArtifactButton}
            data-artifact-id={artifactId}
            data-artifact-type="card"
            data-focused="true"
            aria-label={`${title}. ${subtitle}`}
            onDoubleClick={onEdit}
            onKeyDown={handleFocusedArtifactKey}
          >
            <ArtifactSlot card={card} face={face} width={viewport.visualWidth} depth="focus" flipLabel={title} watermark={!canExportClean} />
            <span className="sr-only">{title}</span>
          </button>
        </div>
      </div>
    </div>
  </div>;
}
